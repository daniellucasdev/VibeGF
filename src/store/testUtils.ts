// Helpers dos testes do store e do motor da conversa.
import type { HanaTurn } from "../../shared/types";

/** localStorage em memória (o Node dos testes não tem um). */
export function memoryStorage(initial: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(initial));
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => {
      map.delete(k);
    },
    setItem: (k, v) => {
      map.set(k, String(v));
    },
  };
}

export const makeTurn = (over: Partial<HanaTurn> = {}): HanaTurn => ({
  thought: "hmm, até que é legal",
  emotion: "happy",
  intensity: 0.6,
  messages: ["oi!"],
  reaction: "none",
  deltas: { affection: 1, trust: 1, romance: 0 },
  newMemories: [],
  event: "none",
  ...over,
});

export const PROFILE = { name: "Dan", pronouns: "ele", honorific: "kun" } as const;
