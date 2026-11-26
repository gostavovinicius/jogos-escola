(() => {
  "use strict";

  const TIME_ZONE = "America/Sao_Paulo";

  // Calendário provisório: confirme estas datas com a coordenação escolar.
  // O ano letivo provisório vai de 1º de fevereiro a 31 de dezembro.
  // Ajuste somente esta lista quando o calendário letivo oficial estiver
  // disponível.
  const trimesterStarts = [
    { month: 2, day: 1 },
    { month: 6, day: 1 },
    { month: 9, day: 1 },
  ];

  const schedule = [
    { weekday: 1, start: "13:50", end: "14:40", grade: "pre5" },
    { weekday: 4, start: "07:00", end: "07:50", grade: "pre4" },
    { weekday: 4, start: "07:50", end: "08:40", grade: "integral" },
    { weekday: 4, start: "09:45", end: "10:35", grade: "pre5" },
    { weekday: 4, start: "13:00", end: "13:50", grade: "pre5" },
    { weekday: 4, start: "13:50", end: "14:40", grade: "pre4" },
    { weekday: 4, start: "15:15", end: "15:58", grade: "pre4" },
  ];

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  function partsAtSaoPaulo(date = new Date()) {
    const values = Object.fromEntries(
      formatter
        .formatToParts(date)
        .filter(({ type }) => type !== "literal")
        .map(({ type, value }) => [type, Number(value)]),
    );
    return values;
  }

  function minutes(value) {
    const match = /^(\d{2}):(\d{2})$/.exec(value);
    return match ? Number(match[1]) * 60 + Number(match[2]) : NaN;
  }

  function weekday(parts) {
    return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
  }

  function currentTrimester(date = new Date()) {
    const local = partsAtSaoPaulo(date);
    if (local.month === 1) return 0;
    const monthDay = local.month * 100 + local.day;
    let trimester = 1;
    trimesterStarts.forEach((start, index) => {
      if (monthDay >= start.month * 100 + start.day) trimester = index + 1;
    });
    return trimester;
  }

  function activeClass(date = new Date()) {
    const local = partsAtSaoPaulo(date);
    if (local.month === 1) return null;
    const currentMinutes = local.hour * 60 + local.minute;
    const match = schedule.find(
      (entry) =>
        entry.weekday === weekday(local) &&
        currentMinutes >= minutes(entry.start) &&
        currentMinutes < minutes(entry.end),
    );
    return match ? { ...match } : null;
  }

  window.CemeiConfig = Object.freeze({
    TIME_ZONE,
    trimesterStarts: Object.freeze(trimesterStarts.map(Object.freeze)),
    schedule: Object.freeze(schedule.map(Object.freeze)),
    partsAtSaoPaulo,
    currentTrimester,
    activeClass,
  });
})();
