import test from "node:test";
import assert from "node:assert/strict";
import { detectarGraficos, preservarIluminacao } from "../jogos/meus-jogos/corrida/js/graphics.mjs";
import * as moderno from "three";
import * as compativel from "three-webgl1";

for (const versao of [2, 1, 0]) {
  test("detecção gráfica: WebGL " + versao, () => {
    const consultados = [];
    const factory = () => ({ getContext(nome) {
      consultados.push(nome);
      if ((nome === "webgl2" && versao === 2) || (nome === "webgl" && versao === 1))
        return { MAX_TEXTURE_SIZE: 1, MAX_SAMPLES: 2, getParameter(p) { return p === 1 ? 4096 : 4; } };
      return null;
    } });
    if (!versao) assert.throws(() => detectarGraficos(factory), /WebGL/);
    else {
      const { graphicsCapabilities: caps } = detectarGraficos(factory);
      assert.equal(caps.webglVersion, versao);
      assert.equal(caps.threeVersion, versao === 2 ? "0.186.0" : "0.162.0");
      assert.equal(caps.maxSamples, versao === 2 ? 4 : 0);
    }
    assert.equal(consultados[0], "webgl2");
  });
}
for (const three of [moderno, compativel]) {
  test("iluminação nas duas versões: r" + three.REVISION, () => {
    preservarIluminacao(three);
    assert.equal(three.ColorManagement.enabled, false);
    assert.match(three.ShaderChunk.lights_pars_begin, /1.0 - lightDistance/);
    assert.match(three.ShaderChunk.lights_lambert_pars_fragment, /PI \* BRDF_Lambert/);
  });
}
