import { criarServidor } from "./serve.mjs";
import { readFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const servidor = criarServidor();
await new Promise(r => servidor.listen(0, "127.0.0.1", r));
const browser = await chromium.launch({ headless: true, channel: "msedge", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
try {
  for (const webgl1 of [false, true]) {
    const context = await browser.newContext({ viewport: { width: 1100, height: 720 } });
    const page = await context.newPage(), erros = [];
    page.on("pageerror", e => erros.push(e.message));
    page.on("console", m => { if (m.type() === "error") erros.push(m.text()); });
    await page.addInitScript(webgl1 => {
      let tempo = 0, id = 1, fila = new Map();
      performance.now = () => tempo;
      window.requestAnimationFrame = cb => { const n = id++; fila.set(n, cb); return n; };
      window.cancelAnimationFrame = n => fila.delete(n);
      window.avancarTeste = n => { for (let i = 0; i < n; i++) { tempo += 1000 / 60; const atual = fila; fila = new Map(); for (const cb of atual.values()) cb(tempo); } };
      let seed = 9182;
      Math.random = () => ((seed = Math.imul(seed, 1664525) + 1013904223 | 0) >>> 0) / 4294967296;
      if (webgl1) {
        const get = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function(nome, ...args) { return nome === "webgl2" ? null : get.call(this, nome, ...args); };
      }
    }, webgl1);
    await page.route("**/*", async route => {
      const url = route.request().url();
      if (url.startsWith("https://cdn.jsdelivr.net/npm/")) {
        const path = url.replace("https://cdn.jsdelivr.net/npm/three@0.186.0/", "node_modules/three/")
          .replace("https://cdn.jsdelivr.net/npm/three@0.162.0/", "node_modules/three-webgl1/")
          .replace("https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.20.0/", "node_modules/@dimforge/rapier3d-compat/");
        return route.fulfill({ body: await readFile(path), contentType: "text/javascript" });
      }
      if (url.endsWith("/corrida/js/main.js")) {
        let src = await readFile("jogos/meus-jogos/corrida/js/main.js", "utf8");
        src = src.replace("    window.CorridaDiagnostico = {", `
          let saltosTeste = 0;
          const ordemOriginalTeste = [...policiais];
          const atualizarRampaOriginal = controleRampas.atualizar;
          controleRampas.atualizar = (...args) => { const saltou = atualizarRampaOriginal(...args); if (saltou) saltosTeste++; return saltou; };
          window.testeJogabilidade = {
            perseguir(indice, borda = false, angulo = 0, equipe = false) {
              clearTimeout(timeoutDerrota);
              limparObjetosRegistrados(objetosDoMapa); limparObjetosRegistrados(objetosDestaFase);
              limparAreasTeste();
              policiais.splice(0, policiais.length, ordemOriginalTeste[indice], ...ordemOriginalTeste.filter((_, i) => i !== indice));
              for (const p of policiais) { p.visual.visible = false; resetarCorpo(p.corpo, 0, -60, 0); resetarEstadoPolicia(p.estado); }
              const x = borda ? 183 : 0;
              resetarCorpo(carroCorpo, x, 0.6, 0);
              totalPoliciasAtivas = equipe ? 4 : 1;
              for (let i = 0; i < totalPoliciasAtivas; i++) {
                const a = angulo + (equipe ? i * Math.PI / 2 : 0);
                resetarCorpo(policiais[i].corpo, x + Math.sin(a) * 22, 0.85, Math.cos(a) * 22);
                policiais[i].corpo.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a);
                policiais[i].visual.visible = true;
              }
              atrasoPoliciaRestante = 0; pausaCapturaAposColisao = 0; tempoContatoPolicia = 0;
              rodadaEncerrada = false; estadoJogo = "jogando"; reiniciarTemporizadorDeObjetivo();
              let maximo = 0, noChao = 0, proximo = 0;
              for (let i = 0; i < 1680 && estadoJogo === "jogando"; i++) {
                window.avancarTeste(1); maximo = Math.max(maximo, tempoContatoPolicia);
                if (estaNoChao(carroCorpo)) noChao++;
                if (consultasJogabilidade.distanciaCarrocerias(carroCorpo, policiais[0].corpo) < 1.6) proximo++;
              }
              return { estrategia: policiais[0].estrategia, borda, angulo, equipe, estado: estadoJogo, maximo, noChao, proximo,
                jogador: carroCorpo.position.toArray(), policial: policiais[0].corpo.position.toArray() };
            },
            fugir() {
              clearTimeout(timeoutDerrota); this.preparar(); this.captureSetup();
              for (let i = 0; i < 100; i++) window.avancarTeste(1);
              const antes = tempoContatoPolicia;
              teclas.ArrowUp = true;
              try { for (let i = 0; i < 240; i++) window.avancarTeste(1); }
              finally { teclas.ArrowUp = false; }
              return { antes, depois: tempoContatoPolicia, estado: estadoJogo,
                distancia: carroCorpo.position.distanceTo(policiais[0].corpo.position) };
            },
            terreno() {
              clearTimeout(timeoutDerrota);
              mensagemDerrota.style.display = "none";
              camera.position.set(160, 12, 160); camera.lookAt(270, 0, 240);
              renderizador.setScissorTest(false); renderizador.setViewport(0, 0, 1100, 720);
              renderizador.render = renderOriginalTeste;
              renderizador.render(cena, camera);
              return { tamanho: chaoVisual.geometry.parameters.width, limite: limiteMapa.limite };
            },
            preparar() {
              limparObjetosRegistrados(objetosDoMapa); limparObjetosRegistrados(objetosDestaFase);
              areasOcupadasMapa = []; construirMalhaNavegacaoPolicia();
              totalPoliciasAtivas = 0; renderizador.render = () => {};
              for (const p of policiais) { p.visual.visible = false; resetarCorpo(p.corpo, 0, -60, 0); }
            },
            rampa() { objetosDoMapa.push(criarRampa(0, 0, 0)); resetarCorpo(carroCorpo, 0, 0.6, 24); carroCorpo.velocity.z = -24; },
            get saltos() { return saltosTeste; },
            captureSetup() {
              limparObjetosRegistrados(objetosDoMapa); areasOcupadasMapa = []; construirMalhaNavegacaoPolicia();
              resetarCorpo(carroCorpo, 0, 0.6, 0); resetarCorpo(policiais[0].corpo, 3.1, 0.6, 0);
              totalPoliciasAtivas = 1; policiais[0].visual.visible = true; resetarEstadoPolicia(policiais[0].estado);
              atrasoPoliciaRestante = 0; pausaCapturaAposColisao = 0; tempoContatoPolicia = 0;
              rodadaEncerrada = false; estadoJogo = "jogando";
            },
            captureSteps(n) {
              for (let i = 0; i < n; i++) {
                carroCorpo.velocity.set(0, 0, 0); policiais[0].corpo.velocity.set(0, 0, 0);
                mundoFisica.avancar(1 / 60, 1 / 60, 1); atualizarCapturaPorContato(1 / 60);
              }
              return { tempo: tempoContatoPolicia, hud: infoContato.textContent, estado: estadoJogo };
            },
            cobertura() { const item = criarCaixa(1.55, 0, 0.3, 3, 4); objetosDoMapa.push(item); },
            prepararTiro(comCobertura) {
              limparObjetosRegistrados(objetosDoMapa); limparProjeteisHelicoptero();
              totalPoliciasAtivas = 0; resetarCorpo(carroCorpo, 0, 0.6, 0);
              helicopteroPolicia.position.set(-12, 1.6 + 1.2, 0);
              if (comCobertura) objetosDoMapa.push(criarCaixa(-5, 0, 0.4, 4, 6));
              dispararProjetilHelicoptero();
            },
            tiroSteps(n) { for (let i = 0; i < n; i++) atualizarProjeteisHelicoptero(1 / 60); return { vx: carroCorpo.velocity.x, tiros: projeteisHelicoptero.length }; },
            temporizador() {
              reiniciarTemporizadorDeObjetivo(); rodadaEncerrada = false; estadoJogo = "jogando";
              atualizarPunicaoPorInatividade(29.9); const antes = punicaoHelicopteroAtiva;
              atualizarPunicaoPorInatividade(0.2); const depois = punicaoHelicopteroAtiva;
              for (let i = 0; i < 8; i++) dispararProjetilHelicoptero(); const maximo = projeteisHelicoptero.length;
              reiniciarTemporizadorDeObjetivo(); return { antes, depois, maximo, limpos: projeteisHelicoptero.length, ativo: punicaoHelicopteroAtiva };
            }
          };
          const renderOriginalTeste = renderizador.render.bind(renderizador);
          function limparAreasTeste() { areasOcupadasMapa = []; construirMalhaNavegacaoPolicia(); }
          window.CorridaDiagnostico = {`);
        return route.fulfill({ body: src, contentType: "text/javascript" });
      }
      return route.continue();
    });
    await page.goto(`http://127.0.0.1:${servidor.address().port}/jogos/meus-jogos/corrida.html`);
    await page.waitForFunction(() => window.CorridaDiagnostico || window.__corridaDoSaberErroExibido, null, { polling: 100 });
    assert.equal(await page.evaluate(() => !!window.__corridaDoSaberErroExibido), false, erros.join("\n"));
    await page.locator('.btn-serie[data-fase="facil"]').dispatchEvent("click");
    if (process.argv.includes("--terrain-only")) {
      await page.evaluate(() => { window.testeJogabilidade.preparar(); window.testeJogabilidade.terreno(); });
      const pasta = await mkdtemp(join(tmpdir(), "corrida-terreno-"));
      const arquivo = join(pasta, webgl1 ? "webgl1.png" : "webgl2.png");
      await page.screenshot({ path: arquivo }); console.log(arquivo);
      assert.deepEqual(erros, []); await context.close(); continue;
    }
    await page.evaluate(() => { window.testeJogabilidade.preparar(); window.testeJogabilidade.rampa(); });
    await page.keyboard.down("ArrowUp");
    const rampa = await page.evaluate(() => {
      let altura = 0;
      for (let i = 0; i < 210; i++) { window.avancarTeste(1); altura = Math.max(altura, window.CorridaDiagnostico.jogador.position.y); }
      return { saltos: window.testeJogabilidade.saltos, altura };
    });
    await page.keyboard.up("ArrowUp");
    assert.equal(rampa.saltos, 1, JSON.stringify(rampa)); assert.ok(rampa.altura > 9);
    await page.evaluate(() => window.testeJogabilidade.captureSetup());
    const grace = await page.evaluate(() => window.testeJogabilidade.captureSteps(12));
    assert.equal(grace.tempo, 0);
    const perto = await page.evaluate(() => window.testeJogabilidade.captureSteps(80));
    assert.ok(perto.tempo > 0);
    assert.equal(perto.hud, `Captura ${Math.round(perto.tempo / 1.8 * 100)}%`);
    await page.evaluate(() => window.testeJogabilidade.cobertura());
    const protegido = await page.evaluate(() => window.testeJogabilidade.captureSteps(60));
    assert.equal(protegido.tempo, 0);
    await page.evaluate(() => window.testeJogabilidade.captureSetup());
    const captura = await page.evaluate(() => window.testeJogabilidade.captureSteps(1200));
    assert.equal(captura.estado, "derrota");
    await page.evaluate(() => window.testeJogabilidade.prepararTiro(true));
    const bloqueado = await page.evaluate(() => window.testeJogabilidade.tiroSteps(15));
    assert.equal(bloqueado.vx, 0); assert.equal(bloqueado.tiros, 0);
    await page.evaluate(() => window.testeJogabilidade.prepararTiro(false));
    const acerto = await page.evaluate(() => window.testeJogabilidade.tiroSteps(15));
    assert.ok(acerto.vx > 20); assert.equal(acerto.tiros, 0);
    const timer = await page.evaluate(() => window.testeJogabilidade.temporizador());
    assert.deepEqual(timer, { antes: false, depois: true, maximo: 4, limpos: 0, ativo: false });
    for (const indice of [0, 1, 2, 3]) {
      const perseguiu = await page.evaluate(i => window.testeJogabilidade.perseguir(i), indice);
      console.log(JSON.stringify(perseguiu));
      assert.equal(perseguiu.estado, "derrota", "IA real precisa concluir captura do jogador sem comandos");
    }
    const borda = await page.evaluate(() => window.testeJogabilidade.perseguir(0, true));
    assert.equal(borda.estado, "derrota", JSON.stringify(borda));
    for (const [indice, angulo] of [[0, Math.PI / 2], [1, Math.PI], [2, -Math.PI / 2], [3, Math.PI / 4]]) {
      const aproximacao = await page.evaluate(([i, a]) => window.testeJogabilidade.perseguir(i, false, a), [indice, angulo]);
      assert.equal(aproximacao.estado, "derrota", JSON.stringify(aproximacao));
    }
    const equipe = await page.evaluate(() => window.testeJogabilidade.perseguir(0, false, 0, true));
    assert.equal(equipe.estado, "derrota", JSON.stringify(equipe));
    const fuga = await page.evaluate(() => window.testeJogabilidade.fugir());
    assert.ok(fuga.antes > 0, JSON.stringify(fuga));
    assert.equal(fuga.depois, 0, JSON.stringify(fuga));
    assert.equal(fuga.estado, "jogando", JSON.stringify(fuga));
    assert.ok(fuga.distancia > 7, JSON.stringify(fuga));
    const terreno = await page.evaluate(() => window.testeJogabilidade.terreno());
    assert.equal(terreno.tamanho, 1600); assert.equal(terreno.limite, 187);
    const imagens = await mkdtemp(join(tmpdir(), "corrida-terreno-"));
    const screenshot = join(imagens, webgl1 ? "webgl1.png" : "webgl2.png");
    await page.screenshot({ path: screenshot }); console.log(`Terreno: ${screenshot}`);
    assert.deepEqual(erros, []);
    console.log(`${webgl1 ? "WebGL 1" : "WebGL 2"}: rampa, tiros, cobertura, captura real por todas as unidades e direções, cerco em grupo, fuga e terreno OK.`);
    await context.close();
  }
} finally { await browser.close(); servidor.close(); }
