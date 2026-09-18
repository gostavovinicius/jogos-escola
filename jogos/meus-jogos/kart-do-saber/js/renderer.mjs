import * as THREE from "../vendor/three.module.js";
import { TRACK_LENGTH, COLORS, LANE_WIDTH, RAMPS, nextQuestion } from "./core.mjs";
import { random } from "./questions.mjs";
import { getTrackSamples, SAMPLE_COUNT as sampleCount, trackPoint, wrapAngle } from "./track.mjs";
export { trackPoint } from "./track.mjs";

export function chooseContext(mode, factory = () => document.createElement("canvas")) {
  const versions = mode === "light" ? [1] : [2, 1];
  for (const version of versions) {
    const canvas = factory();
    const options = { alpha: false, antialias: version === 2 && mode === "full", stencil: false, powerPreference: "low-power" };
    let context;
    try { context = canvas.getContext(version === 2 ? "webgl2" : "webgl", options); } catch { /* Try the next supported context. */ }
    if (context) return { canvas, context, version };
  }
  throw new Error("Este navegador não conseguiu iniciar o WebGL. Ative a aceleração gráfica ou experimente outro navegador atualizado. O modo leve precisa de WebGL 1.");
}

// Bake scenery into one colored mesh. No per-tree objects, physics engine or realtime shadows.
class Batch {
  constructor() { this.positions = []; this.normals = []; this.colors = []; }
  add(geometry, color, position = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0]) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    const matrix = new THREE.Matrix4().compose(new THREE.Vector3(...position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(...scale));
    g.applyMatrix4(matrix);
    const p = g.attributes.position.array, n = g.attributes.normal.array, c = new THREE.Color(color);
    for (let i = 0; i < p.length; i++) { this.positions.push(p[i]); this.normals.push(n[i]); this.colors.push(i % 3 === 0 ? c.r : i % 3 === 1 ? c.g : c.b); }
    g.dispose();
  }
  build() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.computeBoundingSphere();
    return new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ vertexColors: true }));
  }
}

