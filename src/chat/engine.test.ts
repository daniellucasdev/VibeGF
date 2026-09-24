import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatRequest, ChatResponse, HanaTurn, SummarizeRequest } from "../../shared/types";
import { ApiRequestError } from "../lib/api";
import { createSafeStorage, type HanaMessage, type UserMessage } from "../store/save";
import { PROFILE, makeTurn, memoryStorage } from "../store/testUtils";
import { createChatUiStore } from "../store/useChatUi";
import { createGameStore } from "../store/useGame";
import { createChatEngine, type EngineApi } from "./engine";
import { OPENING_CAPTION, OPENING_LINES } from "./opening";
import { DEBOUNCE_MS, typingDelayMs } from "./timing";

const T0 = new Date(2026, 8, 23, 15, 0);

type Reply = HanaTurn | Error | (() => Promise<ChatResponse>);

function setup(replies: Reply[] = [], opts: { opening?: boolean } = {}) {
  const game = createGameStore(createSafeStorage(() => memoryStorage()));
  const ui = createChatUiStore();
  const chatCalls: ChatRequest[] = [];
  const summarizeCalls: SummarizeRequest[] = [];
  const queue = [...replies];
  const api: EngineApi = {
    chat: vi.fn(async (req: ChatRequest) => {
      chatCalls.push(structuredClone(req));
      const r = queue.shift() ?? makeTurn();
      if (r instanceof Error) throw r;
      if (typeof r === "function") return r();
      return r;
    }),
    summarize: vi.fn(async (req: SummarizeRequest) => {
      summarizeCalls.push(req);
      return { summary: "resumo novo" };
    }),
  };
  // random = 0: todos os intervalos no mínimo (visto em 400 ms, 300 ms entre balões)
  const engine = createChatEngine({ game, ui, api, random: () => 0, timeZone: () => "UTC" });
  game.getState().startGame({ ...PROFILE }, "normal");
  if (!opts.opening) game.setState({ openingDone: true });
  const hanaTexts = () => game.getState().messages.filter((m): m is HanaMessage => m.role === "hana").map((m) => m.text);
  const users = () => game.getState().messages.filter((m): m is UserMessage => m.role === "user");
  return { game, ui, api, engine, chatCalls, summarizeCalls, hanaTexts, users };
}

const tick = (ms: number) => vi.advanceTimersByTimeAsync(ms);

beforeEach(() => {
  vi.useFakeTimers({ now: T0 });
});
afterEach(() => {
  vi.useRealTimers();
});

describe("envio com debounce (9.2)", () => {
  it("espera 1,2 s de silêncio e junta as mensagens num turno", async () => {
    const t = setup();
    t.engine.send("oi");
    await tick(800);
    t.engine.send("tudo bem?");
    expect(t.users().map((m) => m.status)).toEqual(["sent", "sent"]);
    await tick(DEBOUNCE_MS - 1);
    expect(t.api.chat).not.toHaveBeenCalled();
    await tick(1);
    expect(t.api.chat).toHaveBeenCalledTimes(1);
    expect(t.chatCalls[0].history.slice(-2).map((h) => h.text)).toEqual(["oi", "tudo bem?"]);
    await tick(10_000);
    expect(t.game.getState().relationship.userMessages).toBe(2);
  });

  it("ignora mensagem vazia e corta em 500 caracteres", async () => {
    const t = setup();
    t.engine.send("   ");
    t.engine.send("a".repeat(600));
    expect(t.users().map((m) => m.text.length)).toEqual([500]);
  });
});

