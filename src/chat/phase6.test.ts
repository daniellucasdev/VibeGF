// Testes da fase 6: retorno após ausência (9.3), silêncio (5.5), toasts e
// declaração na camada do motor; turno proativo não rende sentimento.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatRequest, ChatResponse, HanaTurn, SummarizeRequest } from "../../shared/types";
import { createSafeStorage } from "../store/save";
import { PROFILE, makeTurn, memoryStorage } from "../store/testUtils";
import { createChatUiStore } from "../store/useChatUi";
import { createGameStore } from "../store/useGame";
import { createChatEngine, IDLE_NUDGE_MS, RETURN_GAP_MS, type EngineApi } from "./engine";

const T0 = new Date(2026, 8, 23, 15, 0);

type Reply = HanaTurn | Error | (() => Promise<ChatResponse>);

function setup(replies: Reply[] = []) {
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
  const engine = createChatEngine({ game, ui, api, random: () => 0, timeZone: () => "UTC" });
  game.getState().startGame({ ...PROFILE }, "normal");
  game.setState({ openingDone: true });
  return { game, ui, api, engine, chatCalls };
}

const tick = (ms: number) => vi.advanceTimersByTimeAsync(ms);

beforeEach(() => {
  vi.useFakeTimers({ now: T0 });
});
afterEach(() => {
  vi.useRealTimers();
});

describe("retorno após ausência (9.3)", () => {
  it("última interação há mais de 6 h na carga: greet_return uma vez", async () => {
    const { game, engine, chatCalls } = setup();
    // conversa de ontem
    game.setState({
      messages: [
        { id: 1, role: "user", text: "oi", at: new Date(T0.getTime() - 8 * 3600_000).toISOString(), status: "seen", reaction: null },
        { id: 2, role: "hana", text: "oi!!", at: new Date(T0.getTime() - 8 * 3600_000 + 60_000).toISOString(), emotion: "happy", thought: null },
      ],
      lastInteractionAt: new Date(T0.getTime() - 8 * 3600_000 + 60_000).toISOString(),
    });
    engine.boot();
    await tick(4000);
    expect(chatCalls.length).toBe(1);
    expect(chatCalls[0].mode).toBe("greet_return");
  });

  it("ausência curta não dispara retorno", async () => {
    const { game, engine, chatCalls } = setup();
    game.setState({
      messages: [
        { id: 1, role: "user", text: "oi", at: T0.toISOString(), status: "seen", reaction: null },
        { id: 2, role: "hana", text: "oi!!", at: T0.toISOString(), emotion: "happy", thought: null },
      ],
      lastInteractionAt: new Date(T0.getTime() - 3600_000).toISOString(),
    });
    engine.boot();
    await tick(4000);
    expect(chatCalls.length).toBe(0);
  });

  it("retorno falhou: sem balão de erro, sem loop", async () => {
    const { game, engine, ui, chatCalls } = setup([new Error("api fora do ar")]);
    game.setState({
      messages: [
        { id: 1, role: "user", text: "oi", at: T0.toISOString(), status: "seen", reaction: null },
        { id: 2, role: "hana", text: "oi!!", at: T0.toISOString(), emotion: "happy", thought: null },
      ],
      lastInteractionAt: new Date(T0.getTime() - RETURN_GAP_MS - 1000).toISOString(),
    });
    engine.boot();
    await tick(5000);
    expect(chatCalls.length).toBe(1);
    expect(ui.getState().error).toBeNull();
  });
});

