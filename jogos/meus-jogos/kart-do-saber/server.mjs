import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, randomInt } from "node:crypto";
import { createRace, fillBots, makePlayer, setInput, stepRace, normalizeAvatar } from "./js/core.mjs";
import { lessonForDate } from "./js/schedule.mjs";

const root = fileURLToPath(new URL("./", import.meta.url));
const mime = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".txt": "text/plain; charset=utf-8" };
const subjects = new Set(["letters", "syllables", "math"]);
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function json(res, status, data) { res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }); res.end(JSON.stringify(data)); }
async function body(req) {
  let text = "";
  for await (const chunk of req) { text += chunk; if (Buffer.byteLength(text) > 2048) throw new Error("Requisição muito grande."); }
  try { const value = JSON.parse(text); if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(); return value; }
  catch { throw new Error("Dados inválidos."); }
}

export function createGameServer({ waitMs = 20_000, disconnectMs = 8_000, maxRooms = 64 } = {}) {
  const rooms = new Map(), sessions = new Map(), attempts = new Map();
  let nextMap = 0;
  function code() { let value; do { value = Array.from({ length: 5 }, () => alphabet[randomInt(alphabet.length)]).join(""); } while (rooms.has(value)); return value; }
  function start(room) {
    if (room.race) return;
    room.race = createRace(fillBots(room.players), room.subject, randomInt(2 ** 30), nextMap); room.started = Date.now();
    nextMap = 1 - nextMap;
  }
  function snapshot(room) {
    return { code: room.code, subject: room.subject, lesson: room.lesson, status: room.race ? room.race.finished ? "finished" : "racing" : "waiting",
      remaining: Math.max(0, Math.ceil((room.deadline - Date.now()) / 1000)), players: room.players.map(p => ({ id: p.id, name: p.name, character: p.character, avatar: p.avatar, bot: p.bot })), race: room.race };
  }
  function send(session, packet) {
    if (!session.stream || session.stream.destroyed) return;
    if (session.stream.writableLength > 128_000) { session.stream.destroy(); return; }
    session.stream.write(`data: ${JSON.stringify(packet)}\n\n`);
  }
  function removeSession(token) {
    const session = sessions.get(token); if (!session) return;
    const room = rooms.get(session.code);
    if (room?.race) { const p = room.race.players.find(p => p.id === session.id); if (p) { p.bot = true; p.steer = 0; p.brake = false; } }
    else if (room) room.players = room.players.filter(p => p.id !== session.id);
    session.stream?.end(); sessions.delete(token);
  }
  const server = http.createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    const url = new URL(req.url, "http://localhost");
    try {
      if (url.pathname.startsWith("/api/")) {
        if (req.headers.origin) {
          let origin; try { origin = new URL(req.headers.origin); } catch { return json(res, 403, { error: "Origem inválida." }); }
          if (origin.host !== req.headers.host) return json(res, 403, { error: "Acesse o jogo pelo mesmo servidor da sala." });
        }
        if (url.pathname === "/api/health" && req.method === "GET") return json(res, 200, { ok: true, game: "kart-do-saber", protocol: 3 });
        if (url.pathname === "/api/join" && req.method === "POST") {
          const addr = req.socket.remoteAddress, now = Date.now();
          let attempt = attempts.get(addr); if (!attempt || now - attempt.since > 60_000) { attempt = { since: now, count: 0 }; attempts.set(addr, attempt); }
          if (++attempt.count > 120) return json(res, 429, { error: "Muitas entradas seguidas. Aguarde um minuto." });
          const data = await body(req);
          const lesson = lessonForDate(); const subject = lesson.key;
          // Every arrival joins the next available public race. No private rooms or codes.
          let room = [...rooms.values()].find(r => r.subject === subject && !r.race && r.players.length < 4);
          if (!room) {
            if (rooms.size >= maxRooms) return json(res, 503, { error: "O servidor está cheio. Tente novamente em instantes." });
            room = { code: code(), subject, lesson, deadline: now + waitMs, created: now, players: [], race: null }; rooms.set(room.code, room);
          }
          const token = randomBytes(24).toString("hex"), id = randomBytes(8).toString("hex");
          const rawCharacter = Number(data.character);
          let character = Number.isInteger(rawCharacter) && rawCharacter >= 0 && rawCharacter < 4 ? rawCharacter : 0;
          if (room.players.some(p => p.character === character)) character = [0, 1, 2, 3].find(c => !room.players.some(p => p.character === c));
          const name = String(data.name || "Piloto").replace(/[\x00-\x1f\x7f]/g, "").trim().slice(0, 16) || "Piloto";
          room.players.push(makePlayer(id, name, character, false, data.avatar));
          sessions.set(token, { id, code: room.code, lastSeen: now, stream: null, inputWindow: now, inputCount: 0 });
          if (room.players.length === 4) start(room);
          return json(res, 200, { token, id, code: room.code, subject: room.subject, lesson: room.lesson });
        }
        const token = url.pathname === "/api/events" ? url.searchParams.get("token") : req.headers.authorization?.replace(/^Bearer /, "");
        const session = sessions.get(token), room = session && rooms.get(session.code);
        if (!session || !room) return json(res, 401, { error: "A conexão com a sala expirou. Entre em uma nova corrida." });
        session.lastSeen = Date.now();
        if (url.pathname === "/api/profile" && req.method === "POST") {
          const data = await body(req), p = room.players.find(p => p.id === session.id);
          if (room.race || !p) return json(res, 409, { error: "A corrida já começou." });
          p.name = String(data.name || "Piloto").replace(/[\x00-\x1f\x7f]/g, "").trim().slice(0, 16) || "Piloto";
          if (Object.hasOwn(data, "avatar")) p.avatar = normalizeAvatar(data.avatar);
          const character = Number(data.character);
          if (Number.isInteger(character) && character >= 0 && character < 4 && !room.players.some(other => other !== p && other.character === character)) p.character = character;
          return json(res, 200, { ok: true, character: p.character });
        }
        if (url.pathname === "/api/events" && req.method === "GET") {
          session.stream?.end(); session.stream = res;
          res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", "Connection": "keep-alive", "X-Accel-Buffering": "no" });
          res.write("retry: 1000\n\n"); send(session, snapshot(room));
          const p = room.race?.players.find(p => p.id === session.id); if (p) p.bot = false;
          res.on("close", () => { if (session.stream === res) { session.stream = null; session.lastSeen = Date.now(); } }); return;
        }
        if (url.pathname === "/api/input" && req.method === "POST") {
          const now = Date.now();
          if (now - session.inputWindow >= 1000) { session.inputWindow = now; session.inputCount = 0; }
          if (++session.inputCount > 40) return json(res, 429, { error: "Entradas muito rápidas." });
          const data = await body(req), p = room.race?.players.find(p => p.id === session.id);
          if (p && session.stream) { p.bot = false; setInput(p, data); }
          return json(res, 200, { ok: true });
        }
        if (url.pathname === "/api/leave" && req.method === "POST") { removeSession(token); return json(res, 200, { ok: true }); }
        return json(res, 404, { error: "Recurso não encontrado." });
      }
      if (!["GET", "HEAD"].includes(req.method)) { res.writeHead(405).end(); return; }
      const pathname = decodeURIComponent(url.pathname), relative = pathname === "/" ? "index.html" : pathname.slice(1);
      // Only browser assets are served, never server code, tests or files from other games.
      if (!(relative === "index.html" || relative === "style.css" || /^(js|vendor)\/[a-zA-Z0-9_.-]+$/.test(relative))) { res.writeHead(404).end("Arquivo não encontrado"); return; }
      const target = path.resolve(root, relative);
      if (!target.startsWith(root) || !mime[path.extname(target)]) { res.writeHead(403).end(); return; }
      const file = await readFile(target);
      res.writeHead(200, { "Content-Type": mime[path.extname(target)], "Cache-Control": relative.startsWith("vendor/") ? "public, max-age=86400" : "no-cache" });
      res.end(req.method === "HEAD" ? undefined : file);
    } catch (error) {
      if (!res.headersSent) json(res, error.code === "ENOENT" ? 404 : 400, { error: error.code === "ENOENT" ? "Arquivo não encontrado." : error.message });
      else res.end();
    }
  });
  let last = performance.now(), accumulator = 0, frame = 0;
  const tick = setInterval(() => {
    const now = Date.now(), current = performance.now(); accumulator += Math.min(.25, (current - last) / 1000); last = current;
    for (const [token, session] of sessions) {
      if (!session.stream && now - session.lastSeen > disconnectMs) {
        const room = rooms.get(session.code), player = room?.race?.players.find(p => p.id === session.id);
        if (player) { player.bot = true; setInput(player, {}); }
        else removeSession(token);
      }
      if (now - session.lastSeen > 180_000 && !session.stream) removeSession(token);
    }
    for (const [key, room] of rooms) {
      const active = [...sessions.values()].some(s => s.code === key);
      if (!active || now - room.created > 600_000) { for (const [token, s] of sessions) if (s.code === key) removeSession(token); rooms.delete(key); continue; }
      if (!room.race && now >= room.deadline) start(room);
    }
    while (accumulator >= 1 / 30) { for (const room of rooms.values()) if (room.race) stepRace(room.race, 1 / 30); accumulator -= 1 / 30; }
    if (++frame % 2 === 0) {
      const packets = new Map();
      for (const session of sessions.values()) { const room = rooms.get(session.code); if (!room) continue; if (!room.race && frame % 8 !== 0) continue; if (!packets.has(room.code)) packets.set(room.code, snapshot(room)); send(session, packets.get(room.code)); }
    }
    if (frame % 300 === 0) for (const [ip, attempt] of attempts) if (now - attempt.since > 60_000) attempts.delete(ip);
  }, 1000 / 30);
  tick.unref();
  server.on("close", () => clearInterval(tick));
  return { server, rooms, sessions, async close() { clearInterval(tick); for (const token of sessions.keys()) removeSession(token); await new Promise(resolve => server.close(resolve)); } };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = name => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : undefined; };
  const port = Number(arg("--port") || process.env.PORT || 4180), host = arg("--host") || process.env.HOST || "127.0.0.1";
  const game = createGameServer();
  game.server.listen(port, host, () => console.log(`Kart do Saber: http://${host === "0.0.0.0" ? "localhost" : host}:${port}\nTreino e salas online disponíveis. Ctrl+C encerra o servidor.`));
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => { game.close().then(() => process.exit(0)); });
}
