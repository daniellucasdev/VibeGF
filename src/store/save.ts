// Save do jogo (seção 10): o formato persistido em localStorage, o estado inicial,
// a validação/migração do que vem do disco e as atualizações puras que o store usa.
import { z } from "zod";
import type { PersistStorage, StorageValue } from "zustand/middleware";
import {
  CONFESSION_STATES, EMOTIONS, REACTIONS,
  type Emotion, type HanaEvent, type HanaTurn, type PaceKey, type Profile, type Reaction, type Stage,
} from "../../shared/types";
import { MAX_MEMORIES, addMemories } from "../game/memories";
import { correctMood } from "../game/mood";
import { RECENT_WINDOW, applyTurn, initialRelationship, type RelationshipState, type TurnResult } from "../game/relationship";
import { cutChars } from "../lib/text";

export const SAVE_KEY = "kokoro-save";
export const SAVE_VERSION = 1;
/** O cliente guarda até 400 mensagens (envia só as últimas 30). */
export const MAX_MESSAGES = 400;
export const USER_MESSAGE_MAX_CHARS = 500;
export const NAME_MAX_CHARS = 20;
export const SUMMARY_MAX_CHARS = 1200;
export const INITIAL_SUMMARY =
  "A Hana mandou mensagem pro número errado (achou que era a Yui), contando que o gato Daifuku tinha fugido do café.";

// ------------------------------------------------------------------ tipos

export type UserMessage = {
  id: number; role: "user"; text: string; at: string;
  status: "sent" | "seen";
  /** Reação da Hana a esta mensagem (adesivo no canto da bolha). */
  reaction: Reaction | null;
};
export type HanaMessage = {
  id: number; role: "hana"; text: string; at: string;
  /** Emoção daquele balão (kaomoji do avatar). */
  emotion: Emotion;
  /** Monólogo interno do turno; fica no último balão (ThoughtCloud). */
  thought: string | null;
};
export type SceneMessage = { id: number; role: "scene"; text: string; at: string };
export type ChatMessage = UserMessage | HanaMessage | SceneMessage;

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type NewMessage = DistributiveOmit<ChatMessage, "id">;

export type Memory = { id: number; text: string; at: string };

export const MILESTONE_KINDS = [
  "first_message", "stage_up", "first_name_basis", "nickname", "inside_joke", "date_invite", "fight", "made_up", "confession_accepted",
] as const;
export type MilestoneKind = (typeof MILESTONE_KINDS)[number];
/** Marco do álbum: data, estágio, a frase marcante dela e a emoção (kaomoji). */
export type Milestone = { id: number; kind: MilestoneKind; at: string; stage: Stage; quote: string; emotion: Emotion };

export type ThemeChoice = "auto" | "day" | "night";

export type Settings = {
  pace: PaceKey;
  theme: ThemeChoice;
  sound: boolean;
  reduceMotion: boolean;
  /** "ler pensamentos 💭" (spoiler, desligado por padrão). */
  readThoughts: boolean;
  showNumbers: boolean;
  /** Mensagem de silêncio (5.5), ligada por padrão. */
  idleNudge: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  pace: "normal", theme: "auto", sound: true, reduceMotion: false, readThoughts: false, showNumbers: false, idleNudge: true,
};

/** Tudo o que vai para o localStorage. */
export type SaveData = {
  profile: Profile | null;
  settings: Settings;
  /** Sentimentos, estágio, dailyGains, dias conversados, humor, declaração e briga em aberto. */
  relationship: RelationshipState;
  messages: ChatMessage[];
  /** Próximo id (mensagens, memórias e marcos compartilham o contador). */
  nextId: number;
  /** Id da última mensagem já coberta pelo `summary`. */
  summarizedUpTo: number;
  memories: Memory[];
  summary: string;
  milestones: Milestone[];
  lastInteractionAt: string | null;
  /** A cena de abertura já terminou (se não, ela recomeça ao recarregar). */
  openingDone: boolean;
};