function makeRoad(mapId = 0) {
  const samples = getTrackSamples(mapId), positions = [], colors = [];
  const palette = mapId === 1
    ? { under: "#5a4057", wall: "#76536b", asphaltA: "#514b61", asphaltB: "#575064", curbA: "#f4d36f", curbB: "#56d4d1", line: "#d9d8ea" }
    : { under: "#b39872", wall: "#c6a980", asphaltA: "#71858b", asphaltB: "#73878c", curbA: "#ffefca", curbB: "#e88369", line: "#cbd7d5" };
  function strip(a, b, left, right, color, height = 0) {
    const c = new THREE.Color(color);
    const vertices = [[a.x + a.nx * left, a.y + height, a.z + a.nz * left], [b.x + b.nx * left, b.y + height, b.z + b.nz * left], [a.x + a.nx * right, a.y + height, a.z + a.nz * right], [b.x + b.nx * right, b.y + height, b.z + b.nz * right]];
    for (const i of [0, 2, 1, 1, 2, 3]) { positions.push(...vertices[i]); colors.push(c.r, c.g, c.b); }
  }
  for (let i = 0; i < sampleCount; i++) {
    const a = samples[i], b = samples[i + 1];
    strip(a, b, -7.05, 7.05, palette.under, -1.25);
    for (const side of [-7.05, 7.05]) {
      const wall = [[a.x + a.nx * side, a.y, a.z + a.nz * side], [b.x + b.nx * side, b.y, b.z + b.nz * side], [a.x + a.nx * side, a.y - 1.25, a.z + a.nz * side], [b.x + b.nx * side, b.y - 1.25, b.z + b.nz * side]];
      const color = new THREE.Color(palette.wall);
      for (const vertex of [0, 1, 2, 2, 1, 3]) { positions.push(...wall[vertex]); colors.push(color.r, color.g, color.b); }
    }
    strip(a, b, -6.45, 6.45, i % 2 ? palette.asphaltA : palette.asphaltB);
    const curb = Math.floor(i / 4) % 2 ? palette.curbA : palette.curbB;
    strip(a, b, -7.05, -6.45, curb, .05); strip(a, b, 6.45, 7.05, curb, .05);
    if (i % 12 < 6) { strip(a, b, -2.16, -2.04, palette.line, .02); strip(a, b, 2.04, 2.16, palette.line, .02); }
    if (i < 3) for (let j = 0; j < 12; j++) strip(a, b, -6.4 + j * 1.067, -6.4 + (j + 1) * 1.067, (i + j) % 2 ? "#f7f3df" : "#233e49", .04);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
}

function makeIsland(detail) {
  const samples = getTrackSamples(0);
  const batch = new Batch(), rng = random(4277);
  const box = new THREE.BoxGeometry(1, 1, 1), sphere = new THREE.IcosahedronGeometry(1, 0), cloud = new THREE.IcosahedronGeometry(1, 1), cylinder = new THREE.CylinderGeometry(1, 1, 1, 7), cone = new THREE.ConeGeometry(1, 1, 7);
  // A layered, faceted island rests just above the turquoise water.
  batch.add(new THREE.CylinderGeometry(257, 243, 12, 64), "#e5c996", [-5, -8, 5], [1.06, 1, .9]);
  batch.add(new THREE.CylinderGeometry(247, 257, 3, 64), "#efd59a", [-5, -1.7, 5], [1.06, 1, .9]);
  batch.add(new THREE.CylinderGeometry(239, 247, 1.2, 64), "#95c884", [-5, -.1, 5], [1.06, 1, .9]);
  const distanceToRoad = (x, z) => { let min = Infinity; for (let i = 0; i < samples.length; i += 5) min = Math.min(min, (samples[i].x - x) ** 2 + (samples[i].z - z) ** 2); return Math.sqrt(min); };
  function palm(x, z, size) {
    const y = 5 * size;
    batch.add(cylinder, "#af8f60", [x, y, z], [.65 * size, 10 * size, .65 * size], [0, 0, -.12]);
    for (let k = 0; k < 5; k++) {
      const angle = k * Math.PI * 2 / 5;
      batch.add(sphere, k % 2 ? "#459974" : "#62ad76", [x + Math.cos(angle) * 2.6 * size, y * 2, z + Math.sin(angle) * 2.6 * size], [5 * size, .6 * size, 1.5 * size], [0, -angle, -.16]);
    }
    batch.add(sphere, "#92794e", [x, y * 2 - .5, z], [1.1 * size, 1.1 * size, 1.1 * size]);
  }
  for (let i = 0; i < (detail ? 190 : 95); i++) {
    const x = (rng() - .5) * 470, z = (rng() - .5) * 410;
    if (Math.hypot(x / 1.06, z / .9) > 236 || distanceToRoad(x, z) < 15 || Math.hypot(x + 5, z + 20) < 60) continue;
    const size = .65 + rng() * .7;
    if (i % 3 === 0) palm(x, z, size);
    else {
      batch.add(cylinder, "#a38758", [x, 2.1 * size, z], [.6, 4.2 * size, .6]);
      batch.add(sphere, i % 2 ? "#5fae78" : "#76b976", [x, 6 * size, z], [4 * size, 5 * size, 4 * size]);
    }
    if (detail && i % 2 === 0) batch.add(sphere, "#efdfad", [x + 4, 1, z + 2], [2, 2, 1.6]);
  }
  // Castle and hillside landmark, far from the road.
  batch.add(sphere, "#75ac86", [-7, 2, -20], [56, 32, 46]);
  batch.add(sphere, "#a5c798", [10, 2, -35], [29, 37, 29]);
  batch.add(box, "#f3e7c5", [-7, 35, -20], [23, 20, 18]);
  batch.add(cone, "#e99977", [-7, 50, -20], [18, 15, 16], [0, Math.PI / 4, 0]);
  for (const x of [-21, 7]) for (const z of [-31, -9]) {
    batch.add(cylinder, "#fff0cd", [x, 37, z], [5, 27, 5]);
    batch.add(cone, "#ea9a7e", [x, 55, z], [6.8, 14, 6.8]);
    batch.add(box, "#826f6e", [x, 67, z], [.25, 9, .25]);
    batch.add(box, "#ffc954", [x + 2, 70, z], [4, 2.2, .15]);
  }
  batch.add(box, "#7a9392", [-7, 31, -10.8], [5, 11, .3]);
  // Lighthouse on the shore.
  batch.add(cylinder, "#f9ebce", [-225, 13, 30], [5, 26, 5]);
  batch.add(cylinder, "#e59377", [-225, 16, 30], [5.1, 5, 5.1]);
  batch.add(cylinder, "#487c88", [-225, 29, 30], [6, 6, 6]);
  batch.add(cone, "#e69978", [-225, 35, 30], [8, 7, 8]);
  // Beach corners make the island feel lived in while keeping all geometry batched.
  for (const [x, z, color] of [[-96, -172, "#f28b72"], [82, 157, "#f5ca57"], [176, 42, "#79bfc1"], [-165, 98, "#ef9eb0"]]) {
    batch.add(cylinder, "#b48458", [x, 2.2, z], [.18, 4.4, .18]);
    batch.add(cone, color, [x, 4.5, z], [3.2, 1.4, 3.2]);
    batch.add(box, "#f4e4bb", [x + 3.6, .65, z + 1.5], [3.1, .35, 1.5]);
  }
  for (let i = 0; i < 34; i++) {
    const distance = 28 + i / 34 * (TRACK_LENGTH - 56), side = i % 2 ? 7.15 : -7.15, p = trackPoint(distance, side);
    // Every roadside prop sits on a planter fastened to the elevated road.
    batch.add(box, "#dbc291", [p.x, p.y - .25, p.z], [1.45, .55, 1.45], [0, p.angle, 0]);
    batch.add(box, "#8d765a", [p.x, p.y - .82, p.z], [.25, .75, .25], [0, p.angle, 0]);
    if (i % 2 === 0) {
      batch.add(cylinder, "#4b7d74", [p.x, p.y + .8, p.z], [.12, 1.6, .12]);
      batch.add(sphere, i % 4 ? "#ffd86a" : "#ff9d7b", [p.x, p.y + 2, p.z], [.45, .45, .45]);
    } else {
      batch.add(sphere, "#ffcf7a", [p.x, p.y + .34, p.z], [.36, .18, .36]);
      batch.add(sphere, "#f18c93", [p.x + .42, p.y + .3, p.z + .2], [.24, .14, .24]);
    }
  }
  for (let i = 0; i < 28; i++) {
    const angle = i / 28 * Math.PI * 2, x = Math.cos(angle) * 262, z = Math.sin(angle) * 232;
    batch.add(sphere, i % 2 ? "#c4b692" : "#d7c69e", [x, -1, z], [7 + rng() * 5, 4 + rng() * 6, 6 + rng() * 4]);
  }
  for (let i = 0; i < (detail ? 18 : 8); i++) {
    const angle = rng() * Math.PI * 2, radius = 340 + rng() * 150, x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
    for (let j = 0; j < 4; j++) batch.add(cloud, "#fffdf1", [x + j * 9, 98 + (i % 3) * 20 + Math.sin(j) * 2, z], [17 + (j % 2) * 4, 6.5 + (j % 2) * 2, 10]);
  }
  // Low-cost roadside flags and rail posts provide speed and scale cues.
  for (let i = 0; i < 72; i++) {
    const p = trackPoint(i / 72 * TRACK_LENGTH, i % 2 ? 7.25 : -7.25);
    if (i % 3 === 0) {
      batch.add(box, "#dbc291", [p.x, p.y + .12, p.z], [.9, .24, .9], [0, p.angle, 0]);
      batch.add(box, "#c0a577", [p.x, p.y + 2, p.z], [.25, 3.8, .25]);
      batch.add(box, i % 2 ? "#ffca5c" : "#78c8be", [p.x, p.y + 4.6, p.z], [1.7, 2.8, .12], [0, p.angle, 0]);
    }
    if (i % 2 === 0) {
      const center = trackPoint(i / 72 * TRACK_LENGTH);
      batch.add(box, "#d4bd93", [center.x, (center.y - 1.5) / 2, center.z], [3.5, center.y - 1.5, 3.5]);
    }
  }
  const mesh = batch.build();
  for (const g of [box, sphere, cloud, cylinder, cone]) g.dispose();
  return mesh;
}


function makeCanyon(detail) {
  const batch = new Batch(), rng = random(9317), samples = getTrackSamples(1);
  const box = new THREE.BoxGeometry(1, 1, 1), rock = new THREE.IcosahedronGeometry(1, 0), sphere = new THREE.IcosahedronGeometry(1, 1);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 7), cone = new THREE.ConeGeometry(1, 1, 6);
  batch.add(new THREE.CylinderGeometry(274, 250, 16, 56), "#3b2e48", [0, -10, 0], [1.08, 1, .88]);
  batch.add(new THREE.CylinderGeometry(254, 269, 4, 56), "#624354", [0, -.3, 0], [1.08, 1, .88]);
  const distanceToRoad = (x, z) => { let min = Infinity; for (let i = 0; i < samples.length; i += 5) min = Math.min(min, (samples[i].x - x) ** 2 + (samples[i].z - z) ** 2); return Math.sqrt(min); };
  for (let i = 0; i < (detail ? 155 : 80); i++) {
    const x = (rng() - .5) * 500, z = (rng() - .5) * 400;
    if (Math.hypot(x / 1.08, z / .88) > 242 || distanceToRoad(x, z) < 17) continue;
    const size = .7 + rng() * 1.25;
    if (i % 5 === 0) {
      const glow = i % 10 ? "#4fd7d0" : "#b98cff";
      batch.add(cone, glow, [x, 3.6 * size, z], [1.35 * size, 7.2 * size, 1.35 * size], [0, rng() * Math.PI, .16]);
      batch.add(cone, "#d8fff4", [x + 2.1 * size, 2.2 * size, z + .8], [.7 * size, 4.4 * size, .7 * size], [0, rng() * Math.PI, -.2]);
    } else if (i % 3 === 0) {
      batch.add(cylinder, i % 2 ? "#a85f55" : "#805064", [x, 4.5 * size, z], [4.6 * size, 9 * size, 4.6 * size]);
      batch.add(cylinder, "#c2775d", [x, 9.2 * size, z], [6.2 * size, 1.1 * size, 6.2 * size]);
    } else batch.add(rock, i % 2 ? "#725066" : "#8b5a65", [x, 2.2 * size, z], [4.5 * size, 3.4 * size, 4 * size], [rng(), rng(), rng()]);
  }
  // Observatory and ringed planet make the silhouette immediately different from the island.
  batch.add(cylinder, "#48516f", [-48, 8, -34], [18, 16, 18]);
  batch.add(sphere, "#9cc6cf", [-48, 22, -34], [18, 10, 18]);
  batch.add(box, "#d0b76b", [-48, 33, -34], [2, 17, 2], [0, 0, -.18]);
  batch.add(sphere, "#e0b77b", [128, 86, -190], [31, 31, 31]);
  batch.add(new THREE.TorusGeometry(41, 2.6, 6, 24), "#73c9c4", [128, 86, -190], [1, 1, 1], [1.1, .2, .25]);
  for (let i = 0; i < 72; i++) {
    const p = trackPoint(i / 72 * TRACK_LENGTH, i % 2 ? 7.25 : -7.25, 1);
    if (i % 3 === 0) {
      batch.add(box, "#5d506d", [p.x, p.y + .18, p.z], [.95, .3, .95], [0, p.angle, 0]);
      batch.add(cylinder, "#696a88", [p.x, p.y + 2, p.z], [.2, 3.8, .2]);
      batch.add(cone, i % 2 ? "#51d5cf" : "#f3cb63", [p.x, p.y + 4.7, p.z], [.8, 2.3, .8]);
    }
    if (i % 2 === 0) {
      const center = trackPoint(i / 72 * TRACK_LENGTH, 0, 1);
      batch.add(cylinder, "#4a394f", [center.x, (center.y - 2) / 2, center.z], [3.7, center.y - 2, 3.7]);
    }
  }
  for (let i = 0; i < 22; i++) {
    const angle = i / 22 * Math.PI * 2, x = Math.cos(angle) * 275, z = Math.sin(angle) * 224;
    batch.add(rock, i % 2 ? "#4c3a58" : "#674354", [x, 2, z], [10 + rng() * 8, 12 + rng() * 18, 9 + rng() * 7], [rng(), rng(), rng()]);
  }
  const mesh = batch.build(); [box, rock, sphere, cylinder, cone].forEach(g => g.dispose()); return mesh;
}
function textTexture(text, background, color = "#fffaf0", width = 256, height = 128) {
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d"); ctx.fillStyle = background; ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "#ffffffa0"; ctx.lineWidth = 7; ctx.strokeRect(7, 7, width - 14, height - 14);
  ctx.fillStyle = color; ctx.font = `900 ${Math.min(height * .72, width / Math.max(1, text.length) * 1.2)}px Trebuchet MS, Arial`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, width / 2, height / 2 + 4, width - 28);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.generateMipmaps = false; texture.minFilter = THREE.LinearFilter;
  return texture;
}

