// applyTurn(): o código decide os números, os limites, os estágios e os eventos (5.1–5.4).
import { dateKey } from "../../shared/dailyLife";
import {
  INITIAL_FEELINGS, PACE, ROMANCE_CAP, clampDeltas, isDistant, meetsRequirements,
  type ProgressStats,
} from "../../shared/stages";
import type {
  Deltas, FeelingKey, Feelings, HanaEvent, HanaTurn, Mood, PaceKey, PendingConflict, Stage,
} from "../../shared/types";
import { applyConfessionEvent, initialConfession, isConfessionEvent, refreshConfession, type Confession } from "./confession";
import { correctMood } from "./mood";
import { emptyDayLog, recordUserMessages, type DayLog } from "./time";

export const FEELING_KEYS: readonly FeelingKey[] = ["affection", "trust", "romance"];
/** Quantas mensagens do usuário o anti-grind lembra. */
export const RECENT_WINDOW = 10;
export const SIMILARITY_THRESHOLD = 0.8;
export const REPEAT_MULT = 0.25;
/** Mensagens com menos que isso (em caracteres) são "curtas". */
export const SHORT_MESSAGE_CHARS = 3;

export type RelationshipState = Feelings & {
  stage: Stage;
  /** Total de mensagens enviadas pelo usuário. */
  userMessages: number;
  days: DayLog;
  /** Ganhos positivos já aplicados no dia `date` (teto diário). */
  dailyGains: Feelings & { date: string };
  /** Últimas mensagens do usuário, normalizadas (anti-grind). */
  recentUserMessages: string[];
  confession: Confession;
  pendingConflict: PendingConflict | null;
  mood: Mood;
};

export function initialRelationship(now: Date): RelationshipState {
  return {
    ...INITIAL_FEELINGS,
    stage: 0,
    userMessages: 0,
    days: emptyDayLog(),
    dailyGains: { date: "", affection: 0, trust: 0, romance: 0 },
    recentUserMessages: [],
    confession: initialConfession(),
    pendingConflict: null,
    mood: { emotion: "neutral", intensity: 0.3, at: now.toISOString() },
  };
}

// ---------------------------------------------------------------- anti-grind

