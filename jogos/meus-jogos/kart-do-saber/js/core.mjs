import { makeQuestions, random } from "./questions.mjs";
import { TRACK_LENGTH, ROAD_HALF_WIDTH, trackPoint, projectToTrack, wrapAngle } from "./track.mjs";
export { TRACK_LENGTH } from "./track.mjs";
export const LANE_WIDTH = 4.2;
export const COLORS = ["#44c58a", "#f880af", "#5d9cfa", "#ffb74e"];
export const CHARACTERS = ["Caio", "Lia", "Nico", "Bia"];
// Spawn slots for private catch-up rockets. Only the assigned trailing racer sees one.
export const PICKUP_SPAWNS = [
  [96, -3.8], [326, 3.8], [588, 0], [846, -3.8], [1115, 3.8], [1390, 0], [1650, -3.8]
];
export const RAMPS = [[405, -4.15], [735, 4.15], [1085, 0], [1450, 4.15]];
export const normalizeAvatar = avatar => avatar === "girl" ? "girl" : "boy";
export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
export const BASE_SPEED = 27;
export function placePlayer(player, distance = 0, lateral = 0, mapId = 0) {
  const point = trackPoint(distance, lateral, mapId);
  Object.assign(player, { x: point.x, y: point.y, z: point.z, heading: point.angle, distance, lateral });
}
export function makePlayer(id, name, character = 0, bot = false, avatar = "boy") {
  const player = { id, name: String(name || "Piloto").trim().slice(0, 16), character: clamp(Math.floor(character) || 0, 0, 3), avatar: normalizeAvatar(avatar), bot,
    speed: 0, steer: 0, throttle: false, brake: false, handbrake: false, turn: 0, reverseWait: 0, pushX: 0, pushZ: 0, impact: 0,
    nextQuestion: 0, correct: 0, answered: 0, boost: 0, pickupBoost: 0, pickups: 0, airtime: 0, penalty: 0, feedback: null, finishTime: null,
    falling: 0, explosion: 0, falls: 0, recover: 0, respawnAt: 0, botChoices: [], botSkill: .8 };
  placePlayer(player); return player;
}
export function makeBotChoices(questions, seed, character) {
  const rng = random(seed ^ ((character + 1) * 7963)), accuracy = .48 + rng() * .28;
  return questions.map(q => {
    if (rng() < accuracy) return q.correct;
    const wrong = [0, 1, 2].filter(lane => lane !== q.correct);
    return wrong[Math.floor(rng() * wrong.length)];
  });
}
export function createRace(players, subject = "letters", seed = 1, mapId = 0) {
  const questions = makeQuestions(subject, seed);
  return { seed, subject, mapId: mapId === 1 ? 1 : 0, elapsed: -3, finished: false, questions, pickups: PICKUP_SPAWNS.slice(0, 3).map((_, id) => ({ id, at: -999, lateral: 0, availableAt: 5 + random(seed + id * 947)() * 5, targetId: null, expiresAt: 0 })), players: players.map((p, i) => {
    const player = makePlayer(p.id, p.name, p.character, p.bot, p.avatar);
    player.botChoices = makeBotChoices(questions, seed, player.character);
    player.botSkill = .76 + random(seed + player.character * 853)() * .2;
    placePlayer(player, Math.floor(i / 2) * -6 || 0, i % 2 ? 2.4 : -2.4, mapId);
    return player;
  }) };
}
export function fillBots(players) {
  const filled = [...players];
  while (filled.length < 4) {
    const c = [0, 1, 2, 3].find(n => !filled.some(p => p.character === n)) ?? filled.length;
    filled.push(makePlayer(`bot-${filled.length}`, CHARACTERS[c], c, true, c % 2 ? "girl" : "boy"));
  }
  return filled;
}
export function nextQuestion(race, player) { return race.questions[player.nextQuestion] || null; }
export function answerLane(lateral) { return clamp(Math.floor((lateral + LANE_WIDTH * 1.5) / LANE_WIDTH), 0, 2); }
export function setInput(player, input = {}) {
  player.steer = typeof input.steer === "number" && Number.isFinite(input.steer) ? clamp(input.steer, -1, 1) : 0;
  player.throttle = input.throttle === true; player.brake = input.brake === true;
  player.handbrake = input.handbrake === true;
}
function driveBot(race, p) {
  const q = nextQuestion(race, p), remaining = q ? q.at - p.distance : Infinity;
  const leaderDistance = Math.max(...race.players.map(player => player.distance));
  const pickup = p.distance < leaderDistance - 12 && race.pickups.find(item => item.targetId === p.id && item.at > p.distance + 7 && item.at - p.distance < 78);
  const ramp = RAMPS.find(([at]) => at > p.distance + 7 && at - p.distance < 58);
  let targetLane = remaining < 145 ? (p.botChoices[p.nextQuestion] - 1) * LANE_WIDTH : pickup ? pickup.lateral : ramp ? ramp[1] : Math.sin(p.distance * .012 + p.character * 2) * 2;
  if (remaining > 55) for (const other of race.players) {
    if (other === p || other.falling || other.finishTime !== null) continue;
    const gap = other.distance - p.distance;
    if (gap > -1 && gap < 13 && Math.abs(targetLane - other.lateral) < 2.7) targetLane = clamp(other.lateral + (p.lateral < other.lateral ? -3 : 3), -4.5, 4.5);
  }
  const aim = trackPoint(p.distance + 8 + p.speed * .24, targetLane, race.mapId), angle = Math.atan2(aim.x - p.x, aim.z - p.z);
  p.steer = clamp(-wrapAngle(angle - p.heading) * 2.6, -1, 1);
  const near = trackPoint(p.distance + 4, 0, race.mapId), far = trackPoint(p.distance + 32, 0, race.mapId), curvature = Math.abs(wrapAngle(far.angle - near.angle));
  let desired = BASE_SPEED * p.botSkill * (1 - Math.min(.4, curvature * .32));
  if (remaining < 65) desired = Math.min(desired, 21);
  if (p.boost > 0) desired *= 1.24;
  for (const other of race.players) {
    const gap = other.distance - p.distance;
    if (other !== p && gap > 0 && gap < 7 && Math.abs(p.lateral - other.lateral) < 2.5 && !other.falling && other.finishTime === null) desired = Math.min(desired, Math.max(7, other.speed * .87));
  }
  p.throttle = p.speed < desired; p.brake = p.speed > desired + 2.5; p.handbrake = true;
}
function beginFall(p) {
  p.falling = 1.55; p.explosion = .55; p.falls++; p.boost = 0; p.pickupBoost = 0; p.penalty = 0; p.respawnAt = p.distance - 8;
}

