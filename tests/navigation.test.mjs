import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import * as THREE from "three";
const source = await readFile(new URL("../jogos/meus-jogos/corrida/js/main.js", import.meta.url), "utf8");
const config = await readFile(new URL("../jogos/meus-jogos/corrida/js/config.js", import.meta.url), "utf8");

function cenario(areas = []) {
  const c = vm.createContext({ THREE, window: {}, limiteMapa: { limite: 187 }, areasOcupadasMapa: areas, nosNavegacaoPolicia: [], conexoesNavegacaoPolicia: [] });
  vm.runInContext(config, c);
  c.CONFIG_NAVEGACAO_POLICIA = c.window.CorridaDoSaberConfig.CONFIG_NAVEGACAO_POLICIA;
  for (const name of ["obterLimiteNavegacao", "pontoNavegavelNoMapa", "distanciaPontoParaSegmento", "segmentoLivreParaNavegacao", "construirMalhaNavegacaoPolicia", "obterNosTemporariosParaRota", "reconstruirRotaEntreNos", "simplificarRotaPolicial", "calcularRotaPolicialNoMapa", "limparRotaPolicial", "projetarAlvoNavegavel", "segmentoLivreParaRecuperacao", "encontrarAlvoRecuperacao", "obterAlvoNavegacaoPolicial"]) {
    const match = source.match(new RegExp(`    function ${name}\\([\\s\\S]*?\\n    }`));
    assert.ok(match, name); vm.runInContext(match[0], c);
  }
  c.construirMalhaNavegacaoPolicia();
  const policial = { corpo: { position: new THREE.Vector3(-50, 0.6, 0) }, estado: {} };
  c.limparRotaPolicial(policial.estado);
  return { c, policial };
}

test("polícia: destino na borda usa o mesmo limite da navegação e da barreira", () => {
  const { c, policial } = cenario();
  policial.corpo.position.set(160, 0.6, 0);
  const alvo = c.obterAlvoNavegacaoPolicial(policial, { x: 500, z: 0 }, 1 / 60);
  assert.equal(alvo.x, 183.8);
  assert.ok(c.pontoNavegavelNoMapa(alvo.x, alvo.z));
});

test("polícia: rota contorna obstáculo e cada segmento permanece livre", () => {
  const { c, policial } = cenario([{ x: 0, z: 0, raio: 12 }]);
  const alvo = { x: 50, z: 0 }, pos = policial.corpo.position;
  for (let i = 0; i < 300; i++) {
    const ponto = c.obterAlvoNavegacaoPolicial(policial, alvo, 1 / 60);
    assert.ok(c.segmentoLivreParaNavegacao(pos.x, pos.z, ponto.x, ponto.z, 6));
    const d = Math.hypot(ponto.x - pos.x, ponto.z - pos.z);
    if (d > 0) { const passo = Math.min(d, 1); pos.x += (ponto.x - pos.x) / d * passo; pos.z += (ponto.z - pos.z) / d * passo; }
  }
  assert.ok(Math.hypot(pos.x - alvo.x, pos.z - alvo.z) < 3);
});

test("polícia: busca sem rota respeita intervalo e não retorna alvo bloqueado", () => {
  const { c, policial } = cenario([{ x: 0, z: 0, raio: 12 }]);
  let buscas = 0;
  c.calcularRotaPolicialNoMapa = () => { buscas++; return []; };
  for (let i = 0; i < 12; i++) {
    const p = c.obterAlvoNavegacaoPolicial(policial, { x: 50, z: 0 }, 1 / 60);
    assert.ok(p.x !== 50 || p.z !== 0);
    assert.ok(c.segmentoLivreParaRecuperacao(policial.corpo.position, p));
  }
  assert.equal(buscas, 1);
  for (let i = 0; i < 60; i++) c.obterAlvoNavegacaoPolicial(policial, { x: 50, z: 0 }, 1 / 60);
  assert.ok(buscas >= 2 && buscas <= 3);
});

test("polícia: sai da margem de segurança do obstáculo sem atravessá-lo", () => {
  const { c, policial } = cenario([{ x: 0, z: 0, raio: 12 }]);
  policial.corpo.position.set(13, 0.6, 0);
  const p = c.obterAlvoNavegacaoPolicial(policial, { x: -50, z: 0 }, 1 / 60);
  assert.ok(p.x >= 13);
  assert.ok(c.segmentoLivreParaRecuperacao(policial.corpo.position, p));
});

test("polícia: alvo dentro de obstáculo é projetado em ponto navegável", () => {
  const { c } = cenario([{ x: 0, z: 0, raio: 12 }]);
  const p = c.projetarAlvoNavegavel({ x: 0, z: 0 });
  assert.ok(p && c.pontoNavegavelNoMapa(p.x, p.z, 6));
});
