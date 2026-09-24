// Cliente da API do Kokoro. A chave nunca passa por aqui: só o servidor fala com o Claude.
import { HanaTurnSchema, sanitizeTurn } from "../../shared/schema";
import type { ChatRequest, ChatResponse, SummarizeRequest, SummarizeResponse } from "../../shared/types";

/** Erro de rede ou da API, com a mensagem já pronta para o balão de erro. */
export class ApiRequestError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

const OFFLINE = "não consegui falar com o servidor… ele está ligado?";

async function post(path: string, body: unknown, signal?: AbortSignal): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch {
    throw new ApiRequestError(0, OFFLINE);
  }
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = data && typeof data === "object" && "error" in data && typeof data.error === "string" ? data.error : `erro ${res.status}`;
    throw new ApiRequestError(res.status, msg);
  }
  return data;
}

/** POST /api/chat. O turno passa pelo schema e pelos limites de novo (defesa em profundidade). */
export async function chat(req: ChatRequest, signal?: AbortSignal): Promise<ChatResponse> {
  const data = await post("/api/chat", req, signal);
  const parsed = HanaTurnSchema.safeParse(data);
  const turn = parsed.success ? sanitizeTurn(parsed.data) : null;
  if (!turn) throw new ApiRequestError(502, "a resposta dela chegou embaralhada…");
  const extra = data as Partial<ChatResponse>;
  return { ...turn, ...(extra.usage ? { usage: extra.usage } : {}), ...(extra.mock ? { mock: true } : {}) };
}

/** POST /api/summarize. */
export async function summarize(req: SummarizeRequest, signal?: AbortSignal): Promise<SummarizeResponse> {
  const data = await post("/api/summarize", req, signal);
  if (!data || typeof data !== "object" || !("summary" in data) || typeof data.summary !== "string") {
    throw new ApiRequestError(502, "resumo inválido");
  }
  return { summary: data.summary };
}

export const api = { chat, summarize };
export type ChatApi = typeof api;

export function errorMessage(e: unknown): string {
  if (e instanceof ApiRequestError) return e.message;
  return "algo deu errado…";
}