// Four oriented rectangles: six pairs, no heavyweight physics engine needed.
// Positional correction prevents overlap; impulses transfer both forward and sideways momentum.
export function collideKarts(players) {
  const active = players.filter(p => !p.falling && p.recover <= 0 && p.finishTime === null);
  function impulse(p, x, z) {
    const fx = Math.sin(p.heading), fz = Math.cos(p.heading), along = x * fx + z * fz;
    p.speed = clamp(p.speed + along, -12, 42);
    p.pushX = clamp(p.pushX + x - along * fx, -12, 12); p.pushZ = clamp(p.pushZ + z - along * fz, -12, 12);
  }
  for (let pass = 0; pass < 3; pass++) for (let i = 0; i < active.length; i++) for (let j = i + 1; j < active.length; j++) {
    const a = active[i], b = active[j], dx = b.x - a.x, dz = b.z - a.z;
    if (Math.abs(a.y - b.y) > 2 || dx * dx + dz * dz > 25) continue;
    const af = [Math.sin(a.heading), Math.cos(a.heading)], ar = [af[1], -af[0]], bf = [Math.sin(b.heading), Math.cos(b.heading)], br = [bf[1], -bf[0]];
    let penetration = Infinity, nx = 0, nz = 0;
    for (const [x, z] of [ar, af, br, bf]) {
      const ra = 1.48 * Math.abs(x * ar[0] + z * ar[1]) + 1.85 * Math.abs(x * af[0] + z * af[1]);
      const rb = 1.48 * Math.abs(x * br[0] + z * br[1]) + 1.85 * Math.abs(x * bf[0] + z * bf[1]);
      const along = dx * x + dz * z, overlap = ra + rb - Math.abs(along);
      if (overlap <= 0) { penetration = 0; break; }
      if (overlap < penetration) { penetration = overlap; const sign = along >= 0 ? 1 : -1; nx = x * sign; nz = z * sign; }
    }
    if (!penetration) continue;
    const separation = (penetration + .008) * .5;
    a.x -= nx * separation; a.z -= nz * separation; b.x += nx * separation; b.z += nz * separation;
    const avx = af[0] * a.speed + a.pushX, avz = af[1] * a.speed + a.pushZ;
    const bvx = bf[0] * b.speed + b.pushX, bvz = bf[1] * b.speed + b.pushZ;
    const closing = (bvx - avx) * nx + (bvz - avz) * nz;
    if (closing < 0) {
      const strength = Math.min(22, -closing * .54);
      impulse(a, -nx * strength, -nz * strength); impulse(b, nx * strength, nz * strength);
      if (strength > .4) { a.impact = .28; b.impact = .28; }
    }
  }
}

