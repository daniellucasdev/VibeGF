// Tipos compartilhados entre o front e o servidor.
// As listas fechadas (emoções, reações, eventos) moram aqui para que o
// schema Zod, o JSON Schema e a lógica do jogo usem exatamente os mesmos valores.

export const EMOTIONS = ["neutral","happy","excited","shy","flustered","love","sad","crying","pouty","surprised","thinking","sleepy","teasing"] as const;
export const REACTIONS = ["none","heart","laugh","sparkle","sad","angry","surprised"] as const;
export const EVENTS = ["none","first_name_basis","nickname","inside_joke","fight","made_up","she_confessed","confession_accepted","confession_declined","confession_rejected","date_invite"] as const;
export const CONFESSION_STATES = ["locked", "open", "she_confessed", "cooldown", "together"] as const;

export type Emotion = (typeof EMOTIONS)[number];
export type Reaction = (typeof REACTIONS)[number];
export type HanaEvent = (typeof EVENTS)[number];
export type ConfessionState = (typeof CONFESSION_STATES)[number];

export type Stage = 0 | 1 | 2 | 3 | 4 | 5;
export type PaceKey = "lento" | "normal" | "rapido";
export type Pronouns = "ele" | "ela" | "elu";
export type Honorific = "kun" | "chan" | "none";

export type Feelings = { affection: number; trust: number; romance: number };
export type FeelingKey = keyof Feelings;
export type Deltas = Feelings;

/** Turno da Hana como o Claude devolve (validado por HanaTurnSchema). */
export type HanaTurn = {
  thought: string;
  emotion: Emotion;
  intensity: number;
  messages: string[];
  reaction: Reaction;
  deltas: Deltas;
  newMemories: string[];
  event: HanaEvent;
};

/** Humor do momento. `at` é ISO: o decaimento conta a partir dele. */
export type Mood = { emotion: Emotion; intensity: number; at: string };

export type PendingConflict = { reason: string; at: string };

export type Profile = {
  name: string;
  pronouns: Pronouns;
  honorific: Honorific;
};

export type ChatMode = "reply" | "greet_return" | "idle_nudge";

export type HistoryItem = { role: "user" | "hana" | "scene"; text: string; at: string };

export type ChatRequest = {
  mode: ChatMode;
  profile: Profile & { addressAs: string };
  relationship: {
    stage: Stage;
    affection: number;
    trust: number;
    romance: number;
    daysTalked: number;
    distant: boolean;
    pendingConflict: string | null;
    confession: ConfessionState;
    confessionNote: string;
    togetherSince: string | null;
  };
  mood: { emotion: Emotion; intensity: number };
  memories: string[];
  summary: string;
  history: HistoryItem[];
  client: { nowIso: string; timeZone: string };
};

/** Corpo de POST /api/summarize: resumo anterior + mensagens antigas. */
export type SummarizeRequest = { previousSummary: string; messages: HistoryItem[] };

/** Contagem de tokens (subconjunto do `usage` da API), para o painel de debug. */
export type Usage = {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
};

/** Resposta de POST /api/chat. `usage` e `mock` só em desenvolvimento. */
export type ChatResponse = HanaTurn & { usage?: Usage; mock?: boolean };

export type SummarizeResponse = { summary: string };

/** Corpo de erro de qualquer rota da API. */
export type ApiError = { error: string };
