// Read the pre-migration game from Git, in memory, without restoring worktree files.
import { execFileSync } from "node:child_process";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { criarServidor } from "./serve.mjs";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const referencia = "cdee5cf7a289a792032b48e348170949f4ae25e4";
const original = arquivo => execFileSync("git", ["show", referencia + ":" + arquivo], { encoding: "utf8", maxBuffer: 2e6 });
const html = original("jogos/meus-jogos/corrida.html");
const sources = [...html.matchAll(/<script src="(https:[^"]+)"/g)].map(m => m[1]);
const bibliotecas = new Map(await Promise.all(sources.map(async url => {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Falha ao carregar referência: " + url);
  return [url, await response.text()];
})));
const servidor = criarServidor();
await new Promise(resolve => servidor.listen(0, "127.0.0.1", resolve));
const base = "http://127.0.0.1:" + servidor.address().port;
const browser = await chromium.launch({ headless: true, channel: "msedge", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
await mkdir("test-results", { recursive: true });
const resultados = {};
try {
  for (const modo of ["referencia", "moderno", "webgl1"]) {
    const context = await browser.newContext({ viewport: { width: 1100, height: 720 } });
    const page = await context.newPage();
    const erros = [];
    page.on("pageerror", e => erros.push(e.message));
    await page.addInitScript(modo => {
      let seed = 123456;
      Math.random = () => ((seed = Math.imul(seed, 1664525) + 1013904223 | 0) >>> 0) / 4294967296;
      let tempo = 0, proximoId = 1;
      let fila = new Map();
      performance.now = () => tempo;
      window.requestAnimationFrame = cb => { const id = proximoId++; fila.set(id, cb); return id; };
      window.cancelAnimationFrame = id => fila.delete(id);
      window.avancarTeste = n => {
        for (let i = 0; i < n; i++) {
          tempo += 1000 / 60;
          const atual = fila; fila = new Map();
          for (const cb of atual.values()) cb(tempo);
        }
      };
      if (modo === "webgl1") {
        const get = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function(nome, ...args) {
          return nome === "webgl2" ? null : get.call(this, nome, ...args);
        };
      }
    }, modo);
    await page.route("**/*", async route => {
      const url = route.request().url();
      if (bibliotecas.has(url)) return route.fulfill({ body: bibliotecas.get(url), contentType: "text/javascript" });
      if (url.startsWith("https://cdn.jsdelivr.net/npm/")) {
        const caminho = url.replace("https://cdn.jsdelivr.net/npm/three@0.186.0/", "node_modules/three/")
          .replace("https://cdn.jsdelivr.net/npm/three@0.162.0/", "node_modules/three-webgl1/")
          .replace("https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.20.0/", "node_modules/@dimforge/rapier3d-compat/");
        return route.fulfill({ body: await readFile(caminho), contentType: "text/javascript" });
      }
      if (modo === "referencia" && url.endsWith("/corrida.html"))
        return route.fulfill({ body: html, contentType: "text/html" });
      if (url.endsWith("/corrida/js/main.js")) {
        const source = modo === "referencia"
          ? original("jogos/meus-jogos/corrida/js/main.js")
          : await readFile("jogos/meus-jogos/corrida/js/main.js", "utf8");
        const body = source.replace(/    animar\(\);(?![\s\S]*    animar\(\);)/,
          `    window.CorridaDiagnostico = { jogador: carroCorpo, get estado() { return estadoJogo; } };
               window.prepararComparacao = () => {
                 totalPoliciasAtivas = 0;
                 for (const item of objetosDoMapa) {
                   if (!item.corpo) continue;
                   if (item.corpo.rigidBody) item.corpo.rigidBody.setEnabled(false);
                   else item.corpo.collisionResponse = false;
                 }
               };
               animar();`);
        return route.fulfill({ body, contentType: "text/javascript" });
      }
      if (modo === "referencia" && url.endsWith("/corrida/js/bootstrap.js"))
        return route.fulfill({ body: original("jogos/meus-jogos/corrida/js/bootstrap.js"), contentType: "text/javascript" });
      return route.continue();
    });
    await page.goto(base + "/jogos/meus-jogos/corrida.html");
    await page.waitForFunction(() => window.CorridaDiagnostico || window.__corridaDoSaberErroExibido, null, { polling: 100 });
    assert.equal(await page.evaluate(() => window.__corridaDoSaberErroExibido), false, erros.join("\n"));
    // Dispatch directly: actionability checks depend on RAF, deliberately controlled here.
    await page.locator('.btn-serie[data-fase="facil"]').dispatchEvent("click");
    await page.evaluate(() => window.prepararComparacao());
    const avancar = async n => { for (let i = 0; i < n; i += 15) await page.evaluate(n => window.avancarTeste(n), Math.min(15, n - i)); };
    const medir = () => page.evaluate(() => {
      const c = window.CorridaDiagnostico.jogador;
      return { p: { x: c.position.x, y: c.position.y, z: c.position.z }, v: { x: c.velocity.x, y: c.velocity.y, z: c.velocity.z }, q: { x: c.quaternion.x, y: c.quaternion.y, z: c.quaternion.z, w: c.quaternion.w } };
    });
    await avancar(120);
    const repouso = await medir();
    await page.keyboard.down("ArrowUp");
    await avancar(60);
    const acelerar = await medir();
    await page.screenshot({ path: "test-results/comparacao-" + modo + ".png" });
    await page.keyboard.down("ArrowLeft");
    await avancar(30);
    const curva = await medir();
    await page.keyboard.up("ArrowLeft");
    await page.keyboard.up("ArrowUp");
    await page.keyboard.down("ArrowDown");
    await avancar(30);
    const frear = await medir();
    await page.keyboard.up("ArrowDown");
    assert.deepEqual(erros, []);
    resultados[modo] = { repouso, acelerar, curva, frear };
    console.log(modo + ": " + JSON.stringify(resultados[modo]));
    await context.close();
  }
  for (const modo of ["moderno", "webgl1"]) {
    for (const etapa of ["repouso", "acelerar", "curva", "frear"]) {
      const a = resultados.referencia[etapa], b = resultados[modo][etapa];
      assert.ok(Math.hypot(a.p.x - b.p.x, a.p.y - b.p.y, a.p.z - b.p.z) < 0.1, modo + ": posição em " + etapa);
      assert.ok(Math.abs(Math.hypot(a.v.x, a.v.z) - Math.hypot(b.v.x, b.v.z)) < 0.03, modo + ": velocidade em " + etapa);
      assert.ok(Math.abs(a.q.y - b.q.y) < 0.0001, modo + ": rotação em " + etapa);
    }
  }
  assert.deepEqual(resultados.moderno, resultados.webgl1);
  await writeFile("test-results/comparacao.json", JSON.stringify(resultados, null, 2));
  console.log("Comparação aprovada: posição < 0,1; velocidade < 0,03; mesma física nos dois renderers.");
} finally { await browser.close(); servidor.close(); }
