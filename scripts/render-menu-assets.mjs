// Render the game's own models once; the menu needs no extra WebGL contexts.
import { criarServidor } from "./serve.mjs";
import { mkdir, readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const servidor = criarServidor();
await new Promise(resolve => servidor.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch({ headless: true, channel: "msedge", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const destino = "jogos/meus-jogos/corrida/assets/menu";
await mkdir(destino, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 576 } });
  const erros = [];
  page.on("pageerror", e => erros.push(e.message));
  await page.addInitScript(() => {
    window.requestAnimationFrame = () => 1;
    Object.defineProperty(navigator, "deviceMemory", { value: 8 });
    Object.defineProperty(navigator, "hardwareConcurrency", { value: 8 });
    let seed = 74621;
    Math.random = () => ((seed = Math.imul(seed, 1664525) + 1013904223 | 0) >>> 0) / 4294967296;
  });
  await page.route("https://cdn.jsdelivr.net/npm/**", async route => {
    const caminho = route.request().url()
      .replace("https://cdn.jsdelivr.net/npm/three@0.186.0/", "node_modules/three/")
      .replace("https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.20.0/", "node_modules/@dimforge/rapier3d-compat/");
    await route.fulfill({ body: await readFile(caminho), contentType: "text/javascript" });
  });
  await page.goto(`http://127.0.0.1:${servidor.address().port}/jogos/meus-jogos/corrida.html`);
  await page.waitForFunction(() => window.CorridaDiagnostico || window.__corridaDoSaberErroExibido, null, { polling: 100 });
  assert.equal(await page.evaluate(() => !!window.__corridaDoSaberErroExibido), false);
  await page.evaluate(() => {
    for (const id of ["menu-inicial", "interface-jogo"]) document.getElementById(id).style.display = "none";
    const T = window.THREE, d = window.CorridaDiagnostico;
    const scene = new T.Scene(); scene.background = new T.Color(0xedf2eb);
    scene.add(new T.HemisphereLight(0xe6f5ff, 0x647051, 1.65));
    const key = new T.DirectionalLight(0xffefcf, 2.4); key.position.set(-5, 12, -6); scene.add(key);
    const root = new T.Group(); scene.add(root);
    const camera = new T.PerspectiveCamera(35, 960 / 576, 0.1, 100);
    camera.position.set(6, 3.7, -7.5); camera.lookAt(0, 0.9, 0);
    d.renderer.setPixelRatio(1); d.renderer.setSize(960, 576);
    d.renderer.setScissorTest(false);
    window.estudioMenu = { scene, root, camera };
  });
  const modelos = process.argv.includes("--hero-only") ? [] : await page.evaluate(() => Object.keys(window.CorridaDoSaberConfig.garagemCarros));
  for (const id of modelos) {
    await page.evaluate(id => {
      const d = window.CorridaDiagnostico, { scene, root, camera } = window.estudioMenu;
      d.arte.montarCarro(root, window.CorridaDoSaberConfig.garagemCarros[id]);
      root.position.y = 0.6;
      d.renderer.clear(); d.renderer.render(scene, camera);
    }, id);
    await page.locator("body > canvas").screenshot({ path: `${destino}/${id}.png` });
  }
  await page.setViewportSize({ width: 1200, height: 445 });
  await page.evaluate(() => {
    const d = window.CorridaDiagnostico, T = window.THREE;
    d.jogadorVisual.visible = false;
    for (const policial of d.policiais) policial.visual.visible = false;
    d.helicoptero.visible = false;
    const root = new T.Group(); d.cena.add(root);
    const car = new T.Group(); d.arte.montarCarro(car, window.CorridaDoSaberConfig.garagemCarros.classico);
    car.position.set(-3.8, 0.6, -1.5); car.rotation.y = -0.2; root.add(car);
    const opts = { corBase: 0xf2f6ff, corCapo: 0x13233f, corDetalhe: 0x23324a, corSireneA: 0x258fff, corSireneB: 0xff3344 };
    const police = d.arte.policia(opts).visual; police.position.set(1.7, 0.6, 1.5); police.rotation.y = -0.2; root.add(police);
    const moto = d.arte.policia(opts, true).visual; moto.position.set(5.8, 0.8, -1.7); moto.rotation.y = -0.3; root.add(moto);
    const helicopter = d.arte.helicoptero(); helicopter.visible = true;
    helicopter.position.set(-0.8, 6, 9); helicopter.rotation.y = Math.PI * 0.87; root.add(helicopter);
    for (const [x, z] of [[-14, 15], [16, 19], [-19, 30], [25, 26], [-10, 38]]) root.add(d.arte.arvore(x, z));
    const camera = new T.PerspectiveCamera(44, 1200 / 445, 0.1, 800);
    camera.position.set(9, 6.5, -14); camera.lookAt(0, 2.7, 2);
    d.renderer.setPixelRatio(1); d.renderer.setSize(1200, 445);
    d.renderer.setScissorTest(false); d.renderer.clear(); d.renderer.render(d.cena, camera);
  });
  await page.locator("body > canvas").screenshot({ path: `${destino}/hero.png` });
  assert.deepEqual(erros, []);
  console.log(`Menu: ${modelos.length} modelos reais e cena de apresentação renderizados.`);
} finally { await browser.close(); servidor.close(); }
