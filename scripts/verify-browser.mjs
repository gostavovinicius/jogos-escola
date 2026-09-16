import { criarServidor } from "./serve.mjs";
import { mkdir, readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const servidor = criarServidor();
await new Promise(resolve => servidor.listen(0, "127.0.0.1", resolve));
const base = "http://127.0.0.1:" + servidor.address().port;
const browser = await chromium.launch({
  headless: true, channel: "msedge",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
await mkdir("test-results", { recursive: true });
try {
  for (const modo of ["moderno", "webgl1", "sombras", "legado", "sem-webgl", "sem-wasm", "falha-rede"]) {
    const context = await browser.newContext({ viewport: { width: 1100, height: 720 } });
    const page = await context.newPage();
    const erros = [];
    const requests = [];
    page.on("pageerror", e => erros.push(e.message));
    page.on("console", m => { if (m.type() === "error") erros.push(m.text()); });
    page.on("request", r => requests.push(r.url()));
    // Serve the exact installed packages for deterministic, offline browser tests.
    await page.route("https://cdn.jsdelivr.net/npm/**", async route => {
      const url = route.request().url();
      if (modo === "falha-rede" && url.includes("rapier3d-compat")) return route.abort();
      let relative;
      if (url.includes("three@0.186.0/")) relative = "node_modules/three/" + url.split("three@0.186.0/")[1];
      if (url.includes("three@0.162.0/")) relative = "node_modules/three-webgl1/" + url.split("three@0.162.0/")[1];
      if (url.includes("rapier3d-compat@0.20.0/")) relative = "node_modules/@dimforge/rapier3d-compat/" + url.split("rapier3d-compat@0.20.0/")[1];
      if (!relative) throw new Error("Dependência inesperada: " + url);
      await route.fulfill({ body: await readFile(relative), contentType: "text/javascript" });
    });
    if (modo === "webgl1" || modo === "sem-webgl") {
      await page.addInitScript(modo => {
        const getContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function(nome, ...args) {
          if (nome === "webgl2" || (modo === "sem-webgl" && /webgl/.test(nome))) return null;
          return getContext.call(this, nome, ...args);
        };
      }, modo);
    }
    if (modo === "sem-wasm") await page.addInitScript(() => { window.WebAssembly = undefined; });
    if (modo === "sombras") await page.addInitScript(() => {
      Object.defineProperty(navigator, "deviceMemory", { value: 8 });
      Object.defineProperty(navigator, "hardwareConcurrency", { value: 8 });
    });
    const arquivo = modo === "legado" ? "corrida-backup.html" : "corrida.html";
    await page.goto(base + "/jogos/meus-jogos/" + arquivo);
    if (["sem-webgl", "sem-wasm", "falha-rede"].includes(modo)) {
      await page.waitForFunction(() => window.__corridaDoSaberErroExibido);
      assert.equal(await page.evaluate(() => !!window.CorridaDiagnostico), false);
      if (modo !== "falha-rede") assert.equal(requests.some(u => u.includes("three@")), false);
      assert.match(await page.locator("body").innerText(), /WebGL|WebAssembly|Não foi possível carregar/);
      console.log(modo + ": erro visível, sem iniciar jogo incompleto");
      await context.close();
      continue;
    }
    await page.waitForFunction(() => window.CorridaDiagnostico || window.__corridaDoSaberErroExibido);
    assert.equal(await page.evaluate(() => window.__corridaDoSaberErroExibido), false, erros.join("\n"));
    const rev = await page.evaluate(() => window.THREE.REVISION);
    if (modo === "sombras") assert.equal(await page.evaluate(() => window.CorridaDiagnostico.renderer.shadowMap.enabled), true);
    assert.equal(rev, modo === "webgl1" ? "162" : "186");
    assert.equal(requests.some(u => u.includes(modo === "webgl1" ? "three@0.186.0" : "three@0.162.0")), false);
    if (modo !== "legado") {
      await page.waitForFunction(() => [...document.querySelectorAll('#menu-inicial img')].every(img => img.complete && img.naturalWidth > 0));
      assert.equal(await page.locator('.carro-miniatura').count(), 5);
      assert.equal(await page.locator('.btn-carro[aria-pressed="true"]').count(), 1);
      await page.screenshot({ path: "test-results/menu-" + modo + ".png" });
      if (modo === "moderno") {
        for (const viewport of [{ width: 390, height: 844 }, { width: 568, height: 320 }]) {
          await page.setViewportSize(viewport);
          assert.equal(await page.evaluate(() => {
            const shell = document.querySelector('.menu-shell');
            return shell.scrollWidth <= shell.clientWidth + 1;
          }), true, "Menu não deve ter rolagem horizontal");
          for (const button of await page.locator('.btn-serie, .btn-carro').all()) {
            await button.scrollIntoViewIfNeeded();
            await button.click({ trial: true });
          }
          await page.locator('#menu-inicial h1').scrollIntoViewIfNeeded();
          await page.screenshot({ path: `test-results/menu-${viewport.width}.png` });
        }
        await page.setViewportSize({ width: 1100, height: 720 });
      }
    }
    await page.locator('.btn-serie[data-fase="facil"]').click();
    await page.waitForFunction(() => window.CorridaDiagnostico.estado === "jogando");
    await page.waitForFunction(() => Math.abs(window.CorridaDiagnostico.jogador.position.y - 0.6) < 0.03);
    const inicial = await page.evaluate(() => {
      const c = window.CorridaDiagnostico.jogador;
      return { x: c.position.x, z: c.position.z, y: c.position.y };
    });
    await page.keyboard.down("ArrowUp");
    await page.waitForFunction(inicial => {
      const p = window.CorridaDiagnostico.jogador.position;
      return Math.hypot(p.x - inicial.x, p.z - inicial.z) > 3;
    }, inicial);
    await page.keyboard.up("ArrowUp");
    const depois = await page.evaluate(() => {
      const c = window.CorridaDiagnostico.jogador;
      return { x: c.position.x, z: c.position.z, y: c.position.y, v: c.velocity.length() };
    });
    assert.ok(Math.hypot(depois.x - inicial.x, depois.z - inicial.z) > 1, JSON.stringify({ inicial, depois }));
    assert.ok(Number.isFinite(depois.y) && depois.y > -5 && depois.y < 15);
    const yawInicial = await page.evaluate(() => window.CorridaDiagnostico.jogador.quaternion.y);
    await page.keyboard.down("ArrowLeft");
    await page.waitForFunction(y => Math.abs(window.CorridaDiagnostico.jogador.quaternion.y - y) > 0.025, yawInicial);
    await page.keyboard.up("ArrowLeft");
    await page.locator("#btn-respawn-manual").click();
    await page.waitForFunction(() => window.CorridaDiagnostico.jogador.velocity.length() < 5);
    const pontosAntes = await page.evaluate(() => Number(localStorage.getItem("corridaDoSaber:pontos") || 0));
    const blocos = await page.evaluate(() => window.CorridaDiagnostico.silabas.length);
    for (let indice = 0; indice < blocos; indice++) {
      await page.evaluate(indice => {
        const d = window.CorridaDiagnostico;
        d.jogador.position.copy(d.silabas[indice].mesh.position);
        d.jogador.position.y = 0.6;
        d.jogador.velocity.set(0, 0, 0);
      }, indice);
      await page.waitForFunction(i => window.CorridaDiagnostico.silabas[i]?.coletada, indice);
    }
    const pontosDepois = await page.evaluate(() => Number(localStorage.getItem("corridaDoSaber:pontos") || 0));
    assert.ok(pontosDepois > pontosAntes);
    await page.waitForFunction(() => window.CorridaDiagnostico.fase === 1);
    if (modo === "moderno") {
      const quantidade = await page.evaluate(() => window.CorridaDiagnostico.silabas.length);
      for (let i = 0; i < quantidade; i++) {
        await page.evaluate(i => {
          const d = window.CorridaDiagnostico;
          d.jogador.position.copy(d.silabas[i].mesh.position);
          d.jogador.position.y = 0.6; d.jogador.velocity.set(0, 0, 0);
        }, i);
        await page.waitForFunction(i => window.CorridaDiagnostico.silabas[i]?.coletada, i);
      }
      await page.waitForFunction(() => window.CorridaDiagnostico.fase === 2 && window.CorridaDiagnostico.helicoptero.visible);
    }
    if (modo !== "legado") {
      await page.evaluate(() => window.CorridaDiagnostico.renderer.forceContextLoss());
      await page.getByText(/O suporte gráfico foi interrompido/).waitFor();
      await page.evaluate(() => window.CorridaDiagnostico.renderer.forceContextRestore());
      await page.getByText(/O suporte gráfico foi interrompido/).waitFor({ state: "detached" });
    }
    await page.screenshot({ path: "test-results/" + modo + ".png" });
    assert.deepEqual(erros, []);
    console.log(modo + ": Three r" + rev + ", movimento, curva, respawn, coleta, pontuação e progressão OK; velocidade " + depois.v.toFixed(2));
    await context.close();
  }
} finally {
  await browser.close();
  servidor.close();
}
