import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";

const configSource = fs.readFileSync(new URL("../cemei-config.js", import.meta.url), "utf8");
const catalogSource = fs.readFileSync(new URL("../catalogo.js", import.meta.url), "utf8");
const context = { window: {}, Intl, Date, Object, Number, RegExp };
vm.runInNewContext(configSource, context);
const { CemeiConfig } = context.window;

const at = (iso) => new Date(iso);
const hrefs = (cards) => cards.map((card) => card.getAttribute("href"));
const makeCard = (href, dataset) => ({
  dataset,
  getAttribute: (name) => (name === "href" ? href : null),
});

function createPage(cards, config = CemeiConfig, random = Math.random) {
  const windowListeners = new Map();
  const documentListeners = new Map();
  const intervalCallbacks = [];
  const status = { textContent: "" };
  const grid = {
    dataset: { cemeiGames: "true" },
    querySelectorAll: () => cards,
    replaceCalls: 0,
    children: cards,
    replaceChildren: (...next) => {
      grid.replaceCalls += 1;
      grid.children = next;
    },
  };
  const document = {
    body: { classList: { contains: () => true } },
    hidden: false,
    querySelector: (selector) => {
      if (selector === "[data-random-games]") return grid;
      return selector === "#cemei-status" ? status : null;
    },
    addEventListener: (name, handler) => documentListeners.set(name, handler),
  };
  const page = {
    ...(config ? { CemeiConfig: config } : {}),
    addEventListener: (name, handler) => windowListeners.set(name, handler),
    setInterval: (handler, delay) => {
      intervalCallbacks.push({ handler, delay });
      return intervalCallbacks.length;
    },
  };
  const math = Object.create(Math);
  math.random = random;
  vm.runInNewContext(catalogSource, { window: page, document, Math: math, Number, Array, RegExp, Object, Date });
  return { page, grid, status, document, windowListeners, documentListeners, intervalCallbacks };
}

test("horários CEMEI usam America/Sao_Paulo e todos os limites são inclusivos no início e exclusivos no fim", () => {
  const table = [
    ["2026-03-02T16:49:00Z", null], ["2026-03-02T16:50:00Z", "pre5"], ["2026-03-02T17:39:00Z", "pre5"], ["2026-03-02T17:40:00Z", null],
    ["2026-03-05T09:59:00Z", null], ["2026-03-05T10:00:00Z", "pre4"], ["2026-03-05T10:49:00Z", "pre4"], ["2026-03-05T10:50:00Z", "integral"], ["2026-03-05T11:39:00Z", "integral"], ["2026-03-05T11:40:00Z", null],
    ["2026-03-05T12:44:00Z", null], ["2026-03-05T12:45:00Z", "pre5"], ["2026-03-05T13:34:00Z", "pre5"], ["2026-03-05T13:35:00Z", null],
    ["2026-03-05T15:59:00Z", null], ["2026-03-05T16:00:00Z", "pre5"], ["2026-03-05T16:49:00Z", "pre5"], ["2026-03-05T16:50:00Z", "pre4"], ["2026-03-05T17:39:00Z", "pre4"], ["2026-03-05T17:40:00Z", null],
    ["2026-03-05T18:14:00Z", null], ["2026-03-05T18:15:00Z", "pre4"], ["2026-03-05T18:57:00Z", "pre4"], ["2026-03-05T18:58:00Z", null],
  ];
  table.forEach(([time, grade]) => assert.equal(CemeiConfig.activeClass(at(time))?.grade ?? null, grade, time));
});

test("trimestre segue datas locais e a elegibilidade é cumulativa até o terceiro", () => {
  assert.equal(CemeiConfig.currentTrimester(at("2026-02-01T02:59:00Z")), 0);
  assert.equal(CemeiConfig.currentTrimester(at("2026-02-01T03:00:00Z")), 1);
  assert.equal(CemeiConfig.currentTrimester(at("2026-06-01T02:59:00Z")), 1);
  assert.equal(CemeiConfig.currentTrimester(at("2026-06-01T03:00:00Z")), 2);
  assert.equal(CemeiConfig.currentTrimester(at("2026-09-01T03:00:00Z")), 3);
  assert.equal(CemeiConfig.activeClass(at("2026-01-05T16:50:00Z")), null);
  const { page } = createPage([]);
  const { isEligible } = page.CemeiCatalog;
  [1, 2, 3].forEach((trimester) => assert.equal(isEligible({ dataset: { reviewed: "true", pre4: "1", pre5: "1" } }, "pre4", trimester), true));
  assert.equal(isEligible({ dataset: { reviewed: "true", pre4: "2", pre5: "2" } }, "pre4", 1), false);
  assert.equal(isEligible({ dataset: { reviewed: "true", pre4: "2", pre5: "2" } }, "pre4", 2), true);
  assert.equal(isEligible({ dataset: { reviewed: "true", pre4: "3", pre5: "3" } }, "pre5", 2), false);
  assert.equal(isEligible({ dataset: { reviewed: "true", pre4: "3", pre5: "3" } }, "pre5", 3), true);
});