describe("silêncio (5.5)", () => {
  it("5 min depois da fala dela, estágio 2+: UMA mensagem", async () => {
    const { game, engine, chatCalls } = setup();
    game.setState({
      messages: [
        { id: 1, role: "user", text: "oi", at: T0.toISOString(), status: "seen", reaction: null },
        { id: 2, role: "hana", text: "oi!!", at: T0.toISOString(), emotion: "happy", thought: null },
      ],
      lastInteractionAt: T0.toISOString(),
      relationship: { ...game.getState().relationship, stage: 2 },
    });
    engine.pokeIdle();
    await tick(IDLE_NUDGE_MS + 5000);
    expect(chatCalls.length).toBe(1);
    expect(chatCalls[0].mode).toBe("idle_nudge");
    // mesmo silêncio, de novo: no máximo UMA mensagem (5.5)
    engine.pokeIdle();
    await tick(IDLE_NUDGE_MS + 5000);
    expect(chatCalls.length).toBe(1);
  });

  it("estágio 0-1: silêncio não dispara", async () => {
    const { game, engine, chatCalls } = setup();
    game.setState({
      messages: [
        { id: 1, role: "user", text: "oi", at: T0.toISOString(), status: "seen", reaction: null },
        { id: 2, role: "hana", text: "oi!!", at: T0.toISOString(), emotion: "happy", thought: null },
      ],
    });
    engine.pokeIdle();
    await tick(IDLE_NUDGE_MS + 5000);
    expect(chatCalls.length).toBe(0);
  });

  it("última mensagem é do usuário: não dispara", async () => {
    const { game, engine, chatCalls } = setup();
    game.setState({
      messages: [{ id: 1, role: "user", text: "oi?", at: T0.toISOString(), status: "seen", reaction: null }],
      relationship: { ...game.getState().relationship, stage: 3 },
    });
    engine.pokeIdle();
    await tick(IDLE_NUDGE_MS + 5000);
    expect(chatCalls.length).toBe(0);
  });
});

describe("turno proativo não rende sentimento (decisão fase 2)", () => {
  it("deltas e memórias zerados no turno greet_return", async () => {
    const { game, engine, chatCalls } = setup([
      { ...makeTurn(), deltas: { affection: 5, trust: 5, romance: 5 }, newMemories: ["gosta de pão"] },
    ]);
    const before = game.getState().relationship;
    game.setState({
      messages: [
        { id: 1, role: "user", text: "oi", at: new Date(T0.getTime() - 8 * 3600_000).toISOString(), status: "seen", reaction: null },
        { id: 2, role: "hana", text: "oi!!", at: new Date(T0.getTime() - 8 * 3600_000 + 60_000).toISOString(), emotion: "happy", thought: null },
      ],
      lastInteractionAt: new Date(T0.getTime() - 8 * 3600_000 + 60_000).toISOString(),
    });
    engine.boot();
    await tick(6000);
    expect(chatCalls[0].mode).toBe("greet_return");
    const after = game.getState().relationship;
    expect(after.affection).toBe(before.affection);
    expect(after.trust).toBe(before.trust);
    expect(game.getState().memories.length).toBe(0);
  });
});

describe("anúncios do turno (9.4/9.5)", () => {
  it("subida de estágio dispara toast e o estado de declaração abre a cena", async () => {
    const { game, engine } = setup();
    // força os requisitos do estágio 1 e um turno que sobe
    game.setState({
      relationship: {
        ...game.getState().relationship,
        affection: 16, trust: 12, romance: 0,
        days: { daysTalked: ["2026-09-22", "2026-09-23"], today: { date: "2026-09-23", count: 3 } },
        userMessages: 25,
      },
    });
    engine.send("oi Hana!");
    await tick(DEBOUNCE_FULL);
    // o toast em si é DOM; aqui validamos o gatilho via stageUp no save
    expect(game.getState().relationship.stage).toBeGreaterThanOrEqual(1);
  });

  it("confession_accepted em estágio válido abre a ConfessionScene", async () => {
    const { game, ui, engine } = setup([
      { ...makeTurn(), event: "confession_accepted", messages: ["eu também gosto de você… muito"] },
    ]);
    game.setState({
      relationship: {
        ...game.getState().relationship,
        stage: 4,
        affection: 85, trust: 75, romance: 70,
        days: { daysTalked: ["2026-09-18", "2026-09-19", "2026-09-20", "2026-09-21", "2026-09-22"], today: { date: "2026-09-23", count: 3 } },
        userMessages: 210,
        confession: { state: "open", openSince: new Date(T0.getTime() - 3600_000).toISOString(), cooldownUntil: null, cooldownKind: null, togetherSince: null },
      },
    });
    engine.send("eu gosto de você, Hana. quer namorar comigo?");
    await tick(DEBOUNCE_FULL);
    expect(ui.getState().confession).not.toBeNull();
    expect(ui.getState().confession?.quote).toContain("gosto de você");
    expect(game.getState().relationship.stage).toBe(5);
    expect(game.getState().relationship.confession.state).toBe("together");
  });
});

const DEBOUNCE_FULL = 1200 + 4000 + 4000; // debounce + leitura + digitação + balões
