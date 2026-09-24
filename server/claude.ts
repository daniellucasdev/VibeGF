// Chamada ao Claude (6.2): saída estruturada, cache do PERSONA_STATIC, retry,
// turno reserva e tradução de erros. O modelo padrão é o claude-sonnet-5; betas
// e fallbacks só existiriam no claude-opus-5, então aqui vão `messages.create`
// puro com `output_config`.

import Anthropic from "@anthropic-ai/sdk";
import { HANA_TURN_JSON_SCHEMA, parseHanaTurn } from "../shared/schema";
import type { ChatRequest, HanaTurn, SummarizeRequest, Usage } from "../shared/types";
import { buildMessages, buildNowBlock } from "./context";
import { PERSONA_STATIC } from "./persona";

export const MAX_TOKENS = 16_000;

export type Effort = "low" | "medium" | "high";

/** Erro já traduzido para HTTP (6.2), do mais específico para o mais geral. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Turno reserva em personagem (6.2): parse/validação falhou duas vezes. */
export function fallbackTurn(): HanaTurn {
  return {
    thought: "perdi o fio da conversa… melhor pedir pra repetir",
    emotion: "thinking",
    intensity: 0.4,
    messages: ["desculpa, me distraí… o que você disse? (・・;)"],
    reaction: "none",
    deltas: { affection: 0, trust: 0, romance: 0 },
    newMemories: [],
    event: "none",
  };
}

/** Turno reserva de recusa (6.2): `stop_reason: "refusal"`. */
export function refusalTurn(): HanaTurn {
  return {
    thought: "não quero falar disso agora",
    emotion: "thinking",
    intensity: 0.4,
    messages: ["hmm… acho que não quero falar disso agora"],
    reaction: "none",
    deltas: { affection: 0, trust: 0, romance: 0 },
    newMemories: [],
    event: "none",
  };
}

// A parte pura (mensagem → turno) fica separada para os testes, sem rede.

export type RawMessage = Pick<Anthropic.Message, "content" | "stop_reason" | "usage">;

/**
 * Extrai e valida o turno de uma resposta da API. Devolve `"refusal"` para
 * recusa, `null` para JSON inválido/fora do schema (o chamador tenta de novo).
 */
export function turnFromMessage(msg: RawMessage): HanaTurn | "refusal" | null {
  if (msg.stop_reason === "refusal") return "refusal";
  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  return parseHanaTurn(text);
}

export function usageOf(msg: RawMessage): Usage {
  const u = msg.usage;
  return {
    input_tokens: u.input_tokens ?? 0,
    output_tokens: u.output_tokens ?? 0,
    cache_read_input_tokens: u.cache_read_input_tokens ?? 0,
    cache_creation_input_tokens: u.cache_creation_input_tokens ?? 0,
  };
}

/** Erro de API → HttpError com status e mensagem da seção 6.2. */
export function httpErrorFrom(err: unknown): HttpError {
  if (err instanceof HttpError) return err;
  // APIConnectionError é subclasse de APIError: vem primeiro.
  if (err instanceof Anthropic.APIConnectionError) return new HttpError(503, "sem conexão com a API");
  if (err instanceof Anthropic.AuthenticationError) return new HttpError(500, "chave da API inválida (veja o .env)");
  if (err instanceof Anthropic.RateLimitError) return new HttpError(429, "muitas mensagens seguidas, tenta daqui a pouco");
  if (err instanceof Anthropic.APIError) return new HttpError(502, "a API do Claude respondeu com erro");
  return new HttpError(500, "algo deu errado falando com o Claude");
}

// ------------------------------------------------------------------- chat

export type CreateFn = (params: Anthropic.MessageCreateParamsNonStreaming) => Promise<RawMessage>;

export type ClaudeOptions = {
  model: string;
  effort: Effort;
  /** Sobrepõe a chamada bruta (testes). */
  create?: CreateFn;
};

/** Abre o cliente e devolve a função que responde um turno da Hana. */
export function createHana(client: Anthropic, opts: ClaudeOptions) {
  const create: CreateFn = opts.create ?? ((params) => client.messages.create(params) as Promise<RawMessage>);

  return async function chat(req: ChatRequest): Promise<{ turn: HanaTurn; usage: Usage }> {
    const base: Anthropic.MessageCreateParamsNonStreaming = {
      model: opts.model,
      max_tokens: MAX_TOKENS,
      // PERSONA_STATIC é byte a byte igual em toda chamada: o bloco efêmero
      // de cache cobre só ele; tudo que muda vem depois, no bloco AGORA.
      system: [
        { type: "text", text: PERSONA_STATIC, cache_control: { type: "ephemeral" } },
        { type: "text", text: buildNowBlock(req) },
      ],
      messages: buildMessages(req),
      output_config: {
        effort: opts.effort,
        format: { type: "json_schema", schema: HANA_TURN_JSON_SCHEMA },
      },
    };

    let usage: Usage = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
    try {
      // Duas tentativas: JSON inválido ou cortado no max_tokens merece retry (6.2).
      for (let attempt = 0; attempt < 2; attempt++) {
        const msg = await create(base);
        usage = usageOf(msg);
        const turn = turnFromMessage(msg);
        if (turn === "refusal") return { turn: refusalTurn(), usage };
        if (turn !== null) return { turn, usage };
      }
    } catch (err) {
      throw httpErrorFrom(err);
    }
    return { turn: fallbackTurn(), usage };
  };
}

// --------------------------------------------------------------- summarize

const SUMMARIZE_SYSTEM =
  "Você resume a história entre a Hana e o usuário para a própria Hana lembrar depois. " +
  "Escreva em português, na 3ª pessoa, em até 1200 caracteres. Mantenha os fatos importantes, " +
  "as piadas internas, as promessas, as brigas e como terminaram, os marcos da relação e o clima atual. " +
  "Não invente nada.";

export const SUMMARY_MAX_CHARS = 1200;

const transcript = (messages: SummarizeRequest["messages"]): string =>
  messages
    .map((m) => {
      const who = m.role === "user" ? "Usuário" : m.role === "hana" ? "Hana" : "Cena";
      return `${who}: ${m.text.replace(/\s+/g, " ").trim()}`;
    })
    .join("\n");

/** Resumo (6.7): texto puro, effort low, cortado em 1200 caracteres. */
export async function summarizeWithClaude(
  client: Anthropic,
  model: string,
  body: SummarizeRequest,
  create?: CreateFn,
): Promise<string> {
  const call = create ?? ((params: Anthropic.MessageCreateParamsNonStreaming) => client.messages.create(params) as Promise<RawMessage>);
  try {
    const msg = await call({
      model,
      max_tokens: MAX_TOKENS,
      system: [{ type: "text", text: SUMMARIZE_SYSTEM }],
      messages: [
        {
          role: "user",
          content:
            `Resumo anterior (pode estar vazio): ${body.previousSummary.trim() || "(nada)"}\n\n` +
            `Transcrição das mensagens antigas:\n${transcript(body.messages)}\n\n` +
            "Devolva só o resumo novo, em até 1200 caracteres.",
        },
      ],
      output_config: { effort: "low" },
    });
    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    return Array.from(text).slice(0, SUMMARY_MAX_CHARS).join("");
  } catch (err) {
    throw httpErrorFrom(err);
  }
}