test("filtra por turma, interseção segura e restaura a fonte completa", () => {
  const cards = [
    makeCard("pre4", { reviewed: "true", pre4: "1", pre5: "never", category: "visual" }),
    makeCard("pre5", { reviewed: "true", pre4: "never", pre5: "1", category: "visual" }),
    makeCard("both", { reviewed: "true", pre4: "1", pre5: "2", category: "visual" }),
    makeCard("non-visual", { reviewed: "true", pre4: "1", pre5: "1", category: "other" }),
    makeCard("unreviewed", { reviewed: "false", pre4: "1", pre5: "1", category: "visual" }),
    makeCard("missing", { reviewed: "true", pre4: "1", category: "visual" }),
  ];
  const { page, grid } = createPage(cards);
  const names = (date) => hrefs(page.CemeiCatalog.cemeiCards(at(date)).cards);
  assert.deepEqual(names("2026-03-05T10:00:00Z"), ["pre4", "both", "non-visual"]);
  assert.deepEqual(names("2026-06-04T12:45:00Z"), ["pre5", "both", "non-visual"]);
  assert.deepEqual(names("2026-06-02T15:00:00Z"), ["both"]);
  assert.deepEqual(names("2026-06-04T10:50:00Z"), ["both", "non-visual"]);
  page.CemeiCatalog.updateCemei(at("2026-06-04T12:45:00Z"));
  page.CemeiCatalog.updateCemei(at("2026-06-04T10:00:00Z"));
  assert.deepEqual(hrefs(grid.children).sort(), ["both", "non-visual", "pre4"]);
});

test("estado vazio é renderizado e configuração ausente falha fechada", () => {
  const unsafe = [
    makeCard("unreviewed", { reviewed: "false", pre4: "1", pre5: "1", category: "visual" }),
    makeCard("missing", { reviewed: "true", pre4: "1", category: "visual" }),
  ];
  const normal = createPage(unsafe);
  assert.equal(normal.grid.children.length, 0);
  assert.equal(normal.grid.dataset.ready, "true");
  const noConfig = createPage(unsafe, null);
  assert.equal(noConfig.grid.children.length, 0);
});

test("janeiro fica vazio", () => {
  const page = createPage([
    makeCard("safe", { reviewed: "true", pre4: "1", pre5: "1", category: "visual" }),
  ]);
  page.page.CemeiCatalog.updateCemei(at("2026-01-05T16:50:00Z"));
  assert.deepEqual(page.grid.children, []);
});

test("pageshow sorteia novamente e verificações periódicas preservam os cards", () => {
  const stableConfig = { currentTrimester: () => 1, activeClass: () => ({ grade: "pre4" }) };
  const { grid, document, windowListeners, documentListeners, intervalCallbacks } = createPage([
    makeCard("stable", { reviewed: "true", pre4: "1", pre5: "1", category: "visual" }),
  ], stableConfig);
  assert.equal(intervalCallbacks[0].delay, 30000);
  assert.equal(grid.replaceCalls, 1);
  windowListeners.get("pageshow")();
  assert.equal(grid.replaceCalls, 2);
  intervalCallbacks[0].handler();
  document.hidden = true;
  documentListeners.get("visibilitychange")();
  document.hidden = false;
  documentListeners.get("visibilitychange")();
  assert.equal(grid.replaceCalls, 2, "verificações periódicas mantêm os nós e o foco do card");
});

test("CEMEI sorteia até 15 após filtrar turma e trimestre, preservando todo o acervo para o próximo sorteio", () => {
  let random = 0;
  const eligible = Array.from({ length: 30 }, (_, index) =>
    makeCard(`safe-${index}`, { reviewed: "true", pre4: "1", pre5: "1", category: "visual" }));
  const excluded = [
    makeCard("later", { reviewed: "true", pre4: "2", pre5: "2", category: "visual" }),
    makeCard("other-class", { reviewed: "true", pre4: "never", pre5: "1", category: "visual" }),
    makeCard("unreviewed", { reviewed: "false", pre4: "1", pre5: "1", category: "visual" }),
  ];
  const config = { currentTrimester: () => 1, activeClass: () => ({ grade: "pre4" }) };
  const { grid, windowListeners } = createPage([...eligible, ...excluded], config, () => random);
  const first = hrefs(grid.children);
  assert.equal(first.length, 15);
  assert.equal(new Set(first).size, 15);
  assert.ok(first.every((href) => href.startsWith("safe-")));
  random = 0.999;
  windowListeners.get("pageshow")();
  const second = hrefs(grid.children);
  assert.equal(second.length, 15);
  assert.ok(second.every((href) => href.startsWith("safe-")));
  assert.ok(second.some((href) => !first.includes(href)), "voltar permite sortear jogos que não estavam na tela");
});

function createNormalCatalog(cards, random) {
  const listeners = new Map();
  const grid = {
    dataset: { maxShow: "15" },
    querySelectorAll: () => cards,
    children: cards,
    replaceChildren: (...next) => { grid.children = next; },
  };
  const math = Object.create(Math);
  math.random = random;
  const document = {
    body: { classList: { contains: () => false } },
    querySelector: (selector) => (selector === "[data-random-games]" ? grid : null),
  };
  const page = { addEventListener: (name, handler) => listeners.set(name, handler) };
  vm.runInNewContext(catalogSource, { window: page, document, Math: math, Number, Array, RegExp, Object, Date, localStorage: {} });
  return { grid, listeners };
}

test("catálogo não-CEMEI preserva limite de 15, regra rara e pageshow", () => {
  const cards = Array.from({ length: 16 }, (_, index) => ({
    getAttribute: () => (index === 0 ? "jogos/mario.html" : `jogos/${index}.html`),
    querySelector: () => ({ textContent: index === 0 ? "Mario" : `Jogo ${index}` }),
  }));
  const hiddenRare = createNormalCatalog(cards, () => 0.99);
  hiddenRare.listeners.get("pageshow")();
  assert.equal(hiddenRare.grid.children.length, 15);
  assert.equal(hrefs(hiddenRare.grid.children).includes("jogos/mario.html"), false);
  const shownRare = createNormalCatalog(cards, () => 0);
  shownRare.listeners.get("pageshow")();
  assert.equal(shownRare.grid.children.length, 15);
  assert.equal(hrefs(shownRare.grid.children).includes("jogos/mario.html"), true);
});
