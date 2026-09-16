import { criarServidor } from "./serve.mjs";
import { readFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const server = criarServidor();
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch({ headless: true, channel: "msedge", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
await mkdir("test-results", { recursive: true });
try {
  for (const webgl1 of [false, true]) {
    const context = await browser.newContext({ viewport: { width: 1100, height: 720 } });
    const page = await context.newPage(), errors = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.addInitScript(webgl1 => {
      let now = 0, next = 1, pending = new Map();
      performance.now = () => now;
      window.requestAnimationFrame = cb => { const id = next++; pending.set(id, cb); return id; };
      window.cancelAnimationFrame = id => pending.delete(id);
      window.advanceBoundaryTest = n => {
        for (let i = 0; i < n; i++) {
          now += 1000 / 60; const frame = pending; pending = new Map();
          for (const callback of frame.values()) callback(now);
        }
      };
      if (webgl1) {
        const get = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function(name, ...args) { return name === "webgl2" ? null : get.call(this, name, ...args); };
      }
    }, webgl1);
    await page.route("**/*", async route => {
      const url = route.request().url();
      if (url.startsWith("https://cdn.jsdelivr.net/npm/")) {
        const file = url.replace("https://cdn.jsdelivr.net/npm/three@0.186.0/", "node_modules/three/")
          .replace("https://cdn.jsdelivr.net/npm/three@0.162.0/", "node_modules/three-webgl1/")
          .replace("https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.20.0/", "node_modules/@dimforge/rapier3d-compat/");
        return route.fulfill({ body: await readFile(file), contentType: "text/javascript" });
      }
      if (url.endsWith("/corrida/js/main.js")) {
        const source = await readFile("jogos/meus-jogos/corrida/js/main.js", "utf8");
        return route.fulfill({ body: source.replace("    window.CorridaDiagnostico = {", `
          window.prepareBoundaryTest = () => {
            totalPoliciasAtivas = 0;
            for (const item of objetosDoMapa) item.corpo?.rigidBody?.setEnabled(false);
            renderizador.render = () => {};
          };
          window.CorridaDiagnostico = {`), contentType: "text/javascript" });
      }
      return route.continue();
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/jogos/meus-jogos/corrida.html`);
    await page.waitForFunction(() => window.CorridaDiagnostico || window.__corridaDoSaberErroExibido, null, { polling: 100 });
    assert.equal(await page.evaluate(() => !!window.__corridaDoSaberErroExibido), false);
    await page.waitForFunction(() => [...document.querySelectorAll('#menu-inicial img')].every(img => img.complete && img.naturalWidth), null, { polling: 100 });
    await page.screenshot({ path: `test-results/menu-final-${webgl1 ? 'webgl1' : 'webgl2'}.png` });
    await page.locator('.btn-serie[data-fase="facil"]').dispatchEvent("click");
    await page.evaluate(() => window.prepareBoundaryTest());
    await page.keyboard.down("ArrowUp");
    for (const [x, z] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const result = await page.evaluate(([x, z]) => {
        const d = window.CorridaDiagnostico, c = d.jogador;
        c.position.set(x * 174, 0.6, z * 174); c.velocity.set(x * 78, 0, z * 78);
        c.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(-x, -z)); c.angularVelocity.set(0, 0, 0);
        let maxHeight = 0;
        for (let i = 0; i < 180; i++) { window.advanceBoundaryTest(1); maxHeight = Math.max(maxHeight, c.position.y); }
        return { x: c.position.x, z: c.position.z, y: c.position.y, maxHeight, state: d.estado };
      }, [x, z]);
      assert.ok(Math.abs(result.x) < 186 && Math.abs(result.z) < 186, JSON.stringify(result));
      assert.ok(result.maxHeight < 0.64 && result.y > 0.57, JSON.stringify(result));
      assert.equal(result.state, "jogando");
    }
    await page.keyboard.up("ArrowUp");
    const airborne = await page.evaluate(() => {
      const c = window.CorridaDiagnostico.jogador;
      c.position.set(185, 9, 0); c.velocity.set(78, 8, 0); c.angularVelocity.set(0, 0, 0);
      window.advanceBoundaryTest(180);
      return { x: c.position.x, y: c.position.y };
    });
    assert.ok(airborne.x < 186 && Math.abs(airborne.y - 0.6) < 0.03);
    assert.deepEqual(errors, []);
    console.log(`${webgl1 ? 'WebGL 1' : 'WebGL 2'}: limite nos quatro lados/cantos, sem elevação; salto contra a parede retorna ao chão.`);
    await context.close();
  }
} finally { await browser.close(); server.close(); }
