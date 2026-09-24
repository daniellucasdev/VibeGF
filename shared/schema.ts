import { z } from "zod";
import { clampDeltas } from "./stages";
import { EMOTIONS, EVENTS, REACTIONS, type HanaTurn } from "./types";

export { EMOTIONS, EVENTS, REACTIONS };

// `thought` fica em primeiro: o modelo gera na ordem do schema, e pensar
// antes deixa a emoção e as falas coerentes.
export const HanaTurnSchema = z.object({
  thought: z.string(),                       // monólogo interno, 1–2 frases, 1ª pessoa
  emotion: z.enum(EMOTIONS),
  intensity: z.number(),                     // 0–1 (clamp no código)
  messages: z.array(z.string()),             // 1–3 balões
  reaction: z.enum(REACTIONS),               // reação à última mensagem do usuário
  deltas: z.object({ affection: z.number().int(), trust: z.number().int(), romance: z.number().int() }),
  newMemories: z.array(z.string()),          // 0–2 fatos duradouros sobre o usuário
  event: z.enum(EVENTS),
});

// Garante em tempo de compilação que o Zod e o tipo manual não divergem.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const _schemaMatchesType: Same<z.infer<typeof HanaTurnSchema>, HanaTurn> = true;
void _schemaMatchesType;

// JSON Schema escrito à mão para a saída estruturada. Sem minimum/maximum,
// minLength ou maxItems (não suportados); os limites ficam em sanitizeTurn().
export const HANA_TURN_JSON_SCHEMA = {
  type: "object",
  properties: {
    thought: { type: "string" },
    emotion: { type: "string", enum: [...EMOTIONS] },
    intensity: { type: "number" },
    messages: { type: "array", items: { type: "string" } },
    reaction: { type: "string", enum: [...REACTIONS] },
    deltas: {
      type: "object",
      properties: {
        affection: { type: "integer" },
        trust: { type: "integer" },
        romance: { type: "integer" },
      },
      required: ["affection", "trust", "romance"],
      additionalProperties: false,
    },
    newMemories: { type: "array", items: { type: "string" } },
    event: { type: "string", enum: [...EVENTS] },
  },
  required: ["thought", "emotion", "intensity", "messages", "reaction", "deltas", "newMemories", "event"],
  additionalProperties: false,
} as const;

export const TURN_LIMITS = { maxMessages: 3, maxMessageChars: 400, maxMemories: 2 } as const;

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);
const cut = (s: string, max: number) => Array.from(s).slice(0, max).join("");

/**
 * Aplica os limites que o JSON Schema não expressa: descarta balões vazios,
 * corta cada balão em 400 caracteres, no máximo 3 balões, no máximo 2 memórias,
 * clamp dos deltas (5.1) e intensidade em 0–1.
 * Devolve `null` se não sobrar nenhum balão (o chamador tenta de novo).
 */
export function sanitizeTurn(turn: HanaTurn): HanaTurn | null {
  const messages = turn.messages
    .map((m) => m.trim())
    .filter((m) => m.length > 0)
    .slice(0, TURN_LIMITS.maxMessages)
    .map((m) => cut(m, TURN_LIMITS.maxMessageChars));
  if (messages.length === 0) return null;
  const newMemories = turn.newMemories
    .map((m) => m.trim())
    .filter((m) => m.length > 0)
    .slice(0, TURN_LIMITS.maxMemories);
  return {
    ...turn,
    thought: turn.thought.trim(),
    intensity: clamp01(turn.intensity),
    messages,
    deltas: clampDeltas(turn.deltas),
    newMemories,
  };
}

/** JSON.parse + safeParse + sanitizeTurn. `null` em qualquer falha. */
export function parseHanaTurn(text: string): HanaTurn | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  const parsed = HanaTurnSchema.safeParse(raw);
  return parsed.success ? sanitizeTurn(parsed.data) : null;
}
