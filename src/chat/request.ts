// Monta o ChatRequest (6.1) a partir do save e decide quando resumir (5.6).
import { callName } from "../../shared/stages";
import type { ChatMode, ChatRequest, HistoryItem } from "../../shared/types";
import { confessionNote, refreshConfession } from "../game/confession";
import { currentMood, type MoodNow } from "../game/mood";
import { distantOf, readyForCouple } from "../game/relationship";
import { cutChars } from "../lib/text";
import type { ChatMessage, SaveData } from "../store/save";

/** Mensagens enviadas a cada chamada. */
export const HISTORY_WINDOW = 30;
/** Resume quando passam disto as mensagens ainda não resumidas fora da janela. */
export const SUMMARIZE_THRESHOLD = 40;
/** Máximo por /api/summarize (REQUEST_LIMITS.summarizeItems). */
export const SUMMARIZE_MAX_ITEMS = 400;

// Limites do servidor (REQUEST_LIMITS em shared/schema.ts), repetidos aqui para não
// trazer o Zod do servidor só por causa de números.
const LIMITS = { user: 500, other: 1300, memory: 200, memories: 60, summary: 2000 } as const;

export function toHistoryItem(m: ChatMessage): HistoryItem {
  return { role: m.role, text: cutChars(m.text, m.role === "user" ? LIMITS.user : LIMITS.other), at: m.at };
}

/** Humor atual já com decaimento (5.2), no fuso do navegador. */
export function displayMood(save: Pick<SaveData, "relationship">, at: Date): MoodNow {
  const r = save.relationship;
  return currentMood(r.mood, at, { stage: r.stage, hasConflict: r.pendingConflict !== null });
}

export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function buildChatRequest(save: SaveData, mode: ChatMode, at: Date, timeZone: string): ChatRequest {
  const { profile, relationship: r, settings } = save;
  if (!profile) throw new Error("sem perfil: o onboarding ainda não terminou");
  const confession = refreshConfession(r.confession, { stage: r.stage, ready: readyForCouple(r, settings.pace), now: at });
  const mood = displayMood(save, at);
  return {
    mode,
    profile: { ...profile, addressAs: callName(profile, r.stage) },
    relationship: {
      stage: r.stage,
      affection: r.affection,
      trust: r.trust,
      romance: r.romance,
      daysTalked: r.days.daysTalked.length,
      distant: distantOf(r),
      pendingConflict: r.pendingConflict ? cutChars(r.pendingConflict.reason, LIMITS.other) : null,
      confession: confession.state,
      confessionNote: confessionNote(confession, at, profile.pronouns),
      togetherSince: confession.togetherSince,
    },
    mood: { emotion: mood.emotion, intensity: Math.round(mood.intensity * 100) / 100 },
    memories: save.memories.slice(-LIMITS.memories).map((m) => cutChars(m.text, LIMITS.memory)),
    summary: cutChars(save.summary, LIMITS.summary),
    history: save.messages.slice(-HISTORY_WINDOW).map(toHistoryItem),
    client: { nowIso: at.toISOString(), timeZone },
  };
}

/**
 * Mensagens a resumir: as que estão fora da janela das últimas 30 e ainda não
 * entraram no resumo. Só quando passam de 40; senão `null`.
 */
export function summarizeBatch(messages: readonly ChatMessage[], summarizedUpTo: number): ChatMessage[] | null {
  const outside = messages.slice(0, Math.max(0, messages.length - HISTORY_WINDOW));
  const fresh = outside.filter((m) => m.id > summarizedUpTo);
  if (fresh.length <= SUMMARIZE_THRESHOLD) return null;
  return fresh.slice(-SUMMARIZE_MAX_ITEMS);
}

/** Mensagens do usuário depois da última fala da Hana (ficaram sem resposta). */
export function unansweredUserIds(messages: readonly ChatMessage[]): number[] {
  const ids: number[] = [];
  for (let i = messages.length - 1; i >= 0 && messages[i].role !== "hana"; i--) {
    if (messages[i].role === "user") ids.unshift(messages[i].id);
  }
  return ids;
}
