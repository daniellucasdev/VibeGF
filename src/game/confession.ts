// Máquina de estados da declaração (kokuhaku), tabela 5.4.
import type { ConfessionState, HanaEvent, Pronouns, Stage } from "../../shared/types";
import { DAY, HOUR } from "./time";

export const DECLINED_COOLDOWN_MS = 24 * HOUR;
export const REJECTED_COOLDOWN_MS = 48 * HOUR;
/** Depois de 2 dias em `open`, ela decide se declarar. */
export const OPEN_RESOLVE_MS = 2 * DAY;
export const REJECTED_ROMANCE_PENALTY = -10;

export type Confession = {
  state: ConfessionState;
  openSince: string | null;
  cooldownUntil: string | null;
  cooldownKind: "declined" | "rejected" | null;
  togetherSince: string | null;
};

export const initialConfession = (): Confession => ({
  state: "locked", openSince: null, cooldownUntil: null, cooldownKind: null, togetherSince: null,
});

export type ConfessionContext = {
  stage: Stage;
  /** Requisitos do estágio 5 cumpridos, menos a declaração. */
  ready: boolean;
  now: Date;
};

/**
 * Transições que dependem só do tempo e dos números (sem evento):
 * estágio 5 → together; cooldown vencido → recalcula; locked ↔ open conforme os requisitos.
 * `she_confessed` espera a resposta do usuário e não muda sozinho.
 */
export function refreshConfession(c: Confession, ctx: ConfessionContext): Confession {
  if (c.state === "together") return c;
  if (ctx.stage === 5) return { ...c, state: "together", togetherSince: c.togetherSince ?? ctx.now.toISOString() };
  if (c.state === "she_confessed") return c;
  if (c.state === "cooldown") {
    if (c.cooldownUntil && ctx.now.getTime() < new Date(c.cooldownUntil).getTime()) return c;
    c = { ...c, state: "locked", cooldownUntil: null, cooldownKind: null };
  }
  const canOpen = ctx.stage === 4 && ctx.ready;
  if (canOpen && c.state === "locked") return { ...c, state: "open", openSince: ctx.now.toISOString() };
  if (!canOpen && c.state === "open") return { ...c, state: "locked", openSince: null };
  return c;
}

export type ConfessionOutcome = {
  confession: Confession;
  /** O evento valeu (false = ignorado pelo código). */
  accepted: boolean;
  /** Efeitos para o applyTurn aplicar. */
  romanceDelta: number;
  forceMood: "shy" | "sad" | null;
  becomeCouple: boolean;
};

const CONFESSION_EVENTS: readonly HanaEvent[] = ["she_confessed", "confession_accepted", "confession_declined", "confession_rejected"];

export const isConfessionEvent = (e: HanaEvent) => CONFESSION_EVENTS.includes(e);

/** Aplica um evento de declaração validando o estado atual. Eventos inválidos são ignorados. */
export function applyConfessionEvent(c: Confession, event: HanaEvent, now: Date): ConfessionOutcome {
  const none: ConfessionOutcome = { confession: c, accepted: false, romanceDelta: 0, forceMood: null, becomeCouple: false };
  const iso = now.toISOString();
  const cooldown = (ms: number, kind: "declined" | "rejected"): Confession =>
    ({ ...c, state: "cooldown", openSince: null, cooldownUntil: new Date(now.getTime() + ms).toISOString(), cooldownKind: kind });

  switch (event) {
    case "she_confessed":
      if (c.state !== "open") return none;
      return { ...none, accepted: true, confession: { ...c, state: "she_confessed" } };
    case "confession_accepted":
      if (c.state !== "open" && c.state !== "she_confessed") return none;
      return {
        ...none, accepted: true, becomeCouple: true,
        confession: { ...c, state: "together", togetherSince: iso, openSince: null, cooldownUntil: null, cooldownKind: null },
      };
    case "confession_declined":
      // o usuário se declarou e ela pediu tempo: vale enquanto não há declaração dela pendente nem namoro
      if (c.state === "together" || c.state === "she_confessed") return none;
      return { ...none, accepted: true, forceMood: "shy", confession: cooldown(DECLINED_COOLDOWN_MS, "declined") };
    case "confession_rejected":
      // ela se declarou e o usuário recusou
      if (c.state !== "she_confessed") return none;
      return {
        ...none, accepted: true, forceMood: "sad", romanceDelta: REJECTED_ROMANCE_PENALTY,
        confession: cooldown(REJECTED_COOLDOWN_MS, "rejected"),
      };
    default:
      return none;
  }
}

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

/** Frase do bloco AGORA para o estado da declaração (tabela 5.4). */
export function confessionNote(c: Confession, now: Date, pronouns: Pronouns = "ele"): string {
  switch (c.state) {
    case "locked":
      return "você ainda não está pronta para namorar";
    case "open": {
      const base = "se o usuário se declarar, você pode aceitar; você também pode se declarar se surgir um momento especial";
      const since = c.openSince ? new Date(c.openSince).getTime() : now.getTime();
      return now.getTime() - since >= OPEN_RESOLVE_MS
        ? `${base}. você está decidida a se declarar hoje, se o clima permitir`
        : base;
    }
    case "she_confessed":
      return "você acabou de se declarar e espera a resposta, morrendo de vergonha";
    case "cooldown":
      return c.cooldownKind === "rejected"
        ? `você se declarou e ${pronouns} recusou; está triste, mas seguindo`
        : "o usuário se declarou e você pediu tempo";
    case "together":
      return `vocês estão namorando desde ${c.togetherSince ? formatDate(c.togetherSince) : formatDate(now.toISOString())}`;
  }
}
