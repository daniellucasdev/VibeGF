// Motor da conversa (9.1–9.2): debounce que junta mensagens, "visto", "digitando…",
// balões em sequência, cena de abertura roteirizada e resumo (5.6).
// Os tempos usam o relógio real (setTimeout); as datas das mensagens e a lógica do jogo
// usam o now() central, para a viagem no tempo do debug valer em tudo.
import type { ChatRequest, ChatResponse, HanaTurn, SummarizeRequest, SummarizeResponse } from "../../shared/types";
import { now as clockNow } from "../game/time";
import { errorMessage } from "../lib/api";
import { cutChars } from "../lib/text";
import { USER_MESSAGE_MAX_CHARS } from "../store/save";
import { initialChatUi, type ChatUiState, type ChatUiStore } from "../store/useChatUi";
import type { GameStore } from "../store/useGame";
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
  /** Na carga do app: toca a abertura pendente ou responde o que ficou sem resposta. */
  boot: () => void;
  send: (text: string) => void;
  /** Botão "tentar de novo" do ErrorBubble. */
  retry: () => void;
  playOpening: () => Promise<void>;
  /** Cancela tudo o que está em andamento (apagar tudo). */
  reset: () => void;
  /** Mostra na hora os balões que faltam (a página vai fechar). */
  flushDelivery: () => void;
};

type Balloon = { text: string; thought: string | null; pauseBeforeMs?: number };

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
    };
    const last = turn.messages.length - 1;
    const balloons: Balloon[] = turn.messages.map((text, i) => ({ text, thought: i === last && turn.thought ? turn.thought : null }));
    await deliver(balloons, { alive, typingSince, before: commit });
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
    }
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

  return { boot, send, retry, playOpening, reset, flushDelivery };
}
