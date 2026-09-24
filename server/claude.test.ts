// Testes da fase 5 (seção 11): snapshots do bloco AGORA e das mensagens,
// PERSONA_STATIC sem nada dinâmico, turno inválido → retry → turno reserva,
// e a thread Claude real com `create` falso (sem rede).

import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { ChatRequestSchema, HanaTurnSchema } from "../shared/schema";
import type { ChatRequest, HistoryItem, HanaTurn } from "../shared/types";
import { createHana, fallbackTurn, refusalTurn, summarizeWithClaude, usageOf, type RawMessage } from "./claude";
import { buildMessages, buildNowBlock, CONTINUE_SCENE, OPENING_SCENE } from "./context";
import { PERSONA_STATIC } from "./persona";
import { makeRequest } from "./testUtils";

const valid = (over: Partial<ChatRequest> = {}): ChatRequest => ChatRequestSchema.parse(makeRequest(over));

/** `content` pode ser string ou blocos: para os testes, só interessa o texto. */
const textOf = (m: { content: unknown }) => (typeof m.content === "string" ? m.content : "");

// ------------------------------------------------------------- snapshots

describe("buildNowBlock (6.6)", () => {
  it("tem o formato da seção 6.6", () => {
    const req = valid({
      relationship: {
        ...makeRequest().relationship,
        stage: 1,
        affection: 22,
        trust: 15,
        romance: 3,
        daysTalked: 2,
      },
      memories: ["trabalha com programação", "tem um cachorro chamado Thor"],
      summary: "A Hana mandou mensagem pro número errado achando que era a Yui.",
    });
    expect(buildNowBlock(req)).toMatchSnapshot();
  });

  it("muda com o estágio, o humor e o conflito, e mantém o formato de linhas", () => {
    const base = makeRequest();
    const calm = buildNowBlock(valid());
    const fight = buildNowBlock(
      valid({
        mood: { emotion: "pouty", intensity: 0.5 },
        relationship: { ...base.relationship, stage: 3, pendingConflict: "ele riu do meu desenho", distant: true },
      }),
    );
    expect(fight).not.toBe(calm);
    for (const line of fight.split("\n")) {
      expect(line.startsWith("#") || line.startsWith("-") || line.startsWith("  -")).toBe(true);
    }
  });
});

