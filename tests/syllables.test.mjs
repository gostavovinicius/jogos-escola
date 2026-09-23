import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(
  new URL("../jogos/meus-jogos/corrida/js/syllables.js", import.meta.url),
  "utf8",
);
const window = {};
vm.runInNewContext(source, { window });
const { bancoDeFases, fasesPorPalavra } = window.CorridaDoSaberSyllables;

test("todas as fases têm emoji associado à palavra correta", () => {
  const emojisEsperados = {
    ABELHA: "🐝", AVIÃO: "✈️", ÁRVORE: "🌳", AMIGO: "🤝", ANEL: "💍",
    ELEFANTE: "🐘", ESCADA: "🪜", ESCOLA: "🏫", ESTRELA: "⭐", ILHA: "🏝️",
    IGREJA: "⛪", ÍNDIO: "👤", OVO: "🥚", OLHO: "👁️", URSO: "🐻",
    BOLA: "⚽", CASA: "🏠", BOLO: "🎂", PATO: "🦆", GATO: "🐱", VELA: "🕯️",
    FADA: "🧚", LOBO: "🐺", SAPO: "🐸", DADO: "🎲", RATO: "🐭", BONECA: "🧸",
    CAMA: "🛏️", MESA: "🍽️", LATA: "🥫", BRUXA: "🧙", PRATO: "🍽️", BLUSA: "👚",
    TRATOR: "🚜", FLOR: "🌸", FRUTA: "🍎", DRAGÃO: "🐉", CRIANÇA: "👧",
    PLANTA: "🪴", TIGRE: "🐅", LIVRO: "📘", TREM: "🚂", CHUVA: "🌧️", GRANDE: "🏔️",
  };
  const fases = Object.values(bancoDeFases).flatMap((grupo) => grupo.fases);

  assert.equal(fases.length, 45);
  for (const fase of fases) {
    assert.ok(fase.emoji, `${fase.palavra} está sem emoji`);
    assert.equal(
      fase.emoji,
      emojisEsperados[fase.palavra],
      `emoji incorreto para ${fase.palavra}`,
    );
    assert.equal(fasesPorPalavra.get(fase.palavra)?.emoji, fase.emoji);
  }
});