import { criarServidor } from "./serve.mjs";
import { mkdir, readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const servidor = criarServidor();
await new Promise(r => servidor.listen(0, "127.0.0.1", r));
const browser = await chromium.launch({ headless: true, channel: "msedge", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
await mkdir("test-results", { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  const erros = [];
  page.on("pageerror", e => erros.push(e.message));
  page.on("console", m => { if (m.type() === "error") erros.push(m.text()); });
  await page.addInitScript(() => {
    window.requestAnimationFrame = () => 1;
    Object.defineProperty(navigator, "deviceMemory", { value: 8 });
    Object.defineProperty(navigator, "hardwareConcurrency", { value: 8 });
  });
  await page.route("https://cdn.jsdelivr.net/npm/**", async route => {
    const url = route.request().url();
    const path = url.replace("https://cdn.jsdelivr.net/npm/three@0.186.0/", "node_modules/three/")
      .replace("https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.20.0/", "node_modules/@dimforge/rapier3d-compat/");
    await route.fulfill({ body: await readFile(path), contentType: "text/javascript" });
  });
  await page.goto("http://127.0.0.1:" + servidor.address().port + "/jogos/meus-jogos/corrida.html");
  await page.waitForFunction(() => window.CorridaDiagnostico || window.__corridaDoSaberErroExibido, null, { polling: 100 });
  assert.equal(await page.evaluate(() => window.__corridaDoSaberErroExibido), false, erros.join("\n"));
  await page.locator('.btn-serie[data-fase="facil"]').dispatchEvent("click");
  await page.evaluate(() => {
    document.querySelectorAll("#menu-inicial, #interface-jogo, .tela-centro").forEach(e => e.style.display = "none");
    const d = window.CorridaDiagnostico, T = window.THREE;
    const s = new T.Scene(); s.background = new T.Color(0xc2d9de);
    s.add(new T.HemisphereLight(0xe6f5ff, 0x647051, 1.65));
    const sun = new T.DirectionalLight(0xffefcf, 2.4);
    sun.position.set(-5, 12, 6); sun.castShadow = true;
    Object.assign(sun.shadow.camera, { left: -15, right: 15, top: 15, bottom: -15, near: 0.1, far: 50 });
    sun.shadow.mapSize.set(1024, 1024); sun.shadow.normalBias = 0.03; sun.shadow.bias = -0.0001;
    s.add(sun);
    const floor = new T.Mesh(new T.PlaneGeometry(200, 200), new T.MeshPhongMaterial({ color: 0x82978b }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; s.add(floor);
    const camera = new T.PerspectiveCamera(38, 1.5, 0.1, 400);
    const root = new T.Group(); s.add(root);
    d.renderer.setPixelRatio(1); d.renderer.setSize(1200, 800);
    window.galeriaArte = { s, root, camera };
  });
  for (const tipo of ["classico", "policia", "moto", "helicoptero", "garagem", "ambiente", "frota"]) {
    const stats = await page.evaluate(tipo => {
      const T = window.THREE, d = window.CorridaDiagnostico, { s, root, camera } = window.galeriaArte;
      root.clear();
      let alvo = new T.Vector3(0, 0.75, 0);
      camera.position.set(6.2, 4, 7.8);
      if (tipo === "ambiente") {
        camera.position.set(-13, 10, 39); alvo.set(0, 2, 2);
        d.jogadorVisual.position.set(0, 0.6, 17);
        d.jogadorVisual.quaternion.identity();
        camera.lookAt(alvo); d.renderer.setScissorTest(false); d.renderer.setViewport(0, 0, 1200, 800);
        d.renderer.clear(); d.renderer.render(d.cena, camera);
        return { calls: d.renderer.info.render.calls, triangles: d.renderer.info.render.triangles };
      }
      if (tipo === "frota") {
        const car = new T.Group(); d.arte.montarCarro(car, window.CorridaDoSaberConfig.garagemCarros.classico);
        car.position.set(-3.8, 0.6, 2.4); car.rotation.y = Math.PI * 0.88; root.add(car);
        const opts = { corBase: 0xf2f6ff, corCapo: 0x13233f, corDetalhe: 0x23324a, corSireneA: 0x258fff, corSireneB: 0xff3344 };
        const police = d.arte.policia(opts).visual; police.position.set(1.6, 0.6, 1.8);
        police.rotation.y = Math.PI * 0.88; root.add(police);
        const moto = d.arte.policia(opts, true).visual; moto.position.set(5.5, 0.8, -1);
        moto.rotation.y = Math.PI * 0.94; root.add(moto);
        const h = d.arte.helicoptero(); h.position.set(-3, 5, -6.3);
        h.rotation.y = 0.25; h.visible = true; root.add(h);
        camera.position.set(15, 11.5, 22); alvo.set(0, 2.4, -1.7);
      } else if (tipo === "helicoptero") {
        const h = d.arte.helicoptero(); h.visible = true; h.position.y = 1.7; root.add(h);
        camera.position.set(10, 7.2, 12); alvo.set(0, 1.8, -1);
      } else if (tipo === "policia" || tipo === "moto") {
        const p = d.arte.policia({ corBase: 0xf2f6ff, corCapo: 0x13233f, corDetalhe: 0x23324a, corSireneA: 0x258fff, corSireneB: 0xff3344 }, tipo === "moto");
        root.add(p.visual); p.visual.position.y = tipo === "moto" ? 0.8 : 0.6;
        camera.position.z = -7.8;
      } else if (tipo === "garagem") {
        const modelos = Object.values(window.CorridaDoSaberConfig.garagemCarros);
        modelos.forEach((modelo, i) => {
          const g = new T.Group(); d.arte.montarCarro(g, modelo);
          g.position.set((i % 5 - 2) * 4.3, 0.6, Math.floor(i / 5) * 6);
          root.add(g);
        });
        camera.position.set(18, 17, 26); alvo.set(0, 0.6, 3);
      } else {
        const g = new T.Group(); d.arte.montarCarro(g, window.CorridaDoSaberConfig.garagemCarros.classico);
        g.position.y = 0.6; root.add(g);
      }
      camera.lookAt(alvo);
      d.renderer.setScissorTest(false); d.renderer.setViewport(0, 0, 1200, 800);
      d.renderer.clear(); d.renderer.render(s, camera);
      return { calls: d.renderer.info.render.calls, triangles: d.renderer.info.render.triangles };
    }, tipo);
    await page.locator("body > canvas").screenshot({ path: "test-results/arte-" + tipo + ".png", animations: "disabled" });
    console.log(tipo + ": " + JSON.stringify(stats));
  }
  assert.deepEqual(erros, []);
} finally { await browser.close(); servidor.close(); }
