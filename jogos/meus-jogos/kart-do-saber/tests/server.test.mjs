import test from "node:test";
import assert from "node:assert/strict";
import { createGameServer } from "../server.mjs";

async function fixture(t, options = {}) {
  const game = createGameServer(options); await new Promise(resolve => game.server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${game.server.address().port}`;
  t.after(() => game.close());
  const post = async (route, data, token) => { const response = await fetch(`${url}/api/${route}`, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(data) }); return { status: response.status, data: await response.json() }; };
  return { game, url, post };
}
async function stream(url, token) {
  const controller = new AbortController(), response = await fetch(`${url}/api/events?token=${token}`, { signal: controller.signal }), reader = response.body.getReader(); let buffer = "";
  return { close: () => { controller.abort(); reader.cancel().catch(() => {}); }, async next(predicate = () => true) {
    const timeout = setTimeout(() => controller.abort(), 5000);
    try { while (true) { const part = await reader.read(); if (part.done) throw new Error("Stream terminou"); buffer += new TextDecoder().decode(part.value); let index; while ((index = buffer.indexOf("\n\n")) >= 0) { const event = buffer.slice(0, index); buffer = buffer.slice(index + 2); const line = event.split("\n").find(l => l.startsWith("data: ")); if (line) { const packet = JSON.parse(line.slice(6)); if (predicate(packet)) return packet; } } } }
    finally { clearTimeout(timeout); }
  } };
}
test("servidor serve apenas arquivos do novo jogo", async t => {
  const { url } = await fixture(t);
  const html = await fetch(url); assert.equal(html.status, 200); assert.match(await html.text(), /Kart do Saber/);
  for (const file of ["/server.mjs", "/package.json", "/tests/server.test.mjs", "/.git/config", "/js/../../package.json"]) assert.notEqual((await fetch(url + file)).status, 200);
  assert.equal((await fetch(url + "/js/app.mjs")).status, 200);
});
test("quatro clientes são agrupados automaticamente e o quinto inicia outra partida", async t => {
  const { url, post } = await fixture(t); const connections = [];
  t.after(() => connections.forEach(c => c.close()));
  const first = await post("join", { name: "Aluno 1", subject: "math", character: 0 }); assert.equal(first.status, 200);
  const clients = [first.data];
  const firstStream = await stream(url, first.data.token); connections.push(firstStream);
  assert.equal((await firstStream.next()).status, "waiting");
  for (let i = 1; i < 4; i++) { const joined = await post("join", { subject: "math", name: `Aluno ${i + 1}`, character: 0 }); assert.equal(joined.status, 200); clients.push(joined.data); }
  const state = await firstStream.next(p => p.status === "racing"); assert.equal(state.race.players.length, 4); assert.equal(state.race.players.filter(p => p.bot).length, 0); assert.equal(state.subject, state.lesson.key);
  assert.equal(new Set(state.race.players.map(p => p.character)).size, 4);
  for (const client of clients.slice(1)) { const s = await stream(url, client.token); connections.push(s); assert.equal((await s.next()).race.seed, state.race.seed); }
  const fifth = await post("join", { subject: "math" }); assert.equal(fifth.status, 200); assert.notEqual(fifth.data.code, first.data.code);
  assert.equal((await post("input", { steer: 1, throttle: true, distance: 1840, correct: 8 }, first.data.token)).status, 200);
  const after = await firstStream.next(p => p.race.players[0].steer === 1); assert.equal(after.race.players[0].correct, 0); assert.ok(after.race.players[0].distance < 10);
});
test("tempo de espera completa a sala com bots; saída transfere kart a bot", async t => {
  const { url, post, game } = await fixture(t, { waitMs: 90 });
  const { data } = await post("join", { mode: "quick", name: "Aluno" }); const s = await stream(url, data.token); t.after(() => s.close());
  const packet = await s.next(p => p.status === "racing"); assert.equal(packet.race.players.filter(p => p.bot).length, 3);
  assert.equal((await post("leave", {}, data.token)).status, 200); assert.equal(game.rooms.get(data.code).race.players.find(p => p.id === data.id).bot, true);
  assert.equal((await post("input", {}, data.token)).status, 401);
});
test("busca automática reúne todos os alunos no conteúdo do horário atual", async t => {
  const { post } = await fixture(t);
  const a = await post("join", { subject: "letters" }), b = await post("join", { subject: "letters" }), c = await post("join", { subject: "math" });
  assert.equal(a.data.code, b.data.code); assert.equal(a.data.code, c.data.code);
});
test("validação rejeita origens externas e dados grandes ou inválidos", async t => {
  const { url, post } = await fixture(t);
  assert.equal((await fetch(`${url}/api/join`, { method: "POST", headers: { Origin: "https://example.com" }, body: "{}" })).status, 403);
  assert.equal((await post("join", { mode: "create", name: "x".repeat(3000) })).status, 400);
  assert.equal((await fetch(`${url}/api/join`, { method: "POST", body: "[]" })).status, 400);
  assert.equal((await post("input", {})).status, 401);
});
test("25 computadores formam seis corridas completas e uma com três bots", async t => {
  const { url, post, game } = await fixture(t, { waitMs: 1400 });
  const connections = [], clients = []; t.after(() => connections.forEach(s => s.close()));
  for (let i = 0; i < 25; i++) {
    const { status, data } = await post("join", { name: `Aluno ${i + 1}`, subject: "letters" }); assert.equal(status, 200);
    clients.push(data); connections.push(await stream(url, data.token));
  }
  assert.equal(new Set(clients.map(c => c.code)).size, 7);
  const last = await connections[24].next(p => p.status === "racing"); assert.equal(last.race.players.filter(p => p.bot).length, 3);
  const rooms = [...game.rooms.values()]; assert.equal(rooms.length, 7); assert.ok(rooms.every(r => r.race.players.length === 4));
  assert.equal(rooms.flatMap(r => r.race.players).filter(p => !p.bot).length, 25);
  assert.equal(new Set(rooms.flatMap(r => r.race.players).filter(p => !p.bot).map(p => p.id)).size, 25);
});
test("perfil pode mudar enquanto espera sem reiniciar a contagem", async t => {
  const { post, game } = await fixture(t);
  const { data } = await post("join", { name: "Aluno", character: 0 });
  const before = game.rooms.get(data.code).deadline;
  assert.equal((await post("profile", { name: "Bia", character: 2 }, data.token)).status, 200);
  const room = game.rooms.get(data.code); assert.equal(room.deadline, before); assert.equal(room.players[0].name, "Bia"); assert.equal(room.players[0].character, 2);
});
test("desconexão vira bot e reconexão recupera o mesmo kart sem reiniciar a corrida", async t => {
  const { post, url, game } = await fixture(t, { waitMs: 60, disconnectMs: 70 });
  const { data } = await post("join", { name: "Aluno" });
  const first = await stream(url, data.token); await first.next(p => p.status === "racing"); first.close();
  await new Promise(resolve => setTimeout(resolve, 160));
  const race = game.rooms.get(data.code).race, p = race.players.find(p => p.id === data.id), elapsed = race.elapsed;
  assert.equal(p.bot, true);
  const second = await stream(url, data.token); t.after(() => second.close());
  const packet = await second.next(s => !s.race.players.find(p => p.id === data.id).bot);
  assert.equal(p.bot, false); assert.ok(packet.race.elapsed >= elapsed); assert.equal(game.rooms.get(data.code).race, race);
  assert.equal((await post("input", { throttle: true, steer: -.5 }, data.token)).status, 200);
  assert.equal(p.throttle, true); assert.equal(p.steer, -.5);
});
test("nome e escolha de personagem são transmitidos aos colegas e mantidos na largada", async t => {
  const { post, url } = await fixture(t); const connections = []; t.after(() => connections.forEach(s => s.close()));
  const ana = (await post("join", { name: "Ana", avatar: "girl", character: 0 })).data;
  const bia = (await post("join", { name: "Bia", avatar: "girl", character: 0 })).data;
  const s = await stream(url, ana.token); connections.push(s);
  const waiting = await s.next(); assert.equal(waiting.players[1].name, "Bia"); assert.equal(waiting.players[1].avatar, "girl");
  assert.notEqual(waiting.players[0].character, waiting.players[1].character);
  await post("profile", { name: "Bia Silva", avatar: "girl", character: 2 }, bia.token);
  await post("join", { name: "Caio", avatar: "boy" }); await post("join", { name: "Davi", avatar: "boy" });
  const racing = await s.next(packet => packet.status === "racing");
  assert.equal(racing.race.players.find(p => p.id === bia.id).name, "Bia Silva"); assert.equal(racing.race.players.find(p => p.id === bia.id).avatar, "girl");
  await post("input", { brake: true, handbrake: true }, ana.token);
  const input = await s.next(packet => packet.race.players.find(p => p.id === ana.id).handbrake);
  assert.equal(input.race.players.find(p => p.id === ana.id).brake, true);
});

test("partidas online alternam automaticamente entre ilha e cânion", async t => {
  const { post, game } = await fixture(t);
  for (let i = 0; i < 8; i++) assert.equal((await post("join", { name: `Piloto ${i + 1}` })).status, 200);
  const races = [...game.rooms.values()].map(room => room.race);
  assert.equal(races.length, 2); assert.ok(races.every(Boolean)); assert.deepEqual(races.map(race => race.mapId), [0, 1]);
});