function createKart(character, avatar = "boy") {
  const batch = new Batch(), box = new THREE.BoxGeometry(1, 1, 1), ball = new THREE.IcosahedronGeometry(1, 1), cylinder = new THREE.CylinderGeometry(1, 1, 1, 10);
  const c = COLORS[character], skin = "#e3ac7d", hair = "#4e3d34";
  batch.add(box, "#284655", [0, .68, 0], [2.2, .38, 3.15]);
  batch.add(box, c, [0, 1.02, .05], [2.05, .65, 2.65]);
  batch.add(ball, c, [0, 1.2, 1.1], [1.15, .45, .9]);
  batch.add(box, "#fdf4cc", [0, 1.12, 1.83], [.52, .28, .08]);
  batch.add(box, "#254653", [0, 1.35, -.55], [1.23, 1.12, .32], [-.15, 0, 0]);
  batch.add(ball, c, [0, 1.68, -.2], [.65, .75, .5]);
  batch.add(ball, skin, [0, 2.55, -.05], [.68, .71, .64]);
  batch.add(ball, hair, [0, 2.87, -.2], [.72, .44, .59]);
  batch.add(ball, c, [0, 3.06, -.18], [.74, .29, .6]);
  batch.add(box, "#fff1c8", [0, 3.15, -.17], [.14, .18, 1.13]);
  for (const x of [-.64, .64]) batch.add(ball, skin, [x, 2.54, -.02], [.15, .22, .17]);
  if (avatar === "girl") {
    batch.add(ball, hair, [0, 2.43, -.72], [.55, .63, .3]);
    batch.add(ball, hair, [.52, 2.43, -.7], [.29, .6, .35], [0, 0, -.25]);
    batch.add(ball, "#ffda72", [.46, 2.83, -.63], [.19, .15, .17]);
  } else batch.add(ball, hair, [0, 2.75, .35], [.6, .14, .29]);
  for (const x of [-.3, .3]) {
    batch.add(ball, "#fff8e8", [x, 2.57, .5], [.17, .2, .12]);
    batch.add(ball, "#264756", [x, 2.57, .61], [.08, .1, .05]);
  }
  batch.add(ball, "#a96e4f", [0, 2.35, .59], [.12, .07, .06]);
  for (const x of [-.62, .62]) batch.add(ball, skin, [x, 1.8, .43], [.21, .22, .23]);
  for (const x of [-1.23, 1.23]) for (const z of [-.93, .98]) {
    batch.add(cylinder, "#263d49", [x, .6, z], [.61, .51, .61], [0, 0, Math.PI / 2]);
    batch.add(cylinder, "#ffcd66", [x + Math.sign(x) * .27, .6, z], [.3, .06, .3], [0, 0, Math.PI / 2]);
  }
  batch.add(box, c, [0, 1.55, -1.54], [2.7, .17, .44]);
  const mesh = batch.build(); [box, ball, cylinder].forEach(g => g.dispose()); return mesh;
}

