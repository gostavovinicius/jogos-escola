import test from "node:test";
import assert from "node:assert/strict";
import { createRace, fillBots, makePlayer, setInput, stepRace, ranking, TRACK_LENGTH, LANE_WIDTH, answerLane, placePlayer, makeBotChoices, collideKarts, PICKUP_SPAWNS, RAMPS } from "../js/core.mjs";
import { makeQuestions } from "../js/questions.mjs";
import { lessonForDate } from "../js/schedule.mjs";
import { chooseContext, trackPoint } from "../js/renderer.mjs";
import { getTrackSamples, MAPS } from "../js/track.mjs";

for (const subject of ["letters", "syllables", "math"]) {
  test(`${subject}: oito perguntas reproduzíveis, opções únicas e resposta válida`, () => {
    for (let seed = 0; seed < 50; seed++) {
      const questions = makeQuestions(subject, seed); assert.deepEqual(questions, makeQuestions(subject, seed)); assert.equal(questions.length, 8);
      for (const q of questions) { assert.equal(new Set(q.options).size, 3); assert.ok(q.options[q.correct]); assert.ok(q.at > 0 && q.at < TRACK_LENGTH); }
    }
  });
}
test("preenche exatamente quatro pilotos com personagens distintos", () => {
  const players = fillBots([makePlayer("you", "Aluno", 2)]); assert.equal(players.length, 4); assert.equal(new Set(players.map(p => p.character)).size, 4); assert.equal(players.filter(p => p.bot).length, 3);
});
test("a corrida respeita a contagem regressiva", () => {
  const race = createRace(fillBots([makePlayer("you", "Aluno")]));
  setInput(race.players[0], { throttle: true });
  for (let i = 0; i < 120; i++) stepRace(race, 1 / 60);
  assert.equal(race.players[0].distance, 0); assert.ok(race.elapsed < 0);
});
for (const correct of [true, false]) {
  test(`atravessar o portal ${correct ? "certo dá turbo" : "errado mostra explicação e desacelera"} apenas uma vez`, () => {
    const race = createRace([makePlayer("you", "Aluno")]); race.elapsed = 5;
    const p = race.players[0], q = race.questions[0];
    placePlayer(p, q.at - .1, ((q.correct + (correct ? 0 : 1)) % 3 - 1) * LANE_WIDTH); p.speed = 18;
    stepRace(race, 1 / 30); assert.equal(p.answered, 1); assert.equal(p.correct, correct ? 1 : 0); assert.equal(p.feedback.correct, correct); assert.equal(p.feedback.text, q.explanation);
    assert.ok(correct ? p.boost > 0 : p.penalty > 0);
    for (let i = 0; i < 10; i++) stepRace(race, 1 / 30); assert.equal(p.answered, 1);
  });
}
test("bots conseguem terminar e respondem a todos os desafios", () => {
  const race = createRace(fillBots([]), "letters", 82);
  for (let i = 0; i < 9000 && !race.finished; i++) stepRace(race, 1 / 30);
  assert.equal(race.finished, true); assert.ok(race.players.every(p => p.finishTime !== null && p.answered === 8));
  assert.ok(ranking(race)[0].finishTime <= ranking(race)[3].finishTime);
});
test("direção, freio e limites ignoram valores malformados", () => {
  const p = makePlayer("test", "Aluno"), race = createRace([p]); const player = race.players[0]; race.elapsed = 0;
  setInput(player, { steer: Infinity, throttle: "true", brake: "false", distance: 9999, correct: 8 }); assert.equal(player.steer, 0); assert.equal(player.throttle, false); assert.equal(player.brake, false); assert.equal(player.distance, 0); assert.equal(player.correct, 0);
  setInput(player, { steer: 300, brake: true }); assert.equal(player.steer, 1);
  for (let i = 0; i < 120; i++) stepRace(race, 1 / 30); assert.ok(player.lateral <= 6.15); assert.ok(player.speed < 12);
  assert.equal(answerLane(-4.2), 0); assert.equal(answerLane(0), 1); assert.equal(answerLane(4.2), 2);
});
test("a pista fecha na chegada e direita corresponde à direita da câmera", () => {
  const a = trackPoint(0), b = trackPoint(TRACK_LENGTH); assert.deepEqual(a, b);
  const right = trackPoint(0, 4.2), forward = trackPoint(1); const dx = forward.x - a.x, dz = forward.z - a.z;
  assert.ok((right.x - a.x) * -dz + (right.z - a.z) * dx > 0);
});
for (const available of [1, 2]) test(`contexto WebGL ${available} selecionado de verdade`, () => {
  const attempts = [], factory = () => ({ getContext(name) { attempts.push(name); return name === `webgl${available === 1 ? "" : "2"}` ? {} : null; } });
  assert.equal(chooseContext("auto", factory).version, available); assert.equal(attempts[0], "webgl2");
});
test("modo leve força WebGL 1 e ausência de WebGL gera mensagem útil", () => {
  const attempts = [];
  assert.equal(chooseContext("light", () => ({ getContext(name) { attempts.push(name); return {}; } })).version, 1); assert.deepEqual(attempts, ["webgl"]);
  assert.throws(() => chooseContext("auto", () => ({ getContext() { return null; } })), /WebGL/);
});
test("aceleração exige teclado; soltar desacelera e frear para completamente", () => {
  const race = createRace([makePlayer("you", "Aluno")]); race.elapsed = 0; const p = race.players[0];
  for (let i = 0; i < 60; i++) stepRace(race, 1 / 60);
  assert.equal(p.speed, 0); assert.ok(Math.abs(p.distance) < .1);
  setInput(p, { throttle: true }); for (let i = 0; i < 60; i++) stepRace(race, 1 / 60);
  assert.ok(p.speed > 10); const accelerated = p.speed;
  setInput(p, {}); for (let i = 0; i < 20; i++) stepRace(race, 1 / 60); assert.ok(p.speed < accelerated && p.speed > 0);
  setInput(p, { throttle: true, brake: true }); for (let i = 0; i < 60; i++) stepRace(race, 1 / 60); assert.equal(p.speed, 0);
});
test("dirigir sem fazer curvas pode derrubar o kart", () => {
  const race = createRace([makePlayer("you", "Aluno")]); race.elapsed = 0; const p = race.players[0]; setInput(p, { throttle: true });
  for (let i = 0; i < 1800 && !p.falls; i++) stepRace(race, 1 / 60);
  assert.ok(p.falls > 0); assert.ok(p.falling > 0);
});
test("queda retorna perto do ponto, sem avançar a corrida nem ganhar acertos", () => {
  const race = createRace([makePlayer("you", "Aluno")]); race.elapsed = 0; const p = race.players[0];
  placePlayer(p, 500, 8.5); p.correct = 2; p.answered = 2; p.nextQuestion = 2;
  stepRace(race, 1 / 60); assert.ok(p.falling > 0); const fallAt = p.distance, high = p.y;
  for (let i = 0; i < 30; i++) stepRace(race, 1 / 60); assert.ok(p.y < high);
  for (let i = 0; i < 65; i++) stepRace(race, 1 / 60);
  assert.equal(p.falling, 0); assert.equal(p.falls, 1); assert.ok(p.distance < fallAt && fallAt - p.distance < 12);
  assert.ok(Math.abs(p.lateral) < .1); assert.equal(p.correct, 2); assert.equal(p.answered, 2); assert.equal(p.speed, 0);
});
test("pista elevada mantém todas as seções acima do chão", () => {
  for (let d = 0; d < TRACK_LENGTH; d += 10) assert.ok(trackPoint(d).y > 10);
});
test("bots variam acertos e erros entre corridas e pilotos", () => {
  let correct = 0, total = 0;
  const patterns = new Set();
  for (let seed = 1; seed <= 40; seed++) for (let c = 0; c < 4; c++) {
    const questions = makeQuestions("letters", seed), choices = makeBotChoices(questions, seed, c);
    patterns.add(choices.join("")); choices.forEach((lane, i) => { total++; if (lane === questions[i].correct) correct++; });
  }
  assert.ok(correct / total > .4 && correct / total < .8); assert.ok(patterns.size > 30);
});
test("mais acertos nunca substituem ordem de chegada ou distância", () => {
  const race = createRace([makePlayer("fast", "Rápido"), makePlayer("accurate", "Estudioso")]);
  Object.assign(race.players[0], { finishTime: 70, correct: 0 }); Object.assign(race.players[1], { finishTime: 73, correct: 8 });
  assert.equal(ranking(race)[0].id, "fast");
  Object.assign(race.players[0], { finishTime: null, distance: 1100 }); Object.assign(race.players[1], { finishTime: null, distance: 1000 });
  assert.equal(ranking(race)[0].id, "fast");
});
test("uma corrida real pode ser vencida por um bot com menos acertos", () => {
  const race = createRace(fillBots([]), "letters", 1);
  for (let i = 0; i < 9000 && !race.finished; i++) stepRace(race, 1 / 30);
  assert.ok(ranking(race)[0].correct < Math.max(...race.players.map(p => p.correct)));
});
test("frear até parar e continuar segurando engata ré limitada", () => {
  const race = createRace([makePlayer("you", "Aluno")]); race.elapsed = 0; const p = race.players[0]; p.speed = 15;
  setInput(p, { brake: true }); for (let i = 0; i < 25; i++) stepRace(race, 1 / 60); assert.ok(p.speed > 0 && p.speed < 15);
  for (let i = 0; i < 150; i++) stepRace(race, 1 / 60); assert.ok(p.speed < -1 && p.speed >= -8);
  const before = p.distance; for (let i = 0; i < 15; i++) stepRace(race, 1 / 60); assert.ok(p.distance < before);
  setInput(p, { throttle: true }); for (let i = 0; i < 60; i++) stepRace(race, 1 / 60); assert.ok(p.speed > 0);
});
test("soltar a ré desacelera; freio de pausa nunca marcha para trás", () => {
  const race = createRace([makePlayer("you", "Aluno")]); race.elapsed = 0; const p = race.players[0]; p.speed = -5;
  setInput(p, {}); for (let i = 0; i < 120; i++) stepRace(race, 1 / 60); assert.equal(p.speed, 0);
  p.speed = 12; setInput(p, { brake: true, handbrake: true }); for (let i = 0; i < 180; i++) stepRace(race, 1 / 60); assert.equal(p.speed, 0);
});
test("virar em ré inverte a rotação do volante", () => {
  const forward = createRace([makePlayer("a", "A")]), reverse = createRace([makePlayer("b", "B")]); forward.elapsed = reverse.elapsed = 0;
  const a = forward.players[0], b = reverse.players[0], initial = a.heading;
  a.speed = 5; b.speed = -5; setInput(a, { steer: 1 }); setInput(b, { steer: 1 });
  stepRace(forward, 1 / 60); stepRace(reverse, 1 / 60);
  assert.ok(a.heading < initial); assert.ok(b.heading > initial);
});
function contactPair() {
  const a = makePlayer("a", "A"), b = makePlayer("b", "B", 1);
  Object.assign(a, { x: 0, z: 0, y: 16, heading: 0 }); Object.assign(b, { x: 0, z: 3.3, y: 16, heading: 0 });
  return [a, b];
}
test("batida traseira empurra o kart da frente e reduz o de trás", () => {
  const [a, b] = contactPair(); a.speed = 18; collideKarts([a, b]);
  assert.ok(a.speed < 18 && a.speed > 0); assert.ok(b.speed > 0); assert.ok(b.z - a.z >= 3.7);
  assert.ok(Math.abs(a.speed + b.speed - 18) < 1e-6); assert.ok(a.impact > 0 && b.impact > 0);
});
test("batida lateral transmite empurrão e contato parado não cria energia", () => {
  const [a, b] = contactPair(); a.heading = Math.PI / 2; a.speed = 16; b.x = 2.5; b.z = 0;
  collideKarts([a, b]); assert.ok(b.pushX > 0); assert.ok(a.speed < 16);
  const [c, d] = contactPair(); collideKarts([c, d]); assert.equal(c.speed, 0); assert.equal(d.speed, 0); assert.equal(c.pushX, 0); assert.equal(d.pushX, 0);
});
test("karts em queda ou proteção de retorno não bloqueiam outro piloto", () => {
  for (const protection of ["falling", "recover"]) {
    const [a, b] = contactPair(); b[protection] = .5; a.speed = 20; collideKarts([a, b]);
    assert.equal(a.speed, 20); assert.equal(b.speed, 0); assert.equal(a.z, 0);
  }
});
test("empurrão perto da borda pode derrubar o outro kart", () => {
  const race = createRace([makePlayer("a", "A"), makePlayer("b", "B", 1)]); race.elapsed = 0;
  const [a, b] = race.players; placePlayer(a, 350, 4.85); placePlayer(b, 350, 7.1); a.heading -= Math.PI / 2; a.speed = 6;
  stepRace(race, 1 / 60); assert.ok(b.falling > 0); assert.equal(b.falls, 1);
});
for (const fps of [30, 60]) test(`batida frontal não atravessa karts a ${fps} Hz`, () => {
  const race = createRace([makePlayer("a", "A"), makePlayer("b", "B", 1)]); race.elapsed = 0;
  const [a, b] = race.players; placePlayer(a, 40, 0); placePlayer(b, 49, 0); b.heading += Math.PI; a.speed = b.speed = 27;
  for (let i = 0; i < fps / 2; i++) stepRace(race, 1 / fps);
  assert.ok(a.distance < b.distance); assert.ok(Math.abs(a.speed) < 12 && Math.abs(b.speed) < 12);
});
test("nome e avatar escolhido são preservados independentemente da cor do kart", () => {
  const race = createRace(fillBots([makePlayer("ana", "Ana", 2, false, "girl"), makePlayer("leo", "Léo", 1, false, "boy")]));
  assert.equal(race.players[0].avatar, "girl"); assert.equal(race.players[0].name, "Ana"); assert.equal(race.players[0].character, 2);
  assert.equal(race.players[1].avatar, "boy"); assert.equal(makePlayer("bad", "Test", 0, false, "invalid").avatar, "boy");
});