describe("buildMessages (6.4)", () => {
  const at = (h: number, m = 0) => `2026-09-23T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00.000Z`;

  it("primeira mensagem é sempre user; história começando com a Hana abre com a notificação", () => {
    const msgs = buildMessages(valid());
    expect(msgs[0].role).toBe("user");
    expect(msgs[0].content).toBe(OPENING_SCENE);
  });

  it("junta papéis iguais consecutivos", () => {
    const history: HistoryItem[] = [
      { role: "user", text: "oi", at: at(10) },
      { role: "user", text: "tudo bem?", at: at(10, 1) },
      { role: "hana", text: "oi!", at: at(11) },
      { role: "hana", text: "tudo sim", at: at(11, 1) },
    ];
    const msgs = buildMessages(valid({ history }));
    expect(msgs.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(msgs[0].content).toBe("oi\ntudo bem?");
    expect(msgs[1].content).toBe("oi!\ntudo sim");
    expect(msgs[2].content).toBe(CONTINUE_SCENE); // reply termina em user
  });

  it("insere marcador de tempo quando o intervalo passa de 3 horas", () => {
    const history: HistoryItem[] = [
      { role: "hana", text: "boa noite!", at: at(10) },
      { role: "user", text: "oi, cheguei", at: at(14) },
    ];
    const msgs = buildMessages(valid({ history }));
    expect(msgs.some((m) => m.role === "user" && textOf(m).includes("[4 horas depois]"))).toBe(true);
  });

  it("não insere marcador quando o intervalo é curto", () => {
    const history: HistoryItem[] = [
      { role: "hana", text: "oi!", at: at(10) },
      { role: "user", text: "oi de novo", at: at(10, 5) },
    ];
    const msgs = buildMessages(valid({ history }));
    expect(msgs.some((m) => textOf(m).includes("depois]"))).toBe(false);
  });

  it("cena entra entre colchetes no turno do usuário", () => {
    const history: HistoryItem[] = [
      { role: "user", text: "oi", at: at(10) },
      { role: "scene", text: "A Mochi pula no teclado.", at: at(10, 1) },
      { role: "hana", text: "ahh a Mochi!", at: at(10, 2) },
    ];
    const msgs = buildMessages(valid({ history }));
    expect(msgs[0].role).toBe("user");
    expect(msgs[0].content).toContain("oi\n[A Mochi pula no teclado.]");
  });

  it("modo greet_return e idle_nudge acrescentam a cena do modo no fim, como user", () => {
    const greet = buildMessages(valid({ mode: "greet_return" }));
    expect(greet[greet.length - 1].role).toBe("user");
    expect(greet[greet.length - 1].content).toContain("abriu a conversa de novo depois de");

    const idle = buildMessages(valid({ mode: "idle_nudge" }));
    expect(idle[idle.length - 1].role).toBe("user");
    // a cena do modo entra no turno do usuário em aberto (junta papéis iguais)
    expect(textOf(idle[idle.length - 1]).includes("[O usuário está em silêncio há alguns minutos depois da sua última mensagem.]")).toBe(true);
  });
});

// ------------------------------------------------------- PERSONA_STATIC

describe("PERSONA_STATIC (6.5)", () => {
  it("não contém nada dinâmico: sem data, nome do usuário, horário ou aleatoriedade", () => {
    expect(PERSONA_STATIC).not.toMatch(/\d{1,2}:\d{2}/); // horário
    expect(PERSONA_STATIC).not.toMatch(/\d{2}\/\d{2}/); // data
    expect(PERSONA_STATIC).not.toContain("Dan"); // nome do usuário do fixture
    expect(PERSONA_STATIC).not.toMatch(/20\d{2}/); // ano
    expect(PERSONA_STATIC).not.toMatch(/Math\.random|Date\.now/);
  });

  it("mantém a estrutura da seção 6.5 (quem é, estágios, limites, formato)", () => {
    for (const section of ["## Quem é a Hana", "## Estágios da relação", "## Limites", "## Formato", "Estrela Cadente de Papel"]) {
      expect(PERSONA_STATIC).toContain(section);
    }
  });
});

// ----------------------------------------------------- retry e reserva

const textMsg = (obj: unknown, stop_reason: "end_turn" | "refusal" | "max_tokens" = "end_turn"): RawMessage => {
  const text = typeof obj === "string" ? obj : JSON.stringify(obj);
  const content: Anthropic.Message["content"] = [{ type: "text", text } as Anthropic.TextBlock];
  return { content, stop_reason, usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 42, cache_creation_input_tokens: 0 } } as unknown as RawMessage;
};

const goodTurn: HanaTurn = {
  thought: "que mensagem fofa",
  emotion: "happy",
  intensity: 0.6,
  messages: ["oi!! (＾▽＾)"],
  reaction: "heart",
  deltas: { affection: 1, trust: 0, romance: 0 },
  newMemories: [],
  event: "none",
};

