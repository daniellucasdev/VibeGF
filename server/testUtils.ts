// Helpers dos testes do servidor.

import type { ChatRequest } from "../shared/types";

export function makeRequest(over: Partial<ChatRequest> = {}, rel: Partial<ChatRequest["relationship"]> = {}): ChatRequest {
  return {
    mode: "reply",
    profile: { name: "Dan", pronouns: "ele", honorific: "kun", addressAs: "Dan-san" },
    relationship: {
      stage: 0, affection: 5, trust: 5, romance: 0, daysTalked: 0, distant: false,
      pendingConflict: null, confession: "locked", confessionNote: "você ainda não está pronta para namorar", togetherSince: null,
      ...rel,
    },
    mood: { emotion: "neutral", intensity: 0.3 },
    memories: [],
    summary: "A Hana mandou mensagem pro número errado.",
    history: [
      { role: "hana", text: "oi, Yui!! o Daifuku fugiu", at: "2026-09-23T21:00:00.000Z" },
      { role: "user", text: "oi, acho que você errou o número", at: "2026-09-23T21:01:00.000Z" },
    ],
    client: { nowIso: "2026-09-23T21:02:00.000Z", timeZone: "America/Sao_Paulo" },
    ...over,
  };
}