/** Minúsculas, sem pontuação nem emoji, espaços colapsados. */
export function normalizeMessage(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Iguais (normalizadas) ou Jaccard de palavras ≥ 0,8. Recebe mensagens já normalizadas. */
export function isSimilar(a: string, b: string): boolean {
  if (a === b) return true;
  const wa = new Set(a.split(" ").filter(Boolean));
  const wb = new Set(b.split(" ").filter(Boolean));
  if (wa.size === 0 || wb.size === 0) return false;
  let inter = 0;
  for (const w of wa) if (wb.has(w)) inter++;
  return inter / (wa.size + wb.size - inter) >= SIMILARITY_THRESHOLD;
}

export type GrindKind = "repeat" | "short" | "silent" | null;

/**
 * Classifica o turno do usuário. `messages` são as mensagens cruas do turno
 * (o debounce junta várias). Repetição = todas repetem uma das últimas 10
 * (inclusive as anteriores do mesmo turno). Curta = o texto todo tem < 3 caracteres.
 * Sem mensagem (greet_return / idle_nudge) = "silent".
 */
export function classifyGrind(messages: readonly string[], recent: readonly string[]): GrindKind {
  if (messages.length === 0) return "silent";
  if (Array.from(messages.join(" ").trim()).length < SHORT_MESSAGE_CHARS) return "short";
  const window = [...recent];
  let allRepeat = true;
  for (const m of messages) {
    const n = normalizeMessage(m);
    if (!window.slice(-RECENT_WINDOW).some((r) => isSimilar(n, r))) allRepeat = false;
    window.push(n);
  }
  return allRepeat ? "repeat" : null;
}

export function applyGrind(d: Deltas, kind: GrindKind): Deltas {
  const pos = (v: number, f: (v: number) => number) => (v > 0 ? f(v) : v);
  switch (kind) {
    case "repeat": {
      const cut = (v: number) => Math.floor(v * REPEAT_MULT);
      return { affection: pos(d.affection, cut), trust: pos(d.trust, cut), romance: pos(d.romance, cut) };
    }
    case "short":
      return { affection: Math.min(d.affection, 1), trust: Math.min(d.trust, 0), romance: Math.min(d.romance, 0) };
    case "silent":
      return { affection: Math.min(d.affection, 0), trust: Math.min(d.trust, 0), romance: Math.min(d.romance, 0) };
    default:
      return d;
  }
}

// ---------------------------------------------------------------- estágios

export function progressStats(s: RelationshipState): ProgressStats {
  return { affection: s.affection, trust: s.trust, romance: s.romance, daysTalked: s.days.daysTalked.length, userMessages: s.userMessages };
}

/** Requisitos do estágio 5 cumpridos, menos a declaração. */
export function readyForCouple(s: RelationshipState, pace: PaceKey): boolean {
  return meetsRequirements(5, progressStats(s), pace);
}

/** Próximo estágio se todos os requisitos estiverem cumpridos. O 5 só vem pela declaração. */
export function nextStage(s: RelationshipState, pace: PaceKey): Stage | null {
  if (s.stage >= 4) return null;
  const next = (s.stage + 1) as Stage;
  return meetsRequirements(next, progressStats(s), pace) ? next : null;
}

export function distantOf(s: RelationshipState): boolean {
  return isDistant(s.stage, s.affection);
}

// ---------------------------------------------------------------- applyTurn

export type TurnInput = {
  turn: HanaTurn;
  /** Mensagens do usuário que este turno responde (vazio em greet_return / idle_nudge). */
  userMessages: readonly string[];
  now: Date;
  pace: PaceKey;
  timeZone?: string;
};

const MILESTONE_EVENTS: readonly HanaEvent[] = [
  "first_name_basis", "nickname", "inside_joke", "date_invite", "fight", "made_up", "confession_accepted",
];

export type TurnResult = {
  state: RelationshipState;
  /** Variação efetiva de cada sentimento neste turno. */
  applied: Deltas;
  grind: GrindKind;
  /** Estágio novo, se subiu. */
  stageUp: Stage | null;
  /** Evento que o código aceitou ("none" se não houve ou foi ignorado). */
  event: HanaEvent;
  eventIgnored: boolean;
  /** Marco para o álbum/toast. */
  milestone: HanaEvent | null;
  /** Abrir a ConfessionScene. */
  confessionScene: boolean;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function applyTurn(prev: RelationshipState, input: TurnInput): TurnResult {
  const { turn, userMessages, now, pace, timeZone } = input;
  const today = dateKey(now, timeZone);
  const cap = PACE[pace].dailyCap;

  // 0. cooldown vencido etc., com os números de antes do turno
  let confession = refreshConfession(prev.confession, { stage: prev.stage, ready: readyForCouple(prev, pace), now });

  // 1. clamp por mensagem · 2. anti-grind
  const grind = classifyGrind(userMessages, prev.recentUserMessages);
  const deltas = applyGrind(clampDeltas(turn.deltas), grind);

  // 3. teto diário (só ganhos) · 4. aplica, 0–100, teto de doki-doki
  const gains = prev.dailyGains.date === today ? { ...prev.dailyGains } : { date: today, affection: 0, trust: 0, romance: 0 };
  const next: Feelings = { affection: prev.affection, trust: prev.trust, romance: prev.romance };
  for (const k of FEELING_KEYS) {
    let d = deltas[k];
    if (d > 0) d = Math.min(d, Math.max(0, cap - gains[k]));
    next[k] = clamp(prev[k] + d, 0, k === "romance" ? ROMANCE_CAP[prev.stage] : 100);
    if (next[k] > prev[k]) gains[k] += next[k] - prev[k];
  }

  let stage = prev.stage;
  let pendingConflict = prev.pendingConflict;
  let event: HanaEvent = "none";
  let eventIgnored = false;
  let confessionScene = false;
  let forceMood: "shy" | "sad" | null = null;

  // eventos
  if (turn.event !== "none") {
    if (isConfessionEvent(turn.event)) {
      const out = applyConfessionEvent(confession, turn.event, now);
      if (out.accepted) {
        confession = out.confession;
        next.romance = clamp(next.romance + out.romanceDelta, 0, 100);
        forceMood = out.forceMood;
        if (out.becomeCouple) {
          stage = 5;
          confessionScene = true;
        }
      }
      eventIgnored = !out.accepted;
    } else if (turn.event === "fight") {
      // uma briga já em aberto não abre outra
      if (pendingConflict) eventIgnored = true;
      else pendingConflict = { reason: turn.thought, at: now.toISOString() };
    } else if (turn.event === "made_up") {
      if (pendingConflict) pendingConflict = null;
      else eventIgnored = true;
    }
    if (!eventIgnored) event = turn.event;
  }

  // 5. dias conversados, contagem e memória do anti-grind
  const days = recordUserMessages(prev.days, today, userMessages.length);
  const recentUserMessages = [...prev.recentUserMessages, ...userMessages.map(normalizeMessage)].slice(-RECENT_WINDOW);

  let state: RelationshipState = {
    ...prev,
    ...next,
    stage,
    userMessages: prev.userMessages + userMessages.length,
    days,
    dailyGains: gains,
    recentUserMessages,
    confession,
    pendingConflict,
  };

  // subida de estágio: no máximo um por turno, nunca desce
  let stageUp: Stage | null = stage !== prev.stage ? stage : null;
  if (stageUp === null) {
    const up = nextStage(state, pace);
    if (up !== null) {
      state = { ...state, stage: up };
      stageUp = up;
    }
  }
  const mood = correctMood(turn.emotion, turn.intensity, state.stage);
  if (forceMood) {
    mood.emotion = forceMood;
    mood.intensity = Math.max(mood.intensity, 0.5);
  }
  state = { ...state, mood: { ...mood, at: now.toISOString() } };
  state = { ...state, confession: refreshConfession(state.confession, { stage: state.stage, ready: readyForCouple(state, pace), now }) };

  const applied: Deltas = {
    affection: state.affection - prev.affection,
    trust: state.trust - prev.trust,
    romance: state.romance - prev.romance,
  };

  return {
    state,
    applied,
    grind,
    stageUp,
    event,
    eventIgnored,
    milestone: MILESTONE_EVENTS.includes(event) ? event : null,
    confessionScene,
  };
}
