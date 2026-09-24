import type { FeelingKey, Deltas, Feelings, Honorific, PaceKey, Stage } from "./types";

export const PACE = {
  lento:  { label: "Lento (slow burn)", dailyCap: 8,  mult: 1.5 },
  normal: { label: "Normal",            dailyCap: 12, mult: 1   },
  rapido: { label: "Rápido",            dailyCap: 24, mult: 0.5 },
} as const; // mult multiplica dias e mensagens exigidos (Math.ceil)

/** Teto de doki-doki por estágio. */
export const ROMANCE_CAP = [5, 10, 30, 60, 100, 100] as const;

/** Clamp por mensagem (5.1, passo 1). */
export const DELTA_LIMITS: Record<FeelingKey, { min: number; max: number }> = {
  affection: { min: -8, max: 4 },
  trust:     { min: -8, max: 4 },
  romance:   { min: -5, max: 4 },
};

/** Abaixo do mínimo de afeição do estágio por mais que isso, ela fica "distante". */
export const DISTANCE_MARGIN = 15;

export const INITIAL_FEELINGS: Feelings = { affection: 5, trust: 5, romance: 0 };

export type StageRequirements = {
  affection: number;
  trust: number;
  romance: number;
  days: number;
  messages: number;
  /** Só o estágio 5: precisa da declaração aceita. */
  confession: boolean;
};

export type StageInfo = {
  id: Stage;
  name: string;
  icon: string;
  /** Requisitos no ritmo normal. */
  req: StageRequirements;
  /** Banner do StageUpToast ao chegar neste estágio. */
  toast: string;
  /** Dica suave do NextStageHearts para sair deste estágio rumo ao próximo. */
  hint: string;
};

const req = (affection: number, trust: number, romance: number, days: number, messages: number, confession = false): StageRequirements =>
  ({ affection, trust, romance, days, messages, confession });

export const STAGES: readonly StageInfo[] = [
  { id: 0, name: "Desconhecidos",     icon: "🌱", req: req(0, 0, 0, 0, 0),             toast: "🌱 Um número desconhecido…",                  hint: "ela ainda está desconfiada… converse com calma" },
  { id: 1, name: "Conhecidos",        icon: "🌸", req: req(15, 10, 0, 1, 20),          toast: "🌸 Vocês agora são conhecidos!",              hint: "ela está curiosa sobre você" },
  { id: 2, name: "Amigos",            icon: "🌷", req: req(35, 30, 0, 2, 50),          toast: "🌷 Vocês agora são amigos!",                  hint: "ela gosta da sua companhia" },
  { id: 3, name: "Melhores amigos",   icon: "💐", req: req(55, 50, 0, 3, 100),         toast: "💐 Vocês agora são melhores amigos!",         hint: "às vezes ela demora pra responder… e volta corada" },
  { id: 4, name: "Crush (doki doki)", icon: "💗", req: req(70, 60, 40, 4, 150),        toast: "💗 …acho que ela está gostando de você",      hint: "o coração dela está a mil" },
  { id: 5, name: "Namorados",         icon: "💞", req: req(80, 70, 65, 5, 200, true),  toast: "💞 Agora vocês estão namorando!",             hint: "" },
];

export const TIME_HINT = "o tempo também conta: volte amanhã ✿";

/** Requisitos do estágio já ajustados pelo ritmo (dias e mensagens × mult, com Math.ceil). */
export function requirementsFor(stage: Stage, pace: PaceKey): StageRequirements {
  const base = STAGES[stage].req;
  const { mult } = PACE[pace];
  return { ...base, days: Math.ceil(base.days * mult), messages: Math.ceil(base.messages * mult) };
}

/** Números que decidem a subida de estágio. */
export type ProgressStats = Feelings & { daysTalked: number; userMessages: number };

const REQ_KEYS = [
  ["affection", "affection"],
  ["trust", "trust"],
  ["romance", "romance"],
  ["days", "daysTalked"],
  ["messages", "userMessages"],
] as const satisfies readonly (readonly [keyof StageRequirements, keyof ProgressStats])[];

/** Todos os requisitos numéricos do estágio cumpridos (ignora a declaração). */
export function meetsRequirements(stage: Stage, stats: ProgressStats, pace: PaceKey): boolean {
  const r = requirementsFor(stage, pace);
  return REQ_KEYS.every(([rk, sk]) => stats[sk] >= r[rk]);
}

export type StageProgress = {
  next: Stage | null;
  /** Menor progresso entre os requisitos numéricos, 0–1. */
  ratio: number;
  /** Corações cheios (0–5) do NextStageHearts. */
  hearts: number;
  /** Só falta tempo (dias conversados). */
  onlyTimeMissing: boolean;
  hint: string;
};

export function stageProgress(stage: Stage, stats: ProgressStats, pace: PaceKey): StageProgress {
  if (stage === 5) return { next: null, ratio: 1, hearts: 5, onlyTimeMissing: false, hint: "" };
  const next = (stage + 1) as Stage;
  const r = requirementsFor(next, pace);
  let ratio = 1;
  const missing: string[] = [];
  for (const [rk, sk] of REQ_KEYS) {
    const need = r[rk];
    if (need <= 0) continue;
    const have = stats[sk];
    ratio = Math.min(ratio, Math.max(0, Math.min(1, have / need)));
    if (have < need) missing.push(rk);
  }
  const onlyTimeMissing = missing.length === 1 && missing[0] === "days";
  return {
    next,
    ratio,
    hearts: Math.floor(ratio * 5),
    onlyTimeMissing,
    hint: onlyTimeMissing ? TIME_HINT : STAGES[stage].hint,
  };
}

/** Afeição caiu mais de DISTANCE_MARGIN abaixo do mínimo do estágio atual. */
export function isDistant(stage: Stage, affection: number): boolean {
  return affection < STAGES[stage].req.affection - DISTANCE_MARGIN;
}

/** Clamp por mensagem (5.1, passo 1). Valores não finitos viram 0. */
export function clampDeltas(d: Deltas): Deltas {
  const c = (k: FeelingKey) => {
    const v = Number.isFinite(d[k]) ? Math.trunc(d[k]) : 0;
    return Math.min(DELTA_LIMITS[k].max, Math.max(DELTA_LIMITS[k].min, v));
  };
  return { affection: c("affection"), trust: c("trust"), romance: c("romance") };
}

/** Como a Hana chama o usuário (5.3). */
export function callName(profile: { name: string; honorific: Honorific }, stage: Stage, nickname?: string | null): string {
  const { name, honorific } = profile;
  if (stage <= 1) return `${name}-san`;
  if (stage === 5) return nickname?.trim() || name;
  return honorific === "none" ? name : `${name}-${honorific}`;
}
