// Ritmo de conversa real (9.2): debounce, "visto", "digitando…" e intervalo entre balões.
import { charCount } from "../lib/text";

/** Silêncio que o cliente espera antes de chamar a API, juntando as mensagens num turno só. */
export const DEBOUNCE_MS = 1200;

export const READ_DELAY_MS = { min: 400, max: 1200 } as const;
/** Emburrada ou com briga em aberto, ela demora mais pra ler. */
export const READ_DELAY_UPSET_MS = { min: 2000, max: 4000 } as const;
export const BALLOON_GAP_MS = { min: 300, max: 700 } as const;

const between = (range: { min: number; max: number }, random: () => number) =>
  Math.round(range.min + random() * (range.max - range.min));

/** Quanto tempo depois de enviar vira "✓✓ visto" e aparece o "digitando…". */
export function readDelayMs(upset: boolean, random: () => number = Math.random): number {
  return between(upset ? READ_DELAY_UPSET_MS : READ_DELAY_MS, random);
}

/** "digitando…" antes de cada balão: min(600 + 35 × caracteres, 3500) ms. */
export function typingDelayMs(text: string): number {
  return Math.min(600 + 35 * charCount(text), 3500);
}

/** Pausa entre um balão e o "digitando…" do próximo. */
export function balloonGapMs(random: () => number = Math.random): number {
  return between(BALLOON_GAP_MS, random);
}

/** Depois do último balão a boca ainda mexe um pouquinho, proporcional ao texto. */
export function talkTailMs(text: string): number {
  return Math.min(1500, 300 + 25 * charCount(text));
}
