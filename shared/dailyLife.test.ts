import { describe, expect, it } from "vitest";
import { ACTIVITIES, HAPPENINGS, activityNow, dateKey, happeningsFor, happeningsToday } from "./dailyLife";

// 21/09/2026 é segunda-feira
const on = (day: number, h: number, m = 0) => new Date(2026, 8, day, h, m);
const MON = 21, TUE = 22, WED = 23, SAT = 26, SUN = 27;

describe("activityNow", () => {
  it.each([
    [MON, 3, "sleeping"], [SUN, 6, "sleeping"],
    [MON, 8, "train"], [MON, 10, "class"], [WED, 12, "class"],
    [TUE, 13, "train"], [TUE, 15, "cafe"], [SAT, 14, "cafe"], [TUE, 19, "train"],
    [WED, 15, "drawing"], [MON, 20, "drawing"], [WED, 23, "anime"],
    [SAT, 10, "drawing"], [SUN, 15, "drawing"],
  ] as const)("dia %i, %ih → %s", (day, h, id) => {
    expect(activityNow(on(day, h, 30)).id).toBe(id);
  });

  it("status da UI", () => {
    expect(Object.values(ACTIVITIES).map((a) => a.status)).toEqual(
      expect.arrayContaining(["📚 na aula", "☕ no Neko no Mori", "✎ desenhando", "📺 vendo anime", "🚃 no trem", "💤 dormindo"]),
    );
  });
});

describe("acontecimento do dia", () => {
  it("tem cerca de 30 acontecimentos distintos", () => {
    expect(HAPPENINGS.length).toBeGreaterThanOrEqual(28);
    expect(new Set(HAPPENINGS).size).toBe(HAPPENINGS.length);
  });

  it("o mesmo dia gera o mesmo acontecimento", () => {
    expect(happeningsFor("2026-09-23")).toEqual(happeningsFor("2026-09-23"));
    expect(happeningsToday(on(WED, 8))).toEqual(happeningsToday(on(WED, 23, 59)));
  });

  it("1 por dia útil, 2 distintos no fim de semana", () => {
    expect(happeningsFor("2026-09-23")).toHaveLength(1);
    const sat = happeningsFor(dateKey(on(SAT, 12)));
    const sun = happeningsFor(dateKey(on(SUN, 12)));
    expect(sat).toHaveLength(2);
    expect(sun).toHaveLength(2);
    expect(new Set(sat).size).toBe(2);
  });

  it("varia entre os dias", () => {
    const month = Array.from({ length: 30 }, (_, i) => happeningsFor(dateKey(new Date(2026, 9, i + 1)))[0]);
    expect(new Set(month).size).toBeGreaterThan(10);
    for (const h of month) expect(HAPPENINGS).toContain(h);
  });
});
