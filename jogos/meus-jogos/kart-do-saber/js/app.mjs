import { createRace, fillBots, makePlayer, setInput, stepRace, ranking, TRACK_LENGTH, nextQuestion, CHARACTERS, COLORS, normalizeAvatar } from "./core.mjs";
import { lessonForDate, topicForSubject } from "./schedule.mjs";
import { MAPS } from "./track.mjs";

const $ = id => document.getElementById(id);
const avatarIcon = p => p.avatar === "girl" ? "👧" : "👦";
const api = new URL("../api/", import.meta.url);
let view, race = null, playerId = "you", character = 0, mode = "practice", paused = false, resultShown = false;
let network = null, lastPacket = 0, lastFrame = performance.now(), accumulator = 0, uiElapsed = 0, lastQuestion = -1, lastFeedback = -1;
let joinBusy = false, renderingBusy = false, sound = null, joinGeneration = 0, autoJoinStarted = false, requeueRequested = false, profileTimer;
let profileReady = false, avatar = "boy", rosterKey = "";
const keys = new Set(), touches = new Set();
const store = { get(key, fallback) { try { return localStorage.getItem(`kart-saber-${key}`) ?? fallback; } catch { return fallback; } }, set(key, value) { try { localStorage.setItem(`kart-saber-${key}`, value); } catch { /* Private mode still permits playing. */ } } };
$("nickname").value = store.get("name", "");
$("profile-name").value = $("nickname").value;
let activeLesson = lessonForDate();
function syncLesson() {
  activeLesson = lessonForDate();
  const option = document.createElement("option");
  option.value = activeLesson.key;
  option.textContent = `${activeLesson.classId} · ${activeLesson.grade}º ano — ${activeLesson.topic}`;
  $("subject").replaceChildren(option); $("subject").value = activeLesson.key;
  $("lesson-status").textContent = activeLesson.active ? `Horário detectado: ${activeLesson.classId}, ${activeLesson.grade}º ano${activeLesson.teacher ? ` · Prof.ª ${activeLesson.teacher}` : ""}.` : "Fora da grade: treino de revisão do 3º ano disponível.";
}
syncLesson();
$("quality").value = new URL(location.href).searchParams.get("graphics") || store.get("quality", "auto");
if (!$("quality").value) $("quality").value = "auto";

