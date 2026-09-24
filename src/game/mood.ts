// Humor do momento: correções do código, decaimento e humor-base (5.2).
import { localParts } from "../../shared/dailyLife";
import type { Emotion, Mood, Stage } from "../../shared/types";
import { MINUTE } from "./time";

export const MOOD_HALF_LIFE_MIN = 20;
export const MOOD_FLOOR = 0.25;

export type MoodContext = { stage: Stage; hasConflict: boolean; timeZone?: string };
export type MoodNow = { emotion: Emotion; intensity: number };

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

/** `love` antes do estágio 4 vira `shy`; intensidade limitada a 0–1. */
export function correctMood(emotion: Emotion, intensity: number, stage: Stage): MoodNow {
  return { emotion: emotion === "love" && stage < 4 ? "shy" : emotion, intensity: clamp01(intensity) };
}

/** Humor-base: madrugada → sleepy; briga em aberto → pouty; estágios 0–1 neutral; 2+ happy. */
export function baseMood(date: Date, ctx: MoodContext): MoodNow {
  if (localParts(date, ctx.timeZone).hour < 6) return { emotion: "sleepy", intensity: 0.5 };
  if (ctx.hasConflict) return { emotion: "pouty", intensity: 0.4 };
  if (ctx.stage <= 1) return { emotion: "neutral", intensity: 0.3 };
  return { emotion: "happy", intensity: 0.3 };
}

/** intensity × 0.5^(minutos/20). */
export function decayedIntensity(intensity: number, elapsedMs: number): number {
  const minutes = Math.max(0, elapsedMs) / MINUTE;
  return clamp01(intensity) * 0.5 ** (minutes / MOOD_HALF_LIFE_MIN);
}

/** Humor atual com decaimento; abaixo de 0,25 volta ao humor-base. */
export function currentMood(mood: Mood, date: Date, ctx: MoodContext): MoodNow {
  const elapsed = date.getTime() - new Date(mood.at).getTime();
  const intensity = decayedIntensity(mood.intensity, Number.isFinite(elapsed) ? elapsed : Infinity);
  if (intensity < MOOD_FLOOR) return baseMood(date, ctx);
  return correctMood(mood.emotion, intensity, ctx.stage);
}