export function createView(container, mode = "auto") {
  const { canvas, context, version } = chooseContext(mode);
  const detail = version === 2 && mode !== "light";
  const renderer = new THREE.WebGLRenderer({ canvas, context, antialias: false });
  renderer.setClearColor("#a1e1e6"); renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(); scene.fog = new THREE.Fog("#a1e1e6", detail ? 260 : 190, detail ? 700 : 530);
  const hemi = new THREE.HemisphereLight("#fffae5", "#769b95", 2.3); scene.add(hemi);
  const sun = new THREE.DirectionalLight("#fff1d5", 2.4); sun.position.set(-140, 240, -80); scene.add(sun);
  const camera = new THREE.PerspectiveCamera(54, 1, .2, 1600);
  function buildMapGroup(mapId) {
    const group = new THREE.Group(), canyon = mapId === 1;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshBasicMaterial({ color: canyon ? "#211d35" : "#57bbcf" }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -5; group.add(ground);
    group.add(canyon ? makeCanyon(detail) : makeIsland(detail), makeRoad(mapId));
    for (const [at, lateral] of RAMPS) {
      const point = trackPoint(at, lateral, mapId), ramp = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(3.2, .7, 5.8), new THREE.MeshLambertMaterial({ color: canyon ? "#7653a6" : "#f3a64f" })); body.position.y = .48; body.rotation.x = -.19; ramp.add(body);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.55, .08, 4.7), new THREE.MeshBasicMaterial({ color: canyon ? "#57dbd2" : "#ffe39a" })); stripe.position.set(0, .88, -.05); stripe.rotation.x = -.19; ramp.add(stripe);
      for (const x of [-1.42, 1.42]) { const edge = new THREE.Mesh(new THREE.BoxGeometry(.18, .32, 5.7), new THREE.MeshLambertMaterial({ color: canyon ? "#e1bd59" : "#bd5e48" })); edge.position.set(x, .84, 0); edge.rotation.x = -.19; ramp.add(edge); }
      ramp.position.set(point.x, point.y, point.z); ramp.rotation.y = point.angle; group.add(ramp);
    }
    if (!canyon) {
      const shore = new THREE.Mesh(new THREE.RingGeometry(253, 289, 64), new THREE.MeshBasicMaterial({ color: "#81d5d7", side: THREE.DoubleSide }));
      shore.rotation.x = -Math.PI / 2; shore.position.set(-5, -4.7, 5); shore.scale.set(1.06, .9, 1); group.add(shore);
    } else {
      const starPositions = new Float32Array((detail ? 170 : 85) * 3);
      for (let i = 0; i < starPositions.length; i += 3) { const a = i * 2.399, r = 330 + (i % 19) * 13; starPositions[i] = Math.cos(a) * r; starPositions[i + 1] = 80 + (i % 17) * 9; starPositions[i + 2] = Math.sin(a) * r; }
      const starGeometry = new THREE.BufferGeometry(); starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
      group.add(new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: "#fff1c4", size: 2.2, sizeAttenuation: true })));
    }
    scene.add(group); return group;
  }
  const mapGroups = [buildMapGroup(0), buildMapGroup(1)]; mapGroups[1].visible = false;
  const gate = new THREE.Group(); scene.add(gate);
  const optionMaterials = [], optionBoards = [];
  for (let lane = 0; lane < 3; lane++) {
    const group = new THREE.Group(), color = ["#ec9974", "#75a5e1", "#77bd9b"][lane];
    const mat = new THREE.MeshLambertMaterial({ color });
    for (const x of [-1.96, 1.96]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(.23, 6.7, .27), mat); post.position.set(x, 3.35, 0); group.add(post);
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(4.15, .23, .3), mat); top.position.y = 6.7; group.add(top);
    const material = new THREE.MeshBasicMaterial({ map: textTexture("?", color), side: THREE.DoubleSide });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 1.85), material); board.position.set(0, 5.65, -.05); group.add(board);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 5), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .5, side: THREE.DoubleSide })); floor.rotation.x = -Math.PI / 2; floor.position.y = .06; group.add(floor);
    group.position.x = -(lane - 1) * LANE_WIDTH; gate.add(group); optionMaterials.push(material); optionBoards.push(board);
  }
  const start = new THREE.Group(), startAt = trackPoint(0); start.position.set(startAt.x, startAt.y, startAt.z); start.rotation.y = startAt.angle;
  const startMat = new THREE.MeshLambertMaterial({ color: "#e2bd7e" });
  for (const x of [-7.5, 7.5]) { const post = new THREE.Mesh(new THREE.BoxGeometry(.65, 9, .65), startMat); post.position.set(x, 4.5, 0); start.add(post); }
  const startBoard = new THREE.Mesh(new THREE.PlaneGeometry(16, 2.9), new THREE.MeshBasicMaterial({ map: textTexture("BOA AVENTURA!", "#16817c", "#fff2c8", 1024, 256), side: THREE.DoubleSide })); startBoard.position.y = 8; startBoard.rotation.y = Math.PI; start.add(startBoard); scene.add(start);
  const karts = Array.from({ length: 4 }, (_, i) => { const kart = createKart(i, i % 2 ? "girl" : "boy"); scene.add(kart); return kart; });
  const labels = karts.map(() => {
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: true }));
    label.scale.set(6.8, 1.27, 1); label.visible = false; scene.add(label); return label;
  });
  function createPickup() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(.48, .72, 2.15, 10), new THREE.MeshLambertMaterial({ color: "#f4f1da" })); body.position.y = 1.2; group.add(body);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(.49, .85, 10), new THREE.MeshBasicMaterial({ color: "#ee6b55" })); nose.position.y = 2.7; group.add(nose);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(.34, .9, 8), new THREE.MeshBasicMaterial({ color: "#ffd75b" })); flame.position.y = -.2; flame.rotation.x = Math.PI; group.add(flame);
    for (const x of [-.62, .62]) { const fin = new THREE.Mesh(new THREE.BoxGeometry(.48, .62, .12), new THREE.MeshLambertMaterial({ color: "#4d9ad1" })); fin.position.set(x, .72, 0); fin.rotation.z = x < 0 ? -.45 : .45; group.add(fin); }
    return group;
  }
  const pickupIcons = Array.from({ length: 7 }, () => { const icon = createPickup(); icon.visible = false; scene.add(icon); return icon; });
  const shadows = karts.map(() => {
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.6, 14), new THREE.MeshBasicMaterial({ color: "#2c5860", transparent: true, opacity: .24, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.scale.y = 1.3; scene.add(shadow); return shadow;
  });
  const explosions = karts.map((_, kartIndex) => {
    const count = detail ? 18 : 12, geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    const colors = new Float32Array(count * 3), velocity = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const angle = i / count * Math.PI * 2 + kartIndex * .37, lift = .35 + (i % 4) * .22;
      velocity[i * 3] = Math.cos(angle) * (3.5 + i % 3); velocity[i * 3 + 1] = lift * 6; velocity[i * 3 + 2] = Math.sin(angle) * (3.5 + (i + 1) % 3);
      const color = new THREE.Color(i % 3 === 0 ? "#fff2a8" : i % 3 === 1 ? "#ff9f43" : "#e84f4f"); colors.set([color.r, color.g, color.b], i * 3);
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const points = new THREE.Points(geometry, new THREE.PointsMaterial({ size: detail ? .95 : .75, vertexColors: true, transparent: true, depthWrite: false }));
    points.userData.velocity = velocity; points.visible = false; scene.add(points); return points;
  });
  const visual = new Map(), lookTarget = new THREE.Vector3(), camTarget = new THREE.Vector3();
  let gateKey = "", wasRacing = false, disposed = false, time = 0, diagnosticTime = 0, ratio = Math.min(devicePixelRatio || 1, detail ? 1.35 : 1), slowTime = 0, adaptive = false;
  canvas.dataset.webgl = String(version);
  const resize = () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setPixelRatio(ratio); renderer.setSize(innerWidth, innerHeight); };
  resize(); container.replaceChildren(canvas); window.addEventListener("resize", resize);
  canvas.addEventListener("webglcontextlost", event => { event.preventDefault(); if (!disposed) container.dispatchEvent(new CustomEvent("graphicslost")); });
  function render(race, id, dt, menu = false) {
    time += dt; const player = race?.players.find(p => p.id === id);
    const mapId = player && !menu && race.mapId === 1 ? 1 : 0, canyon = mapId === 1;
    mapGroups.forEach((group, i) => { group.visible = i === mapId; });
    const sky = canyon ? "#302b59" : "#a1e1e6"; renderer.setClearColor(sky); scene.fog.color.set(sky);
    hemi.color.set(canyon ? "#bbb5ff" : "#fffae5"); hemi.groundColor.set(canyon ? "#46314f" : "#769b95"); hemi.intensity = canyon ? 1.75 : 2.3;
    sun.color.set(canyon ? "#b9d9ff" : "#fff1d5"); sun.intensity = canyon ? 1.7 : 2.4;
    const startPoint = trackPoint(0, 0, mapId); start.position.set(startPoint.x, startPoint.y, startPoint.z); start.rotation.y = startPoint.angle;
    start.visible = !player || menu || player.distance > TRACK_LENGTH - 120;
    if (player && !menu) {
      scene.fog.near = detail ? 260 : 190; scene.fog.far = detail ? 700 : 530;
      const blend = 1 - Math.exp(-dt * 15);
      for (let i = 0; i < 4; i++) {
        const p = race.players[i], kart = karts[i];
        if (!p) { kart.visible = shadows[i].visible = labels[i].visible = explosions[i].visible = false; continue; }
        kart.visible = shadows[i].visible = true;
        if (kart.userData.character !== p.character || kart.userData.avatar !== p.avatar) {
          const replacement = createKart(p.character, p.avatar); kart.geometry.dispose(); kart.material.dispose(); kart.geometry = replacement.geometry; kart.material = replacement.material; kart.userData.character = p.character; kart.userData.avatar = p.avatar;
        }
        const label = labels[i], labelText = `${p.name}${p.id === id ? " · VOCÊ" : p.bot ? " · BOT" : ""}`;
        if (label.userData.text !== labelText) {
          label.material.map?.dispose(); label.material.map = textTexture(labelText, p.id === id ? "#176e61" : "#1d4049", "#fff8dd", 512, 96); label.material.needsUpdate = true; label.userData.text = labelText;
          // The local kart is close to the camera: keep its name from covering the road.
          const width = p.id === id ? 2.9 : 3.7; label.scale.set(width, width * 96 / 512, 1);
        }
        let v = visual.get(p.id);
        if (!v || Math.hypot(v.x - p.x, v.z - p.z) > 35) { v = { x: p.x, y: p.y, z: p.z, heading: p.heading }; visual.set(p.id, v); }
        v.x += (p.x - v.x) * blend; v.y += (p.y - v.y) * blend; v.z += (p.z - v.z) * blend; v.heading += wrapAngle(p.heading - v.heading) * blend;
        const jump = p.airtime > 0 ? Math.sin((.62 - p.airtime) / .62 * Math.PI) * 1.45 : 0;
        kart.position.set(v.x, v.y + .04 + jump + Math.sin(time * 15 + i) * .024 * Math.min(1, Math.abs(p.speed) / 10), v.z);
        kart.rotation.set(p.falling ? -.3 : 0, v.heading, p.falling ? (1.55 - p.falling) * .8 : -p.turn * .05);
        const explosion = explosions[i];
        if (p.explosion > 0) {
          const progress = Math.max(0, Math.min(1, 1 - p.explosion / .55)), positions = explosion.geometry.attributes.position.array, velocity = explosion.userData.velocity;
          for (let n = 0; n < positions.length; n += 3) { positions[n] = velocity[n] * progress; positions[n + 1] = velocity[n + 1] * progress - progress * progress * 4.4; positions[n + 2] = velocity[n + 2] * progress; }
          explosion.geometry.attributes.position.needsUpdate = true; explosion.material.opacity = 1 - progress * .8; explosion.position.set(v.x, v.y + 1.5, v.z); explosion.visible = true;
        } else explosion.visible = false;
        kart.visible = !p.falling;
        shadows[i].visible = !p.falling; shadows[i].position.set(v.x, v.y + .045, v.z); shadows[i].rotation.z = -v.heading;
        label.position.set(v.x, v.y + 4.2 + jump, v.z); label.visible = !p.falling && Math.hypot(p.x - player.x, p.z - player.z) < 95 && (p.id === id || Math.hypot(p.x - player.x, p.z - player.z) > 8);
      }
      race.pickups.forEach((item, i) => {
        const icon = pickupIcons[i], point = trackPoint(item.at, item.lateral, mapId), gap = item.at - player.distance;
        icon.position.set(point.x, point.y + .72 + Math.sin(time * 4 + i) * .22, point.z);
        icon.rotation.y = time * 1.6 + i; icon.visible = item.targetId === id && gap > -8 && gap < 70;
      });
      const v = visual.get(id), road = trackPoint(player.distance, 0, mapId);
      camTarget.set(v.x - Math.sin(v.heading) * 13, Math.max(v.y + 7.7, road.y + 4), v.z - Math.cos(v.heading) * 13);
      lookTarget.set(v.x + Math.sin(v.heading) * 19, Math.max(v.y + 1.9, road.y - 3), v.z + Math.cos(v.heading) * 19);
      camera.position.lerp(camTarget, wasRacing ? 1 - Math.exp(-dt * 9) : 1); camera.lookAt(lookTarget); camera.fov = 54 + (player.boost > 0 || player.pickupBoost > 0 ? 3 : 0); camera.updateProjectionMatrix();
      const q = nextQuestion(race, player); gate.visible = Boolean(q && q.at - player.distance < 235);
      if (q && gateKey !== `${race.seed}:${q.id}`) {
        gateKey = `${race.seed}:${q.id}`;
        const point = trackPoint(q.at, 0, mapId); gate.position.set(point.x, point.y, point.z); gate.rotation.y = point.angle;
        q.options.forEach((option, i) => { optionMaterials[i].map.dispose(); optionMaterials[i].map = textTexture(option, ["#d98460", "#538cd3", "#4da37f"][i]); });
      }
      // Boards face the approaching driver; mirrored back faces are avoided by rotating them.
      optionBoards.forEach(board => { board.rotation.y = Math.PI; });
      wasRacing = true;
    } else {
      scene.fog.near = 650; scene.fog.far = 1500;
      gate.visible = false; wasRacing = false; visual.clear();
      labels.forEach(label => { label.visible = false; }); pickupIcons.forEach(icon => { icon.visible = false; }); explosions.forEach(item => { item.visible = false; });
      karts.forEach((kart, i) => { const p = trackPoint(65 + i * 5, (i - 1.5) * 2); kart.visible = true; kart.position.set(p.x, p.y, p.z); kart.rotation.set(0, p.angle, 0); shadows[i].visible = false; });
      const angle = -.76 + Math.sin(time * .025) * .055;
      camera.position.set(Math.cos(angle) * 530, 375, Math.sin(angle) * 530); camera.lookAt(-30, 0, 5); camera.fov = 48; camera.updateProjectionMatrix();
    }
    renderer.render(scene, camera);
    diagnosticTime += dt;
    if (diagnosticTime > 1) {
      canvas.dataset.drawCalls = String(renderer.info.render.calls); canvas.dataset.triangles = String(renderer.info.render.triangles); canvas.dataset.pixelRatio = String(ratio); diagnosticTime = 0;
    }
    // Ignore the deliberately capped 30fps menu when deciding whether the GPU is slow.
    if (player && !menu) {
      if (dt > .04 && dt < .2) slowTime += dt; else slowTime = Math.max(0, slowTime - dt * .4);
      if (slowTime > 5 && ratio > .65) { ratio = Math.max(.65, ratio - .15); resize(); slowTime = 0; adaptive = true; }
    }
  }
  function drawMap(canvas, race, id) {
    const ctx = canvas.getContext("2d"), w = canvas.width, h = canvas.height, mapId = race.mapId === 1 ? 1 : 0, samples = getTrackSamples(mapId);
    ctx.clearRect(0, 0, w, h); ctx.lineJoin = "round"; ctx.lineWidth = 7; ctx.strokeStyle = mapId ? "#9cf1df70" : "#ffffff50"; ctx.beginPath();
    const bounds = mapId ? { minX: -238, maxX: 238, minZ: -196, maxZ: 196 } : { minX: -245, maxX: 245, minZ: -200, maxZ: 220 };
    const map = p => [(p.x - bounds.minX) / (bounds.maxX - bounds.minX) * (w - 24) + 12, (p.z - bounds.minZ) / (bounds.maxZ - bounds.minZ) * (h - 30) + 15];
    samples.forEach((p, i) => { if (i % 6) return; const [x, y] = map(p); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }); ctx.closePath(); ctx.stroke();
    const [sx, sy] = map(samples[0]); ctx.fillStyle = mapId ? "#57dbd2" : "#ffe39a"; ctx.fillRect(sx - 3, sy - 6, 6, 12);
    for (const p of race.players) { const [x, y] = map(trackPoint(p.distance, 0, mapId)); ctx.beginPath(); ctx.arc(x, y, p.id === id ? 5 : 3.5, 0, Math.PI * 2); ctx.fillStyle = COLORS[p.character]; ctx.fill(); if (p.id === id) { ctx.lineWidth = 2; ctx.strokeStyle = "white"; ctx.stroke(); } }
  }  return {
    version, render, drawMap,
    get stats() { return { webgl: version, drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, pixelRatio: ratio, adaptive }; },
    dispose() {
      disposed = true;
      window.removeEventListener("resize", resize);
      const geometries = new Set(), materials = new Set(), textures = new Set();
      scene.traverse(obj => { if (obj.geometry) geometries.add(obj.geometry); const mats = obj.material ? Array.isArray(obj.material) ? obj.material : [obj.material] : []; mats.forEach(m => { materials.add(m); if (m.map) textures.add(m.map); }); });
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); renderer.dispose(); renderer.forceContextLoss(); canvas.remove();
    },
  };
}
