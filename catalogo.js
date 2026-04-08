(() => {
  const grid = document.querySelector("[data-random-games]");
  if (!grid) return;

  const maxShow = Math.max(1, Number(grid.dataset.maxShow || "10"));
  const storageKey =
    grid.dataset.storageKey || `catalogo:${window.location.pathname}`;

  function shuffle(items) {
    for (let i = items.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }

  function obterUltimaSelecao() {
    try {
      return JSON.parse(sessionStorage.getItem(storageKey) || "[]");
    } catch {
      return [];
    }
  }

  function salvarSelecao(cards) {
    const hrefs = cards.map((card) => card.getAttribute("href"));
    sessionStorage.setItem(storageKey, JSON.stringify(hrefs));
  }

  function mesmaSelecao(anterior, atual) {
    return (
      anterior.length === atual.length &&
      anterior.every((href) => atual.includes(href))
    );
  }

  function escolherCards(cards) {
    const ultimaSelecao = obterUltimaSelecao();
    let escolhidos = cards.slice(0, maxShow);

    for (let tentativa = 0; tentativa < 12; tentativa += 1) {
      const embaralhados = shuffle(cards.slice());
      escolhidos = embaralhados.slice(
        0,
        Math.min(maxShow, embaralhados.length),
      );
      const hrefs = escolhidos.map((card) => card.getAttribute("href"));

      if (!mesmaSelecao(ultimaSelecao, hrefs)) {
        salvarSelecao(escolhidos);
        return escolhidos;
      }
    }

    salvarSelecao(escolhidos);
    return escolhidos;
  }

  function atualizarGrid() {
    const cards = Array.from(grid.querySelectorAll(".game-card"));
    if (cards.length <= maxShow) return;

    const escolhidos = escolherCards(cards);
    grid.replaceChildren(...escolhidos);
  }

  window.addEventListener("pageshow", atualizarGrid);
})();
