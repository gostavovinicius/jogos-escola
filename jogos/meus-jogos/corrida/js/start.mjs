import { detectarGraficos, preservarIluminacao } from "./graphics.mjs";
import { criarFisica } from "./physics.mjs";
import { criarArteCorrida } from "./art.mjs";
import { criarLimiteMapa, distanciaSeguraMontanha } from "./boundary.mjs";
import * as jogabilidade from "./gameplay.mjs";

const carregarScript = (caminho) => new Promise((resolve, reject) => {
  const script = document.createElement("script");
  script.src = new URL(caminho, import.meta.url).href;
  script.onload = resolve;
  script.onerror = () => reject(new Error("Não foi possível carregar " + caminho));
  document.head.appendChild(script);
});

export async function iniciar(legado = false) {
  if (typeof WebAssembly === "undefined") {
    throw new Error("Este navegador não oferece WebAssembly, necessário para a física do jogo.");
  }
  const graficos = detectarGraficos();
  window.graphicsCapabilities = graficos.graphicsCapabilities;
  window.CorridaGraficos = graficos;
  // Explicit URLs select distinct modules. Only the selected version downloads.
  const urlThree = graficos.graphicsCapabilities.supportsWebGL2
    ? "https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.module.js"
    : "https://cdn.jsdelivr.net/npm/three@0.162.0/build/three.module.js";
  const [THREE, moduloRapier] = await Promise.all([
    import(urlThree),
    import("https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.20.0/dist/rapier.mjs"),
  ]);
  const RAPIER = moduloRapier.default;
  try { await RAPIER.init(); }
  catch (erro) { throw new Error("Não foi possível iniciar a física WebAssembly. Recarregue a página. " + erro.message); }
  if (window.__corridaDoSaberErroExibido) return;
  preservarIluminacao(THREE);
  window.THREE = THREE;
  window.RAPIER = RAPIER;
  window.CorridaJogabilidade = jogabilidade;
  window.criarFisicaCorrida = () => criarFisica(RAPIER, THREE);
  window.criarArteCorrida = (renderer, cena, perfil) => criarArteCorrida(THREE, renderer, cena, perfil);
  window.criarLimiteMapaCorrida = (fisica, tamanho) => criarLimiteMapa(RAPIER, THREE, fisica, tamanho);
  window.distanciaSeguraMontanha = distanciaSeguraMontanha;
  if (legado) {
    window.iniciarCorridaLegada();
  } else {
    await carregarScript("./config.js");
    await carregarScript("./syllables.js");
    if (window.__corridaDoSaberErroExibido) return;
    await carregarScript("./main.js");
  }
}