function setCharacter(value) {
  character = value; store.set("character", value);
  document.querySelectorAll("[data-character]").forEach(button => { const selected = Number(button.dataset.character) === value; button.classList.toggle("selected", selected); button.setAttribute("aria-pressed", String(selected)); });
}
setCharacter(Math.max(0, Math.min(3, Number(store.get("character", 0)) || 0)));
document.querySelectorAll("[data-character]").forEach(button => button.addEventListener("click", () => { setCharacter(Number(button.dataset.character)); scheduleProfile(); }));
function updateProfileSummary() { $("profile-display-name").textContent = $("nickname").value.trim() || "Piloto"; $("profile-avatar").textContent = avatarIcon({ avatar }); }
function remember() { store.set("name", $("nickname").value.trim()); store.set("avatar", avatar); updateProfileSummary(); }
function setAvatar(value) {
  avatar = normalizeAvatar(value);
  document.querySelectorAll("[data-avatar]").forEach(button => { const selected = button.dataset.avatar === avatar; button.classList.toggle("selected", selected); button.setAttribute("aria-pressed", String(selected)); });
}
setAvatar(store.get("avatar", "boy")); updateProfileSummary();
document.querySelectorAll("[data-avatar]").forEach(button => button.addEventListener("click", () => setAvatar(button.dataset.avatar)));
setInterval(() => { if (!race && !network) syncLesson(); }, 30_000);
$("profile-name").addEventListener("input", () => $("profile-name").setCustomValidity(""));
$("profile-form").addEventListener("submit", event => {
  event.preventDefault();
  const name = $("profile-name").value.trim();
  if (!name) { $("profile-name").setCustomValidity("Digite seu nome ou apelido para a turma reconhecer você."); $("profile-name").reportValidity(); return; }
  if (!view) return;
  $("nickname").value = name; remember(); profileReady = true; autoJoinStarted = true;
  $("profile-screen").hidden = true; $("menu").hidden = false; prepareAudio(); join();
});
$("edit-pilot").addEventListener("click", () => {
  home(false); profileReady = false; autoJoinStarted = false; requeueRequested = false;
  $("profile-name").value = $("nickname").value; $("menu").hidden = true; $("profile-screen").hidden = false; $("profile-name").focus();
});
function closeDialogs() { document.querySelectorAll("dialog[open]").forEach(dialog => dialog.close()); }
function stopSpeech() { if ("speechSynthesis" in window) speechSynthesis.cancel(); }
function formatTime(seconds) { if (seconds == null) return "—"; const s = Math.max(0, Math.floor(seconds)); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; }
function prepareAudio() { try { const Audio = window.AudioContext || window.webkitAudioContext; if (Audio && !sound) sound = new Audio(); if (sound?.state === "suspended") sound.resume().catch(() => {}); } catch { /* Audio is optional. */ } }
function chime(correct) {
  if (!sound || sound.state !== "running") return;
  const now = sound.currentTime;
  (correct ? [523, 659, 784] : [349, 392]).forEach((frequency, i) => {
    const oscillator = sound.createOscillator(), gain = sound.createGain(); oscillator.type = "sine"; oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, now + i * .09); gain.gain.linearRampToValueAtTime(.035, now + i * .09 + .02); gain.gain.exponentialRampToValueAtTime(.001, now + i * .09 + .24);
    oscillator.connect(gain); gain.connect(sound.destination); oscillator.start(now + i * .09); oscillator.stop(now + i * .09 + .25);
  });
}
function showFatal(error) { $("fatal-message").textContent = error.message || String(error); $("fatal").hidden = false; }
async function initGraphics() {
  if (renderingBusy) return;
  renderingBusy = true; $("profile-continue").disabled = $("practice").disabled = $("online").disabled = true;
  $("graphics-status").textContent = "Preparando a ilha…";
  try {
    const { createView } = await import("./renderer.mjs");
    view?.dispose(); view = null;
    view = createView($("world"), $("quality").value);
    $("fatal").hidden = true;
    if (!$("pause-dialog").open) paused = false;
    $("graphics-status").textContent = view.version === 1 ? "● Modo leve ativo · WebGL 1 · pronto para a aventura" : "● WebGL 2 ativo · qualidade ajustada automaticamente";
    if ($("quality").value === "full" && view.version === 1) $("graphics-status").textContent = "WebGL 2 indisponível. O modo leve foi ativado automaticamente.";
    $("profile-continue").disabled = $("practice").disabled = false; $("online").disabled = Boolean(network || joinBusy);
    if (profileReady && !autoJoinStarted) { autoJoinStarted = true; join(); }
  } catch (error) { showFatal(error); }
  finally { renderingBusy = false; }
}
$("quality").addEventListener("change", () => { store.set("quality", $("quality").value); initGraphics(); });
$("retry-light").addEventListener("click", () => { $("quality").value = "light"; store.set("quality", "light"); initGraphics(); });
$("world").addEventListener("graphicslost", () => { paused = true; showFatal(new Error("A conexão com a placa gráfica foi interrompida. Recarregue a página para voltar à corrida ou tente o modo leve.")); });

function beginRace(state, id, raceMode) {
  race = state; playerId = id; mode = raceMode; paused = false; resultShown = false;
  accumulator = 0; lastQuestion = lastFeedback = -1; rosterKey = ""; keys.clear(); touches.clear();
  $("menu").hidden = true; $("hud").hidden = false; $("feedback").hidden = true; closeDialogs(); stopSpeech();
  $("progress-fill").style.width = "0%";
  const mapName = MAPS[state.mapId === 1 ? 1 : 0].name;
  $("race-map-name").textContent = mapName.toUpperCase();
  $("world").setAttribute("aria-label", `Pista tridimensional: ${mapName}`);
  document.title = `Kart do Saber · ${mapName}`;
  $("queue-panel").hidden = true;
}
function practice() {
  if (!view || !profileReady) return;
  leaveNetwork(); remember(); prepareAudio();
  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  const players = fillBots([makePlayer("you", $("nickname").value || CHARACTERS[character], character, false, avatar)]);
  const mapId = Number(store.get("next-map", "0")) === 1 ? 1 : 0;
  store.set("next-map", String(1 - mapId));
  beginRace(createRace(players, $("subject").value, seed, mapId), "you", "practice");
}
$("practice").addEventListener("click", practice);
$("how-to").addEventListener("click", () => $("help-dialog").showModal());
document.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => button.closest("dialog").close()));
$("online").addEventListener("click", () => join());