describe("visto, digitando e balões em sequência", () => {
  it("visto depois da leitura, digitando e cada balão no seu tempo", async () => {
    const turn = makeTurn({ messages: ["oii", "tudo sim, e você?"], emotion: "excited", reaction: "heart", thought: "que fofo" });
    const t = setup([turn]);
    t.engine.send("oi Hana");
    await tick(DEBOUNCE_MS);
    await tick(399);
    expect(t.users()[0].status).toBe("sent");
    expect(t.ui.getState().typing).toBe(false);
    await tick(1);
    expect(t.users()[0].status).toBe("seen");
    expect(t.ui.getState().typing).toBe(true);

    // 1º balão: o "digitando…" já estava na tela
    await tick(typingDelayMs("oii") - 1);
    expect(t.hanaTexts()).toEqual([]);
    expect(t.game.getState().relationship.mood.emotion).toBe("neutral");
    await tick(1);
    expect(t.hanaTexts()).toEqual(["oii"]);
    // a emoção, as barras e a reação mudam junto com o primeiro balão
    expect(t.game.getState().relationship.mood.emotion).toBe("excited");
    expect(t.users()[0].reaction).toBe("heart");
    expect(t.ui.getState().lastDeltas?.applied).toEqual({ affection: 1, trust: 1, romance: 0 });
    expect(t.ui.getState()).toMatchObject({ typing: false, talking: true });

    // 300 ms de pausa, depois "digitando…" e o 2º balão
    await tick(300);
    expect(t.ui.getState().typing).toBe(true);
    await tick(typingDelayMs("tudo sim, e você?"));
    expect(t.hanaTexts()).toEqual(["oii", "tudo sim, e você?"]);
    const last = t.game.getState().messages.at(-1) as HanaMessage;
    expect(last).toMatchObject({ emotion: "excited", thought: "que fofo" });
    expect((t.game.getState().messages.at(-2) as HanaMessage).thought).toBeNull();

    await tick(2000);
    expect(t.ui.getState()).toMatchObject({ typing: false, talking: false });
  });

  it("emburrada, ela demora 2–4 s para ler", async () => {
    const t = setup();
    t.game.getState().setMood("pouty", 1);
    t.engine.send("oi");
    await tick(DEBOUNCE_MS + 1999);
    expect(t.users()[0].status).toBe("sent");
    await tick(1);
    expect(t.users()[0].status).toBe("seen");
  });

  it("mensagens enviadas durante a resposta entram no turno seguinte", async () => {
    const t = setup([makeTurn({ messages: ["primeira resposta"] }), makeTurn({ messages: ["segunda resposta"] })]);
    t.engine.send("um");
    await tick(DEBOUNCE_MS + 500);
    t.engine.send("dois");
    await tick(DEBOUNCE_MS + 100);
    expect(t.api.chat).toHaveBeenCalledTimes(1);
    await tick(20_000);
    expect(t.api.chat).toHaveBeenCalledTimes(2);
    expect(t.hanaTexts()).toEqual(["primeira resposta", "segunda resposta"]);
    expect(t.game.getState().messages.map((m) => m.role)).toEqual(["user", "user", "hana", "hana"]);
    expect(t.game.getState().relationship.userMessages).toBe(2);
  });
});

describe("erro e tentar de novo", () => {
  it("mostra o erro, não tenta sozinho, e o botão manda de novo", async () => {
    const t = setup([new ApiRequestError(429, "calma! muitas mensagens de uma vez…"), makeTurn({ messages: ["voltei"] })]);
    t.engine.send("oi");
    await tick(DEBOUNCE_MS + 1500);
    expect(t.ui.getState().error).toEqual({ message: "calma! muitas mensagens de uma vez…" });
    expect(t.ui.getState().typing).toBe(false);
    expect(t.users()[0].status).toBe("sent"); // falhou antes de ser vista
    await tick(60_000);
    expect(t.api.chat).toHaveBeenCalledTimes(1);

    t.engine.retry();
    expect(t.ui.getState().error).toBeNull();
    await tick(10_000);
    expect(t.api.chat).toHaveBeenCalledTimes(2);
    expect(t.hanaTexts()).toEqual(["voltei"]);
    expect(t.game.getState().relationship.userMessages).toBe(1);
  });

  it("uma mensagem nova depois do erro leva junto as que falharam", async () => {
    const t = setup([new Error("rede")]);
    t.engine.send("oi");
    await tick(DEBOUNCE_MS + 1500);
    expect(t.ui.getState().error).not.toBeNull();
    t.engine.send("tá aí?");
    expect(t.ui.getState().error).toBeNull();
    await tick(10_000);
    expect(t.api.chat).toHaveBeenCalledTimes(2);
    expect(t.game.getState().relationship.userMessages).toBe(2);
  });
});

describe("resumo (5.6)", () => {
  it("resume quando passam de 40 mensagens fora da janela", async () => {
    const t = setup();
    for (let i = 0; i < 70; i++) {
      t.game.getState().appendMessage(i % 2
        ? { role: "hana", text: `fala ${i}`, at: T0.toISOString(), emotion: "neutral", thought: null }
        : { role: "user", text: `msg ${i}`, at: T0.toISOString(), status: "seen", reaction: null });
    }
    t.engine.send("mais uma");
    await tick(20_000);
    expect(t.api.summarize).toHaveBeenCalledTimes(1);
    const req = t.summarizeCalls[0];
    expect(req.previousSummary).toMatch(/número errado/);
    expect(req.messages).toHaveLength(42); // 72 mensagens − 30 da janela
    expect(t.game.getState().summary).toBe("resumo novo");
    expect(t.game.getState().summarizedUpTo).toBe(t.game.getState().messages[41].id);
  });

  it("abaixo do limite não chama", async () => {
    const t = setup();
    t.engine.send("oi");
    await tick(20_000);
    expect(t.api.summarize).not.toHaveBeenCalled();
  });
});

