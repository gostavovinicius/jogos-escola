(() => {
  const grid = document.querySelector("[data-random-games]");
  if (!grid) return;

  const maxShow = Math.max(1, Number(grid.dataset.maxShow || "15"));
  const usarCicloMensal = grid.dataset.monthlyRareGames === "true";
  const jogosRaros = [
    { id: "mario", padrao: /mario/i, chance: 0.1, semana: 1 },
    {
      id: "corrida-do-saber",
      padrao: /corrida-do-saber|corrida do saber/i,
      chance: 0.1,
      semana: 3,
    },
  ];

  function shuffle(items) {
    for (let i = items.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }

  function regraRaraDoCard(card) {
    const href = card.getAttribute("href") || "";
    const titulo = card.querySelector("h3")?.textContent || "";
    const texto = `${href} ${titulo}`;
    return jogosRaros.find(({ padrao }) => padrao.test(texto));
  }

  function obterSemanaDoMes(data = new Date()) {
    return Math.min(4, Math.ceil(data.getDate() / 7));
  }

  function deveMostrarJogoRaro(regra) {
    if (!usarCicloMensal) return Math.random() < regra.chance;

    const agora = new Date();
    const semana = obterSemanaDoMes(agora);
    if (semana !== regra.semana) return false;

    const periodo = `${agora.getFullYear()}-${agora.getMonth() + 1}-${semana}`;
    const chave = `catalogo:raro:${regra.id}:${periodo}`;

    try {
      const decisaoSalva = localStorage.getItem(chave);
      if (decisaoSalva !== null) return decisaoSalva === "1";

      const mostrar = Math.random() < regra.chance;
      localStorage.setItem(chave, mostrar ? "1" : "0");
      return mostrar;
    } catch {
      return Math.random() < regra.chance;
    }
  }

  function escolherCards(cards) {
    const raros = [];
    const comuns = [];

    cards.forEach((card) => {
      const regra = regraRaraDoCard(card);
      if (regra) {
        raros.push({ card, regra });
        return;
      }
      comuns.push(card);
    });

    const limite = Math.min(maxShow, cards.length);
    const rarosEscolhidos = raros
      .filter(({ regra }) => deveMostrarJogoRaro(regra))
      .map(({ card }) => card);
    const espacoParaComuns = Math.max(0, limite - rarosEscolhidos.length);
    const escolhidos = shuffle(comuns.slice()).slice(0, espacoParaComuns);

    return shuffle([...escolhidos, ...rarosEscolhidos]);
  }

  function atualizarGrid() {
    const cards = Array.from(grid.querySelectorAll(".game-card"));
    const escolhidos = escolherCards(cards);
    grid.replaceChildren(...escolhidos);
  }

  window.addEventListener("pageshow", atualizarGrid);
})();