test("foguetes pertencem ao piloto designado, dão impulso e reaparecem", () => {
  const race = createRace([makePlayer("a", "A"), makePlayer("b", "B", 1)]); race.elapsed = 1;
  const [a, b] = race.players, item = race.pickups[0];
  Object.assign(item, { targetId: a.id, at: 100, lateral: 0, availableAt: 0, expiresAt: 20 });
  placePlayer(a, 100, 0); placePlayer(b, 118, 0); a.speed = b.speed = 18;
  stepRace(race, 1 / 60);
  assert.equal(a.pickups, 1); assert.equal(b.pickups, 0); assert.ok(a.pickupBoost > 1.5); assert.ok(a.speed > 18);
  const firstAvailable = item.availableAt; assert.equal(item.targetId, null); assert.ok(firstAvailable >= 9);
  race.elapsed = firstAvailable; Object.assign(item, { targetId: b.id, at: 100, lateral: 0, expiresAt: firstAvailable + 10 });
  placePlayer(a, 400, 0); placePlayer(b, 100, 0); b.speed = 18;
  stepRace(race, 1 / 60); assert.equal(b.pickups, 1); assert.equal(item.targetId, null);
  assert.equal(PICKUP_SPAWNS.length, 7);
});
test("a grade identifica turma, ano e conteúdo em cada horário registrado", () => {
  const first = lessonForDate(new Date("2026-09-14T07:20:00-03:00"));
  assert.deepEqual([first.classId, first.grade, first.topic], ["3B", 3, "Adição e subtração"]);
  const fifth = lessonForDate(new Date("2026-09-18T15:20:00-03:00"));
  assert.deepEqual([fifth.classId, fifth.grade, fifth.topic], ["5C", 5, "Operações e desafios"]);
  assert.equal(lessonForDate(new Date("2026-09-17T09:00:00-03:00")).active, false);
});
test("cada ano recebe oito desafios adequados e respostas válidas", () => {
  for (let grade = 1; grade <= 5; grade++) {
    const questions = makeQuestions(`grade${grade}-teste`, 82 + grade);
    assert.equal(questions.length, 8);
    questions.forEach(q => { assert.equal(new Set(q.options).size, 3); assert.ok(q.correct >= 0 && q.correct < 3); });
  }
});
test("foguetes começam ocultos e usam três vagas de recuperação", () => {
  const race = createRace([makePlayer("a", "A")], "grade3-3b", 77);
  assert.equal(race.pickups.length, 3);
  assert.ok(race.pickups.every(item => item.targetId === null && item.at < 0));
  assert.equal(new Set(race.pickups.map(item => item.availableAt)).size, 3);
});
test("palavras e sílabas não se repetem na mesma corrida", () => {
  for (const subject of ["grade1-1a", "grade2-2a"]) {
    const questions = makeQuestions(subject, 42);
    assert.equal(new Set(questions.map(q => q.word)).size, 8);
  }
});
test("líder e piloto próximo não recebem foguete; rampa cria salto", () => {
  const race = createRace([makePlayer("lead", "Líder"), makePlayer("near", "Perto", 1), makePlayer("back", "Atrás", 2)], "grade3-3b", 14); race.elapsed = 10;
  const [leader, near, trailing] = race.players;
  placePlayer(leader, 120, 0); placePlayer(near, 113, 0); placePlayer(trailing, 70, 0);
  race.pickups.forEach(item => { item.availableAt = 0; item.targetId = null; });
  stepRace(race, 1 / 60);
  const targets = race.pickups.map(item => item.targetId).filter(Boolean);
  assert.deepEqual(targets, [trailing.id]); assert.ok(!targets.includes(leader.id) && !targets.includes(near.id));
  const item = race.pickups.find(entry => entry.targetId === trailing.id);
  placePlayer(leader, item.at, item.lateral); leader.speed = 18; stepRace(race, 1 / 60); assert.equal(leader.pickups, 0);
  const [at, lateral] = RAMPS[0]; placePlayer(trailing, at - .15, lateral); trailing.speed = 18;
  stepRace(race, 1 / 30); assert.ok(trailing.airtime > .45); assert.ok(trailing.speed > 18);
});
test("os dois mapas possuem traçados, alturas e identidades diferentes", () => {
  assert.deepEqual(MAPS.map(map => map.name), ["Ilha das Descobertas", "Cânion Estelar"]);
  const island = getTrackSamples(0), canyon = getTrackSamples(1);
  assert.equal(island.length, canyon.length); assert.notDeepEqual(island[180], canyon[180]);
  for (const mapId of [0, 1]) {
    const start = trackPoint(0, 0, mapId), finish = trackPoint(TRACK_LENGTH, 0, mapId);
    assert.deepEqual(start, finish);
    for (let d = 0; d < TRACK_LENGTH; d += 40) assert.ok(trackPoint(d, 0, mapId).y > 10);
  }
});

test("queda no cânion dispara explosão e retorna ao mesmo traçado com proteção", () => {
  const race = createRace([makePlayer("you", "Aluno")], "grade3-3b", 22, 1); race.elapsed = 0;
  const p = race.players[0]; placePlayer(p, 520, 8.7, 1); p.speed = 12;
  stepRace(race, 1 / 60); assert.ok(p.falling > 0); assert.ok(p.explosion > 0);
  for (let i = 0; i < 105; i++) stepRace(race, 1 / 60);
  assert.equal(p.falling, 0); assert.equal(p.explosion, 0); assert.ok(p.recover > 0); assert.ok(Math.abs(p.lateral) < .1);
  const road = trackPoint(p.distance, 0, 1); assert.ok(Math.hypot(p.x - road.x, p.z - road.z) < .1);
});