describe("cena de abertura (9.1)", () => {
  it("roteirizada, sem chamar a API, com a pausa de 2,5 s antes do …espera", async () => {
    const t = setup([], { opening: true });
    const done = t.engine.playOpening();
    expect(t.ui.getState()).toMatchObject({ scripted: true, openingCaption: OPENING_CAPTION });
    t.engine.send("oi?"); // travado durante a cena
    await tick(60_000);
    await done;
    const s = t.game.getState();
    expect(s.messages[0]).toMatchObject({ role: "scene", text: OPENING_CAPTION });
    expect(t.hanaTexts()).toEqual(OPENING_LINES.map((l) => l.text));
    expect(s.messages.filter((m) => m.role === "hana").map((m) => (m as HanaMessage).emotion)).toEqual(OPENING_LINES.map((l) => l.emotion));
    expect(s.openingDone).toBe(true);
    expect(s.milestones).toEqual([expect.objectContaining({ kind: "first_message", quote: "YUIII socorro" })]);
    expect(t.api.chat).not.toHaveBeenCalled();
    expect(t.users()).toEqual([]);
    expect(t.ui.getState()).toMatchObject({ scripted: false, openingCaption: null, talking: false, typing: false });

    const at = (text: string) => Date.parse(s.messages.find((m) => m.text === text)?.at ?? "");
    const gap = at("…espera") - at(OPENING_LINES[1].text);
    expect(gap).toBe(2500 + typingDelayMs("…espera"));
  });

  it("boot com abertura pela metade: recomeça do zero", async () => {
    const t = setup([], { opening: true });
    t.game.getState().appendMessage({ role: "hana", text: "YUIII socorro", at: T0.toISOString(), emotion: "excited", thought: null });
    t.engine.boot();
    await tick(60_000);
    expect(t.hanaTexts()).toEqual(OPENING_LINES.map((l) => l.text));
  });
});

describe("boot", () => {
  it("mensagens que ficaram sem resposta são respondidas uma vez", async () => {
    const t = setup([makeTurn({ messages: ["desculpa, tava sem sinal"] })]);
    t.game.getState().appendMessage({ role: "hana", text: "oi", at: T0.toISOString(), emotion: "neutral", thought: null });
    t.game.getState().appendMessage({ role: "user", text: "oi, tudo bem?", at: T0.toISOString(), status: "sent", reaction: null });
    t.engine.boot();
    t.engine.boot(); // idempotente
    await tick(20_000);
    expect(t.api.chat).toHaveBeenCalledTimes(1);
    expect(t.hanaTexts()).toEqual(["oi", "desculpa, tava sem sinal"]);
    expect(t.game.getState().relationship.userMessages).toBe(1);
  });

  it("sem perfil não faz nada", async () => {
    const t = setup();
    t.game.getState().resetAll();
    t.engine.boot();
    await tick(20_000);
    expect(t.api.chat).not.toHaveBeenCalled();
  });
});

describe("reset e fechar a página", () => {
  it("reset cancela o turno em andamento", async () => {
    const t = setup([makeTurn({ messages: ["não devia aparecer"] })]);
    t.engine.send("oi");
    await tick(DEBOUNCE_MS + 500);
    t.engine.reset();
    await tick(20_000);
    expect(t.hanaTexts()).toEqual([]);
    expect(t.ui.getState().typing).toBe(false);
  });

  it("flushDelivery mostra na hora os balões que faltam, sem duplicar depois", async () => {
    const t = setup([makeTurn({ messages: ["um", "dois", "três"] })]);
    t.engine.send("oi");
    await tick(DEBOUNCE_MS + 400 + typingDelayMs("um"));
    expect(t.hanaTexts()).toEqual(["um"]);
    t.engine.flushDelivery();
    expect(t.hanaTexts()).toEqual(["um", "dois", "três"]);
    await tick(20_000);
    expect(t.hanaTexts()).toEqual(["um", "dois", "três"]);
  });
});