describe("createHana: validação, retry e turnos reserva (6.2)", () => {
  const fakeClient = {} as Anthropic;

  it("valida e devolve o turno quando o JSON vem certo", async () => {
    let calls = 0;
    const chat = createHana(fakeClient, {
      model: "claude-sonnet-5",
      effort: "low",
      create: async () => {
        calls++;
        return textMsg(goodTurn);
      },
    });
    const { turn, usage } = await chat(valid());
    expect(turn).toEqual(goodTurn);
    expect(usage.cache_read_input_tokens).toBe(42);
    expect(calls).toBe(1);
  });

  it("JSON inválido na 1ª tentativa refaz na 2ª; duas falhas caem no turno reserva", async () => {
    const bad: unknown[] = ["{isso não é json", { ...goodTurn, messages: [] }];
    let i = 0;
    const chat = createHana(fakeClient, {
      model: "claude-sonnet-5",
      effort: "low",
      create: async () => textMsg(bad[i++]),
    });
    const out = await chat(valid());
    expect(out.turn.messages[0]).toContain("desculpa, me distraí"); // 2 falhas → reserva
    expect(i).toBe(2);

    i = 0;
    const chat2 = createHana(fakeClient, {
      model: "claude-sonnet-5",
      effort: "low",
      create: async () => (i++ === 0 ? textMsg("lixo") : textMsg(goodTurn)),
    });
    const out2 = await chat2(valid());
    expect(out2.turn).toEqual(goodTurn); // 1 falha → retry salva
    expect(i).toBe(2);
  });

  it("stop_reason refusal devolve o turno reserva de recusa, sem retry", async () => {
    let calls = 0;
    const chat = createHana(fakeClient, {
      model: "claude-sonnet-5",
      effort: "low",
      create: async () => {
        calls++;
        return textMsg(goodTurn, "refusal");
      },
    });
    const { turn } = await chat(valid());
    expect(turn).toEqual(refusalTurn());
    expect(calls).toBe(1);
  });

  it("stop_reason max_tokens tenta de novo", async () => {
    let i = 0;
    const chat = createHana(fakeClient, {
      model: "claude-sonnet-5",
      effort: "low",
      create: async () => (i++ === 0 ? textMsg("cortado", "max_tokens") : textMsg(goodTurn)),
    });
    const { turn } = await chat(valid());
    expect(turn).toEqual(goodTurn);
  });

  it("content vazio também cai no retry/reserva", async () => {
    let i = 0;
    const chat = createHana(fakeClient, {
      model: "claude-sonnet-5",
      effort: "low",
      create: async () => {
        i++;
        return { content: [], stop_reason: "end_turn", usage: {} } as unknown as RawMessage;
      },
    });
    const { turn } = await chat(valid());
    expect(turn).toEqual(fallbackTurn());
    expect(i).toBe(2);
  });

  it("turno reserva passa no schema da UI", () => {
    expect(HanaTurnSchema.safeParse(fallbackTurn()).success).toBe(true);
    expect(HanaTurnSchema.safeParse(refusalTurn()).success).toBe(true);
  });
});

describe("summarizeWithClaude (6.7)", () => {
  it("usa o system de resumo e devolve texto puro", async () => {
    let seen: Anthropic.MessageCreateParamsNonStreaming | null = null;
    const summary = await summarizeWithClaude(
      {} as Anthropic,
      "claude-sonnet-5",
      { previousSummary: "", messages: [{ role: "user", text: "oi", at: "2026-09-23T21:00:00.000Z" }] },
      async (params) => {
        seen = params;
        return textMsg("resumo curto");
      },
    );
    expect(summary).toBe("resumo curto");
    expect(seen!.max_tokens).toBe(16_000);
    expect(Array.from(summary).length).toBeLessThanOrEqual(1200);
  });

  it("corta resumo maior que 1200 caracteres", async () => {
    const long = "a".repeat(5000);
    const summary = await summarizeWithClaude(
      {} as Anthropic,
      "claude-sonnet-5",
      { previousSummary: "", messages: [{ role: "user", text: "oi", at: "2026-09-23T21:00:00.000Z" }] },
      async () => textMsg(long),
    );
    expect(Array.from(summary).length).toBe(1200);
  });
});

describe("usageOf", () => {
  it("extrai o subconjunto com cache_read_input_tokens", () => {
    expect(usageOf(textMsg("x")).cache_read_input_tokens).toBe(42);
    expect(usageOf(textMsg("x")).input_tokens).toBe(100);
  });
});
