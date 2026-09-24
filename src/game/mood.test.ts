import { describe, expect, it } from "vitest";
import type { Mood } from "../../shared/types";
import { baseMood, correctMood, currentMood, decayedIntensity } from "./mood";
import { MINUTE } from "./time";

const T0 = new Date(2026, 8, 23, 15, 0);
const mood = (over: Partial<Mood> = {}): Mood => ({ emotion: "excited", intensity: 1, at: T0.toISOString(), ...over });
const later = (min: number) => new Date(T0.getTime() + min * MINUTE);

describe("correctMood", () => {
  it("love antes do estágio 4 vira shy", () => {
    expect(correctMood("love", 0.8, 0).emotion).toBe("shy");
    expect(correctMood("love", 0.8, 3).emotion).toBe("shy");
    expect(correctMood("love", 0.8, 4).emotion).toBe("love");
    expect(correctMood("love", 0.8, 5).emotion).toBe("love");
  });

  it("intensidade limitada a 0–1", () => {
    expect(correctMood("happy", 3, 2).intensity).toBe(1);
    expect(correctMood("happy", -1, 2).intensity).toBe(0);
    expect(correctMood("happy", Number.NaN, 2).intensity).toBe(0);
  });
});

describe("decaimento", () => {
  it("intensity × 0.5^(minutos/20)", () => {
    expect(decayedIntensity(1, 0)).toBe(1);
    expect(decayedIntensity(1, 20 * MINUTE)).toBeCloseTo(0.5);
    expect(decayedIntensity(0.8, 40 * MINUTE)).toBeCloseTo(0.2);
  });

  it("acima de 0,25 mantém a emoção com a intensidade decaída", () => {
    const m = currentMood(mood(), later(20), { stage: 2, hasConflict: false });
    expect(m.emotion).toBe("excited");
    expect(m.intensity).toBeCloseTo(0.5);
  });

  it("abaixo de 0,25 volta ao humor-base", () => {
    expect(currentMood(mood(), later(41), { stage: 2, hasConflict: false })).toEqual({ emotion: "happy", intensity: 0.3 });
  });

  it("love decaído antes do estágio 4 continua corrigido", () => {
    expect(currentMood(mood({ emotion: "love" }), later(1), { stage: 3, hasConflict: false }).emotion).toBe("shy");
  });

  it("timestamp inválido cai no humor-base", () => {
    expect(currentMood(mood({ at: "lixo" }), T0, { stage: 0, hasConflict: false }).emotion).toBe("neutral");
  });
});

describe("humor-base", () => {
  it("00h–06h → sleepy, mesmo com briga", () => {
    expect(baseMood(new Date(2026, 8, 23, 0, 0), { stage: 3, hasConflict: true }).emotion).toBe("sleepy");
    expect(baseMood(new Date(2026, 8, 23, 5, 59), { stage: 0, hasConflict: false }).emotion).toBe("sleepy");
    expect(baseMood(new Date(2026, 8, 23, 6, 0), { stage: 0, hasConflict: false }).emotion).toBe("neutral");
  });

  it("briga em aberto → pouty (0,4)", () => {
    expect(baseMood(T0, { stage: 3, hasConflict: true })).toEqual({ emotion: "pouty", intensity: 0.4 });
  });

  it("estágios 0–1 → neutral; 2+ → happy (0,3)", () => {
    expect(baseMood(T0, { stage: 0, hasConflict: false }).emotion).toBe("neutral");
    expect(baseMood(T0, { stage: 1, hasConflict: false }).emotion).toBe("neutral");
    expect(baseMood(T0, { stage: 2, hasConflict: false })).toEqual({ emotion: "happy", intensity: 0.3 });
    expect(baseMood(T0, { stage: 5, hasConflict: false }).emotion).toBe("happy");
  });
});
