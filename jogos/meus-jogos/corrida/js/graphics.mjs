export const VERSOES = Object.freeze({
  moderno: "0.186.0",
  compativel: "0.162.0",
  fisica: "0.20.0",
});

export function detectarGraficos(criarCanvas = () => document.createElement("canvas")) {
  const atributos = { antialias: false, powerPreference: "high-performance", stencil: false };
  // Use separate canvases: some browsers bind a failed context attempt.
  for (const [webglVersion, nomes] of [[2, ["webgl2"]], [1, ["webgl", "experimental-webgl"]]]) {
    const canvas = criarCanvas();
    let context = null;
    const memoria = typeof navigator === "undefined" ? 4 : (navigator.deviceMemory || 4);
    const opcoes = { ...atributos, antialias: webglVersion === 2 && memoria >= 8 };
    for (const nome of nomes) {
      try { context = canvas.getContext(nome, opcoes); } catch { /* Try the next capability. */ }
      if (context) break;
    }
    if (!context) continue;
    const graphicsCapabilities = Object.freeze({
      webglVersion,
      supportsWebGL2: webglVersion === 2,
      maxTextureSize: context.getParameter(context.MAX_TEXTURE_SIZE),
      maxSamples: webglVersion === 2 ? context.getParameter(context.MAX_SAMPLES) : 0,
      antialias: context.getContextAttributes?.()?.antialias || false,
      threeVersion: webglVersion === 2 ? VERSOES.moderno : VERSOES.compativel,
    });
    return { canvas, context, graphicsCapabilities };
  }
  throw new Error("Este navegador ou dispositivo não oferece o suporte gráfico necessário (WebGL). Tente outro navegador com aceleração gráfica ativada.");
}

export function preservarIluminacao(THREE) {
  // The original game authored colors with legacy color management.
  THREE.ColorManagement.enabled = false;
  // Preserve the original Lambert lighting and finite-radius point lights.
  // Both renderers use this small, shared GLSL patch; geometry and effects stay intact.
  const chunks = THREE.ShaderChunk;
  const inicio = chunks.lights_pars_begin.indexOf("float getDistanceAttenuation(");
  const fim = chunks.lights_pars_begin.indexOf("float getSpotAttenuation(", inicio);
  if (inicio < 0 || fim < 0) throw new Error("A versão gráfica não oferece a iluminação esperada.");
  chunks.lights_pars_begin = chunks.lights_pars_begin.slice(0, inicio) +
    `float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
      if ( cutoffDistance > 0.0 && decayExponent > 0.0 ) {
        return pow( saturate( 1.0 - lightDistance / cutoffDistance ), decayExponent );
      }
      return 1.0;
    }
    ` + chunks.lights_pars_begin.slice(fim);
  chunks.lights_lambert_pars_fragment = chunks.lights_lambert_pars_fragment
    .replaceAll("BRDF_Lambert( material.diffuseColor )", "( PI * BRDF_Lambert( material.diffuseColor ) )");
}
