import { describe, expect, it } from "vitest";
import { HanaTurnSchema, TURN_LIMITS } from "../shared/schema";
import type { ChatRequest, HanaTurn, Stage } from "../shared/types";
import { makeRequest } from "./testUtils";
import { MOCK_LINES, mockEvent, mockSummary, mockTurn, pendingUserText, type Rng } from "./mock";

/** RNG determinístico (mulberry32). */
function seeded(seed: number): Rng {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STAGES: Stage[] = [0, 1, 2, 3, 4, 5];
const withText = (text: string) => [{ role: "user" as const, text, at: "2026-09-23T21:01:00.000Z" }];

function expectValid(t: HanaTurn) {
  expect(HanaTurnSchema.safeParse(t).success).toBe(true);
  expect(t.messages.length).toBeGreaterThanOrEqual(1);
  expect(t.messages.length).toBeLessThanOrEqual(TURN_LIMITS.maxMessages);
  for (const m of t.messages) {
    expect(m.trim().length).toBeGreaterThan(0);
    expect(m.length).toBeLessThanOrEqual(TURN_LIMITS.maxMessageChars);
    expect(m).not.toContain("{nome}");
  }
  expect(t.newMemories.length).toBeLessThanOrEqual(TURN_LIMITS.maxMemories);
  expect(t.intensity).toBeGreaterThanOrEqual(0);
  expect(t.intensity).toBeLessThanOrEqual(1);
  for (const d of Object.values(t.deltas)) {
    expect(d).toBeGreaterThanOrEqual(1);
    expect(d).toBeLessThanOrEqual(3);
  }
}

describe("mock (6.8)", () => {
  it("tem cerca de 20 falas por estágio", () => {
    for (const s of STAGES) expect(MOCK_LINES[s].length).toBeGreaterThanOrEqual(18);
  });

  it("todo turno passa no schema, em todo estágio e modo", () => {
    const rng = seeded(42);
    for (const stage of STAGES) {
      for (const mode of ["reply", "greet_return", "idle_nudge"] as const) {
        for (let i = 0; i < 60; i++) {
          const t = mockTurn(makeRequest({ mode }, { stage }), rng);
          expectValid(t);
          // Roundtrip pelo JSON, como na rede.
          expect(HanaTurnSchema.parse(JSON.parse(JSON.stringify(t)))).toEqual(t);
        }
      }
    }
  });

  it("varia as emoções e traz eventos de vez em quando", () => {
    const rng = seeded(7);
    const emotions = new Set<string>();
    let events = 0;
    for (let i = 0; i < 300; i++) {
      const t = mockTurn(makeRequest({}, { stage: 3 }), rng);
      emotions.add(t.emotion);
      if (t.event !== "none") events++;
    }
    expect(emotions.size).toBeGreaterThanOrEqual(6);
    expect(events).toBeGreaterThan(0);
    expect(events).toBeLessThan(100);
  });

  it("não usa `love` antes do estágio 4 fora de eventos", () => {
    const rng = seeded(3);
    for (const stage of [0, 1, 2, 3] as Stage[]) {
      for (let i = 0; i < 100; i++) {
        const t = mockTurn(makeRequest({}, { stage }), rng);
        if (t.event === "none") expect(t.emotion).not.toBe("love");
      }
    }
  });

  it("chama o usuário pelo addressAs", () => {
    const rng = seeded(1);
    const all = Array.from({ length: 300 }, () => mockTurn(makeRequest({}, { stage: 2 }), rng).messages).flat();
    expect(all.some((m) => m.includes("Dan-san"))).toBe(true);
  });

  it("estágio 0 sem eventos de marco", () => {
    const rng = seeded(9);
    for (let i = 0; i < 200; i++) expect(mockTurn(makeRequest(), rng).event).toBe("none");
  });

  it("eventos coerentes com a declaração e a briga", () => {
    const never: Rng = () => 0.99;
    const req = (text: string, rel: Partial<ChatRequest["relationship"]>) =>
      makeRequest({ history: withText(text) }, { stage: 4, ...rel });
    expect(mockEvent(req("eu gosto de você", { confession: "locked" }), "eu gosto de você", never)).toBe("confession_declined");
    expect(mockEvent(req("te amo", { confession: "open" }), "te amo", never)).toBe("confession_accepted");
    expect(mockEvent(req("sim!!", { confession: "she_confessed" }), "sim!!", never)).toBe("confession_accepted");
    expect(mockEvent(req("desculpa, mas só como amiga", { confession: "she_confessed" }), "desculpa, mas só como amiga", never)).toBe("confession_rejected");
    expect(mockEvent(req("desculpa pelo que eu disse", { pendingConflict: "ele riu do mangá" }), "desculpa pelo que eu disse", never)).toBe("made_up");
    expect(mockEvent(req("oi", { confession: "open" }), "oi", () => 0)).toBe("she_confessed");
  });

  it("greet_return e idle_nudge não reagem nem guardam memória", () => {
    const rng = seeded(5);
    for (const mode of ["greet_return", "idle_nudge"] as const) {
      const t = mockTurn(makeRequest({ mode }, { stage: 2 }), rng);
      expect(t.reaction).toBe("none");
      expect(t.newMemories).toEqual([]);
    }
  });

  it("pendingUserText junta as mensagens do usuário desde a última fala da Hana", () => {
    const at = "2026-09-23T21:00:00.000Z";
    expect(pendingUserText([
      { role: "user", text: "antiga", at },
      { role: "hana", text: "oi", at },
      { role: "user", text: "a", at },
      { role: "scene", text: "[3 horas depois]", at },
      { role: "user", text: "b", at },
    ])).toBe("a\nb");
  });

  it("mockSummary acrescenta ao resumo anterior e respeita 1200 caracteres", () => {
    const at = "2026-09-23T21:00:00.000Z";
    const s = mockSummary({ previousSummary: "x".repeat(1500), messages: [{ role: "user", text: "oi", at }] });
    expect(Array.from(s).length).toBeLessThanOrEqual(1200);
    expect(mockSummary({ previousSummary: "Início.", messages: [{ role: "user", text: "oi", at }] })).toMatch(/^Início\. /);
  });
});