export const SAVE_KEYS = [
  "profile", "settings", "relationship", "messages", "nextId", "summarizedUpTo",
  "memories", "summary", "milestones", "lastInteractionAt", "openingDone",
] as const satisfies readonly (keyof SaveData)[];

export function initialSave(now: Date): SaveData {
  return {
    profile: null,
    settings: { ...DEFAULT_SETTINGS },
    relationship: initialRelationship(now),
    messages: [],
    nextId: 1,
    summarizedUpTo: 0,
    memories: [],
    summary: INITIAL_SUMMARY,
    milestones: [],
    lastInteractionAt: null,
    openingDone: false,
  };
}

/** Só os campos persistidos (tira as ações do store). */
export function pickSave(s: SaveData): SaveData {
  const out = {} as Record<keyof SaveData, unknown>;
  for (const k of SAVE_KEYS) out[k] = s[k];
  return out as SaveData;
}

// ------------------------------------------------------- validação do disco
// Cada campo é validado por conta própria: um pedaço estragado não apaga o resto.

const iso = z.string().refine((s) => !Number.isNaN(Date.parse(s)));
const clampTo = (lo: number, hi: number) => z.number().transform((n) => Math.min(hi, Math.max(lo, n)));
const count = z.number().int().min(0);
const id = z.number().int().positive();
const stage = z.literal([0, 1, 2, 3, 4, 5]);

const ProfileSchema = z.object({
  name: z.string().trim().min(1).transform((s) => cutChars(s, NAME_MAX_CHARS)),
  pronouns: z.enum(["ele", "ela", "elu"]),
  honorific: z.enum(["kun", "chan", "none"]),
});

const SettingsSchema = z.object({
  pace: z.enum(["lento", "normal", "rapido"]).catch(DEFAULT_SETTINGS.pace),
  theme: z.enum(["auto", "day", "night"]).catch(DEFAULT_SETTINGS.theme),
  sound: z.boolean().catch(DEFAULT_SETTINGS.sound),
  reduceMotion: z.boolean().catch(DEFAULT_SETTINGS.reduceMotion),
  readThoughts: z.boolean().catch(DEFAULT_SETTINGS.readThoughts),
  showNumbers: z.boolean().catch(DEFAULT_SETTINGS.showNumbers),
  idleNudge: z.boolean().catch(DEFAULT_SETTINGS.idleNudge),
});

const RelationshipSchema = z.object({
  affection: clampTo(0, 100),
  trust: clampTo(0, 100),
  romance: clampTo(0, 100),
  stage,
  userMessages: count,
  days: z.object({
    daysTalked: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
    today: z.object({ date: z.string(), count }),
  }),
  dailyGains: z.object({ date: z.string(), affection: count, trust: count, romance: count }),
  recentUserMessages: z.array(z.string()).transform((a) => a.slice(-RECENT_WINDOW)),
  confession: z.object({
    state: z.enum(CONFESSION_STATES),
    openSince: iso.nullable(),
    cooldownUntil: iso.nullable(),
    cooldownKind: z.enum(["declined", "rejected"]).nullable(),
    togetherSince: iso.nullable(),
  }),
  pendingConflict: z.object({ reason: z.string(), at: iso }).nullable(),
  mood: z.object({ emotion: z.enum(EMOTIONS), intensity: clampTo(0, 1), at: iso }),
});

const MessageSchema = z.discriminatedUnion("role", [
  z.object({
    id, role: z.literal("user"), text: z.string().transform((s) => cutChars(s, USER_MESSAGE_MAX_CHARS)), at: iso,
    status: z.enum(["sent", "seen"]), reaction: z.enum(REACTIONS).nullable(),
  }),
  z.object({ id, role: z.literal("hana"), text: z.string(), at: iso, emotion: z.enum(EMOTIONS), thought: z.string().nullable() }),
  z.object({ id, role: z.literal("scene"), text: z.string(), at: iso }),
]);