async function request(route, data, token) {
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(new URL(route, api), { method: data === undefined ? "GET" : "POST", headers: { ...(data === undefined ? {} : { "Content-Type": "application/json" }), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: data === undefined ? undefined : JSON.stringify(data), signal: controller.signal, cache: "no-store" });
    let result; try { result = await res.json(); } catch { throw new Error("Abra o jogo pelo servidor de partidas (porta 4180). Esta página oferece apenas treino."); }
    if (!res.ok) throw new Error(result.error || "O servidor não respondeu. Tente novamente."); return result;
  } finally { clearTimeout(timeout); }
}
function leaveNetwork() {
  joinGeneration++;
  const connection = network; network = null;
  $("queue-panel").hidden = true; $("island-info").hidden = false; $("menu").classList.remove("waiting");
  $("online").disabled = false; $("online-label").textContent = "CORRER COM A TURMA";
  if (!connection) return;
  connection.events.close(); clearInterval(connection.heartbeat);
  fetch(new URL("leave", api), { method: "POST", headers: { Authorization: `Bearer ${connection.token}` }, keepalive: true }).catch(() => {});
}
function lobby(packet) {
  const self = packet.players.find(p => p.id === playerId);
  if (self && self.character !== character) setCharacter(self.character);
  const topic = packet.lesson?.topic || topicForSubject(packet.subject || $("subject").value);
  $("lobby-time").textContent = `${packet.lesson?.classId || "Turma"} · ${topic} · início em ${packet.remaining} segundos`;
  $("queue-count").textContent = `${packet.players.length} / 4`; $("queue-seconds").textContent = packet.remaining;
  $("queue-status").textContent = `Aguardando mais jogadores: ${packet.players.length} de 4 · início em ${packet.remaining}s`;
  $("online-label").textContent = "AGUARDANDO JOGADORES…"; $("menu").classList.add("waiting");
  $("online").disabled = true; $("queue-panel").hidden = false; $("island-info").hidden = true;
  $("lobby-players").replaceChildren();
  for (let i = 0; i < 4; i++) {
    const p = packet.players[i], row = document.createElement("div"); row.className = "lobby-player";
    const label = document.createElement("b"), status = document.createElement("span");
    label.textContent = p ? `${avatarIcon(p)} ${p.name}` : "○ Aguardando piloto…"; status.textContent = p ? p.id === playerId ? "VOCÊ" : "CONECTADO" : "VAGA LIVRE";
    if (p) row.style.borderLeft = `4px solid ${COLORS[p.character]}`;
    row.append(label, status); $("lobby-players").append(row);
  }
}
async function join() {
  if (joinBusy || network || race || !profileReady) return;
  const generation = ++joinGeneration;
  joinBusy = true; $("queue-status").textContent = "Conectando à turma automaticamente…";
  $("online").disabled = true; $("online-label").textContent = "CONECTANDO À TURMA…";
  try {
    const health = await request("health");
    if (health.game !== "kart-do-saber" || health.protocol !== 3) throw new Error("Inicie a versão atualizada do servidor Kart do Saber (porta 4180). O treino está disponível.");
    if (generation !== joinGeneration || race) return;
    remember();
    syncLesson();
    const joined = await request("join", { name: $("nickname").value || CHARACTERS[character], character, avatar, subject: $("subject").value });
    if (generation !== joinGeneration || race) { fetch(new URL("leave", api), { method: "POST", headers: { Authorization: `Bearer ${joined.token}` }, keepalive: true }).catch(() => {}); return; }
    playerId = joined.id; mode = "online"; lastPacket = performance.now();
    const eventsUrl = new URL("events", api); eventsUrl.searchParams.set("token", joined.token);
    const events = new EventSource(eventsUrl);
    network = { ...joined, events, heartbeat: null, sending: false, pending: false, lastSent: "", lastSendTime: 0 };
    const connection = network;
    events.onmessage = event => {
      if (network !== connection) return;
      let packet; try { packet = JSON.parse(event.data); } catch { return; }
      lastPacket = performance.now();
      if (packet.status === "waiting") lobby(packet);
      else if (packet.race) {
        if (!race || $("menu").hidden === false) beginRace(packet.race, joined.id, "online");
        else race = packet.race;
      }
    };
    events.onerror = () => { if (network === connection && !race) $("lobby-time").textContent = "Tentando reconectar à turma…"; };
    connection.heartbeat = setInterval(() => {
      if (network !== connection) return;
      if (performance.now() - lastPacket > 12_000) {
        home(false); $("queue-status").textContent = "Conexão perdida. Um bot assumiu seu kart. Clique em correr para tentar de novo."; return;
      }
      sendInput(true);
    }, 1000);
    lobby({ subject: joined.subject, players: [{ id: joined.id, name: $("nickname").value || CHARACTERS[character], character, avatar }], remaining: 20 });
  } catch (error) {
    if (generation === joinGeneration) $("queue-status").textContent = error.name === "AbortError" || error instanceof TypeError ? "Servidor indisponível. Você pode treinar com bots ou tentar conectar novamente." : error.message;
  } finally {
    joinBusy = false;
    if (!network) { $("online").disabled = false; $("online-label").textContent = "CORRER COM A TURMA"; }
    if (requeueRequested && !race) { requeueRequested = false; join(); }
  }
}
function scheduleProfile() {
  clearTimeout(profileTimer);
  profileTimer = setTimeout(async () => {
    remember(); const connection = network; if (!connection || race) return;
    try { await request("profile", { name: $("nickname").value || CHARACTERS[character], character, avatar }, connection.token); } catch { /* Starting a race takes precedence over a profile edit. */ }
  }, 250);
}
$("nickname").addEventListener("input", scheduleProfile);
$("subject").addEventListener("change", () => {
  remember(); if (race) return;
  leaveNetwork();
  if (joinBusy) requeueRequested = true; else join();
});

