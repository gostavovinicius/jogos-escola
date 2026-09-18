// Numeric tracks shared by server, physics and renderer. No GPU library required.
export const TRACK_LENGTH = 1840;
export const ROAD_HALF_WIDTH = 7.05;
export const SAMPLE_COUNT = 920;
export const MAPS = [
  { id: 0, name: "Ilha das Descobertas", shortName: "Ilha", sky: "#a1e1e6" },
  { id: 1, name: "Cânion Estelar", shortName: "Cânion", sky: "#302b59" },
];
const layouts = [
  [[-125, -165], [-10, -160], [115, -150], [190, -75], [155, 20], [215, 125], [95, 180], [-10, 100], [-130, 175], [-195, 70], [-150, -25], [-210, -105]],
  [[-185, -35], [-135, -150], [5, -178], [150, -128], [212, -18], [158, 105], [42, 72], [-28, 178], [-162, 148], [-218, 52], [-120, 4], [-45, -62]],
];
export const wrapAngle = angle => Math.atan2(Math.sin(angle), Math.cos(angle));
const wrap = value => (value % TRACK_LENGTH + TRACK_LENGTH) % TRACK_LENGTH;
function catmull(a, b, c, d, t) { return .5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t); }
function buildSamples(knots, mapId) {
  const raw = []; let physicalLength = 0;
  for (let i = 0; i <= 2400; i++) {
    const u = i / 2400 * knots.length, segment = Math.floor(u), t = u - segment;
    const get = offset => knots[(segment + offset + knots.length) % knots.length];
    const [a, b, c, d] = [-1, 0, 1, 2].map(get);
    const p = { x: catmull(a[0], b[0], c[0], d[0], t), z: catmull(a[1], b[1], c[1], d[1], t) };
    if (i) physicalLength += Math.hypot(p.x - raw[i - 1].x, p.z - raw[i - 1].z);
    p.length = physicalLength; raw.push(p);
  }
  let cursor = 0;
  const result = Array.from({ length: SAMPLE_COUNT + 1 }, (_, i) => {
    const length = i / SAMPLE_COUNT * physicalLength;
    while (cursor < raw.length - 2 && raw[cursor + 1].length < length) cursor++;
    const a = raw[cursor], b = raw[cursor + 1], f = (length - a.length) / (b.length - a.length || 1);
    const angle = Math.atan2(b.x - a.x, b.z - a.z), phase = i / SAMPLE_COUNT * Math.PI * 2;
    const y = mapId === 0 ? 16 + 3 * Math.sin(phase) + 2 * Math.sin(phase * 3) : 19 + 4.5 * Math.sin(phase * 2) + 2.2 * Math.cos(phase * 5);
    return { x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f, y, nx: Math.cos(angle), nz: -Math.sin(angle), angle };
  });
  result[SAMPLE_COUNT] = { ...result[0] }; return result;
}
const tracks = layouts.map(buildSamples);
export const samples = tracks[0];
export const getTrackSamples = (mapId = 0) => tracks[mapId === 1 ? 1 : 0];
export function trackPoint(distance, lateral = 0, mapId = 0) {
  const track = getTrackSamples(mapId), value = wrap(distance) / TRACK_LENGTH * SAMPLE_COUNT, i = Math.floor(value), f = value - i;
  const a = track[i], b = track[i + 1], angle = a.angle + wrapAngle(b.angle - a.angle) * f;
  return { x: a.x + (b.x - a.x) * f - Math.cos(angle) * lateral, y: a.y + (b.y - a.y) * f,
    z: a.z + (b.z - a.z) * f + Math.sin(angle) * lateral, angle, index: i };
}
export function projectToTrack(x, z, previousDistance = 0, mapId = 0) {
  const track = getTrackSamples(mapId), center = Math.floor(wrap(previousDistance) / TRACK_LENGTH * SAMPLE_COUNT);
  let best = null, nearest = Infinity;
  for (let offset = -24; offset <= 24; offset++) {
    const index = (center + offset + SAMPLE_COUNT) % SAMPLE_COUNT, a = track[index], b = track[index + 1];
    const dx = b.x - a.x, dz = b.z - a.z, t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
    const px = a.x + dx * t, pz = a.z + dz * t, square = (x - px) ** 2 + (z - pz) ** 2;
    if (square >= nearest) continue;
    nearest = square;
    const angle = Math.atan2(dx, dz), distance = (index + t) / SAMPLE_COUNT * TRACK_LENGTH;
    let delta = distance - wrap(previousDistance); if (delta > TRACK_LENGTH / 2) delta -= TRACK_LENGTH; if (delta < -TRACK_LENGTH / 2) delta += TRACK_LENGTH;
    best = { distance: previousDistance + delta, lateral: -(x - px) * Math.cos(angle) + (z - pz) * Math.sin(angle), y: a.y + (b.y - a.y) * t, angle, square };
  }
  return best;
}