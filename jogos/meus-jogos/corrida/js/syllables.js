/* Corrida do Saber - Banco de fases e silabas */

(() => {
  const CORES_BLOCOS = [
    "#FFEA00",
    "#FF5252",
    "#18FFFF",
    "#69F0AE",
    "#EA80FC",
    "#FFD740",
  ];
  const PONTOS_POR_BLOCO = 10;
  const PENALIDADE_POLICIA = 20;

  function criarBlocos(textos) {
    return textos.map((texto, indice) => ({
      texto,
      cor: CORES_BLOCOS[indice % CORES_BLOCOS.length],
    }));
  }

  const bancoDeFases = {
    facil: {
      nome: "Fase Fácil",
      descricao: "Palavras com vogal inicial",
      destaque: true,
      multiplicadorMapa: 0.72,
      pressaoPolicia: 0.42,
      fases: [
        {
          palavra: "ABELHA",
          emoji: "🐝",
          desafio: "_BELHA",
          silabas: criarBlocos(["A"]),
        },
        {
          palavra: "AVIÃO",
          emoji: "✈️",
          desafio: "_VIÃO",
          silabas: criarBlocos(["A"]),
        },
        {
          palavra: "ÁRVORE",
          emoji: "🌳",
          desafio: "_RVORE",
          silabas: criarBlocos(["Á"]),
        },
        {
          palavra: "AMIGO",
          emoji: "😊",
          desafio: "_MIGO",
          silabas: criarBlocos(["A"]),
        },
        {
          palavra: "ANEL",
          emoji: "💍",
          desafio: "_NEL",
          silabas: criarBlocos(["A"]),
        },
        {
          palavra: "ELEFANTE",
          emoji: "🐘",
          desafio: "_LEFANTE",
          silabas: criarBlocos(["E"]),
        },
        {
          palavra: "ESCADA",
          emoji: "🪜",
          desafio: "_SCADA",
          silabas: criarBlocos(["E"]),
        },
        {
          palavra: "ESCOLA",
          emoji: "🏫",
          desafio: "_SCOLA",
          silabas: criarBlocos(["E"]),
        },
        {
          palavra: "ESTRELA",
          emoji: "⭐",
          desafio: "_STRELA",
          silabas: criarBlocos(["E"]),
        },
        {
          palavra: "ILHA",
          emoji: "🏝️",
          desafio: "_LHA",
          silabas: criarBlocos(["I"]),
        },
        {
          palavra: "IGREJA",
          emoji: "⛪",
          desafio: "_GREJA",
          silabas: criarBlocos(["I"]),
        },
        {
          palavra: "ÍNDIO",
          emoji: "🏹",
          desafio: "_NDIO",
          silabas: criarBlocos(["Í"]),
        },
        {
          palavra: "OVO",
          emoji: "🥚",
          desafio: "_VO",
          silabas: criarBlocos(["O"]),
        },
        {
          palavra: "OLHO",
          emoji: "👁️",
          desafio: "_LHO",
          silabas: criarBlocos(["O"]),
        },
        {
          palavra: "URSO",
          emoji: "🐻",
          desafio: "_RSO",
          silabas: criarBlocos(["U"]),
        },
      ],
    },
    media: {
      nome: "Fase Média",
      descricao: "Palavras com sílabas simples",
      destaque: false,
      multiplicadorMapa: 1,
      pressaoPolicia: 0.5,
      fases: [
        {
          palavra: "BOLA",
          emoji: "⚽",
          silabas: criarBlocos(["BO", "LA"]),
        },
        {
          palavra: "CASA",
          emoji: "🏠",
          silabas: criarBlocos(["CA", "SA"]),
        },
        {
          palavra: "BOLO",
          emoji: "🎂",
          silabas: criarBlocos(["BO", "LO"]),
        },
        {
          palavra: "PATO",
          emoji: "🦆",
          silabas: criarBlocos(["PA", "TO"]),
        },
        {
          palavra: "GATO",
          emoji: "🐱",
          silabas: criarBlocos(["GA", "TO"]),
        },
        {
          palavra: "VELA",
          emoji: "🕯️",
          silabas: criarBlocos(["VE", "LA"]),
        },
        {
          palavra: "FADA",
          emoji: "🧚",
          silabas: criarBlocos(["FA", "DA"]),
        },
        {
          palavra: "LOBO",
          emoji: "🐺",
          silabas: criarBlocos(["LO", "BO"]),
        },
        {
          palavra: "SAPO",
          emoji: "🐸",
          silabas: criarBlocos(["SA", "PO"]),
        },
        {
          palavra: "DADO",
          emoji: "🎲",
          silabas: criarBlocos(["DA", "DO"]),
        },
        {
          palavra: "RATO",
          emoji: "🐭",
          silabas: criarBlocos(["RA", "TO"]),
        },
        {
          palavra: "BONECA",
          emoji: "🧸",
          silabas: criarBlocos(["BO", "NE", "CA"]),
        },
        {
          palavra: "CAMA",
          emoji: "🛏️",
          silabas: criarBlocos(["CA", "MA"]),
        },
        {
          palavra: "MESA",
          emoji: "🪑",
          silabas: criarBlocos(["ME", "SA"]),
        },
        {
          palavra: "LATA",
          emoji: "🥫",
          silabas: criarBlocos(["LA", "TA"]),
        },
      ],
    },
    dificil: {
      nome: "Fase Difícil",
      descricao: "Palavras com sílabas complexas",
      destaque: false,
      multiplicadorMapa: 1.55,
      pressaoPolicia: 0.58,
      fases: [
        {
          palavra: "BRUXA",
          emoji: "🧙",
          silabas: criarBlocos(["BRU", "XA"]),
        },
        {
          palavra: "PRATO",
          emoji: "🍽️",
          silabas: criarBlocos(["PRA", "TO"]),
        },
        {
          palavra: "BLUSA",
          emoji: "👚",
          silabas: criarBlocos(["BLU", "SA"]),
        },
        {
          palavra: "TRATOR",
          emoji: "🚜",
          silabas: criarBlocos(["TRA", "TOR"]),
        },
        {
          palavra: "FLOR",
          emoji: "🌸",
          silabas: criarBlocos(["FLOR"]),
        },
        {
          palavra: "FRUTA",
          emoji: "🍎",
          silabas: criarBlocos(["FRU", "TA"]),
        },
        {
          palavra: "DRAGÃO",
          emoji: "🐉",
          silabas: criarBlocos(["DRA", "GÃO"]),
        },
        {
          palavra: "CRIANÇA",
          emoji: "👧",
          silabas: criarBlocos(["CRI", "AN", "ÇA"]),
        },
        {
          palavra: "ESTRELA",
          emoji: "⭐",
          silabas: criarBlocos(["ES", "TRE", "LA"]),
        },
        {
          palavra: "PLANTA",
          emoji: "🪴",
          silabas: criarBlocos(["PLAN", "TA"]),
        },
        {
          palavra: "TIGRE",
          emoji: "🐅",
          silabas: criarBlocos(["TI", "GRE"]),
        },
        {
          palavra: "LIVRO",
          emoji: "📘",
          silabas: criarBlocos(["LI", "VRO"]),
        },
        {
          palavra: "TREM",
          emoji: "🚂",
          silabas: criarBlocos(["TREM"]),
        },
        {
          palavra: "CHUVA",
          emoji: "🌧️",
          silabas: criarBlocos(["CHU", "VA"]),
        },
        {
          palavra: "GRANDE",
          emoji: "🏔️",
          silabas: criarBlocos(["GRAN", "DE"]),
        },
      ],
    },
  };

  const fasesPorPalavra = new Map();
  Object.values(bancoDeFases).forEach((grupo) => {
    grupo.fases.forEach((fase) => {
      fasesPorPalavra.set(fase.palavra, fase);
    });
  });

  window.CorridaDoSaberSyllables = {
    CORES_BLOCOS,
    PONTOS_POR_BLOCO,
    PENALIDADE_POLICIA,
    bancoDeFases,
    fasesPorPalavra,
  };
})();