function controls() {
  const left = keys.has("arrowleft") || keys.has("a") || touches.has("left");
  const right = keys.has("arrowright") || keys.has("d") || touches.has("right");
  return { steer: Number(right) - Number(left), throttle: keys.has("arrowup") || keys.has("w") || touches.has("throttle"), brake: keys.has("arrowdown") || keys.has("s") || touches.has("brake") };
}
async function sendInput(force = false) {
  const connection = network; if (!connection) return;
  const input = paused ? { steer: 0, throttle: false, brake: true, handbrake: true } : controls(), serialized = JSON.stringify(input);
  if (!force && serialized === connection.lastSent) return;
  if (connection.sending || performance.now() - connection.lastSendTime < 40) { connection.pending = true; return; }
  connection.sending = true; connection.pending = false; connection.lastSent = serialized; connection.lastSendTime = performance.now();
  try { await request("input", input, connection.token); } catch { /* The stream manages reconnection and timeout notices. */ }
  finally { connection.sending = false; }
}
window.addEventListener("keydown", event => {
  if (!race || resultShown) return;
  if (event.key === "Escape") { if (!$("pause-dialog").open) { event.preventDefault(); showPause(); } return; }
  if (paused) return;
  const key = event.key.toLowerCase(); if (!["arrowleft", "arrowright", "arrowup", "arrowdown", "a", "d", "w", "s"].includes(key)) return;
  event.preventDefault(); prepareAudio(); keys.add(key); sendInput();
});
window.addEventListener("keyup", event => { keys.delete(event.key.toLowerCase()); sendInput(); });
function clearControls() { keys.clear(); touches.clear(); sendInput(true); }
window.addEventListener("blur", clearControls);
document.addEventListener("visibilitychange", () => { if (document.hidden) { clearControls(); if (race && mode === "practice" && !resultShown && !paused) showPause(); } lastFrame = performance.now(); });
document.querySelectorAll("[data-control]").forEach(button => {
  button.addEventListener("pointerdown", event => { event.preventDefault(); button.setPointerCapture(event.pointerId); touches.add(button.dataset.control); sendInput(); });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) button.addEventListener(type, () => { touches.delete(button.dataset.control); sendInput(); });
});
function showPause() {
  if (!race || resultShown) return;
  paused = true; clearControls(); stopSpeech();
  $("pause-title").textContent = mode === "online" ? "Corrida online em andamento" : "Pausa para respirar";
  $("pause-text").textContent = mode === "online" ? "A partida continua para a turma. Seu kart freia enquanto este menu está aberto." : "A ilha espera por você.";
  $("pause-dialog").showModal();
}
function resume() { paused = false; $("pause-dialog").close(); lastFrame = performance.now(); }
$("pause-button").addEventListener("click", showPause);
$("resume").addEventListener("click", resume);
$("pause-dialog").addEventListener("cancel", event => { event.preventDefault(); resume(); });
function home(autoQueue = true) { leaveNetwork(); race = null; paused = false; resultShown = false; closeDialogs(); stopSpeech(); keys.clear(); touches.clear(); $("hud").hidden = true; $("menu").hidden = false; $("world").setAttribute("aria-label", "Pista tridimensional dos circuitos do Kart do Saber"); document.title = "Kart do Saber · Corrida educativa"; if (autoQueue) join(); }
$("exit-race").addEventListener("click", () => home());
$("result-menu").addEventListener("click", () => home());
$("results-dialog").addEventListener("cancel", event => { event.preventDefault(); home(); });
$("again").addEventListener("click", () => { const wasOnline = mode === "online"; home(false); if (wasOnline) join(); else practice(); });
$("read-question").disabled = !("speechSynthesis" in window);
$("read-question").addEventListener("click", () => {
  const player = race?.players.find(p => p.id === playerId), question = player && nextQuestion(race, player); if (!question || !("speechSynthesis" in window)) return;
  stopSpeech(); const speech = new SpeechSynthesisUtterance(`${question.speech} Opções: ${question.options.join(", ")}.`); speech.lang = "pt-BR"; speech.rate = .85;
  const voice = speechSynthesis.getVoices().find(v => v.lang.toLowerCase() === "pt-br"); if (voice) speech.voice = voice; speechSynthesis.speak(speech);
});

