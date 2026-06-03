(() => {
  const grid = document.querySelector("[data-random-games]");
  if (!grid) return;

  const maxShow = Math.max(1, Number(grid.dataset.maxShow || "15"));
  const jogosRaros = [
    { padrao: /mario/i, chance: 0.1 },
    { padrao: /corrida-do-saber|corrida do saber/i, chance: 0.1 },
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
      .filter(({ regra }) => Math.random() < regra.chance)
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
