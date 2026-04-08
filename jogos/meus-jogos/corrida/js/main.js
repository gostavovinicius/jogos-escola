/* Corrida do Saber - Logica principal */

(() => {
  const config = window.CorridaDoSaberConfig;
  const syllables = window.CorridaDoSaberSyllables;
  if (!config || !syllables) {
    window.exibirErroDeInicializacaoJogo?.(
      "Nao foi possivel carregar os arquivos internos do jogo.",
    );
    return;
  }

  const {
    CONFIG_RADAR_REAL,
    LIMITES_DE_JOGO,
    PALETA_CENARIO,
    CONFIG_NAVEGACAO_POLICIA,
    CONFIG_CONFORTO_MOVIMENTO,
    CONFIG_TATICA_POLICIAL,
    STORAGE_KEYS,
    ESTADO_INICIAL,
    garagemCarros,
  } = config;
  const {
    bancoDeFases,
    fasesPorPalavra,
    PONTOS_POR_BLOCO,
    PENALIDADE_POLICIA,
  } = syllables;
  const {
    EXIBIR_HUD_SECUNDARIA,
    MAX_POLICIAS_ATIVAS,
    TEMPO_RESPAWN_CAPOTADO,
    COOLDOWN_RESPAWN_MANUAL,
    TEMPO_INATIVIDADE_HELICOPTERO,
    INTERVALO_ATAQUE_HELICOPTERO,
    MAX_PROJETEIS_HELICOPTERO,
  } = LIMITES_DE_JOGO;
  const {
    CHAVE_PONTOS,
    CHAVE_CARRO,
    CHAVE_CARROS_DESBLOQUEADOS,
  } = STORAGE_KEYS;
  if (!window.THREE || !window.CANNON) {
    window.exibirErroDeInicializacaoJogo?.(
      "Nao foi possivel iniciar o jogo porque algumas bibliotecas nao carregaram corretamente.",
    );
    return;
  }

  try {
    // ==========================================
    // 1. CONFIGURAÇÃO BASE
    // ==========================================
    const agenteUsuario = navigator.userAgent || "";
    const ehFirefox =
      /firefox/i.test(agenteUsuario) && !/seamonkey/i.test(agenteUsuario);
    const ehChrome =
      /(chrome|chromium|crios)/i.test(agenteUsuario) &&
      !/(edg|opr|opera|firefox)/i.test(agenteUsuario);
    const estaEmIframe = window.self !== window.top;
    const memoriaDispositivo = navigator.deviceMemory || 8;
    const nucleosDispositivo = navigator.hardwareConcurrency || 4;
    const larguraViewportInicial = Math.max(
      1,
      window.innerWidth || document.documentElement.clientWidth || 1,
    );
    const alturaViewportInicial = Math.max(
      1,
      window.innerHeight || document.documentElement.clientHeight || 1,
    );
    const menorDimensaoViewport = Math.min(
      larguraViewportInicial,
      alturaViewportInicial,
    );
    const controlesTouchAtivos =
      window.matchMedia?.("(pointer: coarse)")?.matches || false;
    const PERFIL_EXECUCAO = {
      firefox: ehFirefox,
      firefoxIframe: ehFirefox && estaEmIframe,
      firefoxEconomia:
        ehFirefox &&
        (estaEmIframe ||
          memoriaDispositivo <= 6 ||
          nucleosDispositivo <= 6 ||
          menorDimensaoViewport <= 760),
      chrome: ehChrome,
      pcFraco:
        memoriaDispositivo <= 4 ||
        nucleosDispositivo <= 4 ||
        menorDimensaoViewport <= 560,
      usarControlesTouch: controlesTouchAtivos,
      usarVibracao: "vibrate" in navigator && controlesTouchAtivos,
    };
    if (PERFIL_EXECUCAO.firefox) {
      document.documentElement.classList.add("firefox");
    }
    if (PERFIL_EXECUCAO.firefoxEconomia) {
      document.documentElement.classList.add("firefox-economia");
    }
    if (estaEmIframe) document.documentElement.classList.add("em-iframe");

    const cena = new THREE.Scene();
    cena.background = new THREE.Color(0xa7c8e8);
    cena.fog = new THREE.Fog(0xb9d2e6, 92, 264);
    const raizEstilos = document.documentElement;
    const eixoRotacaoY = new CANNON.Vec3(0, 1, 0);
    const vetorCimaCapotagemTemp = new CANNON.Vec3();
    const vetorCimaIApoliciaTemp = new CANNON.Vec3();
    const vetorCimaEstabilizacaoTemp = new CANNON.Vec3();
    const vetorCimaPresencaTemp = new CANNON.Vec3();
    const vetorCimaAnimacaoTemp = new CANNON.Vec3();
    const direcaoForcaTemp = new CANNON.Vec3();
    const forcaAplicadaTemp = new CANNON.Vec3();
    const direcaoFrontalTemp = new CANNON.Vec3();
    const direcaoYawTemp = new CANNON.Vec3();
    const direcaoTracaoTemp = new CANNON.Vec3();
    const direcaoIAJogadorTemp = new CANNON.Vec3();
    const direcaoRampaTemp = new CANNON.Vec3();
    const lateralTracaoTemp = new CANNON.Vec3();
    const cameraOffsetTemp = new THREE.Vector3();
    const destinoCameraTemp = new THREE.Vector3();
    const destinoAlvoTemp = new THREE.Vector3();
    const projecaoSilabaTemp = new THREE.Vector3();
    const alvoHelicopteroTemp = new THREE.Vector3();
    const olharHelicopteroTemp = new THREE.Vector3();
    const direcaoTiroHelicopteroTemp = new THREE.Vector3();
    const origemTiroHelicopteroTemp = new THREE.Vector3();
    const direcaoRecuoHelicopteroTemp = new THREE.Vector3();
    const alvoPrevistoHelicopteroTemp = new THREE.Vector3();
    let tamanhoSombraAtual = 0;
    let luzDirecional = null;
    let radarCanvas = null;
    let radarCtx = null;
    let radarFundoCanvas = null;
    let radarFundoCtx = null;
    let radarFundoSujo = true;
    let radarTempoAcumulado = 0;
    let hudCompactaAtiva = false;
    let iframeCompactoAtivo = false;
    let blocosSilabas = null;
    let ajusteBlocosSilabasFrame = 0;
    const geoProjetilHelicoptero = new THREE.SphereGeometry(0.48, 8, 8);
    const matProjetilHelicoptero = new THREE.MeshBasicMaterial({
      color: 0xffb703,
      transparent: true,
      opacity: 0.96,
    });
    const geoParticulaFogos = new THREE.SphereGeometry(1, 5, 5);

    function preencherVetorCima(corpo, destino) {
      destino.set(0, 1, 0);
      corpo.quaternion.vmult(destino, destino);
      return destino;
    }

    function configurarTexturaComoCor(textura) {
      if (
        textura &&
        typeof THREE.sRGBEncoding !== "undefined" &&
        "encoding" in textura
      ) {
        textura.encoding = THREE.sRGBEncoding;
        textura.needsUpdate = true;
      }
      return textura;
    }

    function obterPixelRatioIdeal(largura) {
      if (PERFIL_EXECUCAO.firefoxIframe) {
        if (largura < 560) return 0.56;
        if (largura < 760) return 0.62;
        if (largura < 980) return 0.7;
        return 0.82;
      }

      if (PERFIL_EXECUCAO.firefoxEconomia) {
        if (largura < 720) return 0.66;
        if (largura < 1280) return 0.78;
        return 0.88;
      }

      if (PERFIL_EXECUCAO.pcFraco) {
        if (largura < 900) return 1;
        return 1.05;
      }

      if (ehFirefox) {
        return largura < 720 ? 0.84 : 0.96;
      }

      if (PERFIL_EXECUCAO.chrome) {
        if (largura < 720) return 1.35;
        if (largura < 1280) return 1.7;
        return 2;
      }

      if (largura < 720) return 1.2;
      if (largura < 1280) return 1.4;
      return 1.55;
    }

    function obterTamanhoSombraIdeal(largura) {
      if (PERFIL_EXECUCAO.firefoxEconomia) return 384;
      if (PERFIL_EXECUCAO.pcFraco) return 512;
      if (PERFIL_EXECUCAO.firefoxIframe) return 512;
      if (ehFirefox) return 768;
      if (PERFIL_EXECUCAO.chrome) {
        if (largura < 960) return 1536;
        return 2048;
      }
      if (largura < 960) return 1024;
      return 1536;
    }

    function obterDimensoesViewport() {
      return {
        largura: Math.max(
          1,
          document.documentElement.clientWidth || window.innerWidth || 1,
        ),
        altura: Math.max(
          1,
          document.documentElement.clientHeight ||
            window.innerHeight ||
            1,
        ),
      };
    }

    const dimensoesIniciais = obterDimensoesViewport();
    let larguraViewport = dimensoesIniciais.largura;
    let alturaViewport = dimensoesIniciais.altura;
    let tamanhoMiniMapa = 190;

    const camera = new THREE.PerspectiveCamera(
      75,
      larguraViewport / alturaViewport,
      0.1,
      1000,
    );
    // O Minimapa olhará um raio de 100 unidades ao redor do carro
    // Near=0.1, Far=500 garante que a câmera a y=300 veja o chão em y=0
    const cameraMiniMapa = new THREE.OrthographicCamera(
      -100,
      100,
      100,
      -100,
      0.1,
      700,
    );
    cameraMiniMapa.up.set(0, 0, -1);

    const renderizador = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: "high-performance",
      stencil: false,
    });
    const sombrasAtivas =
      !PERFIL_EXECUCAO.pcFraco &&
      !PERFIL_EXECUCAO.firefoxEconomia &&
      !PERFIL_EXECUCAO.firefoxIframe;
    renderizador.setPixelRatio(
      Math.min(
        window.devicePixelRatio,
        obterPixelRatioIdeal(larguraViewport),
      ),
    );
    renderizador.setSize(larguraViewport, alturaViewport, false);
    renderizador.shadowMap.enabled = sombrasAtivas;
    renderizador.shadowMap.type = THREE.PCFShadowMap;
    renderizador.outputEncoding = THREE.sRGBEncoding;
    renderizador.toneMapping = PERFIL_EXECUCAO.firefoxEconomia
      ? THREE.NoToneMapping
      : THREE.ACESFilmicToneMapping;
    renderizador.toneMappingExposure =
      PERFIL_EXECUCAO.firefoxEconomia || PERFIL_EXECUCAO.firefoxIframe
        ? 1
        : PERFIL_EXECUCAO.pcFraco
          ? 0.64
          : 0.6;
    renderizador.autoClear = false;
    renderizador.sortObjects = false;
    renderizador.setClearColor(0xa7c8e8);
    renderizador.domElement.tabIndex = 0;
    renderizador.domElement.style.willChange = "transform";
    renderizador.domElement.style.width = "100%";
    renderizador.domElement.style.height = "100%";
    document.body.appendChild(renderizador.domElement);

    function focarJogoNoIframe() {
      if (!PERFIL_EXECUCAO.firefoxIframe) return;
      try {
        renderizador.domElement.focus({ preventScroll: true });
      } catch {
        renderizador.domElement.focus();
      }
    }

    renderizador.domElement.addEventListener(
      "pointerdown",
      focarJogoNoIframe,
    );

    function sincronizarLayoutHUDIframe() {
      if (!estaEmIframe) return;
      const margem =
        larguraViewport < 560 ? 6 : larguraViewport < 860 ? 8 : 12;
      const proporcaoHud =
        larguraViewport < 560
          ? 0.52
          : larguraViewport < 760
            ? 0.44
            : larguraViewport < 980
              ? 0.37
              : 0.31;
      const larguraHUDIframe = Math.round(
        THREE.MathUtils.clamp(
          larguraViewport * proporcaoHud,
          larguraViewport < 560 ? 176 : 210,
          larguraViewport < 760 ? 252 : larguraViewport < 980 ? 284 : 320,
        ),
      );
      const larguraHUDDisponivel = Math.max(
        176,
        larguraViewport - margem * 2,
      );

      raizEstilos.style.setProperty("--iframe-hud-right", `${margem}px`);
      raizEstilos.style.setProperty("--iframe-hud-top", `${margem}px`);
      raizEstilos.style.setProperty(
        "--iframe-hud-width",
        `${Math.min(larguraHUDIframe, larguraHUDDisponivel)}px`,
      );

      requestAnimationFrame(() => {
        const interfaceHUD = document.getElementById("interface");
        if (!interfaceHUD) return;
        const topoInfo =
          margem + interfaceHUD.offsetHeight + (larguraViewport < 560 ? 6 : 10);
        raizEstilos.style.setProperty(
          "--iframe-info-top",
          `${Math.round(topoInfo)}px`,
        );
      });
    }

    function aplicarEscalaInterface(escala = 1) {
      const hud = interfaceHud || document.getElementById("interface");
      if (!hud) return;
      const escalaLimitada = Math.max(0.76, Math.min(1, escala));

      hud.style.setProperty(
        "--hud-gap",
        `${Math.max(6, Math.round(8 * escalaLimitada))}px`,
      );
      hud.style.setProperty(
        "--hud-padding-top",
        `${Math.max(8, Math.round(12 * escalaLimitada))}px`,
      );
      hud.style.setProperty(
        "--hud-padding-bottom",
        `${Math.max(9, Math.round(14 * escalaLimitada))}px`,
      );
      hud.style.setProperty(
        "--hud-padding-x",
        `${Math.max(10, Math.round(16 * escalaLimitada))}px`,
      );
      hud.style.setProperty(
        "--hud-border-radius",
        `${Math.max(18, Math.round(24 * escalaLimitada))}px`,
      );
      hud.style.setProperty(
        "--hud-fase-font-size",
        `${Math.max(10, Math.round(12 * escalaLimitada))}px`,
      );
      hud.style.setProperty(
        "--hud-fase-letter-spacing",
        `${Math.max(1.2, 2.2 * escalaLimitada).toFixed(2)}px`,
      );
      hud.style.setProperty(
        "--hud-topbar-gap",
        `${Math.max(5, Math.round(6 * escalaLimitada))}px`,
      );
      hud.style.setProperty(
        "--hud-objetivo-gap",
        `${Math.max(6, Math.round(8 * escalaLimitada))}px`,
      );
      hud.style.setProperty(
        "--hud-meta-gap",
        `${Math.max(6, Math.round(8 * escalaLimitada))}px`,
      );
      hud.style.setProperty(
        "--hud-principal-gap",
        `${Math.max(6, Math.round(8 * escalaLimitada))}px`,
      );
      hud.style.setProperty(
        "--hud-palavra-font-size",
        `${(1.38 * Math.max(0.82, escalaLimitada)).toFixed(3)}rem`,
      );
      hud.style.setProperty(
        "--hud-palavra-padding-y",
        `${Math.max(6, Math.round(8 * escalaLimitada))}px`,
      );
      hud.style.setProperty(
        "--hud-palavra-padding-x",
        `${Math.max(10, Math.round(12 * escalaLimitada))}px`,
      );
      hud.style.setProperty(
        "--hud-palavra-radius",
        `${Math.max(12, Math.round(16 * escalaLimitada))}px`,
      );
      hud.style.setProperty(
        "--hud-facil-objetivo-gap",
        `${Math.max(8, Math.round(12 * escalaLimitada))}px`,
      );
      hud.style.setProperty(
        "--hud-facil-principal-gap",
        `${Math.max(6, Math.round(10 * escalaLimitada))}px`,
      );
      hud.style.setProperty(
        "--hud-silabas-objetivo-gap",
        `${Math.max(6, Math.round(10 * escalaLimitada))}px`,
      );
      hud.style.setProperty(
        "--hud-silabas-principal-gap",
        `${Math.max(5, Math.round(8 * escalaLimitada))}px`,
      );
      hud.style.setProperty(
        "--hud-silabas-blocos-gap",
        `${Math.max(4, Math.round(8 * escalaLimitada))}px`,
      );
      hud.style.setProperty(
        "--hud-emoji-facil-size",
        `${Math.max(58, Math.round(84 * escalaLimitada))}px`,
      );
      hud.style.setProperty(
        "--hud-emoji-facil-font-size",
        `${Math.max(30, Math.round(46 * escalaLimitada))}px`,
      );
      hud.style.setProperty(
        "--hud-emoji-facil-radius",
        `${Math.max(14, Math.round(22 * escalaLimitada))}px`,
      );
      hud.style.setProperty(
        "--hud-emoji-base-size",
        `${Math.max(40, Math.round(48 * escalaLimitada))}px`,
      );
      hud.style.setProperty(
        "--hud-emoji-base-font-size",
        `${Math.max(22, Math.round(28 * escalaLimitada))}px`,
      );
      hud.style.setProperty(
        "--hud-emoji-base-radius",
        `${Math.max(12, Math.round(14 * escalaLimitada))}px`,
      );
      hud.style.setProperty(
        "--hud-emoji-highlight-size",
        `${Math.max(56, Math.round(80 * escalaLimitada))}px`,
      );
      hud.style.setProperty(
        "--hud-emoji-highlight-font-size",
        `${Math.max(30, Math.round(42 * escalaLimitada))}px`,
      );
      hud.style.setProperty(
        "--hud-emoji-highlight-radius",
        `${Math.max(14, Math.round(18 * escalaLimitada))}px`,
      );
      hud.style.setProperty(
        "--hud-emoji-silabas-size",
        `${Math.max(52, Math.round(76 * escalaLimitada))}px`,
      );
      hud.style.setProperty(
        "--hud-emoji-silabas-font-size",
        `${Math.max(28, Math.round(40 * escalaLimitada))}px`,
      );
      hud.style.setProperty(
        "--hud-emoji-silabas-radius",
        `${Math.max(12, Math.round(18 * escalaLimitada))}px`,
      );
      hud.style.setProperty(
        "--hud-button-padding-y",
        `${Math.max(6, Math.round(8 * escalaLimitada))}px`,
      );
      hud.style.setProperty(
        "--hud-button-padding-x",
        `${Math.max(10, Math.round(12 * escalaLimitada))}px`,
      );
      hud.style.setProperty(
        "--hud-button-radius",
        `${Math.max(12, Math.round(14 * escalaLimitada))}px`,
      );
      hud.style.setProperty(
        "--hud-button-font-size",
        `${(0.92 * Math.max(0.84, escalaLimitada)).toFixed(3)}rem`,
      );
      hud.style.setProperty(
        "--hud-perseguicao-gap",
        `${Math.max(4, Math.round(6 * escalaLimitada))}px`,
      );
      hud.style.setProperty(
        "--hud-perseguicao-top-gap",
        `${Math.max(8, Math.round(12 * escalaLimitada))}px`,
      );
      hud.style.setProperty(
        "--hud-perseguicao-label-font-size",
        `${(0.68 * Math.max(0.82, escalaLimitada)).toFixed(3)}rem`,
      );
      hud.style.setProperty(
        "--hud-perseguicao-risco-font-size",
        `${(0.96 * Math.max(0.82, escalaLimitada)).toFixed(3)}rem`,
      );
      hud.style.setProperty(
        "--hud-perseguicao-contato-font-size",
        `${(0.8 * Math.max(0.82, escalaLimitada)).toFixed(3)}rem`,
      );
    }

    function obterEscalaInterfaceAoEspaco() {
      const hud = interfaceHud || document.getElementById("interface");
      if (!hud) return 1;

      const estiloHud = window.getComputedStyle(hud);
      const larguraMaxCss = Number.parseFloat(estiloHud.maxWidth || "");
      const larguraDisponivel = Math.max(
        estaEmIframe ? 176 : 220,
        Math.min(
          Number.isFinite(larguraMaxCss) && larguraMaxCss > 0
            ? larguraMaxCss
            : larguraViewport - (estaEmIframe ? 12 : 20),
          larguraViewport - (estaEmIframe ? 12 : 20),
        ),
      );
      const topoHud =
        hud.offsetTop || Number.parseFloat(estiloHud.top || "0") || 0;
      const alturaDisponivel = Math.max(
        144,
        alturaViewport - topoHud - (estaEmIframe ? 12 : 16),
      );
      const larguraNecessaria = Math.max(
        hud.scrollWidth || 0,
        hud.offsetWidth || 0,
      );
      const alturaNecessaria = Math.max(
        hud.scrollHeight || 0,
        hud.offsetHeight || 0,
      );

      if (!larguraNecessaria || !alturaNecessaria) return 1;

      return THREE.MathUtils.clamp(
        Math.min(
          1,
          larguraDisponivel / larguraNecessaria,
          alturaDisponivel / alturaNecessaria,
        ),
        0.76,
        1,
      );
    }

    function aplicarEscalaBlocosSilabas(escala = 1) {
      const container =
        blocosSilabas || document.getElementById("blocos-silabas");
      if (!container) return;
      const escalaLimitada = Math.max(0.64, Math.min(1, escala));
      const hudEscalavel = interfaceHud || container;
      container.style.setProperty(
        "--silabas-gap",
        `${Math.max(4, Math.round(6 * escalaLimitada))}px`,
      );
      container.style.setProperty(
        "--silabas-min-largura",
        `${Math.max(40, Math.round(54 * escalaLimitada))}px`,
      );
      container.style.setProperty(
        "--silabas-padding-y",
        `${Math.max(6, Math.round(10 * escalaLimitada))}px`,
      );
      container.style.setProperty(
        "--silabas-padding-x",
        `${Math.max(8, Math.round(12 * escalaLimitada))}px`,
      );
      container.style.setProperty(
        "--silabas-font-size",
        `${(1.08 * escalaLimitada).toFixed(3)}rem`,
      );
      container.style.setProperty(
        "--palavra-font-size",
        `${(1.34 * Math.max(0.7, escalaLimitada)).toFixed(3)}rem`,
      );
      container.style.setProperty(
        "--palavra-padding-y",
        `${Math.max(8, Math.round(12 * escalaLimitada))}px`,
      );
      container.style.setProperty(
        "--palavra-padding-x",
        `${Math.max(12, Math.round(20 * escalaLimitada))}px`,
      );
      container.style.setProperty(
        "--silabas-modo-min-largura",
        `${Math.max(36, Math.round(52 * escalaLimitada))}px`,
      );
      container.style.setProperty(
        "--silabas-modo-padding-y",
        `${Math.max(7, Math.round(12 * escalaLimitada))}px`,
      );
      container.style.setProperty(
        "--silabas-modo-padding-x",
        `${Math.max(9, Math.round(16 * escalaLimitada))}px`,
      );
      container.style.setProperty(
        "--silabas-modo-font-size",
        `${(1.62 * escalaLimitada).toFixed(3)}rem`,
      );
      hudEscalavel.style.setProperty(
        "--facil-bloco-min-largura",
        `${Math.max(42, Math.round(58 * escalaLimitada))}px`,
      );
      hudEscalavel.style.setProperty(
        "--facil-bloco-font-size",
        `${(1.8 * escalaLimitada).toFixed(3)}rem`,
      );
      hudEscalavel.style.setProperty(
        "--facil-bloco-padding-y",
        `${Math.max(8, Math.round(14 * escalaLimitada))}px`,
      );
      hudEscalavel.style.setProperty(
        "--facil-bloco-padding-x",
        `${Math.max(10, Math.round(18 * escalaLimitada))}px`,
      );
      hudEscalavel.style.setProperty(
        "--facil-palavra-font-size",
        `${(2 * escalaLimitada).toFixed(3)}rem`,
      );
      hudEscalavel.style.setProperty(
        "--facil-palavra-padding-y",
        `${Math.max(8, Math.round(10 * escalaLimitada))}px`,
      );
      hudEscalavel.style.setProperty(
        "--facil-palavra-padding-x",
        `${Math.max(10, Math.round(16 * escalaLimitada))}px`,
      );
    }

    function obterMedidasAjusteBlocosSilabas() {
      const container =
        blocosSilabas || document.getElementById("blocos-silabas");
      if (!container) return null;

      if (
        grupoFaseAtual === "facil" &&
        interfaceHud &&
        objetivoHud &&
        objetivoPrincipalHud
      ) {
        const estiloPainel = window.getComputedStyle(interfaceHud);
        const estiloObjetivo = window.getComputedStyle(objetivoHud);
        const paddingHorizontal =
          parseFloat(estiloPainel.paddingLeft || "0") +
          parseFloat(estiloPainel.paddingRight || "0");
        const gapObjetivo =
          parseFloat(estiloObjetivo.columnGap || estiloObjetivo.gap || "0") ||
          0;

        return {
          larguraDisponivel: Math.max(
            0,
            (interfaceHud.clientWidth || 0) -
              paddingHorizontal -
              (alvoEmojiHud?.offsetWidth || 0) -
              gapObjetivo,
          ),
          larguraNecessaria: objetivoPrincipalHud.scrollWidth || 0,
        };
      }

      return {
        larguraDisponivel: container.clientWidth || 0,
        larguraNecessaria: container.scrollWidth || 0,
      };
    }

    function ajustarBlocosSilabasAoEspaco() {
      const container =
        blocosSilabas || document.getElementById("blocos-silabas");
      const hud = interfaceHud || document.getElementById("interface");
      if (!hud) return;

      aplicarEscalaInterface(1);
      if (container) {
        aplicarEscalaBlocosSilabas(1);
      }

      let escalaAtual = obterEscalaInterfaceAoEspaco();
      aplicarEscalaInterface(escalaAtual);
      if (!container) return;
      aplicarEscalaBlocosSilabas(escalaAtual);

      for (let tentativa = 0; tentativa < 4; tentativa++) {
        const medidas = obterMedidasAjusteBlocosSilabas();
        if (!medidas || medidas.larguraDisponivel <= 0) return;
        const { larguraDisponivel, larguraNecessaria } = medidas;
        const escalaEspaco = obterEscalaInterfaceAoEspaco();
        const fatorLargura =
          larguraNecessaria > larguraDisponivel
            ? larguraDisponivel / larguraNecessaria
            : 1;
        const fatorEscala =
          escalaEspaco < escalaAtual ? escalaEspaco / escalaAtual : 1;
        const fatorAjuste = Math.min(fatorLargura, fatorEscala, 1);

        if (fatorAjuste >= 0.99 || escalaAtual <= 0.64) {
          break;
        }
        escalaAtual = Math.max(
          0.64,
          escalaAtual * fatorAjuste * 0.98,
        );
        aplicarEscalaInterface(escalaAtual);
        aplicarEscalaBlocosSilabas(escalaAtual);
      }
    }

    function agendarAjusteBlocosSilabas() {
      cancelAnimationFrame(ajusteBlocosSilabasFrame);
      ajusteBlocosSilabasFrame = requestAnimationFrame(() => {
        ajusteBlocosSilabasFrame = 0;
        ajustarBlocosSilabasAoEspaco();
      });
    }

    function atualizarEstadoHUDCompacta(largura, altura) {
      const proximaIframeCompacta =
        estaEmIframe && (largura <= 1180 || altura <= 760);
      if (iframeCompactoAtivo !== proximaIframeCompacta) {
        iframeCompactoAtivo = proximaIframeCompacta;
        raizEstilos.classList.toggle("iframe-compacto", iframeCompactoAtivo);
      }

      const proximaHudCompacta =
        proximaIframeCompacta || largura <= 980 || altura <= 700;
      if (hudCompactaAtiva === proximaHudCompacta) return;
      hudCompactaAtiva = proximaHudCompacta;
      raizEstilos.classList.toggle("hud-compacta", hudCompactaAtiva);
      if (hudCompactaAtiva && radarCtx && radarCanvas) {
        radarCtx.clearRect(
          0,
          0,
          radarCanvas.clientWidth || 0,
          radarCanvas.clientHeight || 0,
        );
      }
      agendarAjusteBlocosSilabas();
    }

    function atualizarLayoutResponsivo() {
      const { largura, altura } = obterDimensoesViewport();
      larguraViewport = largura;
      alturaViewport = altura;
      atualizarEstadoHUDCompacta(largura, altura);
      tamanhoMiniMapa = Math.round(
        THREE.MathUtils.clamp(
          Math.min(largura, altura) * (estaEmIframe ? 0.22 : 0.26),
          estaEmIframe ? 96 : 112,
          estaEmIframe ? 168 : 200,
        ),
      );
      const proporcaoHud =
        estaEmIframe
          ? largura < 560
            ? 0.54
            : largura < 760
              ? 0.46
              : largura < 980
                ? 0.38
                : 0.31
          : PERFIL_EXECUCAO.firefox
            ? 0.26
            : 0.28;
      const hudWidth = Math.round(
        THREE.MathUtils.clamp(
          largura * proporcaoHud,
          estaEmIframe ? 176 : 236,
          estaEmIframe ? 320 : 380,
        ),
      );
      const touchSize = Math.round(
        THREE.MathUtils.clamp(Math.min(largura, altura) * 0.12, 46, 58),
      );

      raizEstilos.style.setProperty("--hud-largura", `${hudWidth}px`);
      raizEstilos.style.setProperty(
        "--minimapa-size",
        `${tamanhoMiniMapa}px`,
      );
      raizEstilos.style.setProperty("--touch-size", `${touchSize}px`);
      sincronizarLayoutHUDIframe();
      if (EXIBIR_HUD_SECUNDARIA && radarCanvas && radarCtx) {
        const tamanhoRadarInterno = Math.max(72, tamanhoMiniMapa - 24);
        const pixelRatioRadar = Math.min(
          window.devicePixelRatio || 1,
          PERFIL_EXECUCAO.firefoxEconomia
            ? 1
            : PERFIL_EXECUCAO.pcFraco
              ? 1.25
              : 2,
        );
        radarCanvas.width = Math.round(
          tamanhoRadarInterno * pixelRatioRadar,
        );
        radarCanvas.height = Math.round(
          tamanhoRadarInterno * pixelRatioRadar,
        );
        radarCanvas.style.width = `${tamanhoRadarInterno}px`;
        radarCanvas.style.height = `${tamanhoRadarInterno}px`;
        radarCtx.setTransform(
          pixelRatioRadar,
          0,
          0,
          pixelRatioRadar,
          0,
          0,
        );
        radarCtx.imageSmoothingEnabled = true;
        if (!radarFundoCanvas) {
          radarFundoCanvas = document.createElement("canvas");
          radarFundoCtx = radarFundoCanvas.getContext("2d");
        }
        radarFundoCanvas.width = tamanhoRadarInterno;
        radarFundoCanvas.height = tamanhoRadarInterno;
        radarFundoSujo = true;
      }

      renderizador.setPixelRatio(
        Math.min(window.devicePixelRatio, obterPixelRatioIdeal(largura)),
      );
      renderizador.setSize(largura, altura, false);
      camera.aspect = largura / altura;
      camera.updateProjectionMatrix();
      const novoTamanhoSombra = obterTamanhoSombraIdeal(largura);
      if (luzDirecional && novoTamanhoSombra !== tamanhoSombraAtual) {
        tamanhoSombraAtual = novoTamanhoSombra;
        luzDirecional.shadow.mapSize.width = novoTamanhoSombra;
        luzDirecional.shadow.mapSize.height = novoTamanhoSombra;
        if (typeof luzDirecional.shadow.map?.dispose === "function") {
          luzDirecional.shadow.map.dispose();
        }
      }
      agendarAjusteBlocosSilabas();
    }

    atualizarLayoutResponsivo();

    cena.add(
      new THREE.HemisphereLight(
        0xe6f3ff,
        0x70845f,
        PERFIL_EXECUCAO.pcFraco ? 0.46 : 0.6,
      ),
    );
    luzDirecional = new THREE.DirectionalLight(
      0xffefcf,
      PERFIL_EXECUCAO.pcFraco ? 0.72 : 0.84,
    );
    luzDirecional.position.set(82, 90, -36);
    luzDirecional.castShadow = renderizador.shadowMap.enabled;
    tamanhoSombraAtual = obterTamanhoSombraIdeal(larguraViewport);
    luzDirecional.shadow.mapSize.width = tamanhoSombraAtual;
    luzDirecional.shadow.mapSize.height = tamanhoSombraAtual;
    luzDirecional.shadow.camera.left = -180;
    luzDirecional.shadow.camera.right = 180;
    luzDirecional.shadow.camera.top = 180;
    luzDirecional.shadow.camera.bottom = -180;
    luzDirecional.shadow.camera.near = 18;
    luzDirecional.shadow.camera.far = 260;
    luzDirecional.shadow.bias = -0.00018;
    luzDirecional.shadow.normalBias = 0.02;
    luzDirecional.shadow.radius = 2;
    const luzAmbiente = new THREE.AmbientLight(
      0xc6d8e6,
      PERFIL_EXECUCAO.pcFraco ? 0.07 : 0.12,
    );
    const luzPreenchimento = new THREE.DirectionalLight(
      0xcfe4ff,
      PERFIL_EXECUCAO.pcFraco ? 0.16 : 0.22,
    );
    luzPreenchimento.position.set(-76, 58, 92);
    luzPreenchimento.castShadow = false;
    const luzRecorte = new THREE.DirectionalLight(
      0xffd8b6,
      PERFIL_EXECUCAO.pcFraco ? 0.05 : 0.09,
    );
    luzRecorte.position.set(28, 24, 118);
    luzRecorte.castShadow = false;
    cena.add(luzAmbiente);
    cena.add(luzDirecional);
    cena.add(luzPreenchimento);
    cena.add(luzRecorte);

    const mundoFisica = new CANNON.World();
    mundoFisica.gravity.set(0, -20, 0);
    mundoFisica.broadphase =
      typeof CANNON.SAPBroadphase === "function"
        ? new CANNON.SAPBroadphase(mundoFisica)
        : new CANNON.NaiveBroadphase();
    const materialDeslizante = new CANNON.Material();
    const materialCarro = new CANNON.Material();
    const corposDePiso = new WeakSet();
    const corposRampas = new WeakSet();
    mundoFisica.addContactMaterial(
      new CANNON.ContactMaterial(materialDeslizante, materialDeslizante, {
        friction: 0.0,
        restitution: 0.1,
      }),
    );
    mundoFisica.addContactMaterial(
      new CANNON.ContactMaterial(materialCarro, materialDeslizante, {
        friction: 0.0,
        restitution: 0.02,
      }),
    );
    mundoFisica.addContactMaterial(
      new CANNON.ContactMaterial(materialCarro, materialCarro, {
        friction: 0.08,
        restitution: 0.04,
      }),
    );

    function corDaPaleta(paleta) {
      return paleta[Math.floor(Math.random() * paleta.length)];
    }

    function criarMaterialCenarioVivo(cor, intensidadeEmissiva = 0.14) {
      const corBase = new THREE.Color(cor);
      const corEmissiva = corBase.clone().multiplyScalar(0.1);
      return new THREE.MeshLambertMaterial({
        color: corBase,
        emissive: corEmissiva,
        emissiveIntensity: intensidadeEmissiva * 0.34,
        flatShading: true,
        dithering: false,
      });
    }

    // ==========================================
    // 2. CENÁRIO, ÁRVORES, PEDRAS, MONTANHAS E RAMPAS
    // ==========================================
    function criarTexturaGrama() {
      const canvas = document.createElement("canvas");
      const tamanhoTextura = PERFIL_EXECUCAO.firefoxEconomia
        ? 256
        : PERFIL_EXECUCAO.pcFraco
          ? 384
          : 512;
      canvas.width = tamanhoTextura;
      canvas.height = tamanhoTextura;
      const ctx = canvas.getContext("2d");
      const gradiente = ctx.createLinearGradient(
        0,
        0,
        tamanhoTextura,
        tamanhoTextura,
      );
      gradiente.addColorStop(0, "#5e9d48");
      gradiente.addColorStop(0.5, "#71ae56");
      gradiente.addColorStop(1, "#84bf66");
      ctx.fillStyle = gradiente;
      ctx.fillRect(0, 0, tamanhoTextura, tamanhoTextura);
      ctx.fillStyle = "rgba(42, 74, 31, 0.1)";
      for (let faixa = 0; faixa < 9; faixa++) {
        const larguraFaixa = tamanhoTextura / 9;
        if (faixa % 2 === 0) {
          ctx.fillRect(
            faixa * larguraFaixa,
            0,
            larguraFaixa * 0.9,
            tamanhoTextura,
          );
        }
      }
      for (
        let i = 0;
        i <
        (PERFIL_EXECUCAO.firefoxEconomia
          ? 1400
          : PERFIL_EXECUCAO.pcFraco
            ? 2400
            : 4000);
        i++
      ) {
        ctx.fillStyle =
          Math.random() > 0.58
            ? "rgba(143, 189, 93, 0.42)"
            : "rgba(46, 93, 44, 0.52)";
        ctx.fillRect(
          Math.random() * tamanhoTextura,
          Math.random() * tamanhoTextura,
          5,
          5,
        );
      }
      for (
        let i = 0;
        i <
        (PERFIL_EXECUCAO.firefoxEconomia
          ? 110
          : PERFIL_EXECUCAO.pcFraco
            ? 180
            : 300);
        i++
      ) {
        ctx.fillStyle = ["#95c96f", "#7db55f", "#6da551", "#a3d07b"][
          Math.floor(Math.random() * 4)
        ];
        ctx.beginPath();
        ctx.arc(
          Math.random() * tamanhoTextura,
          Math.random() * tamanhoTextura,
          0.6 + Math.random() * 1.4,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      const textura = configurarTexturaComoCor(
        new THREE.CanvasTexture(canvas),
      );
      textura.wrapS = THREE.RepeatWrapping;
      textura.wrapT = THREE.RepeatWrapping;
      textura.repeat.set(30, 30);
      return textura;
    }

    const chaoMat = new THREE.MeshLambertMaterial({
      map: criarTexturaGrama(),
      color: 0x79ad58,
    });
    const tamanhoMapa = 400;
    const chaoVisual = new THREE.Mesh(
      new THREE.PlaneGeometry(tamanhoMapa, tamanhoMapa),
      chaoMat,
    );
    chaoVisual.rotation.x = -Math.PI / 2;
    chaoVisual.receiveShadow = true;
    cena.add(chaoVisual);
    congelarObjetoEstatico(chaoVisual);
    const anelMapa = new THREE.Mesh(
      new THREE.RingGeometry(194, 270, 64),
      new THREE.MeshBasicMaterial({
        color: 0x7d9a6f,
        transparent: true,
        opacity: 0.14,
        side: THREE.DoubleSide,
      }),
    );
    anelMapa.rotation.x = -Math.PI / 2;
    anelMapa.position.y = 0.08;
    cena.add(anelMapa);
    congelarObjetoEstatico(anelMapa);
    const chaoCorpo = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Plane(),
      material: materialDeslizante,
    });
    chaoCorpo.quaternion.setFromAxisAngle(
      new CANNON.Vec3(1, 0, 0),
      -Math.PI / 2,
    );
    corposDePiso.add(chaoCorpo);
    mundoFisica.addBody(chaoCorpo);

    function descartarMaterial(material, descartarTexturas = true) {
      if (!material) return;
      if (descartarTexturas) {
        for (const chave of [
          "map",
          "alphaMap",
          "emissiveMap",
          "normalMap",
        ]) {
          const textura = material[chave];
          if (textura && typeof textura.dispose === "function") {
            textura.dispose();
          }
        }
      }
      if (typeof material.dispose === "function") material.dispose();
    }

    function descartarObjeto3D(objeto, descartarTexturas = true) {
      if (!objeto) return;
      objeto.traverse((filho) => {
        if (
          filho.geometry &&
          typeof filho.geometry.dispose === "function"
        ) {
          filho.geometry.dispose();
        }
        if (Array.isArray(filho.material)) {
          for (const material of filho.material) {
            descartarMaterial(material, descartarTexturas);
          }
        } else {
          descartarMaterial(filho.material, descartarTexturas);
        }
      });
    }

    function congelarObjetoEstatico(objeto) {
      if (!objeto) return objeto;
      objeto.updateMatrixWorld(true);
      objeto.traverse((filho) => {
        filho.matrixAutoUpdate = false;
        if (typeof filho.updateMatrix === "function")
          filho.updateMatrix();
      });
      return objeto;
    }

    function removerObjetoRegistrado(item) {
      if (!item) return;
      if (item.visual) {
        cena.remove(item.visual);
        if (item.descartavel) {
          descartarObjeto3D(item.visual, item.descartarTexturas);
        }
      }
      if (item.luz) cena.remove(item.luz);
      if (item.corpo) mundoFisica.removeBody(item.corpo);
      if (typeof item.aoRemover === "function") item.aoRemover(item);
    }

    function limparObjetosRegistrados(lista) {
      for (const item of lista) removerObjetoRegistrado(item);
      lista.length = 0;
    }

    function registrarObjeto({
      visual = null,
      corpo = null,
      luz = null,
      descartavel = true,
      descartarTexturas = true,
      aoRemover = null,
    }) {
      return {
        visual,
        corpo,
        luz,
        descartavel,
        descartarTexturas,
        aoRemover,
      };
    }

    function registrarAreaOcupada(x, z, raio) {
      areasOcupadasMapa.push({ x, z, raio });
    }

    function posicaoLivreNoMapa(x, z, raio) {
      if (Math.abs(x) > 150 || Math.abs(z) > 150) return false;
      if (Math.hypot(x, z - 20) < 24 + raio) return false;
      if (Math.hypot(x - 100, z - 100) < 22 + raio) return false;
      if (Math.hypot(x + 110, z - 85) < 22 + raio) return false;

      return areasOcupadasMapa.every(
        (area) => Math.hypot(x - area.x, z - area.z) > area.raio + raio,
      );
    }

    function encontrarPosicaoLivreParaSilaba(posicoesJaUsadas) {
      for (let tentativa = 0; tentativa < 120; tentativa++) {
        const ang = Math.random() * Math.PI * 2;
        const r = 38 + Math.random() * 78;
        const x = Math.cos(ang) * r;
        const z = Math.sin(ang) * r;
        const livreEntreSilabas = posicoesJaUsadas.every(
          (p) => Math.hypot(x - p.x, z - p.z) > 30,
        );
        if (posicaoLivreNoMapa(x, z, 12) && livreEntreSilabas) {
          return { x, z };
        }
      }

      for (let raio = 45; raio <= 120; raio += 8) {
        for (
          let angulo = 0;
          angulo < Math.PI * 2;
          angulo += Math.PI / 12
        ) {
          const x = Math.cos(angulo) * raio;
          const z = Math.sin(angulo) * raio;
          const livreEntreSilabas = posicoesJaUsadas.every(
            (p) => Math.hypot(x - p.x, z - p.z) > 28,
          );
          if (posicaoLivreNoMapa(x, z, 10) && livreEntreSilabas) {
            return { x, z };
          }
        }
      }

      return { x: 0, z: -60 };
    }

    function criarParedeInvisivel(x, z, largura, prof, altura = 72) {
      const parede = new CANNON.Body({
        mass: 0,
        shape: new CANNON.Box(
          new CANNON.Vec3(largura / 2, altura / 2, prof / 2),
        ),
        position: new CANNON.Vec3(x, altura / 2, z),
        material: materialDeslizante,
      });
      corposDePiso.add(parede);
      mundoFisica.addBody(parede);
    }
    criarParedeInvisivel(0, -tamanhoMapa / 2 + 8, tamanhoMapa - 8, 10);
    criarParedeInvisivel(0, tamanhoMapa / 2 - 8, tamanhoMapa - 8, 10);
    criarParedeInvisivel(-tamanhoMapa / 2 + 8, 0, 10, tamanhoMapa - 8);
    criarParedeInvisivel(tamanhoMapa / 2 - 8, 0, 10, tamanhoMapa - 8);

    function criarMontanha(x, z, raio, escalaAltura = 1.22) {
      const geoMontanha = new THREE.SphereGeometry(
        raio,
        PERFIL_EXECUCAO.pcFraco ? 18 : 32,
        PERFIL_EXECUCAO.pcFraco ? 10 : 16,
      );
      const alturaBase = -raio * 0.58;
      const anguloCentro = Math.atan2(z, x);
      const montanhaVisual = new THREE.Mesh(
        geoMontanha,
        criarMaterialCenarioVivo(
          corDaPaleta(PALETA_CENARIO.montanhas),
          0.12,
        ),
      );
      montanhaVisual.scale.y = escalaAltura;
      montanhaVisual.position.set(x, alturaBase, z);
      montanhaVisual.receiveShadow = true;
      montanhaVisual.castShadow = true;
      cena.add(montanhaVisual);
      congelarObjetoEstatico(montanhaVisual);
      const montanhaCorpo = new CANNON.Body({
        mass: 0,
        material: materialDeslizante,
        position: new CANNON.Vec3(x, alturaBase, z),
      });
      montanhaCorpo.quaternion.setFromAxisAngle(
        new CANNON.Vec3(0, 1, 0),
        anguloCentro,
      );
      montanhaCorpo.addShape(new CANNON.Sphere(raio * 1.1));
      montanhaCorpo.addShape(
        new CANNON.Sphere(raio * 0.74),
        new CANNON.Vec3(0, raio * 0.5 * escalaAltura, 0),
      );
      montanhaCorpo.addShape(
        new CANNON.Box(
          new CANNON.Vec3(
            Math.max(5.5, raio * 0.18),
            Math.max(14, raio * 0.38 * escalaAltura),
            Math.max(18, raio * 0.84),
          ),
        ),
        new CANNON.Vec3(
          -raio * 0.46,
          Math.max(11, raio * 0.6 * escalaAltura),
          0,
        ),
      );
      corposDePiso.add(montanhaCorpo);
      mundoFisica.addBody(montanhaCorpo);
    }

    const quantidadeMontanhasBorda = PERFIL_EXECUCAO.firefoxEconomia
      ? 30
      : PERFIL_EXECUCAO.pcFraco
        ? 34
        : 40;
    for (let i = 0; i < quantidadeMontanhasBorda; i++) {
      const anguloBase = (i / quantidadeMontanhasBorda) * Math.PI * 2;
      const angulo =
        anguloBase +
        (Math.random() - 0.5) *
          ((Math.PI / quantidadeMontanhasBorda) * 0.55);
      const distanciaBorda = 246 + Math.random() * 18;
      const tamanhoMontanha = PERFIL_EXECUCAO.firefoxEconomia
        ? 34 + Math.random() * 10
        : PERFIL_EXECUCAO.pcFraco
          ? 36 + Math.random() * 12
          : 38 + Math.random() * 14;
      const escalaAltura = 1.16 + Math.random() * 0.22;
      criarMontanha(
        Math.cos(angulo) * distanciaBorda,
        Math.sin(angulo) * distanciaBorda,
        tamanhoMontanha,
        escalaAltura,
      );
    }

    function criarArvore(x, z) {
      const arvoreVisual = new THREE.Group();
      const tronco = new THREE.Mesh(
        new THREE.CylinderGeometry(
          0.5,
          0.8,
          4,
          PERFIL_EXECUCAO.firefox ? 6 : PERFIL_EXECUCAO.pcFraco ? 6 : 8,
        ),
        criarMaterialCenarioVivo(
          corDaPaleta(PALETA_CENARIO.troncos),
          0.08,
        ),
      );
      tronco.position.y = 2;
      tronco.castShadow = true;
      arvoreVisual.add(tronco);
      const folhas = new THREE.Mesh(
        new THREE.ConeGeometry(
          3,
          6,
          PERFIL_EXECUCAO.firefox ? 5 : PERFIL_EXECUCAO.pcFraco ? 5 : 7,
        ),
        criarMaterialCenarioVivo(
          corDaPaleta(PALETA_CENARIO.arvores),
          0.18,
        ),
      );
      folhas.position.y = 6;
      folhas.castShadow = true;
      arvoreVisual.add(folhas);
      arvoreVisual.position.set(x, 0, z);
      cena.add(arvoreVisual);
      congelarObjetoEstatico(arvoreVisual);
      const corpo = new CANNON.Body({
        mass: 0,
        shape: new CANNON.Box(new CANNON.Vec3(1.35, 5, 1.35)),
        position: new CANNON.Vec3(x, 5, z),
        material: materialDeslizante,
      });
      mundoFisica.addBody(corpo);
      registrarAreaOcupada(x, z, 7);
      return registrarObjeto({ visual: arvoreVisual, corpo });
    }

    function criarPedra(x, z, tamanho) {
      const pedraGeo = new THREE.DodecahedronGeometry(tamanho);
      const pedraMat = criarMaterialCenarioVivo(
        corDaPaleta(PALETA_CENARIO.pedras),
        0.15,
      );
      const pedraVis = new THREE.Mesh(pedraGeo, pedraMat);
      pedraVis.position.set(x, tamanho / 2, z);
      pedraVis.castShadow = false;
      pedraVis.receiveShadow = true;
      cena.add(pedraVis);
      congelarObjetoEstatico(pedraVis);
      const corpo = new CANNON.Body({
        mass: 0,
        shape: new CANNON.Sphere(tamanho + 0.9),
        position: new CANNON.Vec3(x, tamanho / 2, z),
        material: materialDeslizante,
      });
      mundoFisica.addBody(corpo);
      registrarAreaOcupada(x, z, tamanho + 4);
      return registrarObjeto({ visual: pedraVis, corpo });
    }

    function criarRampa(x, z, rotacaoY) {
      const corRampa = corDaPaleta(PALETA_CENARIO.rampas);
      const rampaCorpo = new CANNON.Body({
        mass: 0,
        material: materialDeslizante,
      });
      rampaCorpo.addShape(
        new CANNON.Box(new CANNON.Vec3(7.2, 2.8, 10.2)),
      );
      rampaCorpo.addShape(
        new CANNON.Box(new CANNON.Vec3(6.1, 1.5, 8.8)),
        new CANNON.Vec3(0, -1.75, 0.2),
      );
      rampaCorpo.position.set(x, 1.15, z);
      const inclina = new CANNON.Quaternion();
      inclina.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 8);
      const gira = new CANNON.Quaternion();
      gira.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), rotacaoY);
      rampaCorpo.quaternion = gira.mult(inclina);
      corposDePiso.add(rampaCorpo);
      corposRampas.add(rampaCorpo);
      mundoFisica.addBody(rampaCorpo);
      const rampaVisual = new THREE.Mesh(
        new THREE.BoxGeometry(13.2, 4.4, 18.4),
        criarMaterialCenarioVivo(corRampa, 0.2),
      );
      rampaVisual.castShadow = true;
      rampaVisual.receiveShadow = true;
      rampaVisual.position.copy(rampaCorpo.position);
      rampaVisual.quaternion.copy(rampaCorpo.quaternion);
      cena.add(rampaVisual);
      congelarObjetoEstatico(rampaVisual);
      registrarAreaOcupada(x, z, 14);
      return registrarObjeto({ visual: rampaVisual, corpo: rampaCorpo });
    }

    function criarArbusto(x, z, tamanho = 2.8) {
      const arbusto = new THREE.Mesh(
        new THREE.SphereGeometry(
          tamanho,
          PERFIL_EXECUCAO.firefox ? 10 : 14,
          PERFIL_EXECUCAO.firefox ? 8 : 12,
        ),
        criarMaterialCenarioVivo(
          corDaPaleta(PALETA_CENARIO.arbustos),
          0.17,
        ),
      );
      arbusto.position.set(x, tamanho * 0.7, z);
      arbusto.castShadow = false;
      arbusto.receiveShadow = true;
      cena.add(arbusto);
      congelarObjetoEstatico(arbusto);
      const corpo = new CANNON.Body({
        mass: 0,
        shape: new CANNON.Sphere(tamanho * 1.1),
        position: new CANNON.Vec3(x, tamanho * 0.7, z),
        material: materialDeslizante,
      });
      mundoFisica.addBody(corpo);
      registrarAreaOcupada(x, z, tamanho + 3);
      return registrarObjeto({ visual: arbusto, corpo });
    }

    function criarCone(x, z, tamanho = 1.6) {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(
          tamanho,
          tamanho * 3.1,
          PERFIL_EXECUCAO.firefox ? 6 : 8,
        ),
        criarMaterialCenarioVivo(corDaPaleta(PALETA_CENARIO.cones), 0.16),
      );
      cone.position.set(x, tamanho * 1.5, z);
      cone.castShadow = false;
      cena.add(cone);
      congelarObjetoEstatico(cone);
      const corpo = new CANNON.Body({
        mass: 0,
        shape: new CANNON.Box(
          new CANNON.Vec3(tamanho * 0.8, tamanho * 1.5, tamanho * 0.8),
        ),
        position: new CANNON.Vec3(x, tamanho * 1.5, z),
        material: materialDeslizante,
      });
      mundoFisica.addBody(corpo);
      registrarAreaOcupada(x, z, tamanho + 2.4);
      return registrarObjeto({ visual: cone, corpo });
    }

    function criarCaixa(
      x,
      z,
      largura = 4,
      altura = 3.2,
      profundidade = 4,
    ) {
      const caixa = new THREE.Mesh(
        new THREE.BoxGeometry(largura, altura, profundidade),
        criarMaterialCenarioVivo(
          corDaPaleta(PALETA_CENARIO.caixas),
          0.14,
        ),
      );
      caixa.position.set(x, altura / 2, z);
      caixa.castShadow = false;
      caixa.receiveShadow = true;
      cena.add(caixa);
      congelarObjetoEstatico(caixa);
      const corpo = new CANNON.Body({
        mass: 0,
        shape: new CANNON.Box(
          new CANNON.Vec3(largura / 2, altura / 2, profundidade / 2),
        ),
        position: new CANNON.Vec3(x, altura / 2, z),
        material: materialDeslizante,
      });
      mundoFisica.addBody(corpo);
      registrarAreaOcupada(x, z, Math.max(largura, profundidade) + 2.8);
      return registrarObjeto({ visual: caixa, corpo });
    }

    // Rampas e obstáculos são gerados dentro de iniciarJogo() para serem novos a cada partida
    // (ver função iniciarJogo abaixo)
    let objetosDoMapa = []; // objetos visuais do cenário que podem ser removidos/resetados
    let areasOcupadasMapa = [];
    let nosNavegacaoPolicia = [];
    let conexoesNavegacaoPolicia = [];

    function pontoNavegavelNoMapa(x, z, folga = 0) {
      const limite =
        tamanhoMapa / 2 - CONFIG_NAVEGACAO_POLICIA.margemMapa;
      if (Math.abs(x) > limite || Math.abs(z) > limite) return false;

      return areasOcupadasMapa.every(
        (area) => Math.hypot(x - area.x, z - area.z) > area.raio + folga,
      );
    }

    function distanciaPontoParaSegmento(x, z, ax, az, bx, bz) {
      const abx = bx - ax;
      const abz = bz - az;
      const comprimentoQuadrado = abx * abx + abz * abz;
      if (comprimentoQuadrado <= 0.0001) {
        return Math.hypot(x - ax, z - az);
      }

      const projecao = THREE.MathUtils.clamp(
        ((x - ax) * abx + (z - az) * abz) / comprimentoQuadrado,
        0,
        1,
      );
      const pontoX = ax + abx * projecao;
      const pontoZ = az + abz * projecao;
      return Math.hypot(x - pontoX, z - pontoZ);
    }

    function segmentoLivreParaNavegacao(ax, az, bx, bz, folga = 0) {
      if (
        !pontoNavegavelNoMapa(ax, az, 0) ||
        !pontoNavegavelNoMapa(bx, bz, 0)
      ) {
        return false;
      }

      return areasOcupadasMapa.every((area) => {
        return (
          distanciaPontoParaSegmento(area.x, area.z, ax, az, bx, bz) >
          area.raio + folga
        );
      });
    }

    function construirMalhaNavegacaoPolicia() {
      nosNavegacaoPolicia = [];
      conexoesNavegacaoPolicia = [];
      const limite =
        tamanhoMapa / 2 - CONFIG_NAVEGACAO_POLICIA.margemMapa;
      const passo = CONFIG_NAVEGACAO_POLICIA.passo;
      const distanciaLigacaoQuadrada =
        CONFIG_NAVEGACAO_POLICIA.distanciaLigacao *
        CONFIG_NAVEGACAO_POLICIA.distanciaLigacao;

      for (let z = -limite; z <= limite; z += passo) {
        for (let x = -limite; x <= limite; x += passo) {
          if (
            !pontoNavegavelNoMapa(
              x,
              z,
              CONFIG_NAVEGACAO_POLICIA.folgaNodo,
            )
          ) {
            continue;
          }
          nosNavegacaoPolicia.push({ x, z });
          conexoesNavegacaoPolicia.push([]);
        }
      }

      for (let i = 0; i < nosNavegacaoPolicia.length; i++) {
        const origem = nosNavegacaoPolicia[i];
        for (let j = i + 1; j < nosNavegacaoPolicia.length; j++) {
          const destino = nosNavegacaoPolicia[j];
          const dx = destino.x - origem.x;
          const dz = destino.z - origem.z;
          const distanciaQuadrada = dx * dx + dz * dz;
          if (distanciaQuadrada > distanciaLigacaoQuadrada) continue;
          if (
            !segmentoLivreParaNavegacao(
              origem.x,
              origem.z,
              destino.x,
              destino.z,
              CONFIG_NAVEGACAO_POLICIA.folgaSegmento,
            )
          ) {
            continue;
          }

          const custo = Math.sqrt(distanciaQuadrada);
          conexoesNavegacaoPolicia[i].push({ indice: j, custo });
          conexoesNavegacaoPolicia[j].push({ indice: i, custo });
        }
      }
    }

    function obterNosTemporariosParaRota(x, z) {
      const candidatos = [];
      for (let i = 0; i < nosNavegacaoPolicia.length; i++) {
        const no = nosNavegacaoPolicia[i];
        if (
          !segmentoLivreParaNavegacao(
            x,
            z,
            no.x,
            no.z,
            CONFIG_NAVEGACAO_POLICIA.folgaSegmento,
          )
        ) {
          continue;
        }
        candidatos.push({
          indice: i,
          custo: Math.hypot(no.x - x, no.z - z),
        });
      }

      candidatos.sort((a, b) => a.custo - b.custo);
      return candidatos.slice(
        0,
        CONFIG_NAVEGACAO_POLICIA.conexoesTemporarias,
      );
    }

    function reconstruirRotaEntreNos(anterior, indiceFinal) {
      const rotaIndices = [];
      let atual = indiceFinal;

      while (atual !== undefined && atual !== null) {
        rotaIndices.push(atual);
        atual = anterior[atual];
      }

      rotaIndices.reverse();
      return rotaIndices.map((indice) => nosNavegacaoPolicia[indice]);
    }

    function simplificarRotaPolicial(origem, rota, destino) {
      const pontos = [...rota];
      if (pontos.length === 0) {
        return segmentoLivreParaNavegacao(
          origem.x,
          origem.z,
          destino.x,
          destino.z,
          CONFIG_NAVEGACAO_POLICIA.folgaSegmento,
        )
          ? [{ x: destino.x, z: destino.z }]
          : [];
      }

      const simplificada = [];
      let ancora = origem;
      let indice = 0;

      while (indice < pontos.length) {
        let melhorIndice = indice;
        for (let teste = pontos.length - 1; teste > indice; teste--) {
          const pontoTeste = pontos[teste];
          if (
            segmentoLivreParaNavegacao(
              ancora.x,
              ancora.z,
              pontoTeste.x,
              pontoTeste.z,
              CONFIG_NAVEGACAO_POLICIA.folgaSegmento,
            )
          ) {
            melhorIndice = teste;
            break;
          }
        }

        const escolhido = pontos[melhorIndice];
        simplificada.push({ x: escolhido.x, z: escolhido.z });
        ancora = escolhido;
        indice = melhorIndice + 1;
      }

      if (
        segmentoLivreParaNavegacao(
          ancora.x,
          ancora.z,
          destino.x,
          destino.z,
          CONFIG_NAVEGACAO_POLICIA.folgaSegmento,
        )
      ) {
        simplificada.push({ x: destino.x, z: destino.z });
      }

      return simplificada;
    }

    function calcularRotaPolicialNoMapa(origem, destino) {
      if (
        segmentoLivreParaNavegacao(
          origem.x,
          origem.z,
          destino.x,
          destino.z,
          CONFIG_NAVEGACAO_POLICIA.folgaSegmento,
        )
      ) {
        return [{ x: destino.x, z: destino.z }];
      }

      const nosOrigem = obterNosTemporariosParaRota(origem.x, origem.z);
      const nosDestino = obterNosTemporariosParaRota(
        destino.x,
        destino.z,
      );
      if (!nosOrigem.length || !nosDestino.length) return [];

      const metas = new Map();
      for (const meta of nosDestino) metas.set(meta.indice, meta.custo);

      const custoAte = new Array(nosNavegacaoPolicia.length).fill(
        Infinity,
      );
      const anterior = new Array(nosNavegacaoPolicia.length).fill(null);
      const abertos = [];

      for (const inicial of nosOrigem) {
        custoAte[inicial.indice] = inicial.custo;
        abertos.push({
          indice: inicial.indice,
          prioridade:
            inicial.custo +
            Math.hypot(
              nosNavegacaoPolicia[inicial.indice].x - destino.x,
              nosNavegacaoPolicia[inicial.indice].z - destino.z,
            ),
        });
      }

      let expansoes = 0;
      let melhorMeta = null;

      while (
        abertos.length &&
        expansoes < CONFIG_NAVEGACAO_POLICIA.maxNosExpandidos
      ) {
        abertos.sort((a, b) => a.prioridade - b.prioridade);
        const atual = abertos.shift();
        expansoes++;

        if (metas.has(atual.indice)) {
          melhorMeta = atual.indice;
          break;
        }

        const conexoes = conexoesNavegacaoPolicia[atual.indice] || [];
        for (const vizinho of conexoes) {
          const novoCusto = custoAte[atual.indice] + vizinho.custo;
          if (novoCusto >= custoAte[vizinho.indice]) continue;

          custoAte[vizinho.indice] = novoCusto;
          anterior[vizinho.indice] = atual.indice;
          abertos.push({
            indice: vizinho.indice,
            prioridade:
              novoCusto +
              Math.hypot(
                nosNavegacaoPolicia[vizinho.indice].x - destino.x,
                nosNavegacaoPolicia[vizinho.indice].z - destino.z,
              ),
          });
        }
      }

      if (melhorMeta === null) return [];

      const rotaBase = reconstruirRotaEntreNos(anterior, melhorMeta);
      return simplificarRotaPolicial(origem, rotaBase, destino);
    }

    function limparRotaPolicial(estado) {
      estado.rota = [];
      estado.indiceRota = 0;
      estado.tempoRota = 0;
      estado.alvoRotaX = Number.NaN;
      estado.alvoRotaZ = Number.NaN;
    }

    function obterAlvoNavegacaoPolicial(policial, alvo, delta) {
      const estado = policial.estado;
      const origem = {
        x: policial.corpo.position.x,
        z: policial.corpo.position.z,
      };
      estado.tempoRota = Math.max(0, estado.tempoRota - delta);

      if (
        segmentoLivreParaNavegacao(
          origem.x,
          origem.z,
          alvo.x,
          alvo.z,
          CONFIG_NAVEGACAO_POLICIA.folgaSegmento,
        )
      ) {
        limparRotaPolicial(estado);
        return alvo;
      }

      const alvoMudou =
        !Number.isFinite(estado.alvoRotaX) ||
        Math.hypot(alvo.x - estado.alvoRotaX, alvo.z - estado.alvoRotaZ) >
          CONFIG_NAVEGACAO_POLICIA.desvioRecalculo;
      const precisaRecalcular =
        !estado.rota.length ||
        estado.indiceRota >= estado.rota.length ||
        estado.tempoRota <= 0 ||
        alvoMudou;

      if (precisaRecalcular) {
        estado.rota = calcularRotaPolicialNoMapa(origem, alvo);
        estado.indiceRota = 0;
        estado.tempoRota = CONFIG_NAVEGACAO_POLICIA.intervaloRecalculo;
        estado.alvoRotaX = alvo.x;
        estado.alvoRotaZ = alvo.z;
      }

      while (estado.indiceRota < estado.rota.length) {
        const waypoint = estado.rota[estado.indiceRota];
        const distanciaWaypoint = Math.hypot(
          waypoint.x - origem.x,
          waypoint.z - origem.z,
        );

        if (
          distanciaWaypoint <= CONFIG_NAVEGACAO_POLICIA.distanciaChegada
        ) {
          estado.indiceRota++;
          continue;
        }

        let waypointMaisAFrente = waypoint;
        for (
          let indice = estado.rota.length - 1;
          indice > estado.indiceRota;
          indice--
        ) {
          const candidato = estado.rota[indice];
          if (
            segmentoLivreParaNavegacao(
              origem.x,
              origem.z,
              candidato.x,
              candidato.z,
              CONFIG_NAVEGACAO_POLICIA.folgaSegmento,
            )
          ) {
            estado.indiceRota = indice;
            waypointMaisAFrente = candidato;
            break;
          }
        }

        return waypointMaisAFrente;
      }

      return alvo;
    }

    // ==========================================
    // 3. OS CARROS (JOGADOR E POLÍCIA)
    // ==========================================
    function criarRoda(grupo, x, z) {
      const roda = new THREE.Mesh(
        new THREE.CylinderGeometry(0.6, 0.6, 0.5, 16),
        new THREE.MeshLambertMaterial({ color: 0x222222 }),
      );
      roda.rotation.z = Math.PI / 2;
      roda.position.set(x, -0.6, z);
      roda.castShadow = true;
      grupo.add(roda);
    }

    // Jogador
    const carroCorpo = new CANNON.Body({
      mass: 800,
      shape: new CANNON.Box(new CANNON.Vec3(1.2, 0.6, 2.2)),
      material: materialCarro,
    });
    carroCorpo.allowSleep = false;
    carroCorpo.angularDamping = 0.9;
    carroCorpo.linearDamping = 0.02;
    if (
      carroCorpo.angularFactor &&
      typeof carroCorpo.angularFactor.set === "function"
    ) {
      carroCorpo.angularFactor.set(0, 1, 0);
    }
    mundoFisica.addBody(carroCorpo);
    const carroVisual = new THREE.Group();
    cena.add(carroVisual);

    function reconstruirMalhasDoCarro(modelo) {
      while (carroVisual.children.length > 0) {
        const child = carroVisual.children[0];
        if (child.geometry) child.geometry.dispose();
        if (child.material && !Array.isArray(child.material))
          child.material.dispose();
        carroVisual.remove(child);
      }

      const matCorpo = new THREE.MeshLambertMaterial({
        color: modelo.carroceria,
      });
      const matVidro = new THREE.MeshLambertMaterial({
        color: modelo.vidro,
      });
      const matDetalhe = new THREE.MeshLambertMaterial({
        color: modelo.detalhe,
      });
      const matAsa = new THREE.MeshBasicMaterial({ color: modelo.asa });

      criarRoda(carroVisual, -1.3, 1.4);
      criarRoda(carroVisual, 1.3, 1.4);
      criarRoda(carroVisual, -1.3, -1.4);
      criarRoda(carroVisual, 1.3, -1.4);

      if (carroSelecionado === "moto-urbana") {
        const geoBase = new THREE.CylinderGeometry(1.0, 1.35, 4.5, 6);
        geoBase.rotateX(Math.PI / 2);
        const base = new THREE.Mesh(geoBase, matCorpo);
        base.scale.set(0.7, 0.14, 0.95);
        base.position.set(0, 0.42, 0.15);
        base.rotation.z = Math.PI / 2;

        const capo = new THREE.Mesh(
          new THREE.BoxGeometry(0.38, 0.22, 2.35),
          matDetalhe,
        );
        capo.position.set(0, 0.72, -0.2);

        const nariz = new THREE.Mesh(
          new THREE.ConeGeometry(0.32, 1.3, 18),
          matDetalhe,
        );
        nariz.rotation.x = -Math.PI / 2;
        nariz.position.set(0, 0.7, -1.95);

        const cockpit = new THREE.Mesh(
          new THREE.BoxGeometry(0.5, 0.42, 0.78),
          matVidro,
        );
        cockpit.position.set(0, 1.0, -0.32);
        cockpit.rotation.x = -Math.PI / 14;

        const fairingEsq = new THREE.Mesh(
          new THREE.BoxGeometry(0.14, 0.52, 1.15),
          matCorpo,
        );
        fairingEsq.position.set(-0.42, 0.68, 0.5);
        const fairingDir = new THREE.Mesh(
          new THREE.BoxGeometry(0.14, 0.52, 1.15),
          matCorpo,
        );
        fairingDir.position.set(0.42, 0.68, 0.5);

        const rollBar = new THREE.Mesh(
          new THREE.BoxGeometry(0.18, 0.95, 0.18),
          matAsa,
        );
        rollBar.position.set(0, 1.22, 0.35);

        const traseira = new THREE.Mesh(
          new THREE.BoxGeometry(0.74, 0.16, 0.55),
          matAsa,
        );
        traseira.position.set(0, 0.92, 1.7);

        carroVisual.add(base);
        carroVisual.add(capo);
        carroVisual.add(nariz);
        carroVisual.add(cockpit);
        carroVisual.add(fairingEsq);
        carroVisual.add(fairingDir);
        carroVisual.add(rollBar);
        carroVisual.add(traseira);
      } else if (carroSelecionado === "rally") {
        const corpo = new THREE.Mesh(
          new THREE.BoxGeometry(2.7, 1.1, 4.35),
          matCorpo,
        );
        corpo.position.set(0, 0.24, 0);

        const cabine = new THREE.Mesh(
          new THREE.BoxGeometry(2.1, 0.92, 1.95),
          matVidro,
        );
        cabine.position.set(0, 0.98, -0.32);

        const paraChoque = new THREE.Mesh(
          new THREE.BoxGeometry(3.05, 0.34, 0.72),
          matDetalhe,
        );
        paraChoque.position.set(0, -0.02, -2.12);

        const scoop = new THREE.Mesh(
          new THREE.BoxGeometry(0.72, 0.18, 0.64),
          matAsa,
        );
        scoop.position.set(0, 1.48, -0.08);

        const spoiler = new THREE.Mesh(
          new THREE.BoxGeometry(1.9, 0.12, 0.42),
          matAsa,
        );
        spoiler.position.set(0, 1.2, 1.96);

        const flareFrenteEsq = new THREE.Mesh(
          new THREE.BoxGeometry(0.24, 0.28, 0.95),
          matDetalhe,
        );
        flareFrenteEsq.position.set(-1.36, 0.08, -1.34);
        const flareFrenteDir = new THREE.Mesh(
          new THREE.BoxGeometry(0.24, 0.28, 0.95),
          matDetalhe,
        );
        flareFrenteDir.position.set(1.36, 0.08, -1.34);
        const flareTrasEsq = new THREE.Mesh(
          new THREE.BoxGeometry(0.24, 0.28, 0.95),
          matDetalhe,
        );
        flareTrasEsq.position.set(-1.36, 0.08, 1.34);
        const flareTrasDir = new THREE.Mesh(
          new THREE.BoxGeometry(0.24, 0.28, 0.95),
          matDetalhe,
        );
        flareTrasDir.position.set(1.36, 0.08, 1.34);

        carroVisual.add(corpo);
        carroVisual.add(cabine);
        carroVisual.add(paraChoque);
        carroVisual.add(scoop);
        carroVisual.add(spoiler);
        carroVisual.add(flareFrenteEsq);
        carroVisual.add(flareFrenteDir);
        carroVisual.add(flareTrasEsq);
        carroVisual.add(flareTrasDir);
      } else if (carroSelecionado === "turbovan") {
        const corpo = new THREE.Mesh(
          new THREE.BoxGeometry(2.6, 1.55, 4.4),
          matCorpo,
        );
        corpo.position.set(0, 0.55, 0.1);

        const cabine = new THREE.Mesh(
          new THREE.BoxGeometry(2.1, 1.15, 2.1),
          matVidro,
        );
        cabine.position.set(0, 1.4, -0.45);

        const faixa = new THREE.Mesh(
          new THREE.BoxGeometry(2.65, 0.14, 3.2),
          matDetalhe,
        );
        faixa.position.set(0, 0.25, 0.2);

        const spoiler = new THREE.Mesh(
          new THREE.BoxGeometry(1.5, 0.14, 0.4),
          matAsa,
        );
        spoiler.position.set(0, 1.55, 2.05);

        const defletor = new THREE.Mesh(
          new THREE.BoxGeometry(2.58, 0.22, 0.56),
          matDetalhe,
        );
        defletor.position.set(0, 0.18, -2.12);

        const tetoExtra = new THREE.Mesh(
          new THREE.BoxGeometry(1.55, 0.14, 1.0),
          matAsa,
        );
        tetoExtra.position.set(0, 2.02, 0.45);

        carroVisual.add(corpo);
        carroVisual.add(cabine);
        carroVisual.add(faixa);
        carroVisual.add(spoiler);
        carroVisual.add(defletor);
        carroVisual.add(tetoExtra);
      } else if (carroSelecionado === "moto-trilha") {
        const geoCorpo = new THREE.CylinderGeometry(0.52, 0.62, 4.6, 20);
        geoCorpo.rotateX(Math.PI / 2);
        const corpo = new THREE.Mesh(geoCorpo, matCorpo);
        corpo.scale.set(0.76, 0.18, 0.96);
        corpo.position.y = 0.48;
        corpo.rotation.z = Math.PI / 2;

        const bico = new THREE.Mesh(
          new THREE.ConeGeometry(0.34, 1.45, 20),
          matDetalhe,
        );
        bico.rotation.x = -Math.PI / 2;
        bico.position.set(0, 0.82, -1.95);

        const cabine = new THREE.Mesh(
          new THREE.SphereGeometry(0.55, 20, 16),
          matVidro,
        );
        cabine.scale.set(0.7, 0.62, 1.02);
        cabine.position.set(0, 1.02, -0.18);

        const asaFrente = new THREE.Mesh(
          new THREE.BoxGeometry(1.5, 0.16, 0.26),
          matAsa,
        );
        asaFrente.position.set(0, 1.32, -0.98);

        const asaTras = new THREE.Mesh(
          new THREE.BoxGeometry(0.28, 1.15, 0.28),
          matAsa,
        );
        asaTras.position.set(0, 1.25, 1.35);

        const paralamaEsq = new THREE.Mesh(
          new THREE.BoxGeometry(0.16, 0.68, 1.0),
          matDetalhe,
        );
        paralamaEsq.position.set(-0.48, 0.86, 0.55);
        const paralamaDir = new THREE.Mesh(
          new THREE.BoxGeometry(0.16, 0.68, 1.0),
          matDetalhe,
        );
        paralamaDir.position.set(0.48, 0.86, 0.55);

        carroVisual.add(corpo);
        carroVisual.add(bico);
        carroVisual.add(cabine);
        carroVisual.add(asaFrente);
        carroVisual.add(asaTras);
        carroVisual.add(paralamaEsq);
        carroVisual.add(paralamaDir);
      } else if (carroSelecionado === "phantom") {
        const geoCorpo = new THREE.CylinderGeometry(1.25, 1.6, 4.9, 4);
        geoCorpo.rotateX(Math.PI / 2);
        geoCorpo.rotateZ(Math.PI);
        const corpo = new THREE.Mesh(geoCorpo, matCorpo);
        corpo.scale.set(1, 0.22, 1);
        corpo.position.set(0, 0.02, 0);

        const canopy = new THREE.Mesh(
          new THREE.SphereGeometry(0.95, 26, 16),
          matVidro,
        );
        canopy.scale.set(0.7, 0.25, 1.4);
        canopy.position.set(0, 0.5, 0.15);

        const laminaEsq = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, 0.12, 2.6),
          matAsa,
        );
        laminaEsq.position.set(-1.18, 0.18, 0.15);
        const laminaDir = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, 0.12, 2.6),
          matAsa,
        );
        laminaDir.position.set(1.18, 0.18, 0.15);

        const bico = new THREE.Mesh(
          new THREE.ConeGeometry(0.36, 1.9, 16),
          matAsa,
        );
        bico.rotation.x = -Math.PI / 2;
        bico.position.set(0, 0.02, -2.75);

        carroVisual.add(corpo);
        carroVisual.add(canopy);
        carroVisual.add(laminaEsq);
        carroVisual.add(laminaDir);
        carroVisual.add(bico);
      } else if (modelo.visual === "classico") {
        const corpo = new THREE.Mesh(
          new THREE.BoxGeometry(2.45, 0.95, 4.55),
          matCorpo,
        );
        corpo.position.set(0, 0.18, 0.05);

        const teto = new THREE.Mesh(
          new THREE.BoxGeometry(1.65, 0.62, 1.75),
          matCorpo,
        );
        teto.position.set(0, 0.9, -0.36);

        const paraBrisa = new THREE.Mesh(
          new THREE.BoxGeometry(1.55, 0.42, 0.74),
          matVidro,
        );
        paraBrisa.position.set(0, 0.72, -1.02);
        paraBrisa.rotation.x = -Math.PI / 7;

        const vidroTras = new THREE.Mesh(
          new THREE.BoxGeometry(1.4, 0.36, 0.5),
          matVidro,
        );
        vidroTras.position.set(0, 0.72, 0.2);
        vidroTras.rotation.x = Math.PI / 12;

        const paraChoqueFrente = new THREE.Mesh(
          new THREE.BoxGeometry(2.48, 0.2, 0.34),
          matDetalhe,
        );
        paraChoqueFrente.position.set(0, -0.04, -2.42);

        const paraChoqueTras = new THREE.Mesh(
          new THREE.BoxGeometry(2.48, 0.2, 0.34),
          matDetalhe,
        );
        paraChoqueTras.position.set(0, -0.04, 2.42);

        const faixaEsq = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, 0.14, 2.25),
          matDetalhe,
        );
        faixaEsq.position.set(-1.23, 0.08, 0.1);
        const faixaDir = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, 0.14, 2.25),
          matDetalhe,
        );
        faixaDir.position.set(1.23, 0.08, 0.1);

        carroVisual.add(corpo);
        carroVisual.add(teto);
        carroVisual.add(paraBrisa);
        carroVisual.add(vidroTras);
        carroVisual.add(paraChoqueFrente);
        carroVisual.add(paraChoqueTras);
        carroVisual.add(faixaEsq);
        carroVisual.add(faixaDir);
      } else if (modelo.visual === "esportivo") {
        const geoCorpo = new THREE.CylinderGeometry(0.8, 1.35, 4.6, 5);
        geoCorpo.rotateX(Math.PI / 2);
        const corpo = new THREE.Mesh(geoCorpo, matCorpo);
        corpo.scale.set(1.05, 0.22, 1);
        corpo.position.set(0, 0.14, 0.1);

        const nariz = new THREE.Mesh(
          new THREE.ConeGeometry(0.48, 1.7, 18),
          matDetalhe,
        );
        nariz.rotation.x = -Math.PI / 2;
        nariz.position.set(0, 0.05, -2.72);

        const vidro = new THREE.Mesh(
          new THREE.BoxGeometry(1.45, 0.42, 1.18),
          matVidro,
        );
        vidro.position.set(0, 0.62, -0.12);
        vidro.rotation.x = -Math.PI / 14;

        const asa = new THREE.Mesh(
          new THREE.BoxGeometry(2.7, 0.12, 0.55),
          matAsa,
        );
        asa.position.set(0, 0.84, 2.0);
        const suporteEsq = new THREE.Mesh(
          new THREE.BoxGeometry(0.1, 0.52, 0.1),
          matDetalhe,
        );
        suporteEsq.position.set(-0.72, 0.56, 1.9);
        const suporteDir = new THREE.Mesh(
          new THREE.BoxGeometry(0.1, 0.52, 0.1),
          matDetalhe,
        );
        suporteDir.position.set(0.72, 0.56, 1.9);

        carroVisual.add(corpo);
        carroVisual.add(nariz);
        carroVisual.add(vidro);
        carroVisual.add(asa);
        carroVisual.add(suporteEsq);
        carroVisual.add(suporteDir);
      } else if (modelo.visual === "pickup") {
        const corpo = new THREE.Mesh(
          new THREE.BoxGeometry(2.6, 1.05, 2.8),
          matCorpo,
        );
        corpo.position.set(0, 0.28, -0.4);
        const cabine = new THREE.Mesh(
          new THREE.BoxGeometry(2.15, 0.95, 1.75),
          matVidro,
        );
        cabine.position.set(0, 0.98, -1.0);
        const caixambaBase = new THREE.Mesh(
          new THREE.BoxGeometry(2.55, 0.52, 1.55),
          matCorpo,
        );
        caixambaBase.position.set(0, 0.02, 1.5);
        const lateralCaixambaEsq = new THREE.Mesh(
          new THREE.BoxGeometry(0.14, 0.48, 1.5),
          matDetalhe,
        );
        lateralCaixambaEsq.position.set(-1.22, 0.36, 1.5);
        const lateralCaixambaDir = new THREE.Mesh(
          new THREE.BoxGeometry(0.14, 0.48, 1.5),
          matDetalhe,
        );
        lateralCaixambaDir.position.set(1.22, 0.36, 1.5);
        const paraChoque = new THREE.Mesh(
          new THREE.BoxGeometry(2.85, 0.34, 0.72),
          matDetalhe,
        );
        paraChoque.position.set(0, 0.08, -2.08);
        const arcoFrenteEsq = new THREE.Mesh(
          new THREE.CylinderGeometry(0.72, 0.72, 0.18, 16),
          matDetalhe,
        );
        arcoFrenteEsq.rotation.z = Math.PI / 2;
        arcoFrenteEsq.scale.set(1.2, 0.5, 0.85);
        arcoFrenteEsq.position.set(-1.28, 0.16, -1.38);
        const arcoFrenteDir = new THREE.Mesh(
          new THREE.CylinderGeometry(0.72, 0.72, 0.18, 16),
          matDetalhe,
        );
        arcoFrenteDir.rotation.z = Math.PI / 2;
        arcoFrenteDir.scale.set(1.2, 0.5, 0.85);
        arcoFrenteDir.position.set(1.28, 0.16, -1.38);
        const arcoTrasEsq = new THREE.Mesh(
          new THREE.CylinderGeometry(0.72, 0.72, 0.18, 16),
          matDetalhe,
        );
        arcoTrasEsq.rotation.z = Math.PI / 2;
        arcoTrasEsq.scale.set(1.2, 0.5, 0.85);
        arcoTrasEsq.position.set(-1.28, 0.16, 1.38);
        const arcoTrasDir = new THREE.Mesh(
          new THREE.CylinderGeometry(0.72, 0.72, 0.18, 16),
          matDetalhe,
        );
        arcoTrasDir.rotation.z = Math.PI / 2;
        arcoTrasDir.scale.set(1.2, 0.5, 0.85);
        arcoTrasDir.position.set(1.28, 0.16, 1.38);

        carroVisual.add(corpo);
        carroVisual.add(cabine);
        carroVisual.add(caixambaBase);
        carroVisual.add(lateralCaixambaEsq);
        carroVisual.add(lateralCaixambaDir);
        carroVisual.add(paraChoque);
        carroVisual.add(arcoFrenteEsq);
        carroVisual.add(arcoFrenteDir);
        carroVisual.add(arcoTrasEsq);
        carroVisual.add(arcoTrasDir);
      } else if (modelo.visual === "f1") {
        const geoCorpo = new THREE.CylinderGeometry(0.5, 0.5, 4.0, 16);
        geoCorpo.rotateX(Math.PI / 2);
        const corpo = new THREE.Mesh(geoCorpo, matCorpo);

        const geoBico = new THREE.ConeGeometry(0.5, 1.5, 16);
        geoBico.rotateX(-Math.PI / 2);
        const bico = new THREE.Mesh(geoBico, matDetalhe);
        bico.position.set(0, 0, -2.75);

        const asaFrente = new THREE.Mesh(
          new THREE.BoxGeometry(2.6, 0.1, 0.6),
          matDetalhe,
        );
        asaFrente.position.set(0, -0.2, -3.2);

        const asaTras = new THREE.Mesh(
          new THREE.BoxGeometry(2.4, 0.1, 0.8),
          matCorpo,
        );
        asaTras.position.set(0, 1.2, 1.8);
        const suporteAsa = new THREE.Mesh(
          new THREE.BoxGeometry(0.2, 1.0, 0.4),
          matCorpo,
        );
        suporteAsa.position.set(0, 0.6, 1.8);

        const cabine = new THREE.Mesh(
          new THREE.SphereGeometry(0.4, 16, 16),
          matVidro,
        );
        cabine.position.set(0, 0.5, 0);

        const tiranteEsq = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, 0.08, 1.45),
          matDetalhe,
        );
        tiranteEsq.position.set(-0.95, -0.08, 1.0);
        tiranteEsq.rotation.y = 0.14;
        const tiranteDir = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, 0.08, 1.45),
          matDetalhe,
        );
        tiranteDir.position.set(0.95, -0.08, 1.0);
        tiranteDir.rotation.y = -0.14;

        carroVisual.add(corpo);
        carroVisual.add(bico);
        carroVisual.add(asaFrente);
        carroVisual.add(asaTras);
        carroVisual.add(suporteAsa);
        carroVisual.add(cabine);
        carroVisual.add(tiranteEsq);
        carroVisual.add(tiranteDir);
      } else if (modelo.visual === "hiper") {
        const geoCorpo = new THREE.CylinderGeometry(1.4, 1.6, 4.4, 3);
        geoCorpo.rotateX(Math.PI / 2);
        geoCorpo.rotateZ(Math.PI);
        const corpo = new THREE.Mesh(geoCorpo, matCorpo);
        corpo.scale.set(1, 0.3, 1);
        corpo.position.set(0, 0.1, 0);

        const geoVidro = new THREE.SphereGeometry(1.0, 32, 16);
        const vidro = new THREE.Mesh(geoVidro, matVidro);
        vidro.scale.set(0.8, 0.3, 1.2);
        vidro.position.set(0, 0.6, 0.2);

        const bico = new THREE.Mesh(
          new THREE.ConeGeometry(0.44, 1.65, 18),
          matDetalhe,
        );
        bico.rotation.x = -Math.PI / 2;
        bico.position.set(0, 0.05, -2.72);

        const difusor = new THREE.Mesh(
          new THREE.BoxGeometry(2.15, 0.12, 0.9),
          matDetalhe,
        );
        difusor.position.set(0, -0.12, 2.22);

        const luzDir = new THREE.Mesh(
          new THREE.BoxGeometry(0.1, 0.1, 2.0),
          matAsa,
        );
        luzDir.position.set(1.2, 0.2, 0);
        const luzEsq = new THREE.Mesh(
          new THREE.BoxGeometry(0.1, 0.1, 2.0),
          matAsa,
        );
        luzEsq.position.set(-1.2, 0.2, 0);
        const barraTraseiraEsq = new THREE.Mesh(
          new THREE.BoxGeometry(0.9, 0.08, 0.12),
          new THREE.MeshBasicMaterial({ color: modelo.asa }),
        );
        barraTraseiraEsq.position.set(-0.58, 0.1, 2.18);
        const barraTraseiraDir = new THREE.Mesh(
          new THREE.BoxGeometry(0.9, 0.08, 0.12),
          new THREE.MeshBasicMaterial({ color: modelo.asa }),
        );
        barraTraseiraDir.position.set(0.58, 0.1, 2.18);

        carroVisual.add(corpo);
        carroVisual.add(vidro);
        carroVisual.add(bico);
        carroVisual.add(difusor);
        carroVisual.add(luzDir);
        carroVisual.add(luzEsq);
        carroVisual.add(barraTraseiraEsq);
        carroVisual.add(barraTraseiraDir);
      }

      carroVisual.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
        }
      });
    }

    function criarCarroPolicia({
      corBase,
      corCapo,
      corSireneA,
      corSireneB,
      corRadar,
    }) {
      const corpo = new CANNON.Body({
        mass: 900,
        shape: new CANNON.Box(new CANNON.Vec3(1.2, 0.6, 2.2)),
        material: materialCarro,
      });
      corpo.allowSleep = false;
      corpo.angularDamping = 0.9;
      corpo.linearDamping = 0.08;
      if (
        corpo.angularFactor &&
        typeof corpo.angularFactor.set === "function"
      ) {
        corpo.angularFactor.set(0, 1, 0);
      }
      mundoFisica.addBody(corpo);

      const visual = new THREE.Group();
      const malhaPolicia = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 1.2, 4.4),
        new THREE.MeshLambertMaterial({ color: corBase }),
      );
      malhaPolicia.castShadow = true;
      visual.add(malhaPolicia);

      const capo = new THREE.Mesh(
        new THREE.BoxGeometry(2.41, 1.21, 2.0),
        new THREE.MeshLambertMaterial({ color: corCapo }),
      );
      capo.position.set(0, 0, 1.2);
      visual.add(capo);

      const sireneA = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.4, 0.4),
        new THREE.MeshBasicMaterial({
          color: corSireneA,
          transparent: true,
          opacity: 1,
        }),
      );
      sireneA.position.set(-0.5, 0.8, -0.5);
      visual.add(sireneA);

      const sireneB = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.4, 0.4),
        new THREE.MeshBasicMaterial({
          color: corSireneB,
          transparent: true,
          opacity: 1,
        }),
      );
      sireneB.position.set(0.5, 0.8, -0.5);
      visual.add(sireneB);

      const luzSireneA =
        PERFIL_EXECUCAO.pcFraco || PERFIL_EXECUCAO.firefox
          ? null
          : new THREE.PointLight(corSireneA, 0, 14, 2);
      if (luzSireneA) {
        luzSireneA.position.set(-0.5, 1.05, -0.5);
        visual.add(luzSireneA);
      }

      const luzSireneB =
        PERFIL_EXECUCAO.pcFraco || PERFIL_EXECUCAO.firefox
          ? null
          : new THREE.PointLight(corSireneB, 0, 14, 2);
      if (luzSireneB) {
        luzSireneB.position.set(0.5, 1.05, -0.5);
        visual.add(luzSireneB);
      }

      const tetoRadar = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 0.16, 1.6),
        new THREE.MeshBasicMaterial({ color: corRadar }),
      );
      tetoRadar.position.set(0, 1.18, 0.1);
      visual.add(tetoRadar);

      const faixaEsq = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.28, 2.8),
        new THREE.MeshLambertMaterial({ color: corRadar }),
      );
      faixaEsq.position.set(-1.22, 0.16, 0.12);
      const faixaDir = faixaEsq.clone();
      faixaDir.position.x = 1.22;
      const barraFrontal = new THREE.Mesh(
        new THREE.BoxGeometry(2.45, 0.12, 0.26),
        new THREE.MeshLambertMaterial({ color: corRadar }),
      );
      barraFrontal.position.set(0, 0.5, -1.92);
      visual.add(faixaEsq);
      visual.add(faixaDir);
      visual.add(barraFrontal);

      criarRoda(visual, -1.3, 1.4);
      criarRoda(visual, 1.3, 1.4);
      criarRoda(visual, -1.3, -1.4);
      criarRoda(visual, 1.3, -1.4);

      corpo.position.set(0, -50, 0);
      cena.add(visual);
      return {
        corpo,
        visual,
        sireneA,
        sireneB,
        luzSireneA,
        luzSireneB,
        tipo: "carro",
      };
    }

    function criarMotoPolicia({
      corBase,
      corDetalhe,
      corSireneA,
      corSireneB,
      corCapacete,
    }) {
      const corpo = new CANNON.Body({
        mass: 540,
        shape: new CANNON.Box(new CANNON.Vec3(0.7, 0.8, 1.9)),
        material: materialCarro,
      });
      corpo.allowSleep = false;
      corpo.angularDamping = 0.82;
      corpo.linearDamping = 0.05;
      if (
        corpo.angularFactor &&
        typeof corpo.angularFactor.set === "function"
      ) {
        corpo.angularFactor.set(0, 1, 0);
      }
      mundoFisica.addBody(corpo);

      const visual = new THREE.Group();
      const matBase = new THREE.MeshLambertMaterial({ color: corBase });
      const matDetalhe = new THREE.MeshLambertMaterial({
        color: corDetalhe,
      });
      const matCapacete = new THREE.MeshLambertMaterial({
        color: corCapacete,
      });
      const matRoda = new THREE.MeshLambertMaterial({ color: 0x202020 });

      const rodaFrente = new THREE.Mesh(
        new THREE.CylinderGeometry(0.85, 0.85, 0.34, 18),
        matRoda,
      );
      rodaFrente.rotation.z = Math.PI / 2;
      rodaFrente.position.set(0, -0.55, -1.72);
      const rodaTras = rodaFrente.clone();
      rodaTras.position.z = 1.62;

      const chassi = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, 0.24, 2.8),
        matBase,
      );
      chassi.position.set(0, 0.02, -0.06);

      const tanque = new THREE.Mesh(
        new THREE.BoxGeometry(0.76, 0.52, 0.96),
        matBase,
      );
      tanque.position.set(0, 0.38, -0.18);

      const banco = new THREE.Mesh(
        new THREE.BoxGeometry(0.52, 0.18, 0.88),
        matDetalhe,
      );
      banco.position.set(0, 0.56, 0.58);

      const garfoFrente = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 1.16, 0.16),
        matDetalhe,
      );
      garfoFrente.position.set(0, 0.06, -1.42);
      garfoFrente.rotation.x = -0.28;

      const guidom = new THREE.Mesh(
        new THREE.BoxGeometry(1.12, 0.1, 0.1),
        matDetalhe,
      );
      guidom.position.set(0, 0.88, -1.0);

      const pilotoCorpo = new THREE.Mesh(
        new THREE.BoxGeometry(0.48, 0.88, 0.4),
        matDetalhe,
      );
      pilotoCorpo.position.set(0, 1.08, 0.1);

      const pilotoCapacete = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 16, 12),
        matCapacete,
      );
      pilotoCapacete.position.set(0, 1.68, -0.06);

      const paraLamaFrente = new THREE.Mesh(
        new THREE.BoxGeometry(0.46, 0.12, 0.82),
        matBase,
      );
      paraLamaFrente.position.set(0, -0.02, -1.58);
      paraLamaFrente.rotation.x = -0.3;

      const escapamento = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.18, 1.2),
        matDetalhe,
      );
      escapamento.position.set(0.34, -0.08, 0.76);

      const malaEsq = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.46, 0.68),
        matBase,
      );
      malaEsq.position.set(-0.46, 0.42, 0.82);
      const malaDir = malaEsq.clone();
      malaDir.position.x = 0.46;

      const sireneA = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.16, 0.18),
        new THREE.MeshBasicMaterial({
          color: corSireneA,
          transparent: true,
          opacity: 1,
        }),
      );
      sireneA.position.set(-0.22, 1.04, -0.96);
      const sireneB = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.16, 0.18),
        new THREE.MeshBasicMaterial({
          color: corSireneB,
          transparent: true,
          opacity: 1,
        }),
      );
      sireneB.position.set(0.22, 1.04, -0.96);

      const luzSireneA =
        PERFIL_EXECUCAO.pcFraco || PERFIL_EXECUCAO.firefox
          ? null
          : new THREE.PointLight(corSireneA, 0, 11, 2);
      if (luzSireneA) {
        luzSireneA.position.set(-0.24, 1.2, -0.9);
      }
      const luzSireneB =
        PERFIL_EXECUCAO.pcFraco || PERFIL_EXECUCAO.firefox
          ? null
          : new THREE.PointLight(corSireneB, 0, 11, 2);
      if (luzSireneB) {
        luzSireneB.position.set(0.24, 1.2, -0.9);
      }

      visual.add(rodaFrente);
      visual.add(rodaTras);
      visual.add(chassi);
      visual.add(tanque);
      visual.add(banco);
      visual.add(garfoFrente);
      visual.add(guidom);
      visual.add(pilotoCorpo);
      visual.add(pilotoCapacete);
      visual.add(paraLamaFrente);
      visual.add(escapamento);
      visual.add(malaEsq);
      visual.add(malaDir);
      visual.add(sireneA);
      visual.add(sireneB);
      if (luzSireneA) visual.add(luzSireneA);
      if (luzSireneB) visual.add(luzSireneB);
      visual.traverse((filho) => {
        if (filho.isMesh) filho.castShadow = true;
      });

      corpo.position.set(0, -50, 0);
      cena.add(visual);
      return {
        corpo,
        visual,
        sireneA,
        sireneB,
        luzSireneA,
        luzSireneB,
        tipo: "moto",
      };
    }

    const policia1 = criarCarroPolicia({
      corBase: 0xf2f6ff,
      corCapo: 0x13233f,
      corSireneA: 0x1e88ff,
      corSireneB: 0xff3344,
      corRadar: 0xffffff,
    });
    const policia2 = criarMotoPolicia({
      corBase: 0x19324f,
      corDetalhe: 0xf4f8ff,
      corSireneA: 0x1e88ff,
      corSireneB: 0xff3344,
      corCapacete: 0xf7f7ff,
    });
    const policia3 = criarCarroPolicia({
      corBase: 0x203a5e,
      corCapo: 0xf3f7ff,
      corSireneA: 0x27a7ff,
      corSireneB: 0xff4263,
      corRadar: 0xffffff,
    });
    const policia4 = criarCarroPolicia({
      corBase: 0x101820,
      corCapo: 0xeaf2ff,
      corSireneA: 0x2398ff,
      corSireneB: 0xff3152,
      corRadar: 0xffffff,
    });

    const cameraPosicaoSuave = new THREE.Vector3(0, 0, 0);
    const cameraAlvoSuave = new THREE.Vector3(0, 0, 0);
    const CONFIG_OTIMIZACAO = {
      deltaMaximo: 1 / 30,
      intervaloAnalisePolicial: PERFIL_EXECUCAO.firefoxIframe
        ? 0.14
        : PERFIL_EXECUCAO.firefoxEconomia
          ? 0.11
          : 0.08,
      intervaloRadar: PERFIL_EXECUCAO.firefoxIframe
        ? 1 / 8
        : PERFIL_EXECUCAO.firefoxEconomia
          ? 1 / 10
          : 1 / 14,
      passoFisica: PERFIL_EXECUCAO.firefoxIframe
        ? 1 / 50
        : PERFIL_EXECUCAO.firefoxEconomia
          ? 1 / 54
        : PERFIL_EXECUCAO.pcFraco
          ? 1 / 60
          : 1 / 90,
      maxSubstepsFisica: PERFIL_EXECUCAO.firefoxIframe
        ? 3
        : PERFIL_EXECUCAO.firefoxEconomia
          ? 4
        : PERFIL_EXECUCAO.pcFraco
          ? 5
          : 10,
    };
    const contextoTaticoPolicia = {
      ativa: false,
      policialIndice: -1,
      modo: "perseguicao",
      alvoX: 0,
      alvoZ: 0,
      distJogadorSilaba: Infinity,
    };
    let acumuladorAnalisePolicial = 0;

    // ==========================================
    // 4. MENU E FASES
    // ==========================================

    let grupoFaseAtual = ESTADO_INICIAL.grupoFaseAtual;
    let niveisAtuais = [];
    let faseAtual = 0;
    let silabasAtivas = [];
    let estadoJogo = "menu";
    let rodadaEncerrada = false;
    let timeoutDerrota = null;
    let timeoutVitoria = null;
    let timeoutFimDeSerie = null;

    let velMaxPolicia = 30;
    let totalPoliciasAtivas = 1;
    let bonusVelocidadePolicialAtual = 0;
    let fatorForcaPolicialAtual = 1;
    let objetosDestaFase = [];
    let efeitosFogos = [];
    let pontosJogador = 0;
    let carroSelecionado = ESTADO_INICIAL.carroSelecionado;
    let cooldownRampa = 0;
    let cooldownRespawnJogador = 0;
    let atrasoPoliciaRestante = 0;
    let tempoReforcoPolicia = 0;
    let tempoContatoPolicia = 0;
    let contatoVisualPolicia = 0;
    const tempoCapturaPolicia = ESTADO_INICIAL.tempoCapturaPolicia;
    let cooldownImpactoColisao = 0;
    let intensidadeImpactoVisual = 0;
    let pausaCapturaAposColisao = 0;
    let tempoSemColetarObjetivo = 0;
    let punicaoHelicopteroAtiva = false;
    let cooldownAtaqueHelicoptero = 0;
    let intensidadePunicaoHelicoptero = 0;
    let projeteisHelicoptero = [];
    let carrosDesbloqueados = new Set(ESTADO_INICIAL.carrosDesbloqueados);


    function criarEstadoPolicia() {
      return {
        tempoTravado: 0,
        tempoRe: 0,
        direcaoRe: 1,
        tempoSpawn: 0,
        tempoAereo: 0,
        tempoCapotado: 0,
        tempoEstrategia: 0,
        alvoPatrulha: null,
        rota: [],
        indiceRota: 0,
        tempoRota: 0,
        alvoRotaX: Number.NaN,
        alvoRotaZ: Number.NaN,
        planoAtual: null,
        tempoSobreposicaoJogador: 0,
        tempoDesgrudeJogador: 0,
      };
    }

    const policiais = [
      {
        ...policia1,
        estado: criarEstadoPolicia(),
        estrategia: "perseguidora",
        forcaFrente: 52000,
        forcaRe: 18000,
      },
      {
        ...policia2,
        estado: criarEstadoPolicia(),
        estrategia: "moto",
        forcaFrente: 56000,
        forcaRe: 17000,
        velocidadeExtra: 0,
        multiplicadorVelocidade: 1,
      },
      {
        ...policia3,
        estado: criarEstadoPolicia(),
        estrategia: "interceptadora",
        forcaFrente: 54000,
        forcaRe: 18000,
      },
      {
        ...policia4,
        estado: criarEstadoPolicia(),
        estrategia: "flanqueadora",
        forcaFrente: 58000,
        forcaRe: 19000,
      },
    ];
    policiais.forEach((policial, indice) => {
      policial.indice = indice;
    });
    const ordemPoliciasPorFase = [...policiais];

    // Marcador 3D do objetivo: fica apenas acima da sílaba ativa.
    function criarMarcadorObjetivo3D() {
      const grupo = new THREE.Group();
      const materialAceso = new THREE.MeshBasicMaterial({
        color: 0xffcc33,
        transparent: true,
        opacity: 0.98,
        depthWrite: false,
      });
      const materialFeixe = new THREE.MeshBasicMaterial({
        color: 0xfff08a,
        transparent: true,
        opacity: 0.26,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const feixe = new THREE.Mesh(
        new THREE.CylinderGeometry(1.9, 3.5, 28, 20, 1, true),
        materialFeixe,
      );
      feixe.position.y = -14;
      const seta = new THREE.Mesh(
        new THREE.ConeGeometry(3.1, 6.4, 28),
        materialAceso,
      );
      seta.rotation.x = Math.PI;
      const aroTopo = new THREE.Mesh(
        new THREE.TorusGeometry(2.5, 0.24, 8, 28),
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.88,
          depthWrite: false,
        }),
      );
      aroTopo.rotation.x = Math.PI / 2;
      aroTopo.position.y = -2.6;
      const aroBase = new THREE.Mesh(
        new THREE.TorusGeometry(3.5, 0.26, 8, 28),
        new THREE.MeshBasicMaterial({
          color: 0xfff3b0,
          transparent: true,
          opacity: 0.9,
          depthWrite: false,
        }),
      );
      aroBase.rotation.x = Math.PI / 2;
      aroBase.position.y = -22.5;
      const canvasLabel = document.createElement("canvas");
      canvasLabel.width = 320;
      canvasLabel.height = 128;
      const ctxLabel = canvasLabel.getContext("2d");
      ctxLabel.fillStyle = "rgba(255,255,255,0.96)";
      ctxLabel.fillRect(14, 16, 292, 88);
      ctxLabel.lineWidth = 8;
      ctxLabel.strokeStyle = "#ffb703";
      ctxLabel.stroke();
      ctxLabel.fillStyle = "#14324f";
      ctxLabel.font = "900 38px Trebuchet MS";
      ctxLabel.textAlign = "center";
      ctxLabel.textBaseline = "middle";
      ctxLabel.fillText("PEGUE ESTE", 160, 47);
      ctxLabel.fillStyle = "#ff7b00";
      ctxLabel.font = "900 34px Trebuchet MS";
      ctxLabel.fillText("BLOCO", 160, 82);
      const texturaLabel = configurarTexturaComoCor(
        new THREE.CanvasTexture(canvasLabel),
      );
      const label = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: texturaLabel,
          transparent: true,
          depthWrite: false,
        }),
      );
      label.position.y = 2.8;
      label.scale.set(10.5, 4.2, 1);

      grupo.add(feixe);
      grupo.add(seta);
      grupo.add(aroTopo);
      grupo.add(aroBase);
      grupo.add(label);
      grupo.userData = { seta, aroTopo, aroBase, feixe, label };
      grupo.visible = false;
      grupo.traverse((filho) => {
        filho.renderOrder = 5;
      });
      cena.add(grupo);
      return grupo;
    }

    // Helicóptero visual da polícia: patrulha o cenário ao longe sem perseguir.
    function criarHelicopteroPolicia() {
      const grupo = new THREE.Group();
      const matCasco = new THREE.MeshLambertMaterial({ color: 0x263238 });
      const matCabine = new THREE.MeshLambertMaterial({
        color: 0x90caf9,
      });
      const matRotor = new THREE.MeshLambertMaterial({ color: 0x111111 });

      const corpo = new THREE.Mesh(
        new THREE.CylinderGeometry(1.1, 1.3, 6.8, 12),
        matCasco,
      );
      corpo.rotation.z = Math.PI / 2;

      const cabine = new THREE.Mesh(
        new THREE.SphereGeometry(1.4, 18, 14),
        matCabine,
      );
      cabine.scale.set(1.1, 0.82, 1.3);
      cabine.position.set(1.25, 0.05, 0);

      const cauda = new THREE.Mesh(
        new THREE.BoxGeometry(5.8, 0.3, 0.32),
        matCasco,
      );
      cauda.position.set(-5.2, 0.08, 0);

      const leme = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 1.55, 1.2),
        matCasco,
      );
      leme.position.set(-7.9, 0.95, 0);

      const skiEsq = new THREE.Mesh(
        new THREE.BoxGeometry(4.4, 0.12, 0.12),
        matRotor,
      );
      skiEsq.position.set(0.2, -1.4, -1.0);
      const skiDir = skiEsq.clone();
      skiDir.position.z = 1.0;
      const suporteEsqA = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 1.0, 0.12),
        matRotor,
      );
      suporteEsqA.position.set(-1.0, -0.92, -1.0);
      const suporteEsqB = suporteEsqA.clone();
      suporteEsqB.position.set(1.2, -0.92, -1.0);
      const suporteDirA = suporteEsqA.clone();
      suporteDirA.position.z = 1.0;
      const suporteDirB = suporteEsqB.clone();
      suporteDirB.position.z = 1.0;

      const rotorPrincipal = new THREE.Group();
      const paA = new THREE.Mesh(
        new THREE.BoxGeometry(8.8, 0.08, 0.24),
        matRotor,
      );
      const paB = new THREE.Mesh(
        new THREE.BoxGeometry(8.8, 0.08, 0.24),
        matRotor,
      );
      paB.rotation.y = Math.PI / 2;
      rotorPrincipal.add(paA);
      rotorPrincipal.add(paB);
      rotorPrincipal.position.set(0, 1.6, 0);

      const rotorCauda = new THREE.Group();
      const paCaudaA = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 1.6, 0.18),
        matRotor,
      );
      const paCaudaB = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 1.6, 0.18),
        matRotor,
      );
      paCaudaB.rotation.x = Math.PI / 2;
      rotorCauda.add(paCaudaA);
      rotorCauda.add(paCaudaB);
      rotorCauda.position.set(-8.2, 0.62, 0);

      const faixaLateral = new THREE.Mesh(
        new THREE.BoxGeometry(2.8, 0.12, 0.22),
        new THREE.MeshLambertMaterial({ color: 0xd8dee9 }),
      );
      faixaLateral.position.set(0.15, 0.22, 0);

      grupo.add(corpo);
      grupo.add(cabine);
      grupo.add(cauda);
      grupo.add(leme);
      grupo.add(skiEsq);
      grupo.add(skiDir);
      grupo.add(suporteEsqA);
      grupo.add(suporteEsqB);
      grupo.add(suporteDirA);
      grupo.add(suporteDirB);
      grupo.add(rotorPrincipal);
      grupo.add(rotorCauda);
      grupo.add(faixaLateral);
      grupo.userData = { rotorPrincipal, rotorCauda };
      grupo.visible = false;
      grupo.traverse((filho) => {
        if (filho.isMesh) filho.castShadow = false;
      });
      cena.add(grupo);
      return grupo;
    }

    const marcadorObjetivo3D = criarMarcadorObjetivo3D();
    const helicopteroPolicia = criarHelicopteroPolicia();

    if (typeof carroCorpo.addEventListener === "function") {
      carroCorpo.addEventListener("collide", (evento) => {
        if (!evento || !evento.contact) return;
        const corpoAtingiu =
          evento.contact.bi === carroCorpo
            ? evento.contact.bj
            : evento.contact.bi;
        for (const policial of policiais) {
          if (policial.corpo !== corpoAtingiu) continue;
          lidarComColisaoEntreCarros(carroCorpo, policial.corpo);
          break;
        }
      });
    }

    const botoesSerie = [...document.querySelectorAll(".btn-serie")];
    const botoesCarro = [...document.querySelectorAll(".btn-carro")];
    const botaoRespawnManual =
      document.getElementById("btn-respawn-manual");
    const hudFase = document.getElementById("fase-info");
    const interfaceHud = document.getElementById("interface");
    const objetivoHud = document.getElementById("objetivo-hud");
    const objetivoPrincipalHud = document.getElementById(
      "objetivo-principal-hud",
    );
    const alvoEmojiHud = document.getElementById("alvo-emoji-hud");
    const infoSerie = document.getElementById("info-serie");
    const infoPontos = document.getElementById("info-pontos");
    const infoCarro = document.getElementById("info-carro");
    const infoVelocidade = document.getElementById("info-velocidade");
    const infoRisco = document.getElementById("info-risco");
    const infoContato = document.getElementById("info-contato");
    const barraRiscoPreenchimento = document.getElementById(
      "barra-risco-preenchimento",
    );
    const controlesTouch = document.getElementById("controles-touch");
    blocosSilabas = document.getElementById("blocos-silabas");
    const statusA11y = document.getElementById("status-a11y");
    const efeitoVelocidade = PERFIL_EXECUCAO.firefoxEconomia
      ? null
      : document.getElementById("efeito-velocidade");
    const impactoOverlay = PERFIL_EXECUCAO.firefoxEconomia
      ? null
      : document.getElementById("impacto-overlay");
    const setaSilaba = document.getElementById("seta-silaba");
    radarCanvas = document.getElementById("radar-canvas");
    radarCtx = radarCanvas?.getContext("2d");
    const pontosMenu = document.getElementById("pontos-menu");
    const mensagemVitoria = document.getElementById("mensagem-vitoria");
    const subtituloVitoria = document.getElementById("subtitulo-vitoria");
    const textoVitoria = document.getElementById("texto-vitoria");
    const emojiVitoria = document.getElementById("emoji-vitoria");
    const mensagemDerrota = document.getElementById("mensagem-derrota");
    const palavraAlvoHud = document.getElementById("palavra-alvo-hud");
    let timeoutMensagemA11y = null;
    let ultimaMensagemA11y = "";
    if (controlesTouch && !PERFIL_EXECUCAO.usarControlesTouch) {
      controlesTouch.hidden = true;
      controlesTouch.style.display = "none";
    }

    function obterDicaVisualInfo(palavra) {
      const fase = fasesPorPalavra.get(palavra);
      return {
        emoji: fase?.emoji || "🎯",
        nome: fase?.palavra?.toLowerCase() || "",
      };
    }

    function mostrarMensagemHud() {
      // A mensagem visual foi removida da HUD para priorizar o espaço dos blocos.
    }

    function anunciarStatus(mensagem) {
      if (!statusA11y || !mensagem) return;
      if (ultimaMensagemA11y === mensagem) {
        statusA11y.textContent = "";
      }
      ultimaMensagemA11y = mensagem;
      if (timeoutMensagemA11y) clearTimeout(timeoutMensagemA11y);
      statusA11y.textContent = "";
      timeoutMensagemA11y = setTimeout(() => {
        statusA11y.textContent = mensagem;
      }, 40);
    }

    function vibrarLeve(duracao = 35) {
      if (!PERFIL_EXECUCAO.usarVibracao) return;
      if (typeof navigator.vibrate === "function") {
        navigator.vibrate(duracao);
      }
    }

    function limparTimeout(id) {
      if (id) clearTimeout(id);
      return null;
    }

    function limparTransicoes() {
      timeoutDerrota = limparTimeout(timeoutDerrota);
      timeoutVitoria = limparTimeout(timeoutVitoria);
      timeoutFimDeSerie = limparTimeout(timeoutFimDeSerie);
      mensagemVitoria.style.display = "none";
      mensagemDerrota.style.display = "none";
    }

    function limparEfeitosFogos() {
      for (const efeito of efeitosFogos) {
        cena.remove(efeito.mesh);
        if (efeito.mesh.geometry !== geoParticulaFogos) {
          efeito.mesh.geometry.dispose();
        }
        efeito.mesh.material.dispose();
      }
      efeitosFogos = [];
    }

    function limparProjeteisHelicoptero() {
      for (const projetil of projeteisHelicoptero) {
        cena.remove(projetil.mesh);
        if (projetil.mesh.geometry !== geoProjetilHelicoptero) {
          projetil.mesh.geometry.dispose();
        }
        if (projetil.mesh.material !== matProjetilHelicoptero) {
          projetil.mesh.material.dispose();
        }
      }
      projeteisHelicoptero = [];
    }

    function zerarTeclas() {
      for (const tecla of Object.keys(teclas)) teclas[tecla] = false;
      document.querySelectorAll(".btn-touch").forEach((botao) => {
        botao.classList.remove("ativo");
      });
    }

    function resetarCorpo(corpo, x, y, z) {
      corpo.position.set(x, y, z);
      corpo.velocity.setZero();
      corpo.angularVelocity.setZero();
      corpo.force.setZero();
      corpo.torque.setZero();
      corpo.quaternion.setFromAxisAngle(eixoRotacaoY, 0);
    }

    function encontrarSpawnPolicial(indice = 0) {
      const frente = obterDirecaoFrente(carroCorpo, direcaoIAJogadorTemp);
      const lateralX = -frente.z;
      const lateralZ = frente.x;
      const padroes = [
        { frente: -0.95, lateral: -1.0, distancia: 42 },
        { frente: -0.6, lateral: 1.18, distancia: 38 },
        { frente: 0.48, lateral: -1.28, distancia: 54 },
        { frente: 0.28, lateral: 1.46, distancia: 58 },
        { frente: 0.96, lateral: 0.12, distancia: 68 },
        { frente: -1.15, lateral: 1.62, distancia: 58 },
        { frente: 0.82, lateral: -1.74, distancia: 74 },
        { frente: -0.18, lateral: 1.88, distancia: 78 },
      ];
      const padrao = padroes[Math.min(indice, padroes.length - 1)];
      const silabaAtiva = obterSilabaAtual();
      const silabaX = silabaAtiva?.mesh.position.x ?? 9999;
      const silabaZ = silabaAtiva?.mesh.position.z ?? 9999;

      for (let tentativa = 0; tentativa < 28; tentativa++) {
        const variacaoLateral = (Math.random() - 0.5) * 12;
        const variacaoFrontal = (Math.random() - 0.5) * 10;
        const ponto = limitarPontoAoMapa(
          carroCorpo.position.x +
            frente.x *
              (padrao.frente * padrao.distancia + variacaoFrontal) +
            lateralX * (padrao.lateral * 18 + variacaoLateral),
          carroCorpo.position.z +
            frente.z *
              (padrao.frente * padrao.distancia + variacaoFrontal) +
            lateralZ * (padrao.lateral * 18 + variacaoLateral),
          24,
        );
        const distJogador = Math.hypot(
          carroCorpo.position.x - ponto.x,
          carroCorpo.position.z - ponto.z,
        );
        const distSilaba = Math.hypot(
          silabaX - ponto.x,
          silabaZ - ponto.z,
        );
        if (
          distJogador >= 24 &&
          distSilaba >= 16 &&
          posicaoLivreNoMapa(ponto.x, ponto.z, 8)
        ) {
          return { x: ponto.x, y: 3.2, z: ponto.z };
        }
      }

      const fallback = limitarPontoAoMapa(
        carroCorpo.position.x + 32 + indice * 6,
        carroCorpo.position.z - 26 - indice * 5,
        24,
      );
      return { x: fallback.x, y: 3.2, z: fallback.z };
    }

    function reposicionarPolicia(policial, indice) {
      const spawn = encontrarSpawnPolicial(indice);
      policial.spawn = spawn;
      resetarCorpo(policial.corpo, spawn.x, spawn.y, spawn.z);
      const yawJogador = Math.atan2(
        carroCorpo.position.x - spawn.x,
        -(carroCorpo.position.z - spawn.z),
      );
      policial.corpo.quaternion.setFromAxisAngle(
        eixoRotacaoY,
        yawJogador,
      );
      policial.visual.visible = true;
      policial.visual.position.set(spawn.x, spawn.y, spawn.z);
      policial.visual.quaternion.copy(policial.corpo.quaternion);
      resetarEstadoPolicia(policial.estado);
      policial.estado.tempoSpawn = 2.0;
      if (typeof policial.corpo.wakeUp === "function")
        policial.corpo.wakeUp();
    }

    function resetarPosicoes() {
      resetarCorpo(carroCorpo, 0, 3, 20);
      for (let i = 0; i < policiais.length; i++) {
        reposicionarPolicia(policiais[i], i);
      }
      resetarContextoTaticoPolicia();
      acumuladorAnalisePolicial =
        CONFIG_OTIMIZACAO.intervaloAnalisePolicial;
      atrasoPoliciaRestante = 1.45;
      tempoReforcoPolicia = 0;
      tempoContatoPolicia = 0;
      contatoVisualPolicia = 0;
      cooldownImpactoColisao = 0;
      intensidadeImpactoVisual = 0;
      pausaCapturaAposColisao = 0;
      cameraPosicaoSuave.set(0, 0, 0);
      cameraAlvoSuave.set(0, 0, 0);
      if (efeitoVelocidade) efeitoVelocidade.style.opacity = "0";
      if (impactoOverlay) impactoOverlay.style.opacity = "0";
      atualizarIndicadorContato();
    }

    function encontrarSpawnJogadorSeguro() {
      const silabaAtual = obterSilabaAtual();
      for (let tentativa = 0; tentativa < 80; tentativa++) {
        const angulo = Math.random() * Math.PI * 2;
        const raio = 30 + Math.random() * 90;
        const ponto = limitarPontoAoMapa(
          Math.cos(angulo) * raio,
          Math.sin(angulo) * raio,
          24,
        );
        if (!posicaoLivreNoMapa(ponto.x, ponto.z, 10)) continue;

        let longeDaPolicia = true;
        for (let i = 0; i < totalPoliciasAtivas; i++) {
          const policial = policiais[i];
          if (!policial?.visual.visible) continue;
          if (
            Math.hypot(
              ponto.x - policial.corpo.position.x,
              ponto.z - policial.corpo.position.z,
            ) < 42
          ) {
            longeDaPolicia = false;
            break;
          }
        }
        if (!longeDaPolicia) continue;

        if (
          silabaAtual &&
          !silabaAtual.coletada &&
          Math.hypot(
            ponto.x - silabaAtual.mesh.position.x,
            ponto.z - silabaAtual.mesh.position.z,
          ) < 18
        ) {
          continue;
        }

        return { x: ponto.x, y: 3, z: ponto.z };
      }

      return { x: 0, y: 3, z: 20 };
    }

    function respawnJogadorEmPontoSeguro(origem = "manual") {
      if (estadoJogo !== "jogando" || rodadaEncerrada) return;
      if (origem !== "capotado" && cooldownRespawnJogador > 0) return;

      const spawn = encontrarSpawnJogadorSeguro();
      const silabaAtual = obterSilabaAtual();
      const alvoX = silabaAtual?.mesh.position.x ?? 0;
      const alvoZ = silabaAtual?.mesh.position.z ?? 0;
      const yaw = Math.atan2(alvoX - spawn.x, -(alvoZ - spawn.z));

      resetarCorpo(carroCorpo, spawn.x, spawn.y, spawn.z);
      carroCorpo.quaternion.setFromAxisAngle(eixoRotacaoY, yaw);
      for (let i = 0; i < policiais.length; i++) {
        reposicionarPolicia(policiais[i], i);
      }
      sincronizarVisibilidadePolicias();
      resetarContextoTaticoPolicia();
      acumuladorAnalisePolicial =
        CONFIG_OTIMIZACAO.intervaloAnalisePolicial;
      atrasoPoliciaRestante = 1.9;
      tempoReforcoPolicia = 0;
      tempoContatoPolicia = 0;
      contatoVisualPolicia = 0;
      cooldownImpactoColisao = 0;
      intensidadeImpactoVisual = 0;
      pausaCapturaAposColisao = 0;
      cooldownRespawnJogador =
        origem === "capotado" ? 0.35 : COOLDOWN_RESPAWN_MANUAL;
      reposicionarCarroSeCapotado.tempo = 0;
      reposicionarCarroSeCapotado.tempoCritico = 0;
      cameraPosicaoSuave.set(0, 0, 0);
      cameraAlvoSuave.set(0, 0, 0);
      carroVisual.position.copy(carroCorpo.position);
      carroVisual.quaternion.copy(carroCorpo.quaternion);
      if (efeitoVelocidade) efeitoVelocidade.style.opacity = "0";
      if (impactoOverlay) impactoOverlay.style.opacity = "0";
      atualizarIndicadorContato();
      anunciarStatus(
        origem === "capotado"
          ? "Carro reposicionado automaticamente."
          : "Carro reposicionado.",
      );
    }

    function resetarEstadoPolicia(estado) {
      estado.tempoTravado = 0;
      estado.tempoRe = 0;
      estado.direcaoRe = 1;
      estado.tempoSpawn = 0;
      estado.tempoAereo = 0;
      estado.tempoCapotado = 0;
      estado.tempoEstrategia = 0;
      estado.alvoPatrulha = null;
      estado.planoAtual = null;
      estado.tempoSobreposicaoJogador = 0;
      estado.tempoDesgrudeJogador = 0;
      limparRotaPolicial(estado);
    }

    function obterSilabaAtual() {
      return silabasAtivas[proximaSilaba] || null;
    }

    function obterIndicePolicialGuardiao() {
      return -1;
    }

    function resetarContextoTaticoPolicia() {
      contextoTaticoPolicia.ativa = false;
      contextoTaticoPolicia.policialIndice = -1;
      contextoTaticoPolicia.modo = "perseguicao";
      contextoTaticoPolicia.alvoX = 0;
      contextoTaticoPolicia.alvoZ = 0;
      contextoTaticoPolicia.distJogadorSilaba = Infinity;
    }

    // Analisa a intenção do jogador e escolhe um único policial para tentar
    // bloquear o caminho até a sílaba ou atacar a rota de coleta.
    function atualizarContextoTaticoPolicia() {
      resetarContextoTaticoPolicia();

      if (
        estadoJogo !== "jogando" ||
        rodadaEncerrada ||
        atrasoPoliciaRestante > 0
      ) {
        return;
      }

      const silabaAtual = obterSilabaAtual();
      if (!silabaAtual || silabaAtual.coletada) return;

      const jogadorX = carroCorpo.position.x;
      const jogadorZ = carroCorpo.position.z;
      const silabaX = silabaAtual.mesh.position.x;
      const silabaZ = silabaAtual.mesh.position.z;
      const vetorSilabaX = silabaX - jogadorX;
      const vetorSilabaZ = silabaZ - jogadorZ;
      const distJogadorSilaba = Math.hypot(vetorSilabaX, vetorSilabaZ);
      if (distJogadorSilaba > CONFIG_TATICA_POLICIAL.raioLeituraSilaba)
        return;

      const frenteJogador = obterDirecaoFrente(
        carroCorpo,
        direcaoIAJogadorTemp,
      );
      const velocidadeJogadorModulo = Math.hypot(
        carroCorpo.velocity.x,
        carroCorpo.velocity.z,
      );
      const movimentoJogadorX =
        velocidadeJogadorModulo > 1.2
          ? carroCorpo.velocity.x / velocidadeJogadorModulo
          : frenteJogador.x;
      const movimentoJogadorZ =
        velocidadeJogadorModulo > 1.2
          ? carroCorpo.velocity.z / velocidadeJogadorModulo
          : frenteJogador.z;
      const direcaoSilabaX =
        vetorSilabaX / Math.max(distJogadorSilaba, 0.001);
      const direcaoSilabaZ =
        vetorSilabaZ / Math.max(distJogadorSilaba, 0.001);
      const alinhamentoJogador =
        movimentoJogadorX * direcaoSilabaX +
        movimentoJogadorZ * direcaoSilabaZ;

      if (
        alinhamentoJogador < CONFIG_TATICA_POLICIAL.alinhamentoMinimo &&
        distJogadorSilaba > 18
      ) {
        return;
      }

      let melhorIndice = -1;
      let melhorDistJogador = Infinity;
      let melhorScore = Infinity;

      for (let indice = 0; indice < totalPoliciasAtivas; indice++) {
        const policial = policiais[indice];
        if (
          !policial?.visual.visible ||
          policial.estado.tempoSpawn > 0.45
        ) {
          continue;
        }
        if (
          policial.estrategia !== "perseguidora" &&
          policial.estrategia !== "interceptadora" &&
          policial.estrategia !== "corta-rota" &&
          policial.estrategia !== "flanqueadora" &&
          policial.estrategia !== "moto" &&
          policial.estrategia !== "cercadora" &&
          policial.estrategia !== "varredora"
        ) {
          continue;
        }

        const distPolicialJogador = Math.hypot(
          policial.corpo.position.x - jogadorX,
          policial.corpo.position.z - jogadorZ,
        );
        const distPolicialSilaba = Math.hypot(
          policial.corpo.position.x - silabaX,
          policial.corpo.position.z - silabaZ,
        );
        const score =
          distPolicialJogador * 0.62 +
          distPolicialSilaba * 0.38 +
          distanciaPontoParaSegmento(
            policial.corpo.position.x,
            policial.corpo.position.z,
            jogadorX,
            jogadorZ,
            silabaX,
            silabaZ,
          ) *
            1.25;

        if (score < melhorScore) {
          melhorScore = score;
          melhorIndice = indice;
          melhorDistJogador = distPolicialJogador;
        }
      }

      if (melhorIndice < 0) return;

      const lateralX = -direcaoSilabaZ;
      const lateralZ = direcaoSilabaX;
      const distanciaBloqueio = THREE.MathUtils.clamp(
        distJogadorSilaba * 0.45,
        CONFIG_TATICA_POLICIAL.distanciaBloqueioMin,
        CONFIG_TATICA_POLICIAL.distanciaBloqueioMax,
      );
      const deslocamentoLateral =
        (melhorIndice % 2 === 0 ? 1 : -1) *
        THREE.MathUtils.clamp(distJogadorSilaba * 0.08, 0, 5);
      const pontoBloqueio = limitarPontoAoMapa(
        silabaX -
          direcaoSilabaX * distanciaBloqueio +
          lateralX * deslocamentoLateral,
        silabaZ -
          direcaoSilabaZ * distanciaBloqueio +
          lateralZ * deslocamentoLateral,
        20,
      );
      const tempoAntecipacao = THREE.MathUtils.clamp(
        melhorDistJogador / Math.max(velMaxPolicia, 24),
        0.22,
        0.68,
      );
      const pontoColisao = limitarPontoAoMapa(
        jogadorX +
          movimentoJogadorX * velocidadeJogadorModulo * tempoAntecipacao,
        jogadorZ +
          movimentoJogadorZ * velocidadeJogadorModulo * tempoAntecipacao,
        20,
      );
      const modoBloqueioDireto =
        distJogadorSilaba > CONFIG_TATICA_POLICIAL.distanciaColisao ||
        melhorDistJogador > 34;

      contextoTaticoPolicia.ativa = true;
      contextoTaticoPolicia.policialIndice = melhorIndice;
      contextoTaticoPolicia.modo = modoBloqueioDireto
        ? "bloqueio"
        : "colisao";
      contextoTaticoPolicia.alvoX = modoBloqueioDireto
        ? pontoBloqueio.x
        : pontoColisao.x * 0.7 + pontoBloqueio.x * 0.3;
      contextoTaticoPolicia.alvoZ = modoBloqueioDireto
        ? pontoBloqueio.z
        : pontoColisao.z * 0.7 + pontoBloqueio.z * 0.3;
      contextoTaticoPolicia.distJogadorSilaba = distJogadorSilaba;
    }

    // IA policial em 5 passos:
    // 1. Ler o cenário e medir risco/oportunidade.
    // 2. Prever para onde o jogador vai.
    // 3. Escolher uma tática própria do policial.
    // 4. Corrigir a rota com formação e bloqueio do mapa.
    // 5. Gerar multiplicadores de agressividade e curva.
    function criarPlanoIApolicial(policial) {
      const perfilPorEstrategia = {
        perseguidora: {
          previsao: 1.08,
          lateral: 0,
          objetivo: 0.12,
          agressividade: 0.42,
          curva: 1.16,
          bonusVelocidade: 0.05,
        },
        moto: {
          previsao: 1.2,
          lateral: 2,
          objetivo: 0.1,
          agressividade: 0.46,
          curva: 1.32,
          bonusVelocidade: 0.08,
        },
        interceptadora: {
          previsao: 1.42,
          lateral: 8,
          objetivo: 0.22,
          agressividade: 0.44,
          curva: 1.22,
          bonusVelocidade: 0.07,
        },
        flanqueadora: {
          previsao: 1.14,
          lateral: 14,
          objetivo: 0.16,
          agressividade: 0.4,
          curva: 1.24,
          bonusVelocidade: 0.06,
        },
        pressiona: {
          previsao: 0.84,
          lateral: 5,
          objetivo: 0.12,
          agressividade: 0.48,
          curva: 1.14,
          bonusVelocidade: 0.05,
        },
        "corta-rota": {
          previsao: 1.56,
          lateral: 4,
          objetivo: 0.52,
          agressividade: 0.5,
          curva: 1.18,
          bonusVelocidade: 0.09,
        },
        cercadora: {
          previsao: 1.3,
          lateral: 16,
          objetivo: 0.28,
          agressividade: 0.46,
          curva: 1.2,
          bonusVelocidade: 0.1,
        },
        varredora: {
          previsao: 1.68,
          lateral: 10,
          objetivo: 0.56,
          agressividade: 0.55,
          curva: 1.28,
          bonusVelocidade: 0.11,
        },
      };
      const perfil =
        perfilPorEstrategia[policial.estrategia] ||
        perfilPorEstrategia.perseguidora;
      const alvoJogador = {
        x: carroCorpo.position.x,
        z: carroCorpo.position.z,
      };
      const velocidadeJogador = {
        x: carroCorpo.velocity.x,
        z: carroCorpo.velocity.z,
      };
      const silabaAtual = obterSilabaAtual();
      const alvoSilaba =
        silabaAtual && !silabaAtual.coletada
          ? {
              x: silabaAtual.mesh.position.x,
              z: silabaAtual.mesh.position.z,
            }
          : null;
      const frenteJogador = obterDirecaoFrente(
        carroCorpo,
        direcaoIAJogadorTemp,
      );
      const velocidadeJogadorModulo = Math.hypot(
        velocidadeJogador.x,
        velocidadeJogador.z,
      );
      const direcaoMovimentoJogador =
        velocidadeJogadorModulo > 0.8
          ? {
              x: velocidadeJogador.x / velocidadeJogadorModulo,
              z: velocidadeJogador.z / velocidadeJogadorModulo,
            }
          : {
              x: frenteJogador.x,
              z: frenteJogador.z,
            };
      const jogadorParado = velocidadeJogadorModulo < 1.2;
      const jogadorLento = velocidadeJogadorModulo < 6.5;
      const jogadorMuitoRapido = velocidadeJogadorModulo > 42;
      const lateralMovimentoX = -direcaoMovimentoJogador.z;
      const lateralMovimentoZ = direcaoMovimentoJogador.x;
      const distPolicialJogador = Math.hypot(
        policial.corpo.position.x - alvoJogador.x,
        policial.corpo.position.z - alvoJogador.z,
      );
      const modoCapturaDireta =
        distPolicialJogador < 22 ||
        (distPolicialJogador < 30 && jogadorLento);
      const distJogadorSilaba = alvoSilaba
        ? Math.hypot(
            alvoJogador.x - alvoSilaba.x,
            alvoJogador.z - alvoSilaba.z,
          )
        : Infinity;

      // Passo 1: leitura do cenário.
      const pressaoLocal = THREE.MathUtils.clamp(
        1 - distPolicialJogador / 85,
        0,
        1,
      );
      const oportunidadeObjetivo = alvoSilaba
        ? THREE.MathUtils.clamp(1 - distJogadorSilaba / 90, 0, 1)
        : 0;

      // Passo 2: previsão do próximo movimento do jogador.
      const horizontePrevisao =
        THREE.MathUtils.clamp(
          distPolicialJogador / 18 + velocidadeJogadorModulo / 90,
          0.55,
          2.8,
        ) * perfil.previsao;
      const alvoPrevisto = {
        x:
          alvoJogador.x +
          direcaoMovimentoJogador.x *
            velocidadeJogadorModulo *
            horizontePrevisao,
        z:
          alvoJogador.z +
          direcaoMovimentoJogador.z *
            velocidadeJogadorModulo *
            horizontePrevisao,
      };

      // Passo 3: escolha tática específica da unidade.
      let alvoTatico = { ...alvoPrevisto };
      switch (policial.estrategia) {
        case "perseguidora":
          alvoTatico = {
            x: alvoPrevisto.x + direcaoMovimentoJogador.x * 2,
            z: alvoPrevisto.z + direcaoMovimentoJogador.z * 2,
          };
          break;
        case "moto": {
          const zigueZague =
            Math.sin(performance.now() * 0.0044 + policial.indice * 0.8) *
            THREE.MathUtils.clamp(distPolicialJogador * 0.2, 3, 8.5);
          alvoTatico = {
            x: alvoPrevisto.x + lateralMovimentoX * zigueZague,
            z: alvoPrevisto.z + lateralMovimentoZ * zigueZague,
          };
          break;
        }
        case "interceptadora":
          alvoTatico = {
            x:
              alvoPrevisto.x +
              lateralMovimentoX *
                (policial.indice % 2 === 0
                  ? -perfil.lateral
                  : perfil.lateral),
            z:
              alvoPrevisto.z +
              lateralMovimentoZ *
                (policial.indice % 2 === 0
                  ? -perfil.lateral
                  : perfil.lateral),
          };
          break;
        case "flanqueadora":
          alvoTatico = {
            x:
              alvoJogador.x +
              lateralMovimentoX *
                (policial.indice % 2 === 0
                  ? -perfil.lateral
                  : perfil.lateral) +
              direcaoMovimentoJogador.x * 7,
            z:
              alvoJogador.z +
              lateralMovimentoZ *
                (policial.indice % 2 === 0
                  ? -perfil.lateral
                  : perfil.lateral) +
              direcaoMovimentoJogador.z * 7,
          };
          break;
        case "pressiona":
          alvoTatico = {
            x:
              alvoJogador.x -
              direcaoMovimentoJogador.x * 9 +
              lateralMovimentoX * (policial.indice % 2 === 0 ? 4 : -4),
            z:
              alvoJogador.z -
              direcaoMovimentoJogador.z * 9 +
              lateralMovimentoZ * (policial.indice % 2 === 0 ? 4 : -4),
          };
          break;
        case "corta-rota":
          if (alvoSilaba) {
            const pesoSilaba = THREE.MathUtils.lerp(
              0.48,
              0.72,
              oportunidadeObjetivo,
            );
            alvoTatico = {
              x:
                alvoPrevisto.x * (1 - pesoSilaba) +
                alvoSilaba.x * pesoSilaba,
              z:
                alvoPrevisto.z * (1 - pesoSilaba) +
                alvoSilaba.z * pesoSilaba,
            };
          }
          break;
        case "cercadora":
          alvoTatico = {
            x:
              alvoJogador.x +
              lateralMovimentoX *
                (policial.indice % 2 === 0
                  ? -perfil.lateral
                  : perfil.lateral) -
              direcaoMovimentoJogador.x * 4,
            z:
              alvoJogador.z +
              lateralMovimentoZ *
                (policial.indice % 2 === 0
                  ? -perfil.lateral
                  : perfil.lateral) -
              direcaoMovimentoJogador.z * 4,
          };
          break;
        case "varredora":
          if (alvoSilaba) {
            const pesoSilaba = THREE.MathUtils.lerp(
              0.58,
              0.72,
              oportunidadeObjetivo,
            );
            alvoTatico = {
              x:
                alvoJogador.x * (1 - pesoSilaba) +
                alvoSilaba.x * pesoSilaba +
                direcaoMovimentoJogador.x * 9,
              z:
                alvoJogador.z * (1 - pesoSilaba) +
                alvoSilaba.z * pesoSilaba +
                direcaoMovimentoJogador.z * 9,
            };
          } else {
            alvoTatico = {
              x:
                alvoPrevisto.x +
                lateralMovimentoX * (policial.indice % 2 === 0 ? -8 : 8),
              z:
                alvoPrevisto.z +
                lateralMovimentoZ * (policial.indice % 2 === 0 ? -8 : 8),
            };
          }
          break;
      }

      if (modoCapturaDireta) {
        const lado = policial.indice % 2 === 0 ? -1 : 1;
        if (
          policial.estrategia === "perseguidora" ||
          policial.estrategia === "pressiona" ||
          policial.estrategia === "varredora"
        ) {
          alvoTatico = {
            x: alvoJogador.x + direcaoMovimentoJogador.x * 0.9,
            z: alvoJogador.z + direcaoMovimentoJogador.z * 0.9,
          };
        } else if (policial.estrategia === "moto") {
          alvoTatico = {
            x:
              alvoJogador.x +
              direcaoMovimentoJogador.x * 1.05 +
              lateralMovimentoX * lado * 1.05,
            z:
              alvoJogador.z +
              direcaoMovimentoJogador.z * 1.05 +
              lateralMovimentoZ * lado * 1.05,
          };
        } else if (
          policial.estrategia === "interceptadora" ||
          policial.estrategia === "corta-rota"
        ) {
          alvoTatico = {
            x:
              alvoJogador.x -
              direcaoMovimentoJogador.x * 0.15 +
              lateralMovimentoX * lado * 1.15,
            z:
              alvoJogador.z -
              direcaoMovimentoJogador.z * 0.15 +
              lateralMovimentoZ * lado * 1.15,
          };
        } else {
          alvoTatico = {
            x: alvoJogador.x + lateralMovimentoX * lado * 1.3,
            z: alvoJogador.z + lateralMovimentoZ * lado * 1.3,
          };
        }
      }

      // Passo 4: correção fina de rota, objetivo e formação.
      const pesoObjetivo = modoCapturaDireta
        ? Math.min(perfil.objetivo, 0.02)
        : perfil.objetivo;
      if (alvoSilaba && pesoObjetivo > 0) {
        alvoTatico = {
          x:
            alvoTatico.x * (1 - pesoObjetivo) +
            alvoSilaba.x * pesoObjetivo,
          z:
            alvoTatico.z * (1 - pesoObjetivo) +
            alvoSilaba.z * pesoObjetivo,
        };
      }
      if (
        contextoTaticoPolicia.ativa &&
        contextoTaticoPolicia.policialIndice === policial.indice
      ) {
        alvoTatico = {
          x: alvoTatico.x * 0.2 + contextoTaticoPolicia.alvoX * 0.8,
          z: alvoTatico.z * 0.2 + contextoTaticoPolicia.alvoZ * 0.8,
        };
      }
      const alvoBaseCorrigido = limitarPontoAoMapa(
        alvoTatico.x,
        alvoTatico.z,
        20,
      );
      const alvoComFormacao = ajustarAlvoComFormacao(
        policial,
        alvoBaseCorrigido,
      );
      const pesoFormacao = modoCapturaDireta
        ? 0.03
        : jogadorParado
          ? 0.28
          : 1;
      const alvoCorrigido = limitarPontoAoMapa(
        alvoBaseCorrigido.x * (1 - pesoFormacao) +
          alvoComFormacao.x * pesoFormacao,
        alvoBaseCorrigido.z * (1 - pesoFormacao) +
          alvoComFormacao.z * pesoFormacao,
        20,
      );

      // Passo 5: pacote final de agressividade e resposta do veículo.
      const agressividadeFinal = THREE.MathUtils.clamp(
        perfil.agressividade +
          pressaoLocal * 0.12 +
          oportunidadeObjetivo * 0.08 +
          (modoCapturaDireta ? 0.08 : 0) +
          (jogadorMuitoRapido ? 0.03 : 0),
        0.22,
        0.64,
      );
      const respostaCurvaSuave =
        perfil.curva * 0.9 +
        pressaoLocal * 0.06 +
        (modoCapturaDireta ? 0.08 : 0) +
        (jogadorMuitoRapido ? 0.04 : 0);
      const bonusVelocidadeSuave =
        perfil.bonusVelocidade * 0.42 +
        oportunidadeObjetivo * 0.02 +
        (modoCapturaDireta ? 0.03 : 0) +
        Math.min(0.04, velocidadeJogadorModulo / 260);
      return {
        alvo: alvoCorrigido,
        agressividade: agressividadeFinal,
        respostaCurva: respostaCurvaSuave,
        bonusVelocidade: bonusVelocidadeSuave,
        amortecimento: 0.989 + agressividadeFinal * 0.003,
        modoCerco: jogadorParado || distPolicialJogador < 8,
        modoCapturaDireta,
      };
    }

    function calcularAlvoPolicial(policial) {
      const plano = criarPlanoIApolicial(policial);
      policial.estado.planoAtual = plano;
      return plano.alvo;
    }

    function obterPressaoPolicial() {
      let pressaoTotal = 0;
      let contatoVisualMaximo = 0;

      for (let idx = 0; idx < totalPoliciasAtivas; idx++) {
        const policial = policiais[idx];
        if (!policial?.visual.visible) continue;

        const distHorizontal = Math.hypot(
          carroCorpo.position.x - policial.corpo.position.x,
          carroCorpo.position.z - policial.corpo.position.z,
        );
        const distVertical = Math.abs(
          carroCorpo.position.y - policial.corpo.position.y,
        );
        const velocidadeRelativa = Math.hypot(
          carroCorpo.velocity.x - policial.corpo.velocity.x,
          carroCorpo.velocity.z - policial.corpo.velocity.z,
        );
        if (distHorizontal > 10.5 || distVertical > 3.2) continue;

        const proximidadeHorizontal = THREE.MathUtils.clamp(
          1 - distHorizontal / 8.8,
          0,
          1,
        );
        const proximidadeVertical = THREE.MathUtils.clamp(
          1 - distVertical / 2.8,
          0,
          1,
        );
        const sincroniaVelocidade = THREE.MathUtils.clamp(
          1 - velocidadeRelativa / 12,
          0,
          1,
        );

        let contatoFisico = 0;
        for (let i = 0; i < mundoFisica.contacts.length; i++) {
          const contato = mundoFisica.contacts[i];
          const envolveJogador =
            contato.bi === carroCorpo || contato.bj === carroCorpo;
          const envolvePolicial =
            contato.bi === policial.corpo ||
            contato.bj === policial.corpo;
          if (!envolveJogador || !envolvePolicial) continue;
          contatoFisico = 1;
          break;
        }
        const contatoTravado =
          distHorizontal < 4.8 &&
          distVertical < 1.9 &&
          proximidadeHorizontal > 0.28 &&
          proximidadeVertical > 0.18;
        const quaseEncostando =
          distHorizontal < 6.8 &&
          distVertical < 2.2 &&
          proximidadeHorizontal > 0.12;
        const fatorDesgrude = THREE.MathUtils.clamp(
          1 -
            ((policial.estado?.tempoDesgrudeJogador || 0) / 0.72) * 0.55,
          contatoFisico ? 0.7 : 0.42,
          1,
        );
        const pressaoIndividual =
          (proximidadeHorizontal * 0.8 +
            proximidadeVertical * 0.28 +
            sincroniaVelocidade * 0.22 +
            (quaseEncostando ? 0.18 : 0) +
            (contatoFisico ? 0.52 : 0) +
            (contatoTravado ? 0.38 : 0)) *
          fatorDesgrude;
        if (pressaoIndividual <= 0.02) continue;
        pressaoTotal += pressaoIndividual;
        contatoVisualMaximo = Math.max(
          contatoVisualMaximo,
          THREE.MathUtils.clamp(
            proximidadeHorizontal * 0.74 +
              proximidadeVertical * 0.18 +
              (quaseEncostando ? 0.14 : 0) +
              (contatoFisico ? 0.24 : 0) +
              (contatoTravado ? 0.16 : 0),
            0,
            1,
          ),
        );
      }

      return {
        pressao: THREE.MathUtils.clamp(pressaoTotal, 0, 2.4),
        contatoVisual: contatoVisualMaximo,
      };
    }

    function exibirVitoria(subtitulo, texto) {
      subtituloVitoria.textContent = subtitulo;
      textoVitoria.textContent = texto;
      emojiVitoria.textContent =
        niveisAtuais[
          Math.max(0, Math.min(faseAtual, niveisAtuais.length - 1))
        ]?.emoji || "⭐";
      mensagemVitoria.style.display = "block";
      anunciarStatus(`${subtitulo} ${texto}`.trim());
    }

    function atualizarDicaVisual(palavra) {
      const dica = obterDicaVisualInfo(palavra);
      alvoEmojiHud.textContent = dica.emoji;
      alvoEmojiHud.classList.toggle(
        "emoji-destaque",
        bancoDeFases[grupoFaseAtual]?.destaque === true,
      );
      alvoEmojiHud.setAttribute(
        "aria-label",
        dica.nome ? `Emoji: ${dica.nome}` : "Emoji do desafio",
      );
      alvoEmojiHud.title = dica.nome || "Desafio";
    }

    function atualizarPainelPontos() {
      infoPontos.textContent = String(pontosJogador);
      pontosMenu.textContent = `Pontos: ${pontosJogador}`;
    }

    function reiniciarTemporizadorDeObjetivo() {
      tempoSemColetarObjetivo = 0;
      punicaoHelicopteroAtiva = false;
      cooldownAtaqueHelicoptero = 0;
      intensidadePunicaoHelicoptero = 0;
      limparProjeteisHelicoptero();
    }

    function atualizarObjetivoHUD() {
      const fase = niveisAtuais[faseAtual];
      if (!fase) return;
      if (interfaceHud) {
        interfaceHud.classList.toggle(
          "modo-facil",
          grupoFaseAtual === "facil",
        );
        interfaceHud.classList.toggle(
          "modo-silabas",
          grupoFaseAtual !== "facil",
        );
      }
      if (palavraAlvoHud) {
        palavraAlvoHud.textContent =
          grupoFaseAtual === "facil"
            ? fase.desafio || fase.palavra
            : fase.palavra;
      }
    }

    function definirPontos(valor) {
      pontosJogador = Math.max(0, Math.round(valor));
      atualizarPainelPontos();
      atualizarGaragemUI();
      salvarProgressoLocal();
    }

    function adicionarPontos(valor) {
      definirPontos(pontosJogador + Math.max(0, valor));
    }

    function removerPontos(valor) {
      definirPontos(pontosJogador - Math.max(0, valor));
    }

    function comprarOuSelecionarCarro(id) {
      const modelo = garagemCarros[id];
      if (!modelo) return false;

      if (!carrosDesbloqueados.has(id)) {
        if (pontosJogador < modelo.custo) {
          mostrarMensagemHud(
            "Pontos insuficientes para este carro!",
            "alerta",
          );
          anunciarStatus(
            `Pontos insuficientes para comprar ${modelo.nome}.`,
          );
          return false;
        }
        removerPontos(modelo.custo);
        carrosDesbloqueados.add(id);
        mostrarMensagemHud(`${modelo.nome} comprado!`, "boa");
      } else {
        mostrarMensagemHud(`${modelo.nome} selecionado!`, "boa");
      }

      carroSelecionado = id;
      aplicarModeloCarro();
      atualizarGaragemUI();
      salvarProgressoLocal();
      anunciarStatus(`Carro selecionado: ${modelo.nome}.`);
      return true;
    }

    function obterTextoDesafio(fase) {
      if (!fase) {
        return "Veja a palavra, pegue o próximo bloco e fuja da polícia.";
      }
      if (grupoFaseAtual === "facil") {
        return `${fase.emoji} ${fase.desafio || fase.palavra} • Pegue a vogal inicial.`;
      }
      return `${fase.emoji} ${fase.palavra} • Pegue os blocos em ordem e fuja da polícia.`;
    }

    function obterClasseVisualCarro(id, modelo) {
      const classesEspecificas = {
        "moto-urbana": "visual-roadster",
        rally: "visual-rally",
        "moto-trilha": "visual-prototype",
        turbovan: "visual-van",
        phantom: "visual-phantom",
      };
      return classesEspecificas[id] || `visual-${modelo.visual}`;
    }

    function obterPalavraIncompletaDaFase() {
      const fase = niveisAtuais[faseAtual];
      if (!fase) return "";
      return fase.desafio || fase.palavra;
    }

    function ajustarAlvoComFormacao(policial, alvoBase) {
      let ajusteX = 0;
      let ajusteZ = 0;

      policiais.forEach((outro) => {
        if (outro === policial || !outro.visual.visible) return;
        const dx = policial.corpo.position.x - outro.corpo.position.x;
        const dz = policial.corpo.position.z - outro.corpo.position.z;
        const distancia = Math.hypot(dx, dz);
        if (distancia < 0.001 || distancia > 16) return;

        const peso = ((16 - distancia) / 16) * 8;
        ajusteX += (dx / distancia) * peso;
        ajusteZ += (dz / distancia) * peso;
      });

      return limitarPontoAoMapa(
        alvoBase.x + ajusteX,
        alvoBase.z + ajusteZ,
        18,
      );
    }

    function atualizarIndicadorContato() {
      const progressoCaptura = THREE.MathUtils.clamp(
        tempoContatoPolicia / tempoCapturaPolicia,
        0,
        1,
      );
      const progresso = Math.max(progressoCaptura, contatoVisualPolicia);
      if (infoRisco) {
        infoRisco.textContent =
          progresso >= 0.75
            ? "Pegando!"
            : progresso >= 0.3
              ? "Pressão"
              : contextoTaticoPolicia.ativa
                ? "Bloqueio"
                : "Livre";
      }
      if (infoContato) {
        infoContato.textContent = `Contato ${Math.round(progresso * 100)}%`;
      }
      if (barraRiscoPreenchimento) {
        barraRiscoPreenchimento.style.width = `${Math.round(progresso * 100)}%`;
        barraRiscoPreenchimento.style.filter =
          progresso >= 0.75 ? "saturate(1.25) brightness(1.1)" : "none";
      }
      if (
        progresso >= 0.75 &&
        estadoJogo === "jogando" &&
        !rodadaEncerrada
      ) {
        mostrarMensagemHud("Fuja da polícia!", "alerta");
      }
    }

    function aplicarImpactoVisual(intensidade) {
      intensidadeImpactoVisual = Math.max(
        intensidadeImpactoVisual,
        intensidade * CONFIG_CONFORTO_MOVIMENTO.fatorImpactoTela,
      );
      if (impactoOverlay) {
        impactoOverlay.style.opacity =
          intensidadeImpactoVisual.toFixed(3);
      }
    }

    function lidarComColisaoEntreCarros(corpoJogador, corpoPolicial) {
      if (cooldownImpactoColisao > 0 || rodadaEncerrada) return;

      const velocidadeJogadorAntes = Math.hypot(
        corpoJogador.velocity.x,
        corpoJogador.velocity.z,
      );
      let dx = corpoJogador.position.x - corpoPolicial.position.x;
      let dz = corpoJogador.position.z - corpoPolicial.position.z;
      let distancia = Math.hypot(dx, dz);
      if (distancia < 0.001) {
        const frentePolicial = obterDirecaoFrente(
          corpoPolicial,
          direcaoForcaTemp,
        );
        dx = -frentePolicial.z;
        dz = frentePolicial.x;
        distancia = Math.hypot(dx, dz) || 1;
      }
      const direcaoX = dx / distancia;
      const direcaoZ = dz / distancia;
      const frentePolicial = obterDirecaoFrente(
        corpoPolicial,
        direcaoForcaTemp,
      );
      const lateralX = -frentePolicial.z;
      const lateralZ = frentePolicial.x;
      const sentidoLateral =
        direcaoX * lateralX + direcaoZ * lateralZ >= 0 ? 1 : -1;
      const velocidadeRelativa = Math.hypot(
        corpoPolicial.velocity.x - corpoJogador.velocity.x,
        corpoPolicial.velocity.z - corpoJogador.velocity.z,
      );
      const impulso =
        THREE.MathUtils.clamp(2.8 + velocidadeRelativa * 0.18, 2.8, 8.4) *
        CONFIG_CONFORTO_MOVIMENTO.fatorEmpurraoColisao;
      const impulsoLateral = THREE.MathUtils.clamp(
        1.6 + velocidadeRelativa * 0.06,
        1.6,
        3.6,
      );
      const frenteJogador = obterDirecaoFrente(
        corpoJogador,
        direcaoFrontalTemp,
      );
      const impulsoFugaFrontal = THREE.MathUtils.clamp(
        1.8 + Math.max(0, 8 - velocidadeJogadorAntes) * 0.24,
        1.8,
        3.8,
      );
      const policial = policiais.find(
        (candidato) => candidato.corpo === corpoPolicial,
      );

      corpoJogador.velocity.x +=
        direcaoX * impulso +
        lateralX * impulsoLateral * sentidoLateral +
        frenteJogador.x * impulsoFugaFrontal;
      corpoJogador.velocity.z +=
        direcaoZ * impulso +
        lateralZ * impulsoLateral * sentidoLateral +
        frenteJogador.z * impulsoFugaFrontal;
      corpoJogador.velocity.y = Math.max(corpoJogador.velocity.y, 2.4);
      corpoPolicial.velocity.x -=
        direcaoX * impulso * 0.7 + lateralX * impulsoLateral * 0.38;
      corpoPolicial.velocity.z -=
        direcaoZ * impulso * 0.7 + lateralZ * impulsoLateral * 0.38;
      const separacao = Math.max(1.6, 5.8 - distancia);
      corpoJogador.position.x +=
        direcaoX * separacao * 0.72 + lateralX * 0.48 * sentidoLateral;
      corpoJogador.position.z +=
        direcaoZ * separacao * 0.72 + lateralZ * 0.48 * sentidoLateral;
      corpoPolicial.position.x -=
        direcaoX * separacao * 0.58 + lateralX * 0.18 * sentidoLateral;
      corpoPolicial.position.z -=
        direcaoZ * separacao * 0.58 + lateralZ * 0.18 * sentidoLateral;
      corpoJogador.velocity.x *= 0.96;
      corpoJogador.velocity.z *= 0.96;
      limitarVelocidadeHorizontal(
        corpoJogador,
        Math.max(9, velocidadeJogadorAntes * 0.96),
      );
      if (policial?.estado) {
        policial.estado.tempoSobreposicaoJogador = 0;
        policial.estado.tempoDesgrudeJogador = Math.max(
          policial.estado.tempoDesgrudeJogador || 0,
          0.72,
        );
      }
      cooldownImpactoColisao = 0.18;
      pausaCapturaAposColisao = 0.7;
      aplicarImpactoVisual(THREE.MathUtils.clamp(impulso / 8, 0.22, 0.6));
    }

    // Evita que o jogador fique "colado" na polícia ao resolver sobreposição
    // física prolongada logo após o step do mundo.
    function aliviarContatoComPolicia(delta) {
      for (let indice = 0; indice < totalPoliciasAtivas; indice++) {
        const policial = policiais[indice];
        if (!policial?.visual.visible) continue;
        let contatoFisico = false;
        for (let i = 0; i < mundoFisica.contacts.length; i++) {
          const contato = mundoFisica.contacts[i];
          const envolveJogador =
            contato.bi === carroCorpo || contato.bj === carroCorpo;
          const envolvePolicial =
            contato.bi === policial.corpo ||
            contato.bj === policial.corpo;
          if (!envolveJogador || !envolvePolicial) continue;
          contatoFisico = true;
          break;
        }
        const dx = carroCorpo.position.x - policial.corpo.position.x;
        const dz = carroCorpo.position.z - policial.corpo.position.z;
        const distHorizontal = Math.hypot(dx, dz);
        const distVertical = Math.abs(
          carroCorpo.position.y - policial.corpo.position.y,
        );
        if (contatoFisico) {
          policial.estado.tempoSobreposicaoJogador += delta;
          policial.estado.tempoDesgrudeJogador = Math.max(
            policial.estado.tempoDesgrudeJogador || 0,
            0.38,
          );
        } else {
          policial.estado.tempoSobreposicaoJogador = Math.max(
            0,
            policial.estado.tempoSobreposicaoJogador - delta * 2,
          );
        }
        if (distHorizontal >= 4.6 || distVertical >= 1.9) continue;
        if (
          contatoFisico &&
          policial.estado.tempoSobreposicaoJogador < 0.22
        ) {
          continue;
        }

        const nx = dx / Math.max(distHorizontal, 0.001);
        const nz = dz / Math.max(distHorizontal, 0.001);
        const escape =
          (4.8 - distHorizontal) * Math.max(0.18, delta * 4.1);
        carroCorpo.position.x += nx * escape * 1.26;
        carroCorpo.position.z += nz * escape * 1.26;
        policial.corpo.position.x -= nx * escape * 0.38;
        policial.corpo.position.z -= nz * escape * 0.38;
        carroCorpo.velocity.x += nx * (1.15 + escape * 2.3);
        carroCorpo.velocity.z += nz * (1.15 + escape * 2.3);
        policial.corpo.velocity.x -= nx * (0.42 + escape * 1.2);
        policial.corpo.velocity.z -= nz * (0.42 + escape * 1.2);
      }
    }

    function marcarRadarComoSujo() {
      radarTempoAcumulado = CONFIG_OTIMIZACAO.intervaloRadar;
    }

    function mapearPontoNoRadar(x, z, margem, areaLargura, areaAltura) {
      return {
        x: margem + (x + tamanhoMapa / 2) * (areaLargura / tamanhoMapa),
        y: margem + (z + tamanhoMapa / 2) * (areaAltura / tamanhoMapa),
      };
    }

    // O overlay do radar só desenha marcadores; o mapa real é o próprio
    // cenário renderizado por cima com câmera ortográfica de topo.
    function atualizarRadar(delta = CONFIG_OTIMIZACAO.intervaloRadar) {
      if (!radarCanvas || !radarCtx) return;

      radarTempoAcumulado += delta;
      if (radarTempoAcumulado < CONFIG_OTIMIZACAO.intervaloRadar) {
        return;
      }
      radarTempoAcumulado = 0;

      const largura = radarCanvas.clientWidth || 0;
      const altura = radarCanvas.clientHeight || 0;
      if (largura <= 0 || altura <= 0) return;

      if (radarFundoSujo) {
        desenharFundoRadar(largura, altura);
      }

      const margem = 2;
      const areaLargura = largura - margem * 2;
      const areaAltura = altura - margem * 2;

      radarCtx.clearRect(0, 0, largura, altura);
      radarCtx.save();
      radarCtx.strokeStyle = "rgba(255, 255, 255, 0.22)";
      radarCtx.lineWidth = 1;
      radarCtx.strokeRect(margem, margem, areaLargura, areaAltura);

      const silabaAtual = obterSilabaAtual();
      if (silabaAtual && !silabaAtual.coletada) {
        const alvo = mapearPontoNoRadar(
          silabaAtual.mesh.position.x,
          silabaAtual.mesh.position.z,
          margem,
          areaLargura,
          areaAltura,
        );
        radarCtx.fillStyle = "#ffd166";
        radarCtx.strokeStyle = "#fff6d5";
        radarCtx.lineWidth = 1.5;
        radarCtx.beginPath();
        radarCtx.arc(alvo.x, alvo.y, 5.5, 0, Math.PI * 2);
        radarCtx.fill();
        radarCtx.stroke();
        radarCtx.beginPath();
        radarCtx.arc(alvo.x, alvo.y, 10, 0, Math.PI * 2);
        radarCtx.strokeStyle = "rgba(255, 224, 130, 0.34)";
        radarCtx.lineWidth = 1;
        radarCtx.stroke();
      }

      for (let indice = 0; indice < totalPoliciasAtivas; indice++) {
        const policial = policiais[indice];
        if (!policial?.visual.visible) continue;
        const pontoPolicial = mapearPontoNoRadar(
          policial.corpo.position.x,
          policial.corpo.position.z,
          margem,
          areaLargura,
          areaAltura,
        );
        radarCtx.fillStyle =
          policial.tipo === "moto" ? "#ffb703" : "#ff595e";
        radarCtx.beginPath();
        radarCtx.arc(
          pontoPolicial.x,
          pontoPolicial.y,
          4.4,
          0,
          Math.PI * 2,
        );
        radarCtx.fill();
        radarCtx.strokeStyle = "rgba(255, 255, 255, 0.85)";
        radarCtx.lineWidth = 1.2;
        radarCtx.stroke();
      }

      const pontoJogador = mapearPontoNoRadar(
        carroCorpo.position.x,
        carroCorpo.position.z,
        margem,
        areaLargura,
        areaAltura,
      );
      const yawJogador = obterYawCorpo(carroCorpo);
      radarCtx.translate(pontoJogador.x, pontoJogador.y);
      radarCtx.rotate(yawJogador);
      radarCtx.fillStyle = "#8fd3ff";
      radarCtx.beginPath();
      radarCtx.moveTo(0, -7.5);
      radarCtx.lineTo(5.8, 6.4);
      radarCtx.lineTo(0, 3.4);
      radarCtx.lineTo(-5.8, 6.4);
      radarCtx.closePath();
      radarCtx.fill();
      radarCtx.strokeStyle = "rgba(255,255,255,0.96)";
      radarCtx.lineWidth = 1.4;
      radarCtx.stroke();
      radarCtx.restore();
    }

    function ocultarSetaSilaba() {
      if (!setaSilaba) return;
      setaSilaba.classList.remove("visivel");
      setaSilaba.classList.remove("sobre-alvo");
      setaSilaba.style.display = "none";
    }

    function atualizarMarcadorObjetivo3D(tempoAgora) {
      if (!marcadorObjetivo3D || estadoJogo !== "jogando") {
        marcadorObjetivo3D.visible = false;
        return;
      }

      const silabaAtiva = obterSilabaAtual();
      if (!silabaAtiva || silabaAtiva.coletada) {
        marcadorObjetivo3D.visible = false;
        return;
      }

      const flutuacao = Math.sin(tempoAgora * 0.42) * 0.6;
      const pulso = 1 + Math.sin(tempoAgora * 0.52) * 0.08;
      marcadorObjetivo3D.visible = true;
      marcadorObjetivo3D.position.set(
        silabaAtiva.mesh.position.x,
        silabaAtiva.mesh.position.y + 20 + flutuacao,
        silabaAtiva.mesh.position.z,
      );
      marcadorObjetivo3D.userData.seta.rotation.y += 0.04;
      marcadorObjetivo3D.userData.aroTopo.rotation.z += 0.03;
      marcadorObjetivo3D.userData.aroBase.rotation.z -= 0.02;
      marcadorObjetivo3D.userData.aroTopo.scale.setScalar(pulso);
      marcadorObjetivo3D.userData.aroBase.scale.setScalar(1 + (pulso - 1) * 1.2);
      marcadorObjetivo3D.userData.feixe.material.opacity =
        0.22 + Math.sin(tempoAgora * 0.45) * 0.06;
      marcadorObjetivo3D.userData.label.scale.set(
        10.5 + Math.sin(tempoAgora * 0.48) * 0.5,
        4.2 + Math.sin(tempoAgora * 0.48) * 0.18,
        1,
      );
    }

    // Helicóptero faz patrulha em círculos pelo mapa, sem depender do
    // jogador. Assim ele passa por diferentes áreas do cenário e fica mais
    // natural visualmente.
    function calcularAlvoPrevistoHelicoptero(destino) {
      const alvo = destino || alvoPrevistoHelicopteroTemp;
      const velocidadeProjetil = 96;
      const frenteJogador = obterDirecaoFrente(
        carroCorpo,
        direcaoIAJogadorTemp,
      );
      const velocidadeHorizontal = Math.hypot(
        carroCorpo.velocity.x,
        carroCorpo.velocity.z,
      );
      const movimentoX =
        velocidadeHorizontal > 3
          ? carroCorpo.velocity.x
          : frenteJogador.x * 8;
      const movimentoZ =
        velocidadeHorizontal > 3
          ? carroCorpo.velocity.z
          : frenteJogador.z * 8;
      const distanciaInicial = Math.hypot(
        helicopteroPolicia.position.x - carroCorpo.position.x,
        helicopteroPolicia.position.y - (carroCorpo.position.y + 1),
        helicopteroPolicia.position.z - carroCorpo.position.z,
      );
      let tempoInterceptacao = THREE.MathUtils.clamp(
        distanciaInicial / velocidadeProjetil,
        0.28,
        2.2,
      );
      alvo.set(
        carroCorpo.position.x + movimentoX * tempoInterceptacao,
        carroCorpo.position.y + 1 + carroCorpo.velocity.y * tempoInterceptacao * 0.12,
        carroCorpo.position.z + movimentoZ * tempoInterceptacao,
      );
      const distanciaRefinada = Math.hypot(
        helicopteroPolicia.position.x - alvo.x,
        helicopteroPolicia.position.y - alvo.y,
        helicopteroPolicia.position.z - alvo.z,
      );
      tempoInterceptacao = THREE.MathUtils.clamp(
        distanciaRefinada / velocidadeProjetil,
        0.28,
        2.4,
      );
      alvo.set(
        carroCorpo.position.x + movimentoX * tempoInterceptacao,
        carroCorpo.position.y + 1 + carroCorpo.velocity.y * tempoInterceptacao * 0.12,
        carroCorpo.position.z + movimentoZ * tempoInterceptacao,
      );
      return alvo;
    }

    function removerProjetilHelicoptero(projetil) {
      cena.remove(projetil.mesh);
      if (projetil.mesh.geometry !== geoProjetilHelicoptero) {
        projetil.mesh.geometry.dispose();
      }
      if (projetil.mesh.material !== matProjetilHelicoptero) {
        projetil.mesh.material.dispose();
      }
    }

    function dispararProjetilHelicoptero() {
      origemTiroHelicopteroTemp
        .copy(helicopteroPolicia.position)
        .setY(helicopteroPolicia.position.y - 1.2);
      const alvoPrevisto = calcularAlvoPrevistoHelicoptero(
        alvoPrevistoHelicopteroTemp,
      );
      direcaoTiroHelicopteroTemp
        .set(
          alvoPrevisto.x - origemTiroHelicopteroTemp.x,
          alvoPrevisto.y - origemTiroHelicopteroTemp.y,
          alvoPrevisto.z - origemTiroHelicopteroTemp.z,
        )
        .normalize();

      if (projeteisHelicoptero.length >= MAX_PROJETEIS_HELICOPTERO) {
        const antigo = projeteisHelicoptero.shift();
        if (antigo) removerProjetilHelicoptero(antigo);
      }

      const mesh = new THREE.Mesh(
        geoProjetilHelicoptero,
        matProjetilHelicoptero,
      );
      mesh.position.copy(origemTiroHelicopteroTemp);
      cena.add(mesh);
      projeteisHelicoptero.push({
        mesh,
        velocidade: direcaoTiroHelicopteroTemp.clone().multiplyScalar(96),
        vida: 5.4,
      });
    }

    function atualizarProjeteisHelicoptero(delta) {
      if (!projeteisHelicoptero.length) return;

      for (let i = projeteisHelicoptero.length - 1; i >= 0; i--) {
        const projetil = projeteisHelicoptero[i];
        projetil.vida -= delta;
        projetil.mesh.position.addScaledVector(projetil.velocidade, delta);

        const dx = projetil.mesh.position.x - carroCorpo.position.x;
        const dy = projetil.mesh.position.y - (carroCorpo.position.y + 1);
        const dz = projetil.mesh.position.z - carroCorpo.position.z;
        if (dx * dx + dy * dy + dz * dz <= 20) {
          const moduloVelocidade =
            Math.hypot(
              projetil.velocidade.x,
              projetil.velocidade.y,
              projetil.velocidade.z,
            ) || 1;
          const impactoX = projetil.velocidade.x / moduloVelocidade;
          const impactoY = projetil.velocidade.y / moduloVelocidade;
          const impactoZ = projetil.velocidade.z / moduloVelocidade;
          carroCorpo.velocity.x += impactoX * 28;
          carroCorpo.velocity.z += impactoZ * 28;
          carroCorpo.velocity.y = Math.max(
            carroCorpo.velocity.y,
            4.2 + Math.abs(impactoY) * 1.6,
          );
          criarFogosSilaba(projetil.mesh.position, "#ff7043", 5);
          aplicarImpactoVisual(0.56);
          mostrarMensagemHud(
            "Tiro do helicóptero! Pegue o bloco!",
            "alerta",
          );
          anunciarStatus(
            "Tiro do helicóptero acertou o jogador. Colete o proximo bloco para parar a punicao.",
          );
          removerProjetilHelicoptero(projetil);
          projeteisHelicoptero.splice(i, 1);
          continue;
        }

        const foraDoMapa =
          Math.abs(projetil.mesh.position.x) > tamanhoMapa ||
          Math.abs(projetil.mesh.position.z) > tamanhoMapa ||
          projetil.mesh.position.y < -2;
        if (projetil.vida <= 0 || foraDoMapa) {
          removerProjetilHelicoptero(projetil);
          projeteisHelicoptero.splice(i, 1);
        }
      }
    }

    function atualizarHelicopteroPolicial(delta, tempoAgora) {
      if (!helicopteroPolicia) return;

      const ativo =
        estadoJogo === "jogando" &&
        (faseAtual >= 2 || punicaoHelicopteroAtiva);
      helicopteroPolicia.visible = ativo;
      if (!ativo) return;

      if (punicaoHelicopteroAtiva) {
        intensidadePunicaoHelicoptero = Math.min(
          1,
          intensidadePunicaoHelicoptero + delta * 1.8,
        );
        cooldownAtaqueHelicoptero = Math.max(
          0,
          cooldownAtaqueHelicoptero - delta,
        );
        const orbitaPunicao = tempoAgora * 0.016;
        const raioBordaX = tamanhoMapa / 2 + 28;
        const raioBordaZ = tamanhoMapa / 2 + 18;
        alvoHelicopteroTemp.set(
          Math.cos(orbitaPunicao) * raioBordaX,
          29 + Math.sin(tempoAgora * 0.18) * 1.8,
          Math.sin(orbitaPunicao) * raioBordaZ,
        );
        direcaoRecuoHelicopteroTemp.set(
          helicopteroPolicia.position.x - carroCorpo.position.x,
          0,
          helicopteroPolicia.position.z - carroCorpo.position.z,
        );
        const distanciaAtual = direcaoRecuoHelicopteroTemp.length();
        if (distanciaAtual < 60) {
          helicopteroPolicia.position.set(
            alvoHelicopteroTemp.x,
            alvoHelicopteroTemp.y,
            alvoHelicopteroTemp.z,
          );
        }
        helicopteroPolicia.position.lerp(
          alvoHelicopteroTemp,
          THREE.MathUtils.clamp(delta * 0.46, 0.02, 0.05),
        );
        const alvoPrevisto = calcularAlvoPrevistoHelicoptero(
          alvoPrevistoHelicopteroTemp,
        );
        olharHelicopteroTemp.set(
          alvoPrevisto.x,
          alvoPrevisto.y,
          alvoPrevisto.z,
        );
        helicopteroPolicia.lookAt(olharHelicopteroTemp);
        if (cooldownAtaqueHelicoptero <= 0 && !rodadaEncerrada) {
          dispararProjetilHelicoptero();
          mostrarMensagemHud(
            "Helicóptero atirando de longe!",
            "alerta",
          );
          anunciarStatus(
            "Helicoptero atirando de longe. Colete o proximo bloco para parar a punicao.",
          );
          cooldownAtaqueHelicoptero = INTERVALO_ATAQUE_HELICOPTERO;
        }
        helicopteroPolicia.userData.rotorPrincipal.rotation.y += delta * 30;
        helicopteroPolicia.userData.rotorCauda.rotation.x += delta * 38;
        return;
      }

      intensidadePunicaoHelicoptero = Math.max(
        0,
        intensidadePunicaoHelicoptero - delta * 2,
      );

      const orbita = tempoAgora * 0.028;
      const raioPrincipal = 72 + (faseAtual % 3) * 16;
      const raioSecundario = 18 + (faseAtual % 2) * 4;
      const centroX = Math.sin(tempoAgora * 0.009) * 10;
      const centroZ = Math.cos(tempoAgora * 0.007) * 10;
      alvoHelicopteroTemp.set(
        centroX +
          Math.cos(orbita) * raioPrincipal +
          Math.cos(orbita * 2.1) * raioSecundario,
        34 + Math.sin(tempoAgora * 0.16) * 2.2,
        centroZ +
          Math.sin(orbita) * raioPrincipal +
          Math.sin(orbita * 2.1) * raioSecundario,
      );
      helicopteroPolicia.position.lerp(
        alvoHelicopteroTemp,
        THREE.MathUtils.clamp(delta * 0.82, 0.025, 0.08),
      );
      olharHelicopteroTemp.set(
        centroX +
          Math.cos(orbita + 0.18) * raioPrincipal +
          Math.cos((orbita + 0.18) * 2.1) * raioSecundario,
        helicopteroPolicia.position.y - 1,
        centroZ +
          Math.sin(orbita + 0.18) * raioPrincipal +
          Math.sin((orbita + 0.18) * 2.1) * raioSecundario,
      );
      helicopteroPolicia.lookAt(olharHelicopteroTemp);
      helicopteroPolicia.userData.rotorPrincipal.rotation.y += delta * 24;
      helicopteroPolicia.userData.rotorCauda.rotation.x += delta * 32;
    }

    function atualizarSetaSilaba() {
      ocultarSetaSilaba();
    }

    function atualizarPunicaoPorInatividade(delta) {
      if (estadoJogo !== "jogando" || rodadaEncerrada) {
        reiniciarTemporizadorDeObjetivo();
        return;
      }

      tempoSemColetarObjetivo += delta;
      if (tempoSemColetarObjetivo >= TEMPO_INATIVIDADE_HELICOPTERO) {
        punicaoHelicopteroAtiva = true;
      }
    }

    function atualizarCapturaPorContato(delta) {
      pausaCapturaAposColisao = Math.max(
        0,
        pausaCapturaAposColisao - delta,
      );
      if (rodadaEncerrada || atrasoPoliciaRestante > 0) {
        tempoContatoPolicia = Math.max(
          0,
          tempoContatoPolicia - delta * 2.2,
        );
        contatoVisualPolicia = Math.max(
          0,
          contatoVisualPolicia - delta * 1.8,
        );
        atualizarIndicadorContato();
        return;
      }

      const { pressao: pressaoPolicial, contatoVisual } =
        obterPressaoPolicial();
      const contatoVisualAlvo = Math.max(
        contatoVisual,
        THREE.MathUtils.clamp(
          tempoContatoPolicia / tempoCapturaPolicia,
          0,
          1,
        ),
      );
      contatoVisualPolicia +=
        (contatoVisualAlvo - contatoVisualPolicia) *
        THREE.MathUtils.clamp(
          delta * (contatoVisualAlvo > contatoVisualPolicia ? 8.5 : 4.2),
          0,
          1,
        );
      if (pressaoPolicial > 0.01) {
        tempoContatoPolicia = Math.min(
          tempoCapturaPolicia,
          tempoContatoPolicia +
            delta *
              (bancoDeFases[grupoFaseAtual]?.pressaoPolicia || 0.5) *
              (0.48 + pressaoPolicial * 0.32) *
              (pausaCapturaAposColisao > 0 ? 0.18 : 1),
        );
      } else {
        tempoContatoPolicia = Math.max(
          0,
          tempoContatoPolicia -
            delta * (pausaCapturaAposColisao > 0 ? 0.96 : 1.48),
        );
      }

      atualizarIndicadorContato();
      if (tempoContatoPolicia >= tempoCapturaPolicia) {
        iniciarDerrota();
      }
    }

    function salvarProgressoLocal() {
      try {
        localStorage.setItem(CHAVE_PONTOS, String(pontosJogador));
        localStorage.setItem(CHAVE_CARRO, carroSelecionado);
        localStorage.setItem(
          CHAVE_CARROS_DESBLOQUEADOS,
          JSON.stringify([...carrosDesbloqueados]),
        );
      } catch {}
    }

    function carregarProgressoLocal() {
      try {
        const pontosSalvos = Number(
          localStorage.getItem(CHAVE_PONTOS) || "0",
        );
        const carroSalvo =
          localStorage.getItem(CHAVE_CARRO) || "classico";
        const carrosSalvos = JSON.parse(
          localStorage.getItem(CHAVE_CARROS_DESBLOQUEADOS) ||
            '["classico"]',
        );
        pontosJogador = Number.isFinite(pontosSalvos)
          ? Math.max(0, pontosSalvos)
          : 0;
        carrosDesbloqueados = new Set(
          Array.isArray(carrosSalvos) ? carrosSalvos : ["classico"],
        );
        carrosDesbloqueados.add("classico");
        carroSelecionado = garagemCarros[carroSalvo]
          ? carroSalvo
          : "classico";
        if (!carrosDesbloqueados.has(carroSelecionado))
          carroSelecionado = "classico";
      } catch {
        pontosJogador = 0;
        carrosDesbloqueados = new Set(["classico"]);
        carroSelecionado = "classico";
      }
    }

    function obterCarroAtual() {
      return garagemCarros[carroSelecionado] || garagemCarros.classico;
    }

    function hexParaCss(valor) {
      return `#${valor.toString(16).padStart(6, "0")}`;
    }

    function montarCardCarro(modelo, desbloqueado, equipado) {
      const meta = desbloqueado
        ? equipado
          ? "Equipado"
          : "Disponível"
        : `Desbloquear por ${modelo.custo} pts`;

      return `
    <span class="carro-preview" aria-hidden="true">
      <span class="carro-preview__aura"></span>
      <span class="carro-preview__body"></span>
      <span class="carro-preview__cabine"></span>
      <span class="carro-preview__faixa"></span>
      <span class="carro-preview__nariz"></span>
      <span class="carro-preview__rodas"></span>
      <span class="carro-preview__spoiler"></span>
      <span class="carro-preview__asa"></span>
      <span class="carro-preview__entrada-esq"></span>
      <span class="carro-preview__entrada-dir"></span>
    </span>
    <span class="btn-carro-titulo">${modelo.nome}</span>
    <span class="btn-carro-descricao">${modelo.descricao}</span>
    <span class="btn-carro-meta">${modelo.titulo} • ${meta}</span>
    <span class="btn-carro-stats">
      <span>Vel ${modelo.nivelVelocidade}/5</span>
      <span>Acel ${modelo.nivelAceleracao}/5</span>
      <span>Ctrl ${modelo.nivelControle}/5</span>
    </span>
  `;
    }

    function aplicarModeloCarro() {
      const modelo = obterCarroAtual();
      reconstruirMalhasDoCarro(modelo);
    }

    function atualizarGaragemUI(
      reconstruirCards = estadoJogo === "menu",
    ) {
      const carroAtual = obterCarroAtual();
      if (reconstruirCards) {
        botoesCarro.forEach((botao) => {
          const id = botao.dataset.carro;
          const modelo = garagemCarros[id];
          const desbloqueado = carrosDesbloqueados.has(id);
          const podeComprar = pontosJogador >= modelo.custo;
          botao.classList.toggle(
            "travado",
            !desbloqueado && !podeComprar,
          );
          botao.classList.toggle(
            "pode-comprar",
            !desbloqueado && podeComprar,
          );
          botao.classList.toggle("ativo", carroSelecionado === id);
          botao.classList.remove(
            "visual-classico",
            "visual-esportivo",
            "visual-pickup",
            "visual-f1",
            "visual-hiper",
            "visual-roadster",
            "visual-rally",
            "visual-van",
            "visual-prototype",
            "visual-phantom",
          );
          botao.classList.add(obterClasseVisualCarro(id, modelo));
          botao.style.setProperty(
            "--preview-body",
            hexParaCss(modelo.carroceria),
          );
          botao.style.setProperty(
            "--preview-glass",
            hexParaCss(modelo.vidro),
          );
          botao.style.setProperty(
            "--preview-stripe",
            hexParaCss(modelo.faixa),
          );
          botao.style.setProperty(
            "--preview-accent",
            hexParaCss(modelo.asa),
          );
          botao.setAttribute(
            "aria-label",
            `${modelo.nome}, velocidade ${modelo.nivelVelocidade} de 5 e aceleração ${modelo.nivelAceleracao} de 5`,
          );
          botao.innerHTML = montarCardCarro(
            modelo,
            desbloqueado,
            carroSelecionado === id,
          );
        });
      }
      if (infoCarro) infoCarro.textContent = carroAtual.nome;
      if (infoVelocidade) {
        infoVelocidade.textContent = `Vel ${carroAtual.nivelVelocidade} • Acel ${carroAtual.nivelAceleracao}`;
      }
    }

    function obterVelocidadeMaximaPolicial(policial, carroAtual) {
      if (grupoFaseAtual === "dificil") {
        return carroAtual.velocidadeMaxima;
      }
      const fatorPorIndice =
        0.82 + Math.min(policial?.indice || 0, 3) * 0.025;
      return carroAtual.velocidadeMaxima * Math.min(0.9, fatorPorIndice);
    }

    function obterForcaFrentePolicial(policial) {
      const multiplicadorPosicao =
        1 + Math.min(policial?.indice || 0, 3) * 0.03;
      return (
        policial.forcaFrente *
        fatorForcaPolicialAtual *
        0.68 *
        multiplicadorPosicao
      );
    }

    function obterForcaRePolicial(policial) {
      const multiplicadorPosicao =
        1 + Math.min(policial?.indice || 0, 3) * 0.025;
      return (
        policial.forcaRe *
        Math.min(1.05, 1 + (fatorForcaPolicialAtual - 1) * 0.2) *
        0.62 *
        multiplicadorPosicao
      );
    }

    function configurarDificuldadeDaFase(indice) {
      if (grupoFaseAtual === "facil") {
        totalPoliciasAtivas = Math.min(
          1 + Math.floor(indice / 2),
          MAX_POLICIAS_ATIVAS,
        );
      } else if (grupoFaseAtual === "media") {
        totalPoliciasAtivas = Math.min(
          2 * Math.pow(2, Math.floor(indice / 2)),
          MAX_POLICIAS_ATIVAS,
        );
      } else {
        totalPoliciasAtivas = Math.min(indice + 1, MAX_POLICIAS_ATIVAS);
      }
      bonusVelocidadePolicialAtual = 0;
      fatorForcaPolicialAtual = 0.92 + indice * 0.015;
      const policialDaFase =
        ordemPoliciasPorFase[
          Math.min(indice, ordemPoliciasPorFase.length - 1)
        ];
      const restantes = ordemPoliciasPorFase.filter(
        (policial) => policial !== policialDaFase,
      );
      policiais.length = 0;
      policiais.push(policialDaFase, ...restantes);
      policiais.forEach((policial, posicao) => {
        policial.indice = posicao;
      });
    }

    function sincronizarVisibilidadePolicias() {
      policiais.forEach((policial, idx) => {
        const ativa = idx < totalPoliciasAtivas;
        policial.visual.visible = ativa;
        if (ativa) {
          const dx = policial.corpo.position.x - carroCorpo.position.x;
          const dz = policial.corpo.position.z - carroCorpo.position.z;
          const distancia = Math.hypot(dx, dz);
          if (
            policial.corpo.position.y < 0.5 ||
            !Number.isFinite(policial.corpo.position.x) ||
            !Number.isFinite(policial.corpo.position.z) ||
            distancia > 90
          ) {
            reposicionarPolicia(policial, idx);
          }
          policial.corpo.position.y = Math.max(
            policial.corpo.position.y,
            3,
          );
          if (typeof policial.corpo.wakeUp === "function")
            policial.corpo.wakeUp();
        } else {
          policial.corpo.position.y = -50;
          policial.visual.position.copy(policial.corpo.position);
        }
      });
    }

    function voltarAoMenu() {
      limparTransicoes();
      limparObjetosRegistrados(objetosDestaFase);
      limparObjetosRegistrados(objetosDoMapa);
      silabasAtivas = [];
      proximaSilaba = 0;
      reiniciarTemporizadorDeObjetivo();
      resetarContextoTaticoPolicia();
      acumuladorAnalisePolicial = 0;
      rodadaEncerrada = false;
      tempoContatoPolicia = 0;
      contatoVisualPolicia = 0;
      limparEfeitosFogos();
      zerarTeclas();
      policiais.forEach((policial) =>
        resetarEstadoPolicia(policial.estado),
      );
      subtituloVitoria.textContent = "";
      textoVitoria.textContent = "";
      ocultarSetaSilaba();
      marcadorObjetivo3D.visible = false;
      helicopteroPolicia.visible = false;
      hudFase.textContent = "FASE FÁCIL · 1 / 15";
      infoSerie.textContent = "Fase Fácil";
      alvoEmojiHud.textContent = "🎯";
      alvoEmojiHud.classList.remove("emoji-destaque");
      atualizarHUD();
      atualizarObjetivoHUD();
      atualizarIndicadorContato();
      mostrarMensagemHud("Veja a palavra e escolha uma fase!", "fixa");
      estadoJogo = "menu";
      document.getElementById("interface-jogo").style.display = "none";
      document.getElementById("menu-inicial").style.display = "grid";
      resetarPosicoes();
      policiais.forEach((policial) => {
        policial.corpo.position.y = -50;
      });
      sincronizarVisibilidadePolicias();
      carroVisual.position.copy(carroCorpo.position);
      carroVisual.quaternion.copy(carroCorpo.quaternion);
      policiais.forEach((policial) => {
        policial.visual.position.copy(policial.corpo.position);
        policial.visual.quaternion.copy(policial.corpo.quaternion);
      });
      anunciarStatus("Menu principal aberto.");
    }

    // ==========================================
    // 5. INICIALIZAÇÃO E CORREÇÃO DE CONTRASTE
    // ==========================================
    const cacheTexturasSilabas = new Map();
    const geoSilaba = new THREE.BoxGeometry(3.8, 3.8, 3.8);

    function criarTexturaTexto(texto, corFundo) {
      const chave = `${texto}|${corFundo}`;
      if (cacheTexturasSilabas.has(chave))
        return cacheTexturasSilabas.get(chave);

      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext("2d");

      // Fundo da cor escolhida
      ctx.fillStyle = corFundo;
      ctx.fillRect(0, 0, 256, 256);

      // Configurações da Fonte
      ctx.font = "Bold 100px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // CORREÇÃO: Contorno preto grosso para a letra se destacar em qualquer fundo
      ctx.lineWidth = 10;
      ctx.strokeStyle = "black";
      ctx.strokeText(texto, 128, 128);

      // Miolo da letra em branco
      ctx.fillStyle = "white";
      ctx.fillText(texto, 128, 128);

      const textura = configurarTexturaComoCor(
        new THREE.CanvasTexture(canvas),
      );
      cacheTexturasSilabas.set(chave, textura);
      return textura;
    }

    function embaralharFases(lista) {
      const copia = lista.map((fase) => ({
        ...fase,
        silabas: fase.silabas.map((silaba) => ({ ...silaba })),
      }));
      for (let i = copia.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copia[i], copia[j]] = [copia[j], copia[i]];
      }
      return copia;
    }

    function iniciarJogo(grupo) {
      grupoFaseAtual = grupo;
      niveisAtuais = embaralharFases(bancoDeFases[grupo].fases);
      faseAtual = 0;
      velMaxPolicia = obterVelocidadeMaximaPolicial(
        policiais[policiais.length - 1],
        obterCarroAtual(),
      );
      rodadaEncerrada = false;
      tempoContatoPolicia = 0;
      contatoVisualPolicia = 0;
      pausaCapturaAposColisao = 0;
      reiniciarTemporizadorDeObjetivo();
      limparTransicoes();
      zerarTeclas();
      areasOcupadasMapa = [];

      // Limpa objetos do mapa anterior (caso reuse)
      limparObjetosRegistrados(objetosDoMapa);
      limparObjetosRegistrados(objetosDestaFase);
      const fatorMapaLeve = PERFIL_EXECUCAO.firefoxEconomia
        ? 0.58
        : PERFIL_EXECUCAO.pcFraco
          ? 0.72
          : 1;

      // === RAMPAS ALEATÓRIAS (5 a 7 rampas em posições variadas) ===
      const multiplicadorMapa =
        bancoDeFases[grupoFaseAtual]?.multiplicadorMapa || 1;
      const numRampasBase = PERFIL_EXECUCAO.firefoxEconomia
        ? 3 + Math.floor(Math.random() * 2)
        : PERFIL_EXECUCAO.pcFraco
          ? 4 + Math.floor(Math.random() * 2)
          : 5 + Math.floor(Math.random() * 3);
      const numRampas = Math.max(
        2,
        Math.round(numRampasBase * Math.max(0.72, multiplicadorMapa)),
      );
      for (let i = 0; i < numRampas; i++) {
        let rx = (Math.random() - 0.5) * 240;
        let rz = (Math.random() - 0.5) * 240;
        if (Math.abs(rx) < 20 && Math.abs(rz) < 20) {
          rx += 40;
          rz += 40;
        }
        objetosDoMapa.push(
          criarRampa(rx, rz, Math.random() * Math.PI * 2),
        );
      }

      // === OBSTÁCULOS ALEATÓRIOS (árvores e pedras) ===
      let quantidadeObstaculos = Math.round(
        48 * multiplicadorMapa * fatorMapaLeve,
      );
      for (let i = 0; i < quantidadeObstaculos; i++) {
        let x = (Math.random() - 0.5) * 320;
        let z = (Math.random() - 0.5) * 320;
        // Área segura ao redor do spawn do jogador (0,0,20)
        if (Math.abs(x) < 25 && Math.abs(z - 20) < 25) continue;
        if (Math.random() > 0.35) {
          objetosDoMapa.push(criarArvore(x, z));
        } else {
          objetosDoMapa.push(criarPedra(x, z, 3 + Math.random() * 5));
        }
      }

      const quantidadeArbustos = Math.round(
        20 * multiplicadorMapa * fatorMapaLeve,
      );
      for (let i = 0; i < quantidadeArbustos; i++) {
        const x = (Math.random() - 0.5) * 300;
        const z = (Math.random() - 0.5) * 300;
        if (!posicaoLivreNoMapa(x, z, 7)) continue;
        objetosDoMapa.push(criarArbusto(x, z, 2 + Math.random() * 1.5));
      }

      const quantidadeCones = Math.round(
        12 * multiplicadorMapa * fatorMapaLeve,
      );
      for (let i = 0; i < quantidadeCones; i++) {
        const x = (Math.random() - 0.5) * 260;
        const z = (Math.random() - 0.5) * 260;
        if (!posicaoLivreNoMapa(x, z, 5)) continue;
        objetosDoMapa.push(criarCone(x, z, 1.2 + Math.random() * 0.6));
      }

      const quantidadeCaixas = Math.round(
        10 * multiplicadorMapa * fatorMapaLeve,
      );
      for (let i = 0; i < quantidadeCaixas; i++) {
        const x = (Math.random() - 0.5) * 260;
        const z = (Math.random() - 0.5) * 260;
        if (!posicaoLivreNoMapa(x, z, 8)) continue;
        objetosDoMapa.push(
          criarCaixa(
            x,
            z,
            3 + Math.random() * 3,
            2.5 + Math.random() * 2,
            3 + Math.random() * 3,
          ),
        );
      }

      construirMalhaNavegacaoPolicia();
      marcarRadarComoSujo();

      document.getElementById("menu-inicial").style.display = "none";
      document.getElementById("interface-jogo").style.display = "block";
      sincronizarLayoutHUDIframe();
      focarJogoNoIframe();
      mostrarMensagemHud("Colete o próximo bloco!", "fixa");

      carregarFase(0);
    }

    // índice da próxima sílaba a ser coletada (lógica em ordem)
    let proximaSilaba = 0;

    function atualizarHUD() {
      blocosSilabas.innerHTML = "";

      if (interfaceHud) {
        interfaceHud.classList.toggle(
          "modo-facil",
          grupoFaseAtual === "facil",
        );
        interfaceHud.classList.toggle(
          "modo-silabas",
          grupoFaseAtual !== "facil",
        );
      }

      for (let i = 0; i < silabasAtivas.length; i++) {
        const s = silabasAtivas[i];
        const bloco = document.createElement("div");
        bloco.className = "bloco-silaba";
        bloco.id = "bloco-" + i;
        bloco.setAttribute("role", "listitem");
        bloco.style.setProperty("--cor", s.corHex);
        if (s.coletada) {
          bloco.classList.add("coletada");
          bloco.textContent = s.texto;
          bloco.setAttribute("aria-label", `Silaba ${s.texto} coletada`);
        } else if (i === proximaSilaba) {
          bloco.classList.add("proxima");
          bloco.textContent = s.texto; // mostra a sílaba alvo
          bloco.setAttribute("aria-label", `Proxima silaba: ${s.texto}`);
        } else {
          bloco.textContent = "?";
          bloco.setAttribute(
            "aria-label",
            `Silaba ${i + 1} ainda escondida`,
          );
        }
        blocosSilabas.appendChild(bloco);
      }
      atualizarObjetivoHUD();
      sincronizarLayoutHUDIframe();
      agendarAjusteBlocosSilabas();
    }

    function carregarFase(indice) {
      limparTransicoes();
      limparObjetosRegistrados(objetosDestaFase);
      limparEfeitosFogos();
      silabasAtivas = [];
      proximaSilaba = 0;
      resetarContextoTaticoPolicia();
      acumuladorAnalisePolicial =
        CONFIG_OTIMIZACAO.intervaloAnalisePolicial;
      rodadaEncerrada = false;
      tempoContatoPolicia = 0;
      contatoVisualPolicia = 0;
      reiniciarTemporizadorDeObjetivo();
      policiais.forEach((policial) =>
        resetarEstadoPolicia(policial.estado),
      );
      configurarDificuldadeDaFase(indice);

      if (indice >= niveisAtuais.length) {
        exibirVitoria(
          `${bancoDeFases[grupoFaseAtual]?.nome || "Fase"} completa!`,
          niveisAtuais[indice - 1]?.palavra || "FIM",
        );
        estadoJogo = "zerado";
        timeoutFimDeSerie = setTimeout(() => {
          voltarAoMenu();
        }, 4000);
        return;
      }

      const fase = niveisAtuais[indice];
      const nomeGrupo = bancoDeFases[grupoFaseAtual]?.nome || "Fase";
      hudFase.textContent = `${nomeGrupo.toUpperCase()} · ${indice + 1} / ${niveisAtuais.length}`;
      infoSerie.textContent = nomeGrupo;
      atualizarDicaVisual(fase.palavra);
      atualizarObjetivoHUD();
      mostrarMensagemHud("Colete o próximo bloco!", "fixa");

      // Gera posições aleatórias para as sílabas, longe do centro e entre si
      const posicoesSilabas = [];
      for (let i = 0; i < fase.silabas.length; i++) {
        posicoesSilabas.push(
          encontrarPosicaoLivreParaSilaba(posicoesSilabas),
        );
      }

      for (let i = 0; i < fase.silabas.length; i++) {
        const dados = fase.silabas[i];
        const pos = posicoesSilabas[i];
        const texturaSilaba = criarTexturaTexto(dados.texto, dados.cor);
        const materialSilaba = new THREE.MeshLambertMaterial({
          map: texturaSilaba,
        });
        const malha = new THREE.Mesh(geoSilaba, materialSilaba);
        malha.position.set(pos.x, 1.9, pos.z);
        malha.castShadow = true;

        const luzSilaba = new THREE.PointLight(dados.cor, 2, 40);
        luzSilaba.position.set(pos.x, 1.9, pos.z);

        // Só a 1ª sílaba começa visível; as demais ficam escondidas (scale 0)
        if (i > 0) {
          malha.scale.set(0, 0, 0);
          luzSilaba.intensity = 0;
        }

        cena.add(malha);
        cena.add(luzSilaba);
        objetosDestaFase.push(
          registrarObjeto({
            visual: malha,
            luz: luzSilaba,
            descartavel: false,
            aoRemover: () => {
              materialSilaba.dispose();
            },
          }),
        );

        silabasAtivas.push({
          mesh: malha,
          luz: luzSilaba,
          texto: dados.texto,
          corHex: dados.cor,
          coletada: false,
          yBase: 1.9,
        });
      }

      atualizarHUD();
      resetarPosicoes();
      sincronizarVisibilidadePolicias();
      carroVisual.position.copy(carroCorpo.position);
      carroVisual.quaternion.copy(carroCorpo.quaternion);
      policiais.forEach((policial) => {
        policial.visual.position.copy(policial.corpo.position);
        policial.visual.quaternion.copy(policial.corpo.quaternion);
      });
      anunciarStatus(
        `${nomeGrupo}, fase ${indice + 1}. ${obterTextoDesafio(fase)} Próximo bloco: ${fase.silabas[0]?.texto || ""}`.trim(),
      );

      estadoJogo = "jogando";
    }

    // ==========================================
    // 6. LÓGICA DO MOTOR
    // ==========================================
    const teclas = {};
    function definirTecla(code, ativa) {
      teclas[code] = ativa;
    }

    window.addEventListener("keydown", (e) => definirTecla(e.code, true));
    window.addEventListener("keyup", (e) => definirTecla(e.code, false));
    window.addEventListener("blur", zerarTeclas);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) zerarTeclas();
    });

    botoesSerie.forEach((botao) => {
      botao.addEventListener("click", () => {
        iniciarJogo(botao.dataset.fase);
      });
    });
    botoesCarro.forEach((botao) => {
      botao.addEventListener("click", () => {
        comprarOuSelecionarCarro(botao.dataset.carro);
      });
    });
    botaoRespawnManual?.addEventListener("click", () => {
      respawnJogadorEmPontoSeguro("manual");
    });
    carregarProgressoLocal();
    atualizarPainelPontos();
    atualizarGaragemUI();
    aplicarModeloCarro();
    atualizarIndicadorContato();

    function bindTouch(id, code) {
      if (!PERFIL_EXECUCAO.usarControlesTouch) return;
      const el = document.getElementById(id);
      if (!el) return;

      const ativar = (e) => {
        if (e) e.preventDefault();
        definirTecla(code, true);
        el.classList.add("ativo");
        el.setAttribute("aria-pressed", "true");
      };
      const desativar = (e) => {
        if (e) e.preventDefault();
        definirTecla(code, false);
        el.classList.remove("ativo");
        el.setAttribute("aria-pressed", "false");
      };

      el.addEventListener("touchstart", ativar, { passive: false });
      el.addEventListener("touchend", desativar, { passive: false });
      el.addEventListener("touchcancel", desativar, { passive: false });
      el.addEventListener("mousedown", ativar);
      el.addEventListener("mouseup", desativar);
      el.addEventListener("mouseleave", desativar);
    }
    bindTouch("btn-cima", "ArrowUp");
    bindTouch("btn-baixo", "ArrowDown");
    bindTouch("btn-esq", "ArrowLeft");
    bindTouch("btn-dir", "ArrowRight");

    const relogio = new THREE.Clock();
    let anguloMenu = 0;

    function estaNoChao(corpo) {
      for (let i = 0; i < mundoFisica.contacts.length; i++) {
        const contato = mundoFisica.contacts[i];
        let outroCorpo = null;

        if (contato.bi === corpo) {
          outroCorpo = contato.bj;
        } else if (contato.bj === corpo) {
          outroCorpo = contato.bi;
        }

        if (!outroCorpo || !corposDePiso.has(outroCorpo)) continue;
        if (Math.abs(contato.ni.y) > 0.15) return true;
      }
      return false;
    }

    function manterDentroDoMapa(corpo) {
      const limite = tamanhoMapa / 2 - 12;
      if (Math.abs(corpo.position.x) > limite) {
        corpo.position.x = THREE.MathUtils.clamp(
          corpo.position.x,
          -limite,
          limite,
        );
        corpo.velocity.x *= 0.15;
      }
      if (Math.abs(corpo.position.z) > limite) {
        corpo.position.z = THREE.MathUtils.clamp(
          corpo.position.z,
          -limite,
          limite,
        );
        corpo.velocity.z *= 0.15;
      }
    }

    function criarFogosSilaba(posicao, corHex, quantidade = 16) {
      const cor = new THREE.Color(corHex);
      for (let i = 0; i < quantidade; i++) {
        const escalaParticula = 0.22 + Math.random() * 0.12;
        const particula = new THREE.Mesh(
          geoParticulaFogos,
          new THREE.MeshBasicMaterial({
            color: cor,
            transparent: true,
            opacity: 1,
          }),
        );
        particula.position.copy(posicao);
        particula.scale.setScalar(escalaParticula);
        cena.add(particula);
        efeitosFogos.push({
          mesh: particula,
          escalaBase: escalaParticula,
          velocidade: new THREE.Vector3(
            (Math.random() - 0.5) * 8,
            4 + Math.random() * 6,
            (Math.random() - 0.5) * 8,
          ),
          vida: 0.7 + Math.random() * 0.4,
        });
      }
    }

    function atualizarFogos(delta) {
      for (let i = efeitosFogos.length - 1; i >= 0; i--) {
        const efeito = efeitosFogos[i];
        efeito.vida -= delta;
        if (efeito.vida <= 0) {
          cena.remove(efeito.mesh);
          if (efeito.mesh.geometry !== geoParticulaFogos) {
            efeito.mesh.geometry.dispose();
          }
          efeito.mesh.material.dispose();
          efeitosFogos.splice(i, 1);
          continue;
        }

        efeito.velocidade.y -= 12 * delta;
        efeito.mesh.position.x += efeito.velocidade.x * delta;
        efeito.mesh.position.y += efeito.velocidade.y * delta;
        efeito.mesh.position.z += efeito.velocidade.z * delta;
        efeito.mesh.material.opacity = Math.max(efeito.vida, 0);
        const escalaAtual =
          efeito.escalaBase * (0.8 + efeito.vida * 0.5);
        efeito.mesh.scale.setScalar(escalaAtual);
      }
    }

    function estaEmRampa(corpo) {
      for (let i = 0; i < mundoFisica.contacts.length; i++) {
        const contato = mundoFisica.contacts[i];
        const outroCorpo =
          contato.bi === corpo
            ? contato.bj
            : contato.bj === corpo
              ? contato.bi
              : null;
        if (outroCorpo && corposRampas.has(outroCorpo)) return true;
      }
      return false;
    }

    function reposicionarCarroSeCapotado(delta) {
      if (typeof reposicionarCarroSeCapotado.tempo !== "number")
        reposicionarCarroSeCapotado.tempo = 0;
      if (typeof reposicionarCarroSeCapotado.tempoCritico !== "number")
        reposicionarCarroSeCapotado.tempoCritico = 0;

      const cima = preencherVetorCima(carroCorpo, vetorCimaCapotagemTemp);
      const noChao = estaNoChao(carroCorpo);
      const velocidadeHorizontal = Math.hypot(
        carroCorpo.velocity.x,
        carroCorpo.velocity.z,
      );
      const velocidadeVertical = Math.abs(carroCorpo.velocity.y);
      const velocidadeAngular = Math.hypot(
        carroCorpo.angularVelocity.x,
        carroCorpo.angularVelocity.y,
        carroCorpo.angularVelocity.z,
      );
      const deLado = cima.y < 0.52;
      const invertido = cima.y < -0.08;
      const quaseParado =
        velocidadeHorizontal < 2.4 &&
        velocidadeVertical < 1.8 &&
        velocidadeAngular < 1.9;
      const travadoNoChao =
        noChao &&
        velocidadeHorizontal < 6.5 &&
        velocidadeVertical < 3.2 &&
        velocidadeAngular < 4.8;
      const capotadoPersistente =
        deLado && (travadoNoChao || quaseParado);
      const capotadoCritico =
        invertido &&
        (noChao || (quaseParado && carroCorpo.position.y < 8));

      if (capotadoPersistente) {
        reposicionarCarroSeCapotado.tempo += delta;
      } else {
        reposicionarCarroSeCapotado.tempo = Math.max(
          0,
          reposicionarCarroSeCapotado.tempo - delta * 2.5,
        );
      }

      if (capotadoCritico) {
        reposicionarCarroSeCapotado.tempoCritico += delta;
      } else {
        reposicionarCarroSeCapotado.tempoCritico = Math.max(
          0,
          reposicionarCarroSeCapotado.tempoCritico - delta * 3,
        );
      }

      const tempoLimiteCapotado = invertido
        ? Math.max(1.2, TEMPO_RESPAWN_CAPOTADO * 0.28)
        : Math.max(2.1, TEMPO_RESPAWN_CAPOTADO * 0.48);

      if (
        reposicionarCarroSeCapotado.tempoCritico >= 1.15 ||
        reposicionarCarroSeCapotado.tempo >= tempoLimiteCapotado
      ) {
        reposicionarCarroSeCapotado.tempo = 0;
        reposicionarCarroSeCapotado.tempoCritico = 0;
        respawnJogadorEmPontoSeguro("capotado");
      }
    }

    function limitarVelocidadeHorizontal(corpo, limite) {
      const velocidadeHorizontal = Math.hypot(
        corpo.velocity.x,
        corpo.velocity.z,
      );
      if (velocidadeHorizontal <= limite) return;

      const escala = limite / velocidadeHorizontal;
      corpo.velocity.x *= escala;
      corpo.velocity.z *= escala;
    }

    function aplicarForcaDirecional(corpo, intensidade) {
      const direcao = obterDirecaoFrente(corpo, direcaoForcaTemp);
      forcaAplicadaTemp.set(
        direcao.x * intensidade,
        0,
        direcao.z * intensidade,
      );
      corpo.applyForce(forcaAplicadaTemp, corpo.position);
    }

    function obterDirecaoFrente(corpo, destino) {
      const direcao = destino || new CANNON.Vec3();
      direcao.set(0, 0, -1);
      corpo.quaternion.vmult(direcao, direcao);
      return direcao;
    }

    function obterVelocidadeFrontal(corpo) {
      const frente = obterDirecaoFrente(corpo, direcaoFrontalTemp);
      return corpo.velocity.x * frente.x + corpo.velocity.z * frente.z;
    }

    function obterYawCorpo(corpo) {
      const frente = obterDirecaoFrente(corpo, direcaoYawTemp);
      return Math.atan2(frente.x, -frente.z);
    }

    function normalizarAngulo(angulo) {
      while (angulo > Math.PI) angulo -= Math.PI * 2;
      while (angulo < -Math.PI) angulo += Math.PI * 2;
      return angulo;
    }

    function limitarPontoAoMapa(x, z, margem = 18) {
      const limite = tamanhoMapa / 2 - margem;
      return {
        x: THREE.MathUtils.clamp(x, -limite, limite),
        z: THREE.MathUtils.clamp(z, -limite, limite),
      };
    }

    function endireitarCorpoNoYaw(corpo) {
      const yaw = obterYawCorpo(corpo);
      corpo.quaternion.setFromAxisAngle(eixoRotacaoY, yaw);
    }

    function aplicarTracaoLateral(corpo, intensidade = 0.86) {
      const frente = obterDirecaoFrente(corpo, direcaoTracaoTemp);
      lateralTracaoTemp.set(-frente.z, 0, frente.x);
      const velocidadeLateral =
        corpo.velocity.x * lateralTracaoTemp.x +
        corpo.velocity.z * lateralTracaoTemp.z;

      corpo.velocity.x -=
        lateralTracaoTemp.x * velocidadeLateral * intensidade;
      corpo.velocity.z -=
        lateralTracaoTemp.z * velocidadeLateral * intensidade;
    }

    function iniciarDerrota() {
      if (rodadaEncerrada) return;
      removerPontos(PENALIDADE_POLICIA);
      reiniciarTemporizadorDeObjetivo();
      rodadaEncerrada = true;
      estadoJogo = "derrota";
      ocultarSetaSilaba();
      mensagemDerrota.style.display = "block";
      vibrarLeve(120);
      mostrarMensagemHud(
        "Fuja da polícia! Você perdeu pontos!",
        "alerta",
      );
      anunciarStatus("Voce foi pego. A fase vai recomecar.");
      timeoutDerrota = setTimeout(() => {
        mensagemDerrota.style.display = "none";
        carregarFase(faseAtual);
      }, 3000);
    }

    function atualizarIApolicia({
      policial,
      corpo,
      visual,
      estado,
      alvo,
      delta,
      velMaxima,
      forcaFrente,
      forcaRe,
    }) {
      const vetorCima = preencherVetorCima(corpo, vetorCimaIApoliciaTemp);
      const orientado = vetorCima.y > 0.4;
      const noChao = orientado && estaNoChao(corpo);
      const planoIA = estado.planoAtual || {
        agressividade: 0.22,
        respostaCurva: 1,
        bonusVelocidade: 0,
        amortecimento: 0.988,
      };
      const alvoNavegavel = obterAlvoNavegacaoPolicial(
        policial,
        alvo,
        delta,
      );
      const policialTatico =
        contextoTaticoPolicia.ativa &&
        contextoTaticoPolicia.policialIndice === policial.indice;
      const multiplicadorTatico = policialTatico
        ? contextoTaticoPolicia.modo === "colisao"
          ? 1.06
          : 1.03
        : 1 +
          planoIA.agressividade * 0.06 +
          (planoIA.modoCerco ? 0.04 : 0) +
          (planoIA.modoCapturaDireta ? 0.05 : 0);
      const fatorSpawn = Math.min(
        estado.tempoSpawn > 0 ? (2.0 - estado.tempoSpawn) / 2.0 : 1,
        1,
      );
      estado.tempoSpawn = Math.max(0, estado.tempoSpawn - delta);
      const forcaFrenteProgressiva =
        forcaFrente *
        fatorSpawn *
        multiplicadorTatico *
        (1 + planoIA.bonusVelocidade * 0.1);
      // O teto de velocidade da polícia precisa respeitar o carro
      // escolhido pelo jogador. A IA pode variar na força e na curva,
      // mas não pode ultrapassar esse limite final.
      const velMaximaEfetiva = velMaxima;
      const velocidadeHorizontal = Math.hypot(
        corpo.velocity.x,
        corpo.velocity.z,
      );
      const velocidadeFrontal = obterVelocidadeFrontal(corpo);
      const alvoDx = alvoNavegavel.x - corpo.position.x;
      const alvoDz = alvoNavegavel.z - corpo.position.z;
      const distanciaAlvo = Math.hypot(alvoDx, alvoDz);
      const distJogador = Math.hypot(
        carroCorpo.position.x - corpo.position.x,
        carroCorpo.position.z - corpo.position.z,
      );
      const silabaAtual = obterSilabaAtual();
      const distSilaba =
        silabaAtual && !silabaAtual.coletada
          ? Math.hypot(
              silabaAtual.mesh.position.x - corpo.position.x,
              silabaAtual.mesh.position.z - corpo.position.z,
            )
          : Infinity;

      estado.tempoAereo = noChao ? 0 : estado.tempoAereo + delta;
      estado.tempoCapotado = orientado ? 0 : estado.tempoCapotado + delta;
      estado.tempoEstrategia = Math.max(
        0,
        estado.tempoEstrategia - delta,
      );
      estado.tempoDesgrudeJogador = Math.max(
        0,
        estado.tempoDesgrudeJogador - delta,
      );

      if (
        !Number.isFinite(corpo.position.x) ||
        !Number.isFinite(corpo.position.z) ||
        corpo.position.y < -5 ||
        corpo.position.y > 14 ||
        estado.tempoAereo > 1.4 ||
        estado.tempoCapotado > 0.9
      ) {
        return false;
      }

      if (!orientado && velocidadeHorizontal < 1.5) {
        corpo.position.y += 3;
        endireitarCorpoNoYaw(corpo);
        corpo.velocity.set(0, 0, 0);
        corpo.angularVelocity.set(0, 0, 0);
        resetarEstadoPolicia(estado);
        return true;
      }

      if (!noChao) {
        corpo.velocity.x *= 0.994;
        corpo.velocity.z *= 0.994;
        corpo.angularVelocity.x *= 0.82;
        corpo.angularVelocity.z *= 0.82;
        corpo.angularVelocity.y *= 0.95;
      } else {
        const anguloAlvo = Math.atan2(alvoDx, -alvoDz);
        const yawAtual = obterYawCorpo(corpo);
        const diffAngulo = normalizarAngulo(anguloAlvo - yawAtual);
        const anguloEscapeJogador = Math.atan2(
          corpo.position.x - carroCorpo.position.x,
          -(corpo.position.z - carroCorpo.position.z),
        );
        const diffEscapeJogador = normalizarAngulo(
          anguloEscapeJogador - yawAtual,
        );

        aplicarTracaoLateral(
          corpo,
          THREE.MathUtils.clamp(
            0.84 + planoIA.respostaCurva * 0.05,
            0.84,
            0.96,
          ),
        );
        corpo.angularVelocity.x = 0;
        corpo.angularVelocity.z = 0;

        if (estado.tempoDesgrudeJogador > 0) {
          corpo.angularVelocity.y = THREE.MathUtils.clamp(
            -diffEscapeJogador * 2.4,
            -2.4,
            2.4,
          );
          corpo.velocity.x +=
            (corpo.position.x - carroCorpo.position.x) *
            Math.min(0.02, delta * 0.14);
          corpo.velocity.z +=
            (corpo.position.z - carroCorpo.position.z) *
            Math.min(0.02, delta * 0.14);
          aplicarForcaDirecional(corpo, -forcaRe * 0.72);
          corpo.velocity.x *= 0.992;
          corpo.velocity.z *= 0.992;
          limitarVelocidadeHorizontal(corpo, velMaximaEfetiva * 0.34);
          visual.quaternion.copy(corpo.quaternion);
          if (typeof corpo.wakeUp === "function") corpo.wakeUp();
          return true;
        }

        if (
          estado.tempoRe <= 0 &&
          distanciaAlvo > 7 &&
          velocidadeHorizontal <
            (planoIA.modoCapturaDireta
              ? 4.6
              : planoIA.modoCerco
                ? 3.8
                : 3.1) &&
          Math.abs(velocidadeFrontal) < 1.05
        ) {
          estado.tempoTravado += delta;
        } else {
          estado.tempoTravado = Math.max(
            0,
            estado.tempoTravado - delta * 1.6,
          );
        }

        if (
          estado.tempoTravado >
          (planoIA.modoCapturaDireta
            ? 0.3
            : planoIA.modoCerco
              ? 0.55
              : 0.8)
        ) {
          estado.tempoRe = 0.42;
          estado.tempoTravado = 0;
          estado.direcaoRe = diffAngulo >= 0 ? -1 : 1;
        }

        if (estado.tempoRe > 0) {
          estado.tempoRe -= delta;
          corpo.angularVelocity.y = estado.direcaoRe * 1.35;
          aplicarForcaDirecional(corpo, -forcaRe);
          corpo.velocity.x *= 0.992;
          corpo.velocity.z *= 0.992;
          limitarVelocidadeHorizontal(corpo, velMaximaEfetiva * 0.42);
        } else {
          if (distanciaAlvo > 2.5 || planoIA.modoCapturaDireta) {
            const agressividadeJogador = THREE.MathUtils.clamp(
              1 - distJogador / 24,
              0,
              1,
            );
            const agressividadeSilaba = THREE.MathUtils.clamp(
              1 - distSilaba / 16,
              0,
              1,
            );
            const impulsoTatico = THREE.MathUtils.clamp(
              Math.max(
                agressividadeJogador,
                contextoTaticoPolicia.policialIndice === policial.indice
                  ? agressividadeSilaba
                  : 0,
              ) + planoIA.agressividade,
              0,
              1.18,
            );
            const intensidadeCurva = THREE.MathUtils.clamp(
              Math.abs(diffAngulo) / Math.PI,
              0,
              1,
            );
            const fatorCurva = Math.max(
              planoIA.modoCapturaDireta ? 0.6 : 0.44,
              1 - intensidadeCurva * (0.58 - impulsoTatico * 0.16),
            );
            corpo.angularVelocity.y = THREE.MathUtils.clamp(
              -diffAngulo *
                (3.2 + impulsoTatico * 1.15) *
                planoIA.respostaCurva,
              -(3.5 + impulsoTatico * 1.3),
              3.5 + impulsoTatico * 1.3,
            );

            if (velocidadeHorizontal < velMaximaEfetiva) {
              aplicarForcaDirecional(
                corpo,
                forcaFrenteProgressiva *
                  fatorCurva *
                  (1 + impulsoTatico * 0.24) *
                  (planoIA.modoCapturaDireta ? 1.18 : 1),
              );
            }
            corpo.velocity.x *= Math.min(
              0.997,
              planoIA.amortecimento + impulsoTatico * 0.003,
            );
            corpo.velocity.z *= Math.min(
              0.997,
              planoIA.amortecimento + impulsoTatico * 0.003,
            );
          } else {
            corpo.velocity.x *= 0.9;
            corpo.velocity.z *= 0.9;
          }
        }
      }

      visual.quaternion.copy(corpo.quaternion);
      limitarVelocidadeHorizontal(corpo, velMaximaEfetiva);
      if (corpo.position.y < -5) return false;
      if (typeof corpo.wakeUp === "function") corpo.wakeUp();
      return true;
    }

    function estabilizarPolicia(corpo, delta) {
      const vetorCima = preencherVetorCima(
        corpo,
        vetorCimaEstabilizacaoTemp,
      );
      const noChao = estaNoChao(corpo);

      corpo.angularVelocity.x *= noChao ? 0.18 : 0.48;
      corpo.angularVelocity.z *= noChao ? 0.18 : 0.48;
      corpo.angularVelocity.y = THREE.MathUtils.clamp(
        corpo.angularVelocity.y,
        -1.9,
        1.9,
      );

      if (corpo.velocity.y > 6.5) corpo.velocity.y = 6.5;
      if (corpo.velocity.y < -20) corpo.velocity.y = -20;

      if (!noChao) {
        corpo.velocity.x *= 0.994;
        corpo.velocity.z *= 0.994;
        return;
      }

      if (vetorCima.y < 0.45) {
        corpo.angularVelocity.x = 0;
        corpo.angularVelocity.z = 0;
        corpo.velocity.y = Math.min(corpo.velocity.y, 1.6);
        corpo.position.y = Math.max(corpo.position.y, 2.6);
        endireitarCorpoNoYaw(corpo);
        corpo.velocity.x *= 0.94;
        corpo.velocity.z *= 0.94;
      }
    }

    function garantirPresencaPolicias(delta) {
      if (rodadaEncerrada) return;
      tempoReforcoPolicia += delta;
      if (tempoReforcoPolicia < 0.35) return;
      tempoReforcoPolicia = 0;
      const carroAtual = obterCarroAtual();

      policiais.forEach((policial, indice) => {
        if (indice >= totalPoliciasAtivas) {
          policial.visual.visible = false;
          if (policial.corpo.position.y > -40) {
            resetarCorpo(policial.corpo, 0, -60, 0);
          }
          resetarEstadoPolicia(policial.estado);
          return;
        }
        policial.visual.visible = true;
        const velocidadeLimitePolicial = obterVelocidadeMaximaPolicial(
          policial,
          carroAtual,
        );
        const dx = policial.corpo.position.x - carroCorpo.position.x;
        const dz = policial.corpo.position.z - carroCorpo.position.z;
        const distancia = Math.hypot(dx, dz);
        const vetorCima = preencherVetorCima(
          policial.corpo,
          vetorCimaPresencaTemp,
        );
        const velocidadeHorizontal = Math.hypot(
          policial.corpo.velocity.x,
          policial.corpo.velocity.z,
        );
        const limiteMapa = tamanhoMapa / 2 - 10;
        const invalida =
          policial.corpo.position.y < -5 ||
          policial.corpo.position.y > 14 ||
          !Number.isFinite(policial.corpo.position.x) ||
          !Number.isFinite(policial.corpo.position.z) ||
          Math.abs(policial.corpo.position.x) > limiteMapa ||
          Math.abs(policial.corpo.position.z) > limiteMapa ||
          distancia > 180 ||
          velocidadeHorizontal >
            Math.max(velocidadeLimitePolicial, 18) * 1.9 ||
          Math.abs(policial.corpo.angularVelocity.x) > 5 ||
          Math.abs(policial.corpo.angularVelocity.z) > 5 ||
          policial.estado.tempoAereo > 1.2 ||
          policial.estado.tempoCapotado > 0.85 ||
          vetorCima.y < -0.1;
        if (invalida) reposicionarPolicia(policial, indice);
      });
    }

    function animar() {
      requestAnimationFrame(animar);
      const delta = Math.min(
        relogio.getDelta(),
        CONFIG_OTIMIZACAO.deltaMaximo,
      );
      const tempoAgora = performance.now() * 0.012;

      policiais.forEach((policial, indice) => {
        const intensidadeBase = policial.visual.visible ? 1 : 0;
        const fase = tempoAgora + indice * 0.9;
        const pulsoA = Math.max(0.18, Math.sin(fase) * 0.5 + 0.5);
        const pulsoB = Math.max(
          0.18,
          Math.sin(fase + Math.PI) * 0.5 + 0.5,
        );

        if (policial.sireneA?.material) {
          policial.sireneA.material.opacity = 0.25 + pulsoA * 0.75;
        }
        if (policial.sireneB?.material) {
          policial.sireneB.material.opacity = 0.25 + pulsoB * 0.75;
        }
        if (policial.luzSireneA) {
          policial.luzSireneA.intensity =
            intensidadeBase * (0.4 + pulsoA * 2.2);
        }
        if (policial.luzSireneB) {
          policial.luzSireneB.intensity =
            intensidadeBase * (0.4 + pulsoB * 2.2);
        }
      });

      // Limpa a tela inteira com a cor do céu
      renderizador.clear();

      if (estadoJogo === "menu") {
        ocultarSetaSilaba();
        marcadorObjetivo3D.visible = false;
        helicopteroPolicia.visible = false;
        limparProjeteisHelicoptero();
        if (efeitoVelocidade) efeitoVelocidade.style.opacity = "0";
        if (impactoOverlay) impactoOverlay.style.opacity = "0";
        if (radarCtx && radarCanvas) {
          radarCtx.clearRect(
            0,
            0,
            radarCanvas.clientWidth || 0,
            radarCanvas.clientHeight || 0,
          );
        }
        anguloMenu += CONFIG_CONFORTO_MOVIMENTO.rotacaoMenu * delta;
        camera.position.x = Math.sin(anguloMenu) * 80;
        camera.position.z = Math.cos(anguloMenu) * 80;
        camera.position.y = 40;
        camera.lookAt(0, 0, 0);
        renderizador.setViewport(0, 0, larguraViewport, alturaViewport);
        renderizador.setScissor(0, 0, larguraViewport, alturaViewport);
        renderizador.setScissorTest(true);
        renderizador.render(cena, camera);
        return;
      }

      if (estadoJogo === "jogando") {
        const carroAtual = obterCarroAtual();
        velMaxPolicia = carroAtual.velocidadeMaxima * 0.9;
        for (let indice = 0; indice < totalPoliciasAtivas; indice++) {
          velMaxPolicia = Math.max(
            velMaxPolicia,
            obterVelocidadeMaximaPolicial(policiais[indice], carroAtual),
          );
        }
        cooldownRampa = Math.max(0, cooldownRampa - delta);
        cooldownRespawnJogador = Math.max(
          0,
          cooldownRespawnJogador - delta,
        );
        atrasoPoliciaRestante = Math.max(
          0,
          atrasoPoliciaRestante - delta,
        );
        cooldownImpactoColisao = Math.max(
          0,
          cooldownImpactoColisao - delta,
        );
        atualizarPunicaoPorInatividade(delta);
        acumuladorAnalisePolicial += delta;
        intensidadeImpactoVisual = Math.max(
          0,
          intensidadeImpactoVisual - delta * 2.8,
        );
        if (impactoOverlay) {
          impactoOverlay.style.opacity =
            intensidadeImpactoVisual.toFixed(3);
        }
        const vetorCima = preencherVetorCima(
          carroCorpo,
          vetorCimaAnimacaoTemp,
        );
        reposicionarCarroSeCapotado(delta);

        // Movimento do Jogador
        const tocandoChao = estaNoChao(carroCorpo);
        const carroEmPosicaoValida = tocandoChao && vetorCima.y > 0.72;
        const velocidadeFrontal = obterVelocidadeFrontal(carroCorpo);

        if (carroEmPosicaoValida) {
          carroCorpo.angularVelocity.x = 0;
          carroCorpo.angularVelocity.z = 0;
          aplicarTracaoLateral(carroCorpo, carroAtual.tracao);

          const fatorMovimento = Math.min(
            Math.abs(velocidadeFrontal) / 10,
            1.0,
          );
          const direcaoSinal = velocidadeFrontal < -0.5 ? -1 : 1;
          const curvaDesejada =
            (teclas["ArrowLeft"] ? carroAtual.curva : 0) -
            (teclas["ArrowRight"] ? carroAtual.curva : 0);
          carroCorpo.angularVelocity.y =
            curvaDesejada * fatorMovimento * direcaoSinal;

          if (teclas["ArrowUp"]) {
            aplicarForcaDirecional(carroCorpo, carroAtual.aceleracao);
          } else if (teclas["ArrowDown"]) {
            aplicarForcaDirecional(carroCorpo, -carroAtual.freio);
          } else {
            carroCorpo.velocity.x *= 0.985;
            carroCorpo.velocity.z *= 0.985;
          }
        } else {
          carroCorpo.velocity.x *= 0.992;
          carroCorpo.velocity.z *= 0.992;
          carroCorpo.angularVelocity.x = 0;
          carroCorpo.angularVelocity.z = 0;
          carroCorpo.angularVelocity.y *= 0.82;
        }
        limitarVelocidadeHorizontal(
          carroCorpo,
          carroAtual.velocidadeMaxima,
        );
        if (
          cooldownRampa <= 0 &&
          estaEmRampa(carroCorpo) &&
          vetorCima.y > 0.68
        ) {
          const frenteRampa = obterDirecaoFrente(
            carroCorpo,
            direcaoRampaTemp,
          );
          carroCorpo.velocity.x +=
            frenteRampa.x *
            carroAtual.impulsoRampa *
            CONFIG_CONFORTO_MOVIMENTO.fatorSaltoRampa;
          carroCorpo.velocity.z +=
            frenteRampa.z *
            carroAtual.impulsoRampa *
            CONFIG_CONFORTO_MOVIMENTO.fatorSaltoRampa;
          carroCorpo.velocity.y = Math.max(
            carroCorpo.velocity.y,
            carroAtual.saltoRampa *
              CONFIG_CONFORTO_MOVIMENTO.fatorSaltoRampa,
          );
          cooldownRampa = 1.1;
        }

        if (
          acumuladorAnalisePolicial >=
          CONFIG_OTIMIZACAO.intervaloAnalisePolicial
        ) {
          atualizarContextoTaticoPolicia();
          acumuladorAnalisePolicial = 0;
        }

        // IA da Polícia — usa força em vez de setar velocidade direta,
        // para que o corpo físico respeite colisões com obstáculos
        if (!rodadaEncerrada && atrasoPoliciaRestante <= 0) {
          policiais.forEach((policial, indice) => {
            if (indice >= totalPoliciasAtivas) {
              policial.visual.visible = false;
              if (policial.corpo.position.y > -40) {
                resetarCorpo(policial.corpo, 0, -60, 0);
              }
              resetarEstadoPolicia(policial.estado);
              return;
            }

            const iaEstavel = atualizarIApolicia({
              policial,
              corpo: policial.corpo,
              visual: policial.visual,
              estado: policial.estado,
              alvo: calcularAlvoPolicial(policial),
              delta,
              velMaxima: obterVelocidadeMaximaPolicial(
                policial,
                carroAtual,
              ),
              forcaFrente: obterForcaFrentePolicial(policial),
              forcaRe: obterForcaRePolicial(policial),
            });
            if (!iaEstavel) reposicionarPolicia(policial, indice);
          });
        }

        const carroEmRampa = estaEmRampa(carroCorpo);
        mundoFisica.step(
          carroEmRampa
            ? CONFIG_OTIMIZACAO.passoFisica * 0.75
            : CONFIG_OTIMIZACAO.passoFisica,
          Math.min(delta, CONFIG_OTIMIZACAO.deltaMaximo),
          CONFIG_OTIMIZACAO.maxSubstepsFisica + (carroEmRampa ? 3 : 0),
        );
        atualizarFogos(delta);
        garantirPresencaPolicias(delta);
        aliviarContatoComPolicia(delta);
        atualizarCapturaPorContato(delta);
        manterDentroDoMapa(carroCorpo);
        policiais.forEach((policial) => {
          estabilizarPolicia(policial.corpo, delta);
          manterDentroDoMapa(policial.corpo);
        });
        carroVisual.position.copy(carroCorpo.position);
        carroVisual.quaternion.copy(carroCorpo.quaternion);
        policiais.forEach((policial) => {
          policial.visual.position.copy(policial.corpo.position);
          policial.visual.quaternion.copy(policial.corpo.quaternion);
        });
        atualizarMarcadorObjetivo3D(tempoAgora);
        atualizarHelicopteroPolicial(delta, tempoAgora);
        atualizarProjeteisHelicoptero(delta);

        // Sílabas — coleta em ordem, revela próxima ao coletar atual
        const agora = performance.now();

        for (let i = 0; i < silabasAtivas.length; i++) {
          const silaba = silabasAtivas[i];
          if (silaba.coletada) continue;

          // Anima apenas a sílaba ativa (próxima a coletar)
          if (i === proximaSilaba) {
            silaba.mesh.rotation.y += 0.025;
            // Pulsação de escala para chamar atenção
            const pulso = 2 + Math.sin(agora * 0.004) * 0.16;
            silaba.mesh.scale.set(pulso, pulso, pulso);
            silaba.luz.intensity = 4.6 + Math.sin(agora * 0.005) * 0.8;
            if (silaba.mesh.material?.emissive) {
              silaba.mesh.material.emissive.set(silaba.corHex);
              silaba.mesh.material.emissiveIntensity =
                grupoFaseAtual === "facil" ? 0.55 : 0.72;
            }

            const flutuacao = Math.sin(agora * 0.002) * 0.3;
            silaba.mesh.position.y = silaba.yBase + flutuacao;
            silaba.luz.position.y = silaba.yBase + flutuacao;

            // Verifica coleta
            const dxSilaba =
              carroVisual.position.x - silaba.mesh.position.x;
            const dzSilaba =
              carroVisual.position.z - silaba.mesh.position.z;
            if (dxSilaba * dxSilaba + dzSilaba * dzSilaba < 16) {
              criarFogosSilaba(silaba.mesh.position, silaba.corHex);
              adicionarPontos(PONTOS_POR_BLOCO);
              reiniciarTemporizadorDeObjetivo();
              silaba.coletada = true;
              cena.remove(silaba.mesh);
              cena.remove(silaba.luz);
              proximaSilaba++;
              atualizarObjetivoHUD();
              mostrarMensagemHud(
                proximaSilaba < silabasAtivas.length
                  ? "Boa! Colete o próximo bloco!"
                  : "Boa! Palavra completa!",
                "boa",
              );

              // Revela a próxima sílaba com animação de surgimento
              if (proximaSilaba < silabasAtivas.length) {
                const proxima = silabasAtivas[proximaSilaba];
                proxima.mesh.scale.set(0.01, 0.01, 0.01);
                proxima.luz.intensity = 2;
                // Anima scale de 0 → 1 suavemente no próximo frame
                proxima._surgindo = true;
              }
              atualizarHUD();
              vibrarLeve();
              anunciarStatus(
                proximaSilaba < silabasAtivas.length
                  ? `Bloco ${silaba.texto} coletado. Próximo bloco: ${silabasAtivas[proximaSilaba].texto}.`
                  : `Palavra ${niveisAtuais[faseAtual]?.palavra || ""} completa.`,
              );
            }
          } else if (silaba._surgindo) {
            // Animação de surgimento: escala cresce até 1
            const s = silaba.mesh.scale.x;
            if (s < 0.99) {
              const novo = s + (1 - s) * 0.12;
              silaba.mesh.scale.set(novo, novo, novo);
            } else {
              silaba.mesh.scale.set(1, 1, 1);
              silaba._surgindo = false;
            }
          }
          if (i !== proximaSilaba && silaba.mesh.material?.emissive) {
            silaba.mesh.material.emissive.set("#000000");
            silaba.mesh.material.emissiveIntensity = 0;
          }
        }

        if (
          silabasAtivas.length > 0 &&
          proximaSilaba >= silabasAtivas.length &&
          !rodadaEncerrada
        ) {
          rodadaEncerrada = true;
          estadoJogo = "transicao";
          ocultarSetaSilaba();
          const palavraFormada = niveisAtuais[faseAtual].palavra;
          exibirVitoria(
            `${bancoDeFases[grupoFaseAtual]?.nome || "Fase"} ${faseAtual + 1} concluída!`,
            palavraFormada,
          );
          timeoutVitoria = setTimeout(() => {
            mensagemVitoria.style.display = "none";
            faseAtual++;
            carregarFase(faseAtual);
          }, 3000);
        }
      }

      if (estadoJogo !== "jogando") {
        ocultarSetaSilaba();
        marcadorObjetivo3D.visible = false;
        helicopteroPolicia.visible = false;
        limparProjeteisHelicoptero();
      }

      if (estadoJogo !== "menu") {
        // RENDERIZAÇÃO 1: Câmera Principal (Tela Cheia)
        const carroAtual = obterCarroAtual();
        const velocidadeAtual = Math.hypot(
          carroCorpo.velocity.x,
          carroCorpo.velocity.z,
        );
        const fatorVelocidade = THREE.MathUtils.clamp(
          velocidadeAtual / Math.max(carroAtual.velocidadeMaxima, 1),
          0,
          1,
        );
        cameraOffsetTemp.set(
          0,
          carroAtual.cameraAltura,
          carroAtual.cameraDistancia,
        );
        cameraOffsetTemp.applyQuaternion(carroVisual.quaternion);
        destinoCameraTemp
          .copy(carroVisual.position)
          .add(cameraOffsetTemp);
        destinoAlvoTemp.set(
          carroVisual.position.x,
          carroVisual.position.y + 2,
          carroVisual.position.z,
        );
        const suavizacaoCamera = THREE.MathUtils.clamp(
          delta * CONFIG_CONFORTO_MOVIMENTO.suavizacaoCamera,
          0.06,
          0.2,
        );
        const suavizacaoAlvo = THREE.MathUtils.clamp(
          delta * CONFIG_CONFORTO_MOVIMENTO.suavizacaoAlvo,
          0.05,
          0.18,
        );
        if (cameraPosicaoSuave.lengthSq() === 0) {
          cameraPosicaoSuave.copy(destinoCameraTemp);
          cameraAlvoSuave.copy(destinoAlvoTemp);
        }
        cameraPosicaoSuave.lerp(destinoCameraTemp, suavizacaoCamera);
        cameraAlvoSuave.lerp(destinoAlvoTemp, suavizacaoAlvo);
        const fovAlvo =
          CONFIG_CONFORTO_MOVIMENTO.fovBase +
          fatorVelocidade * CONFIG_CONFORTO_MOVIMENTO.fovExtra;
        if (Math.abs(camera.fov - fovAlvo) > 0.05) {
          camera.fov +=
            (fovAlvo - camera.fov) * Math.min(0.1, delta * 3.4);
          camera.updateProjectionMatrix();
        }
        if (efeitoVelocidade) {
          efeitoVelocidade.style.opacity = Math.max(
            0,
            (fatorVelocidade - CONFIG_CONFORTO_MOVIMENTO.overlayInicio) *
              CONFIG_CONFORTO_MOVIMENTO.overlayIntensidade,
          ).toFixed(3);
        }
        camera.position.copy(cameraPosicaoSuave);
        camera.lookAt(cameraAlvoSuave);

        renderizador.setViewport(0, 0, larguraViewport, alturaViewport);
        renderizador.setScissor(0, 0, larguraViewport, alturaViewport);
        renderizador.setScissorTest(true);
        renderizador.render(cena, camera);

        if (EXIBIR_HUD_SECUNDARIA && !hudCompactaAtiva) {
          const larguraMapa = Math.max(
            1,
            tamanhoMiniMapa - CONFIG_RADAR_REAL.inset * 2,
          );
          const alturaMapa = Math.max(
            1,
            tamanhoMiniMapa - CONFIG_RADAR_REAL.inset * 2,
          );
          const origemMapaX =
            Math.max(10, larguraViewport - tamanhoMiniMapa - 20) +
            CONFIG_RADAR_REAL.inset;
          const origemMapaY = 20 + CONFIG_RADAR_REAL.inset;
          const alcanceMapa =
            tamanhoMapa / 2 + CONFIG_RADAR_REAL.folgaMapa;
          cameraMiniMapa.left = -alcanceMapa;
          cameraMiniMapa.right = alcanceMapa;
          cameraMiniMapa.top = alcanceMapa;
          cameraMiniMapa.bottom = -alcanceMapa;
          cameraMiniMapa.position.set(0, CONFIG_RADAR_REAL.altitude, 0);
          cameraMiniMapa.lookAt(0, 0, 0);
          cameraMiniMapa.updateProjectionMatrix();

          renderizador.setViewport(
            origemMapaX,
            origemMapaY,
            larguraMapa,
            alturaMapa,
          );
          renderizador.setScissor(
            origemMapaX,
            origemMapaY,
            larguraMapa,
            alturaMapa,
          );
          renderizador.setScissorTest(true);
          renderizador.clearDepth();
          const neblinaRadar = cena.fog;
          cena.fog = null;
          renderizador.render(cena, cameraMiniMapa);
          cena.fog = neblinaRadar;
          renderizador.setScissorTest(false);
          atualizarRadar(delta);
        } else {
          renderizador.setScissorTest(false);
          if (radarCtx && radarCanvas) {
            radarCtx.clearRect(
              0,
              0,
              radarCanvas.clientWidth || 0,
              radarCanvas.clientHeight || 0,
            );
          }
        }
        atualizarSetaSilaba();
      } else if (radarCtx && radarCanvas) {
        radarCtx.clearRect(
          0,
          0,
          radarCanvas.clientWidth || 0,
          radarCanvas.clientHeight || 0,
        );
      }
    }

    window.addEventListener("resize", atualizarLayoutResponsivo);
    if (window.visualViewport && !PERFIL_EXECUCAO.firefoxIframe) {
      window.visualViewport.addEventListener(
        "resize",
        atualizarLayoutResponsivo,
      );
    }

    animar();
  } catch (erro) {
    console.error(erro);
    window.exibirErroDeInicializacaoJogo?.(
      "O jogo encontrou um erro ao iniciar. Recarregue a pagina para tentar novamente.",
      erro?.message || String(erro),
    );
  }
})();