const MemorySchema = z.object({ id, text: z.string().min(1), at: iso });
const MilestoneSchema = z.object({ id, kind: z.enum(MILESTONE_KINDS), at: iso, stage, quote: z.string(), emotion: z.enum(EMOTIONS) });

// Garante em tempo de compilação que os schemas e os tipos não divergem.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const _checks: [
  Same<z.infer<typeof ProfileSchema>, Profile>,
  Same<z.infer<typeof SettingsSchema>, Settings>,
  Same<z.infer<typeof RelationshipSchema>, RelationshipState>,
  Same<z.infer<typeof MessageSchema>, ChatMessage>,
  Same<z.infer<typeof MemorySchema>, Memory>,
  Same<z.infer<typeof MilestoneSchema>, Milestone>,
] = [true, true, true, true, true, true];
void _checks;

/** Itens válidos de uma lista, com ids estritamente crescentes (descarta o resto). */
function validItems<T extends { id: number }>(raw: unknown, schema: z.ZodType<T>): T[] {
  if (!Array.isArray(raw)) return [];
  const out: T[] = [];
  for (const item of raw) {
    const p = schema.safeParse(item);
    if (p.success && (out.length === 0 || p.data.id > out[out.length - 1].id)) out.push(p.data);
  }
  return out;
}

/**
 * Transforma qualquer coisa lida do disco num SaveData válido: aproveita cada campo
 * que passa na validação e completa o resto com o estado inicial.
 */
export function sanitizeSave(raw: unknown, now: Date): SaveData {
  const base = initialSave(now);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  const r = raw as Record<string, unknown>;

  const profile = ProfileSchema.safeParse(r.profile);
  const settings = SettingsSchema.safeParse(r.settings && typeof r.settings === "object" ? r.settings : {});
  const relationship = RelationshipSchema.safeParse(r.relationship);
  const messages = validItems(r.messages, MessageSchema).slice(-MAX_MESSAGES);
  const memories = validItems(r.memories, MemorySchema).slice(-MAX_MEMORIES);
  const milestones = validItems(r.milestones, MilestoneSchema);
  const maxId = Math.max(0, ...[...messages, ...memories, ...milestones].map((x) => x.id));
  const nextId = count.safeParse(r.nextId);
  const summarizedUpTo = count.safeParse(r.summarizedUpTo);
  const lastInteractionAt = iso.safeParse(r.lastInteractionAt);

  return {
    profile: profile.success ? profile.data : null,
    settings: settings.success ? settings.data : base.settings,
    relationship: relationship.success ? relationship.data : base.relationship,
    messages,
    nextId: Math.max(maxId + 1, nextId.success ? nextId.data : 1),
    summarizedUpTo: summarizedUpTo.success ? summarizedUpTo.data : 0,
    memories,
    summary: typeof r.summary === "string" ? cutChars(r.summary, SUMMARY_MAX_CHARS) : base.summary,
    milestones,
    lastInteractionAt: lastInteractionAt.success ? lastInteractionAt.data : null,
    // save antigo sem o campo: se já tem conversa, a abertura já passou
    openingDone: typeof r.openingDone === "boolean" ? r.openingDone : messages.length > 0,
  };
}

/**
 * `migrate` do persist: roda quando a versão salva é diferente de SAVE_VERSION.
 * A versão 1 é o primeiro formato; de qualquer versão anterior ou desconhecida,
 * aproveita o que for reconhecível e completa o resto.
 */
export function migrateSave(persisted: unknown, _fromVersion: number, now: Date): SaveData {
  return sanitizeSave(persisted, now);
}

// ------------------------------------------------------------ localStorage

/** Storage do persist com try/catch na leitura e na escrita (JSON estragado, cota cheia, modo privado). */
export function createSafeStorage(getStorage: () => Storage | undefined): PersistStorage<SaveData> {
  const storage = (): Storage | undefined => {
    try {
      return getStorage();
    } catch {
      return undefined;
    }
  };
  return {
    getItem: (name) => {
      try {
        const text = storage()?.getItem(name);
        return text ? (JSON.parse(text) as StorageValue<SaveData>) : null;
      } catch (e) {
        console.warn("[kokoro] não consegui ler o save; começando do zero", e);
        return null;
      }
    },
    setItem: (name, value) => {
      try {
        storage()?.setItem(name, JSON.stringify(value));
      } catch (e) {
        console.warn("[kokoro] não consegui salvar", e);
      }
    },
    removeItem: (name) => {
      try {
        storage()?.removeItem(name);
      } catch {
        /* nada a fazer */
      }
    },
  };
}

