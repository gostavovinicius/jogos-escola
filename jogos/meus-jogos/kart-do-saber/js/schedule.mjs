const slots = [
  [1, 7*60, 7*60+50, 3, "3B", "Sandra"], [1, 9*60+45, 10*60+35, 4, "4B", "Elaine"], [1, 13*60, 13*60+50, 4, "4C", "Lindieli"], [1, 15*60, 15*60+50, 2, "2C", "Rosamara"],
  [2, 7*60, 7*60+50, 5, "5A", "Maria"], [2, 7*60+50, 8*60+40, 3, "3A", "Claudia"], [2, 9*60+45, 10*60+35, 2, "2A", "Vanessa"], [2, 13*60+50, 14*60+40, 3, "3D", "Janaina"],
  [3, 7*60+50, 8*60+40, 4, "4A", "Angelica"], [3, 8*60+40, 9*60+45, 5, "5B", "Tais"], [3, 13*60, 13*60+50, 3, "3C", "Elaine"], [3, 13*60+50, 14*60+40, 1, "1C", "Gilma"], [3, 15*60, 15*60+50, 2, "2D", "Sandra"],
  [5, 7*60, 7*60+50, 1, "1A", "Silvia"], [5, 8*60+40, 9*60+45, 1, "1B", "Fabricia"], [5, 9*60+45, 10*60+35, 2, "2B", "Eliana"], [5, 13*60+50, 14*60+40, 4, "4D", "Sizênia"], [5, 15*60, 15*60+50, 5, "5C", "Adriana"],
];
const topics = { 1: "Primeiras letras e palavras", 2: "Sílabas e leitura", 3: "Adição e subtração", 4: "Multiplicação e problemas", 5: "Operações e desafios" };
export const gradeTopic = grade => topics[grade] || topics[3];
export const gradeFromSubject = subject => Number(String(subject).match(/grade([1-5])/i)?.[1]) || ({ letters: 1, syllables: 2, math: 3 }[subject] || 3);
export function lessonForDate(date = new Date()) {
  const day = date.getDay(), minutes = date.getHours() * 60 + date.getMinutes();
  const match = slots.find(([slotDay, start, end]) => slotDay === day && minutes >= start && minutes < end);
  if (!match) return { key: "free-review", grade: 3, classId: "Treino", teacher: "", topic: "Revisão de 3º ano", active: false };
  const [, start, end, grade, classId, teacher] = match;
  return { key: `grade${grade}-${classId.toLowerCase()}`, grade, classId, teacher, start, end, topic: gradeTopic(grade), active: true };
}
export const topicForSubject = subject => gradeTopic(gradeFromSubject(subject));