function showResults() {
  if (resultShown) return;
  resultShown = true; clearControls(); closeDialogs(); stopSpeech();
  const sorted = ranking(race), player = race.players.find(p => p.id === playerId), place = sorted.findIndex(p => p.id === playerId) + 1;
  $("result-title").textContent = player.finishTime === null ? "A corrida terminou!" : place === 1 ? "Você chegou em primeiro!" : "Que boa aventura!";
  $("result-summary").textContent = `${player.correct} de 8 desafios resolvidos · ${place}º lugar · ${formatTime(player.finishTime)}`;
  $("result-learning").textContent = player.correct === 8 ? "Oito descobertas e uma pista cheia de orgulho!" : "Cada tentativa ensina algo novo. Vamos descobrir mais?";
  $("result-ranking").replaceChildren();
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i], row = document.createElement("div"); row.className = `result-row${p.id === playerId ? " you" : ""}`;
    const position = document.createElement("b"), name = document.createElement("span"), stats = document.createElement("small");
    position.textContent = `${i + 1}º`; name.textContent = `${avatarIcon(p)} ${p.name}${p.bot ? " · bot" : ""}`; stats.textContent = `★ ${p.correct}/8 · ${formatTime(p.finishTime)}`;
    row.append(position, name, stats); $("result-ranking").append(row);
  }
  $("results-dialog").showModal();
}
function updateHUD() {
  if (!race) return;
  const player = race.players.find(p => p.id === playerId); if (!player) return;
  const ordered = ranking(race);
  $("position").textContent = `${ordered.findIndex(p => p.id === playerId) + 1}º`;
  const nextRoster = JSON.stringify(ordered.map(p => [p.id, p.name, p.bot, p.avatar, p.character]));
  if (nextRoster !== rosterKey) {
    rosterKey = nextRoster; $("race-roster").replaceChildren();
    ordered.forEach((p, i) => {
      const row = document.createElement("li"), pos = document.createElement("b"), name = document.createElement("span"), kind = document.createElement("small");
      pos.textContent = `${i + 1}º`; name.textContent = p.name; kind.textContent = p.id === playerId ? "VOCÊ" : p.bot ? "BOT" : "";
      row.className = p.id === playerId ? "you" : ""; row.style.borderLeftColor = COLORS[p.character]; row.append(pos, name, kind); $("race-roster").append(row);
    });
  }
  $("speed").textContent = Math.round(Math.abs(player.speed) * 3.6); $("gear").textContent = player.speed < -.2 ? "R · km/h" : "km/h"; $("timer").textContent = formatTime(race.elapsed);
  $("score").textContent = `★ ${player.correct} / 8`; $("progress-fill").style.width = `${Math.max(0, player.distance) / TRACK_LENGTH * 100}%`;
  $("boost-label").textContent = player.falling ? "VOLTANDO À PISTA…" : player.speed < -.2 ? "MARCHA À RÉ" : player.airtime > 0 ? "↗ SALTO!" : player.boost > 0 ? "✦ TURBO DO SABER!" : player.pickupBoost > 0 ? "⚡ TURBO DE PISTA!" : player.penalty > 0 ? "PENSE E TENTE DE NOVO" : player.speed < 2 ? "↑ ACELERAR · ↓ RÉ" : "↑ ACELERAR · ↓ FREAR";
  const q = nextQuestion(race, player), showQuestion = race.elapsed >= 0 && q && q.at - player.distance < 210 && !player.falling;
  $("question").hidden = !showQuestion;
  if (showQuestion && q.id !== lastQuestion) {
    stopSpeech(); lastQuestion = q.id;
    $("question-count").textContent = `DESAFIO ${q.id + 1} / 8`;
    $("question-prompt").textContent = q.prompt; $("question-word").textContent = q.word; $("question-emoji").textContent = q.emoji;
  }
  $("countdown").hidden = race.elapsed > .9;
  $("countdown").textContent = race.elapsed < 0 ? Math.ceil(-race.elapsed) : "JÁ!";
  const feedback = player.feedback, visible = feedback && feedback.until > race.elapsed;
  $("feedback").hidden = !visible;
  if (visible && feedback.id !== lastFeedback) {
    stopSpeech(); lastFeedback = feedback.id; chime(feedback.correct);
    $("feedback").classList.toggle("wrong", !feedback.correct);
    const title = document.createElement("span"), detail = document.createElement("small");
    title.textContent = String(feedback.id).startsWith("pickup-") ? "⚡ Turbo de pista!" : String(feedback.id).startsWith("ramp-") ? "↗ Salto na rampa!" : feedback.correct ? "✦ Acertou! Olha o turbo!" : "Vamos aprender juntos!";
    detail.textContent = feedback.text; $("feedback").replaceChildren(title, detail);
  }
  if (network && performance.now() - lastPacket > 3000) { $("feedback").hidden = false; $("feedback").textContent = "Reconectando à corrida…"; }
  else if (player.falling) { $("feedback").hidden = false; $("feedback").textContent = "🪂 Opa! Voltando perto de onde você caiu…"; }
  else if (player.recover > 0) { $("feedback").hidden = false; $("feedback").textContent = "De volta! Segure ↑ e continue a corrida."; }
  else if (player.finishTime !== null && !race.finished) { $("feedback").hidden = false; $("feedback").textContent = "🏁 Você chegou! A turma está terminando…"; }
  view?.drawMap($("minimap"), race, playerId);
  if (race.finished) showResults();
}
function frame(now) {
  requestAnimationFrame(frame);
  if (document.hidden) { lastFrame = now; return; }
  const dt = Math.min(.1, Math.max(0, (now - lastFrame) / 1000));
  if ((!race || resultShown) && dt < 1 / 30) return;
  lastFrame = now;
  if (race && mode === "practice" && !paused && !resultShown) {
    const player = race.players.find(p => p.id === playerId); setInput(player, controls());
    accumulator += dt; while (accumulator >= 1 / 60) { stepRace(race, 1 / 60); accumulator -= 1 / 60; }
  }
  if (network?.pending) sendInput();
  view?.render(race, playerId, dt, !race);
  uiElapsed += dt; if (uiElapsed > .1) { updateHUD(); uiElapsed = 0; }
}
window.addEventListener("pagehide", leaveNetwork);
// Read-only diagnostics for checking real hardware; no gameplay state can be modified here.
Object.defineProperty(window, "kartDoSaber", { get: () => ({ graphics: view?.stats, mode, elapsed: race?.elapsed, players: race?.players.map(p => ({ name: p.name, distance: Math.round(p.distance), correct: p.correct, bot: p.bot, falls: p.falls, speed: p.speed })) }) });
initGraphics(); requestAnimationFrame(frame);
