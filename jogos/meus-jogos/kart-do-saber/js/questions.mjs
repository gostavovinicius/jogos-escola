import { gradeFromSubject } from "./schedule.mjs";
const letters = [["ABELHA", "🐝"], ["BOLA", "⚽"], ["CASA", "🏠"], ["DADO", "🎲"], ["ELEFANTE", "🐘"], ["FOCA", "🦭"], ["GATO", "🐱"], ["ILHA", "🏝️"], ["JACARÉ", "🐊"], ["LUA", "🌙"], ["MACACO", "🐒"], ["NAVIO", "🚢"], ["OVO", "🥚"], ["PATO", "🦆"], ["QUEIJO", "🧀"], ["SAPO", "🐸"], ["TARTARUGA", "🐢"], ["UVA", "🍇"], ["VACA", "🐄"], ["ZEBRA", "🦓"]];
const syllables = [
  ["BO", "LA", "⚽"], ["CA", "SA", "🏠"], ["DA", "DO", "🎲"], ["GA", "TO", "🐱"],
  ["PA", "NE", "🥖"], ["SA", "PO", "🐸"], ["VA", "CA", "🐄"], ["MA", "PA", "🗺️"]
];
export function random(seed) { let n = seed >>> 0; return () => { n += 0x6D2B79F5; let t = Math.imul(n ^ n >>> 15, 1 | n); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function shuffle(items, rng) { const out = [...items]; for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; } return out; }
function options(answer, rng) { const n = Number(answer), choices = Number.isFinite(n) ? [n - 2, n - 1, n + 1, n + 2, n + 3].filter(value => value >= 0).map(String) : []; return shuffle([String(answer), ...shuffle([...new Set(choices)].filter(value => value !== String(answer)), rng).slice(0, 2)], rng); }
function mathQuestion(grade, rng, i) {
  let a, b, answer, word, speech, emoji = grade >= 4 ? "🚀" : "🔢";
  if (grade === 3) { a = 3 + Math.floor(rng() * 17); b = 1 + Math.floor(rng() * 10); const subtract = i % 3 === 2; if (subtract) { a = Math.max(a, b); answer = a - b; word = `${a} − ${b} = ?`; speech = `Quanto é ${a} menos ${b}?`; } else { answer = a + b; word = `${a} + ${b} = ?`; speech = `Quanto é ${a} mais ${b}?`; } }
  else if (grade === 4) { a = 2 + Math.floor(rng() * 8); b = 2 + Math.floor(rng() * 8); answer = a * b; word = `${a} × ${b} = ?`; speech = `Quanto é ${a} vezes ${b}?`; }
  else { a = 3 + Math.floor(rng() * 8); b = 2 + Math.floor(rng() * 8); if (i % 2) { answer = a; word = `${a * b} ÷ ${b} = ?`; speech = `Quanto é ${a * b} dividido por ${b}?`; } else { answer = a * b; word = `${a} × ${b} = ?`; speech = `Quanto é ${a} vezes ${b}?`; } }
  return { prompt: grade >= 4 ? "Resolva o desafio:" : "Qual é o resultado?", word, emoji, answer: String(answer), options: options(answer, rng), explanation: word.replace("?", answer), speech };
}
export function makeQuestions(subject = "letters", seed = 1) {
  const rng = random(seed), grade = gradeFromSubject(subject), letterPool = shuffle(letters, rng).filter((entry, index, pool) => pool.findIndex(other => other[0].slice(1) === entry[0].slice(1)) === index), syllablePool = shuffle(syllables, rng);
  return Array.from({ length: 8 }, (_, i) => {
    let q;
    if (grade === 1) { const [word, emoji] = letterPool[i % letterPool.length]; const answer = word[0]; q = { prompt: "Qual é a primeira letra?", word: `_${word.slice(1)}`, emoji, answer, options: shuffle([answer, ...shuffle([..."AEIOUBCDFGLMNPSTVZ"].filter(x => x !== answer), rng).slice(0, 2)], rng), explanation: `${answer} de ${word}`, speech: `Qual é a primeira letra da palavra ${word}?` }; }
    else if (grade === 2) { const [answer, ending, emoji] = syllablePool[i % syllablePool.length]; q = { prompt: "Qual sílaba completa a palavra?", word: `__${ending}`, emoji, answer, options: shuffle([answer, ...shuffle(syllables.map(item => item[0]).filter(x => x !== answer), rng).slice(0, 2)], rng), explanation: `${answer} + ${ending} = ${answer}${ending}`, speech: `Qual é a primeira sílaba da palavra ${answer}${ending}?` }; }
    else q = mathQuestion(grade, rng, i);
    return { id: i, at: 190 + i * 210, ...q, correct: q.options.indexOf(q.answer) };
  });
}