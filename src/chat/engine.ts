// Motor da conversa (9.1–9.2): debounce que junta mensagens, "visto", "digitando…",
// balões em sequência, cena de abertura roteirizada e resumo (5.6).
// Os tempos usam o relógio real (setTimeout); as datas das mensagens e a lógica do jogo
// usam o now() central, para a viagem no tempo do debug valer em tudo.
import type { ChatRequest, ChatResponse, HanaEvent, HanaTurn, SummarizeRequest, SummarizeResponse } from "../../shared/types";
import { STAGES } from "../../shared/stages";
import type { TurnResult } from "../game/relationship";
import { HOUR, now as clockNow } from "../game/time";
import { errorMessage } from "../lib/api";
import { cutChars } from "../lib/text";
import { USER_MESSAGE_MAX_CHARS } from "../store/save";
import { initialChatUi, type ChatUiState, type ChatUiStore } from "../store/useChatUi";
import type { GameStore } from "../store/useGame";
import { toasts } from "../components/Toasts";
import { pop } from "../lib/sound";
import { OPENING_CAPTION, OPENING_CAPTION_MS, OPENING_LINES, OPENING_UNDIM_MS } from "./opening";
import { browserTimeZone, buildChatRequest, displayMood, summarizeBatch, toHistoryItem, unansweredUserIds } from "./request";
import { DEBOUNCE_MS, balloonGapMs, readDelayMs, talkTailMs, typingDelayMs } from "./timing";

export type EngineApi = {
  chat: (req: ChatRequest) => Promise<ChatResponse>;
  summarize: (req: SummarizeRequest) => Promise<SummarizeResponse>;
};

export type EngineDeps = {
  game: GameStore;
  ui: ChatUiStore;
  api: EngineApi;
  now?: () => Date;
  random?: () => number;
  timeZone?: () => string;
};

export type ChatEngine = {
  /** Na carga do app: abertura pendente, retorno após ausência ou o que ficou sem resposta. */
  boot: () => void;
  send: (text: string) => void;
  /** Botão "tentar de novo" do ErrorBubble. */
  retry: () => void;
  playOpening: () => Promise<void>;
  /** Cancela tudo o que está em andamento (apagar tudo). */
  reset: () => void;
  /** Mostra na hora os balões que faltam (a página vai fechar). */
  flushDelivery: () => void;
  /** Silêncio (5.5): ela manda UMA mensagem se o usuário sumir com a aba visível. */
  pokeIdle: () => void;
};

type Balloon = { text: string; thought: string | null; pauseBeforeMs?: number };

/** Retorno (9.3): última interação há mais de 6 h na carga → greet_return. */
export const RETURN_GAP_MS = 6 * HOUR;
/** Silêncio (5.5): 5 min em silêncio com a aba visível → idle_nudge (uma vez). */
export const IDLE_NUDGE_MS = 5 * 60_000;

type Outcome = { ok: true; res: ChatResponse } | { ok: false; error: unknown };

type DeliverOptions = {
  alive: () => boolean;
  /** O "digitando…" já está na tela desde este instante: o 1º balão desconta esse tempo. */
  typingSince?: number;
  /** Roda antes de mostrar o balão i (o turno é aplicado junto com o primeiro). */
  before: (i: number) => void;
};

