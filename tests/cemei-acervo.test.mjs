import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const html = (await readFile(new URL("cemei.html", root), "utf8"))
  .replace(/<!--[\s\S]*?-->/g, "");
const cards = [...html.matchAll(/<a\b([^>]*class="game-card"[^>]*)>/g)]
  .map(([, attributes]) => Object.fromEntries(
    [...attributes.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]),
  ));

test("acervo CEMEI tem classificação completa e destinos locais existentes", async () => {
  assert.ok(cards.length >= 82, "inclui os 25 novos jogos visuais");
  assert.equal(new Set(cards.map((card) => card.href)).size, cards.length);
  for (const card of cards) {
    await access(new URL(card.href, root));
    assert.match(card["data-pre4"], /^(1|2|3|never)$/);
    assert.match(card["data-pre5"], /^(1|2|3|never)$/);
    assert.match(card["data-reviewed"], /^(true|false)$/);
    assert.match(card["data-category"], /^(visual|letras)$/);
    if (card["data-category"] === "letras") {
      assert.match(card["data-pre4"], /^(3|never)$/);
      assert.match(card["data-pre5"], /^(3|never)$/);
    }
  }
});

test("trimestres do acervo real acumulam e turma não possui seletor manual", () => {
  assert.doesNotMatch(html, /<select\b|<input\b|cemei-heading|cemei-status/);
  assert.match(html, /data-max-show="15"/);
  assert.ok(html.indexOf('src="cemei-config.js"') < html.indexOf('src="catalogo.js"'));
  for (const grade of ["pre4", "pre5"]) {
    const pools = [1, 2, 3].map((trimester) => cards.filter((card) =>
      card["data-reviewed"] === "true" && Number(card[`data-${grade}`]) <= trimester,
    ).map((card) => card.href));
    assert.ok(pools[0].length >= 8, "primeiro trimestre oferece variedade visual");
    assert.ok(pools[1].length > pools[0].length);
    assert.ok(pools[2].length > pools[1].length);
    assert.ok(pools[0].every((href) => pools[1].includes(href)));
    assert.ok(pools[1].every((href) => pools[2].includes(href)));
  }
});

test("novos jogos preservam sandbox e retorno para o catálogo automático", async () => {
  const guids = new Set();
  const additions = [
    "memoriaCores", "relacioneCores", "classificandoCores", "sombrasCorpo", "sequenciaImagens",
    "memoriaFrutas", "memoriaHorta", "memoriaAlimentos", "memoriaMar", "memoriaTransito",
    "memoriaSustentabilidade", "memoriaEsportes", "memoriaProfissoes", "memoriaOlimpiadas",
    "memoriaBrinquedos", "memoriaFormas", "ligueNumeros", "conteBolinhas", "conteAnimais",
    "memoriaQuantidades", "sombrasCarros", "sombrasFrutas", "sombrasPalhacos",
    "sombrasTransportes", "sombrasVerao",
  ];
  for (const name of additions) {
    const page = await readFile(new URL(`jogos/cemei/${name}.html`, root), "utf8");
    assert.match(page, /https:\/\/wordwall\.net\/pt\/embed\/[a-f0-9]{32}\?/);
    assert.match(page, /sandbox="allow-scripts allow-same-origin"/);
    assert.match(page, /href="\.\.\/\.\.\/cemei\.html"/);
    const guid = page.match(/\/embed\/([a-f0-9]{32})\?/)[1];
    assert.ok(!guids.has(guid), "os novos jogos usam conteúdos distintos");
    guids.add(guid);
    assert.ok(cards.some((card) => card.href === `jogos/cemei/${name}.html` && card["data-reviewed"] === "true"));
  }
});