export const browserStorage = (): Storage | undefined =>
  typeof window === "undefined" ? undefined : window.localStorage;

// ------------------------------------------------------ atualizações puras

/** Acrescenta uma mensagem (com id novo), mantendo só as 400 mais recentes. */
export function pushMessage(save: SaveData, msg: NewMessage): { save: SaveData; id: number } {
  const id = save.nextId;
  const messages = [...save.messages, { ...msg, id } as ChatMessage].slice(-MAX_MESSAGES);
  const lastInteractionAt = msg.role === "scene" ? save.lastInteractionAt : msg.at;
  return { save: { ...save, messages, nextId: id + 1, lastInteractionAt }, id };
}

/** "✓ enviado" → "✓✓ visto". */
export function markSeen(save: SaveData, ids: readonly number[]): SaveData {
  const set = new Set(ids);
  return {
    ...save,
    messages: save.messages.map((m) => (m.role === "user" && m.status === "sent" && set.has(m.id) ? { ...m, status: "seen" } : m)),
  };
}

/** Humor definido de fora do turno (cena de abertura). Passa pelas correções de 5.2. */
export function setMood(save: SaveData, emotion: Emotion, intensity: number, now: Date): SaveData {
  const mood = { ...correctMood(emotion, intensity, save.relationship.stage), at: now.toISOString() };
  return { ...save, relationship: { ...save.relationship, mood } };
}

const isMilestoneKind = (e: HanaEvent | MilestoneKind): e is MilestoneKind =>
  (MILESTONE_KINDS as readonly string[]).includes(e);

export type CommitInput = {
  turn: HanaTurn;
  /** Mensagens do usuário que este turno responde. */
  userIds: readonly number[];
  now: Date;
  timeZone?: string;
};

/**
 * Aplica o turno da Hana ao save: applyTurn (5.1–5.4), memórias novas,
 * reação na última mensagem do usuário e marcos do álbum.
 * Os balões entram depois, um a um (pushMessage).
 */
export function commitTurn(save: SaveData, input: CommitInput): { save: SaveData; result: TurnResult } {
  const { turn, userIds, now } = input;
  const ids = new Set(userIds);
  const texts = save.messages.flatMap((m) => (m.role === "user" && ids.has(m.id) ? [m.text] : []));
  const result = applyTurn(save.relationship, {
    turn, userMessages: texts, now, pace: save.settings.pace, timeZone: input.timeZone,
  });

  const at = now.toISOString();
  let nextId = save.nextId;
  const memories = addMemories(save.memories, turn.newMemories, (text) => ({ id: nextId++, text, at }));

  const lastUserId = userIds.length ? Math.max(...userIds) : null;
  const reaction = turn.reaction === "none" ? null : turn.reaction;
  const messages = reaction && lastUserId !== null
    ? save.messages.map((m) => (m.role === "user" && m.id === lastUserId ? { ...m, reaction } : m))
    : save.messages;

  const milestones = [...save.milestones];
  const quote = turn.messages[0] ?? "";
  const emotion = result.state.mood.emotion;
  if (result.stageUp !== null) {
    milestones.push({ id: nextId++, kind: "stage_up", at, stage: result.stageUp, quote, emotion });
  }
  if (result.milestone && isMilestoneKind(result.milestone)) {
    milestones.push({ id: nextId++, kind: result.milestone, at, stage: result.state.stage, quote, emotion });
  }

  return {
    save: { ...save, relationship: result.state, memories, messages, milestones, nextId, lastInteractionAt: at },
    result,
  };
}
