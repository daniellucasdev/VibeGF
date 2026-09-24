import { afterEach, describe, expect, it } from "vitest";
import {
  DAY, HOUR, MINUTE, clockState, dateKey, dayPeriod, emptyDayLog, humanizeGap, isNightTime, now, periodLabel,
  recordUserMessages, resetClock, sceneGapMarker, setFixedClock, travel,
} from "./time";

const at = (h: number, m = 0) => new Date(2026, 8, 23, h, m);

describe("período do dia", () => {
  it.each([
    [6, "morning"], [10, "morning"], [11, "afternoon"], [16, "afternoon"],
    [17, "sunset"], [18, "sunset"], [19, "night"], [23, "night"], [0, "night"], [5, "night"],
  ] as const)("%ih → %s", (h, p) => {
    expect(dayPeriod(at(h, 30))).toBe(p);
  });

  it("tema noite das 19h às 6h", () => {
    expect(isNightTime(at(18, 59))).toBe(false);
    expect(isNightTime(at(19))).toBe(true);
    expect(isNightTime(at(5, 59))).toBe(true);
    expect(isNightTime(at(6))).toBe(false);
  });

  it("rótulo para o bloco AGORA", () => {
    expect(periodLabel(at(3))).toBe("madrugada");
    expect(periodLabel(at(8))).toBe("manhã");
    expect(periodLabel(at(14))).toBe("tarde");
    expect(periodLabel(at(18))).toBe("fim de tarde");
    expect(periodLabel(at(21, 40))).toBe("noite");
  });

  it("respeita o fuso do cliente", () => {
    const utc = new Date(Date.UTC(2026, 8, 23, 23, 0)); // 20h em São Paulo, 8h do dia 24 em Tóquio
    expect(dayPeriod(utc, "America/Sao_Paulo")).toBe("night");
    expect(dayPeriod(utc, "Asia/Tokyo")).toBe("morning");
    expect(dateKey(utc, "Asia/Tokyo")).toBe("2026-09-24");
    expect(dateKey(utc, "America/Sao_Paulo")).toBe("2026-09-23");
  });
});

describe("humanizeGap", () => {
  it.each([
    [0, "agora mesmo"],
    [30_000, "agora mesmo"],
    [MINUTE, "há 1 minuto"],
    [5 * MINUTE, "há 5 minutos"],
    [59 * MINUTE, "há 59 minutos"],
    [HOUR, "há 1 hora"],
    [3 * HOUR + 20 * MINUTE, "há 3 horas"],
    [DAY, "ontem"],
    [DAY + 23 * HOUR, "ontem"],
    [2 * DAY, "há 2 dias"],
    [3 * DAY + 5 * HOUR, "há 3 dias"],
    [-5000, "agora mesmo"],
  ])("%i ms → %s", (ms, text) => {
    expect(humanizeGap(ms)).toBe(text);
  });
});

describe("sceneGapMarker", () => {
  it("só com mais de 3 h", () => {
    expect(sceneGapMarker(3 * HOUR)).toBeNull();
    expect(sceneGapMarker(3 * HOUR + MINUTE)).toBe("[3 horas depois]");
    expect(sceneGapMarker(10 * HOUR)).toBe("[10 horas depois]");
    expect(sceneGapMarker(DAY)).toBe("[1 dia depois]");
    expect(sceneGapMarker(2 * DAY + 3 * HOUR)).toBe("[2 dias depois]");
  });
});

describe("daysTalked", () => {
  it("conta datas distintas com 3+ mensagens do usuário", () => {
    let log = emptyDayLog();
    log = recordUserMessages(log, "2026-09-23", 2);
    expect(log.daysTalked).toEqual([]);
    log = recordUserMessages(log, "2026-09-23", 1);
    expect(log.daysTalked).toEqual(["2026-09-23"]);
    log = recordUserMessages(log, "2026-09-23", 5);
    expect(log.daysTalked).toEqual(["2026-09-23"]);
    log = recordUserMessages(log, "2026-09-24", 2); // a contagem recomeça no dia novo
    expect(log.daysTalked).toHaveLength(1);
    log = recordUserMessages(log, "2026-09-25", 3);
    expect(log.daysTalked).toEqual(["2026-09-23", "2026-09-25"]);
  });

  it("zero mensagens não mexe no registro", () => {
    const log = emptyDayLog();
    expect(recordUserMessages(log, "2026-09-23", 0)).toBe(log);
  });
});

describe("now() central", () => {
  afterEach(resetClock);

  it("viagem no tempo acumula", () => {
    const before = Date.now();
    travel(HOUR);
    travel(DAY);
    expect(now().getTime() - before).toBeGreaterThanOrEqual(DAY + HOUR);
    expect(clockState().offsetMs).toBe(DAY + HOUR);
  });

  it("relógio fixo e viagem a partir dele", () => {
    setFixedClock(at(21, 40));
    expect(now().getTime()).toBe(at(21, 40).getTime());
    travel(HOUR);
    expect(now().getTime()).toBe(at(22, 40).getTime());
    setFixedClock(null);
    expect(clockState().fixed).toBeNull();
  });
});