function updatePickups(race) {
  const racers = race.players.filter(p => p.finishTime === null && !p.falling).sort((a, b) => b.distance - a.distance);
  if (racers.length < 2) return;
  const leader = racers[0], lanes = [-3.8, 0, 3.8];
  for (const item of race.pickups) {
    const target = item.targetId && racers.find(p => p.id === item.targetId);
    if (item.targetId && (!target || race.elapsed > item.expiresAt || target.distance > item.at + 8)) {
      item.targetId = null; item.at = -999; item.availableAt = race.elapsed + 4;
    }
    if (item.targetId || race.elapsed < item.availableAt) continue;
    const eligible = racers.filter(p => p !== leader && leader.distance - p.distance >= 12 && p.distance < TRACK_LENGTH - 110 && !race.pickups.some(other => other.targetId === p.id));
    if (!eligible.length) { item.availableAt = race.elapsed + 1; continue; }
    const rng = random(race.seed + item.id * 1543 + Math.floor(race.elapsed * 10));
    const chosen = eligible[Math.floor(rng() * eligible.length)];
    item.targetId = chosen.id; item.at = Math.min(TRACK_LENGTH - 55, chosen.distance + 48 + rng() * 24); item.lateral = lanes[Math.floor(rng() * lanes.length)]; item.expiresAt = race.elapsed + 7;
  }
}
export function stepRace(race, dt) {
  if (race.finished || !Number.isFinite(dt) || dt <= 0) return;
  // Substeps also prevent a fast head-on collision from tunneling through another kart.
  let remaining = Math.min(dt, .1);
  while (remaining > 1e-8 && !race.finished) { const step = Math.min(remaining, 1 / 60); advanceRace(race, step); remaining -= step; }
}
function advanceRace(race, dt) {
  race.elapsed += dt;
  if (race.elapsed < 0) return;
  updatePickups(race);
  const active = [];
  for (const p of race.players) {
    if (p.finishTime !== null) { p.speed = 0; continue; }
    p.boost = Math.max(0, p.boost - dt); p.pickupBoost = Math.max(0, p.pickupBoost - dt); p.airtime = Math.max(0, p.airtime - dt); p.penalty = Math.max(0, p.penalty - dt); p.recover = Math.max(0, p.recover - dt); p.impact = Math.max(0, p.impact - dt);
    if (p.falling > 0) {
      p.falling = Math.max(0, p.falling - dt); p.explosion = Math.max(0, p.explosion - dt);
      p.x += Math.sin(p.heading) * p.speed * dt * .35; p.z += Math.cos(p.heading) * p.speed * dt * .35; p.y -= (1.55 - p.falling) * 30 * dt;
      if (p.falling === 0) { placePlayer(p, p.respawnAt, 0, race.mapId); p.speed = 0; p.turn = 0; p.pushX = p.pushZ = 0; p.reverseWait = 0; p.recover = 1.1; }
      continue;
    }
    if (p.bot) driveBot(race, p);
    const maxSpeed = BASE_SPEED * (1 + (p.boost > 0 ? .28 : 0) + (p.pickupBoost > 0 ? .16 : 0)) * (p.penalty > 0 ? .74 : 1);
    if (p.brake && !p.throttle && !p.handbrake) {
      if (p.speed > .05) { p.speed = Math.max(0, p.speed - 24 * dt); p.reverseWait = 0; }
      else {
        p.reverseWait += dt;
        if (p.reverseWait >= .25 || p.speed < -.05) p.speed = Math.max(-8, p.speed - 8 * dt);
        else p.speed = 0;
      }
    } else {
      p.reverseWait = 0;
      if (p.brake) p.speed = Math.sign(p.speed) * Math.max(0, Math.abs(p.speed) - 24 * dt);
      else if (p.throttle) { if (p.speed < maxSpeed) p.speed = Math.min(maxSpeed, p.speed + (p.speed < 0 ? 24 : 11) * dt); }
      else p.speed = Math.sign(p.speed) * Math.max(0, Math.abs(p.speed) - 3.5 * dt);
    }
    if (p.speed > maxSpeed) p.speed = Math.max(maxSpeed, p.speed - 13 * dt);
    if (Math.abs(p.speed) < 1e-7) p.speed = 0;
    p.turn += (p.steer - p.turn) * Math.min(1, dt * 9);
    p.heading = wrapAngle(p.heading - p.turn * (1.1 + Math.min(Math.abs(p.speed), 30) * .022) * clamp(p.speed / 6, -1, 1) * dt);
    p.pushX *= Math.exp(-4 * dt); p.pushZ *= Math.exp(-4 * dt);
    p.x += (Math.sin(p.heading) * p.speed + p.pushX) * dt; p.z += (Math.cos(p.heading) * p.speed + p.pushZ) * dt;
    active.push(p);
  }
  collideKarts(active);
  for (const p of active) {
    const previous = p.distance, projection = projectToTrack(p.x, p.z, previous, race.mapId);
    p.lateral = projection.lateral; p.y = projection.y;
    const advanceLimit = (Math.abs(p.speed) + Math.hypot(p.pushX, p.pushZ)) * dt * 2 + 3;
    p.distance = clamp(projection.distance, previous - advanceLimit, previous + advanceLimit);
    if (Math.abs(p.lateral) > ROAD_HALF_WIDTH + .35 || projection.square > (ROAD_HALF_WIDTH + .8) ** 2) { beginFall(p); continue; }
    for (const item of race.pickups) {
      if (item.targetId !== p.id || Math.abs(item.at - p.distance) > 3.2 || Math.abs(item.lateral - p.lateral) > 1.75) continue;
      item.targetId = null; item.at = -999; item.availableAt = race.elapsed + 8 + random(race.seed + item.id * 173 + p.pickups * 37)() * 5;
      p.pickups++; p.pickupBoost = Math.max(p.pickupBoost, 1.65); p.speed = Math.min(BASE_SPEED * 1.44, p.speed + 4.5);
      p.feedback = { id: `pickup-${item.id}-${p.pickups}`, correct: true, text: "Turbo de pista! Aproveite a velocidade extra.", chosen: null, until: race.elapsed + 1.7 };
    }
    for (const [rampId, [at, lateral]] of RAMPS.entries()) {
      if (!(previous < at && p.distance >= at && Math.abs(p.lateral - lateral) < 2.15)) continue;
      p.airtime = .62; p.speed = Math.min(BASE_SPEED * 1.34, p.speed + 3.2);
      p.feedback = { id: `ramp-${rampId}-${Math.floor(race.elapsed * 10)}`, correct: true, text: "Salto perfeito! Continue acelerando.", chosen: null, until: race.elapsed + 1.1 };
    }
    const q = nextQuestion(race, p);
    if (q && previous < q.at && p.distance >= q.at) {
      const lane = answerLane(p.lateral), correct = lane === q.correct;
      p.answered++; if (correct) p.correct++;
      p.boost = correct ? 2.2 : 0; p.penalty = correct ? 0 : 1.15;
      p.feedback = { id: q.id, correct, text: q.explanation, chosen: lane, until: race.elapsed + 3 }; p.nextQuestion++;
    }
    if (p.distance >= TRACK_LENGTH) { p.distance = TRACK_LENGTH; p.finishTime = race.elapsed; p.speed = 0; }
  }
  const first = race.players.filter(p => p.finishTime !== null).sort((a, b) => a.finishTime - b.finishTime)[0];
  if (race.players.every(p => p.finishTime !== null) || (first && race.elapsed - first.finishTime > 50) || race.elapsed > 300) race.finished = true;
}
// Knowledge scores never enter the ordering: the winner is the first across the line.
export function ranking(race) {
  return [...race.players].sort((a, b) => {
    if (a.finishTime !== null && b.finishTime !== null) return a.finishTime - b.finishTime;
    if (a.finishTime !== null) return -1; if (b.finishTime !== null) return 1;
    return b.distance - a.distance;
  });
}