export function createChatEngine(deps: EngineDeps): ChatEngine {
  const { game, ui, api } = deps;
  const now = deps.now ?? clockNow;
  const random = deps.random ?? Math.random;
  const timeZone = deps.timeZone ?? browserTimeZone;

  /** Muda em reset(): tudo o que estava em andamento para no próximo passo. */
  let gen = 0;
  let booted = false;
  /** Mensagens do usuário esperando o próximo turno. */
  let pending: number[] = [];
  let busy = false;
  let opening = false;
  let summarizing = false;
  let debounce: ReturnType<typeof setTimeout> | undefined;
  let lastSendAt = 0;
  let flushRest: (() => void) | null = null;
  /** Silêncio atual já respondeu (5.5): uma mensagem por silêncio, no máximo. */
  let nudged = false;

  const g = () => game.getState();
  const setUi = (patch: Partial<ChatUiState>) => ui.setState(patch);
  const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  function schedule(ms: number) {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      debounce = undefined;
      void runTurn();
    }, ms);
  }

  function send(raw: string) {
    const text = cutChars(raw.trim(), USER_MESSAGE_MAX_CHARS);
    if (!text || opening || !g().profile) return;
    armIdle(); // o usuário voltou a interagir: o próximo silêncio pode ter mensagem dela
    const id = g().appendMessage({ role: "user", text, at: now().toISOString(), status: "sent", reaction: null });
    pending.push(id);
    lastSendAt = Date.now();
    setUi({ error: null });
    // Com uma resposta em andamento, a mensagem espera o turno seguinte.
    if (!busy) schedule(DEBOUNCE_MS);
  }

  function retry() {
    if (busy || opening || pending.length === 0) return;
    clearTimeout(debounce);
    void runTurn();
  }

  async function runTurn() {
    if (busy || opening || pending.length === 0) return;
    const myGen = gen;
    const alive = () => myGen === gen;
    const ids = pending;
    pending = [];
    busy = true;
    setUi({ error: null });

    const state = g();
    const at = now();
    let call: Promise<Outcome>;
    try {
      const req = buildChatRequest(state, "reply", at, timeZone());
      call = api.chat(req).then(
        (res): Outcome => ({ ok: true, res }),
        (error: unknown): Outcome => ({ ok: false, error }),
      );
    } catch (error) {
      call = Promise.resolve({ ok: false, error });
    }
    const early = { failed: false };
    void call.then((o) => {
      if (!o.ok) early.failed = true;
    });

    // Leitura com a chamada já em andamento: 400–1200 ms, ou 2–4 s emburrada/com briga em aberto.
    const upset = displayMood(state, at).emotion === "pouty" || state.relationship.pendingConflict !== null;
    await sleep(readDelayMs(upset, random));
    if (!alive()) return;
    if (!early.failed) {
      g().markSeen(ids);
      setUi({ typing: true });
    }
    const typingSince = Date.now();

    const outcome = await call;
    if (!alive()) return;
    if (!outcome.ok) {
      // Sem nova tentativa automática: só pelo botão ou junto com a próxima mensagem.
      pending = [...ids, ...pending];
      busy = false;
      setUi({ typing: false, error: { message: errorMessage(outcome.error) } });
      return;
    }

    setUi({ lastResponse: outcome.res });
    await deliverTurn(outcome.res, ids, typingSince, alive);
    if (!alive()) return;
    busy = false;
    void maybeSummarize();
    if (pending.length) schedule(Math.max(0, lastSendAt + DEBOUNCE_MS - Date.now()));
  }

  async function deliverTurn(turn: HanaTurn, ids: number[], typingSince: number, alive: () => boolean) {
    let committed = false;
    const commit = () => {
      if (committed) return;
      committed = true;
      // applyTurn + memórias + reação + marcos, junto com o primeiro balão
      const result = g().commitTurn({ turn, userIds: ids, now: now() });
      ui.setState((s) => ({ lastDeltas: { key: (s.lastDeltas?.key ?? 0) + 1, applied: result.applied } }));
      announceResult(result, turn);
    };
    const last = turn.messages.length - 1;
    const balloons: Balloon[] = turn.messages.map((text, i) => ({ text, thought: i === last && turn.thought ? turn.thought : null }));
    await deliver(balloons, { alive, typingSince, before: commit });
  }

  /** Toasts + som depois do turno aplicado (9.4): subida de estágio, marcos, declaração. */
  function announceResult(result: TurnResult, turn: HanaTurn) {
    const s = g();
    if (s.settings.sound) pop();
    if (result.stageUp !== null) {
      const info = STAGES[result.stageUp];
      toasts.stageUp(info.icon, info.toast);
    }
    if (result.confessionScene) {
      ui.setState({ confession: { quote: turn.messages[0] ?? "", key: Date.now() } });
    }
    const MILESTONE_TOASTS: Partial<Record<HanaEvent, string>> = {
      first_name_basis: "ela te chamou só pelo nome pela primeira vez",
      nickname: "vocês combinaram um apelido ♡",
      inside_joke: "nasceu uma piada interna 😂",
      date_invite: "vocês combinaram de sair 📅",
      fight: "vocês brigaram… tenta conversar com ela",
      made_up: "pazes feitas 🕊",
      she_confessed: "ela acabou de se declarar!! (〃▽〃)",
    };
    const text = MILESTONE_TOASTS[result.event];
    if (text) toasts.milestone("💬", text);
  }

  /**
   * Balões um a um: pausa de 300–700 ms, "digitando…" por min(600 + 35 × caracteres, 3500) ms
   * e o balão. A boca mexe do primeiro balão até um pouco depois do último.
   */
  async function deliver(balloons: Balloon[], opts: DeliverOptions) {
    let shown = 0;
    const show = (i: number) => {
      if (i < shown) return;
      opts.before(i);
      const b = balloons[i];
      g().appendMessage({ role: "hana", text: b.text, at: now().toISOString(), emotion: g().relationship.mood.emotion, thought: b.thought });
      shown = i + 1;
    };
    flushRest = () => {
      for (let i = shown; i < balloons.length; i++) show(i);
    };
    try {
      for (let i = 0; i < balloons.length; i++) {
        const b = balloons[i];
        if (i === 0 && opts.typingSince !== undefined) {
          setUi({ typing: true });
          await sleep(Math.max(0, typingDelayMs(b.text) - (Date.now() - opts.typingSince)));
        } else {
          setUi({ typing: false });
          await sleep(b.pauseBeforeMs ?? balloonGapMs(random));
          if (!opts.alive()) return;
          setUi({ typing: true });
          await sleep(typingDelayMs(b.text));
        }
        if (!opts.alive()) return;
        show(i);
        setUi({ typing: false, talking: true });
      }
      await sleep(talkTailMs(balloons[balloons.length - 1]?.text ?? ""));
      if (!opts.alive()) return;
      setUi({ talking: false });
    } finally {
      flushRest = null;
    }
  }

  async function maybeSummarize() {
    if (summarizing) return;
    const s = g();
    const batch = summarizeBatch(s.messages, s.summarizedUpTo);
    if (!batch) return;
    summarizing = true;
    const myGen = gen;
    try {
      const res = await api.summarize({ previousSummary: s.summary, messages: batch.map(toHistoryItem) });
      const text = res.summary.trim();
      if (myGen === gen && text) g().setSummary(text, batch[batch.length - 1].id);
    } catch (e) {
      // Fica para depois do próximo turno (nunca em loop).
      console.warn("[kokoro] não consegui resumir a conversa", e);
    } finally {
      summarizing = false;
    }
  }

  async function playOpening() {
    if (opening || !g().profile) return;
    opening = true;
    const myGen = gen;
    const alive = () => myGen === gen;
    clearTimeout(debounce);
    pending = [];
    g().restartOpening();
    setUi({ scripted: true, openingCaption: OPENING_CAPTION, typing: false, talking: false, error: null });

    await sleep(OPENING_CAPTION_MS);
    if (!alive()) return;
    g().appendMessage({ role: "scene", text: OPENING_CAPTION, at: now().toISOString() });
    setUi({ openingCaption: null });
    await sleep(OPENING_UNDIM_MS);
    if (!alive()) return;

    const balloons: Balloon[] = OPENING_LINES.map((l) => ({ text: l.text, thought: null, pauseBeforeMs: l.pauseBeforeMs }));
    await deliver(balloons, {
      alive,
      before: (i) => g().setMood(OPENING_LINES[i].emotion, OPENING_LINES[i].intensity),
    });
    if (!alive()) return;

    const first = OPENING_LINES[0];
    g().addMilestone({ kind: "first_message", at: now().toISOString(), stage: 0, quote: first.text, emotion: first.emotion });
    g().finishOpening();
    opening = false;
    setUi({ scripted: false });
  }

  function boot() {
    if (booted) return;
    booted = true;
    if (typeof window !== "undefined") window.addEventListener("pagehide", flushDelivery);
    const s = g();
    if (!s.profile) return;
    if (!s.openingDone) {
      void playOpening();
      return;
    }
    // A página fechou antes da resposta: essas mensagens entram no próximo turno (uma vez só).
    const ids = unansweredUserIds(s.messages);
    if (ids.length) {
      pending = ids;
      lastSendAt = Date.now();
      schedule(DEBOUNCE_MS);
      return;
    }
    // Retorno após ausência (9.3): última interação há mais de 6 h → ela puxa assunto, uma vez por carga.
    const last = s.lastInteractionAt ? new Date(s.lastInteractionAt).getTime() : null;
    if (last !== null && now().getTime() - last > RETURN_GAP_MS && s.messages.some((m) => m.role === "hana")) {
      void proactiveTurn("greet_return");
    }
  }

  /** Turno sem mensagem do usuário (greet_return / idle_nudge): sem deltas visíveis, sem anti-grind. */
  async function proactiveTurn(mode: "greet_return" | "idle_nudge") {
    if (busy || opening || pending.length) return;
    const myGen = gen;
    const alive = () => myGen === gen;
    busy = true;
    setUi({ typing: true, error: null });
    const typingSince = Date.now();
    try {
      const req = buildChatRequest(g(), mode, now(), timeZone());
      const res = await api.chat(req);
      if (!alive()) return;
      // Decisão da fase 2: turno sem mensagem do usuário não rende sentimento
      // nem memória nova (o usuário não contou nada). Eventos valem: ela pode
      // se declarar num retorno ou no silêncio.
      const turn: HanaTurn = { ...res, deltas: { affection: 0, trust: 0, romance: 0 }, newMemories: [] };
      setUi({ lastResponse: res });
      await deliverTurn(turn, [], typingSince, alive);
    } catch (error) {
      if (!alive()) return;
      // Silencioso: um retorno que falhou não vira balão de erro na cara do usuário.
      console.warn("[kokoro] turno proativo falhou", error);
    } finally {
      if (alive()) busy = false;
    }
  }

  /** Silêncio (5.5): chamado pelo timer da UI; no máximo uma vez por silêncio. */
  function pokeIdle() {
    if (nudged) return;
    const s = g();
    if (!s.settings.idleNudge || s.relationship.stage < 2) return;
    const msgs = s.messages;
    const last = msgs[msgs.length - 1];
    if (!last || last.role !== "hana") return;
    nudged = true;
    void proactiveTurn("idle_nudge");
  }

  /** O usuário voltou a interagir: o próximo silêncio pode ter uma mensagem again. */
  function armIdle() {
    nudged = false;
  }

  function reset() {
    gen++;
    clearTimeout(debounce);
    debounce = undefined;
    pending = [];
    busy = false;
    opening = false;
    summarizing = false;
    flushRest = null;
    ui.setState({ ...initialChatUi(), debug: ui.getState().debug });
  }

  function flushDelivery() {
    flushRest?.();
  }

  return { boot, send, retry, playOpening, reset, flushDelivery, pokeIdle };
}
