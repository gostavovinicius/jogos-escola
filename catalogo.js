(() => {
  const grid = document.querySelector("[data-random-games]");
  if (!grid) return;

  const maxShow = Math.max(1, Number(grid.dataset.maxShow || "15"));
  const marioChance = 0.1;

  function shuffle(items) {
    for (let i = items.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }

  function ehMario(card) {
    const href = card.getAttribute("href") || "";
    const titulo = card.querySelector("h3")?.textContent || "";
    return /mario/i.test(`${href} ${titulo}`);
  }

  function escolherCards(cards) {
    const mario = cards.find(ehMario);
    const comuns = cards.filter((card) => card !== mario);
    const limite = Math.min(maxShow, cards.length);

    if (mario && Math.random() < marioChance) {
      const escolhidos = shuffle(comuns.slice()).slice(0, limite - 1);
      return shuffle([...escolhidos, mario]);
    }

    return shuffle(comuns.slice()).slice(0, limite);
  }

  function atualizarGrid() {
    const cards = Array.from(grid.querySelectorAll(".game-card"));
    const escolhidos = escolherCards(cards);
    grid.replaceChildren(...escolhidos);
  }

  window.addEventListener("pageshow", atualizarGrid);
})();
