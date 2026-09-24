// Cliente da API com fallback de demonstração: sem servidor (GitHub Pages,
// arquivo aberto direto, servidor fora do ar), as respostas vêm do mock local
// — o mesmo do servidor (6.8), importado de shared+server, sem dependências de Node.
import { HanaTurnSchema, sanitizeTurn } from "../../shared/schema";
import type { ChatRequest, ChatResponse, SummarizeRequest, SummarizeResponse } from "../../shared/types";
import { mockSummary, mockTurn } from "../../server/mock";

export class ApiRequestError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

const OFFLINE = "não consegui falar com o servidor… ele está ligado?";

/** true quando não há servidor no ar (deploy estático). */
export const isStaticDemo = (): boolean => {
  if (typeof window === "undefined") return false;
  const { hostname, port } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1") return false;
  // porta 5173/8787 = dev local com servidor; sem porta ou 443/80 = estático
  return port === "" || port === "80" || port === "443";
};

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
  if (isStaticDemo()) return demoChat(req);
  const data = await post("/api/chat", req, signal);
  const parsed = HanaTurnSchema.safeParse(data);
  const turn = parsed.success ? sanitizeTurn(parsed.data) : null;
  if (!turn) throw new ApiRequestError(502, "a resposta dela chegou embaralhada…");
  const extra = data as Partial<ChatResponse>;
  return { ...turn, ...(extra.usage ? { usage: extra.usage } : {}), ...(extra.mock ? { mock: true } : {}) };
}

/** POST /api/summarize. */
export async function summarize(req: SummarizeRequest, signal?: AbortSignal): Promise<SummarizeResponse> {
  if (isStaticDemo()) return { summary: mockSummary(req) };
  const data = await post("/api/summarize", req, signal);
  if (!data || typeof data !== "object" || !(("summary" in data) && typeof data.summary === "string")) {
    throw new ApiRequestError(502, "resumo inválido");
  }
  return { summary: data.summary };
}

// ------------------------------------------------------------- demo local

let demoUsed = false;

async function demoChat(req: ChatRequest): Promise<ChatResponse> {
  if (!demoUsed) {
    demoUsed = true;
    // avisa uma vez por sessão (o console é do dev; o banner fica pra depois)
    console.info("[kokoro] modo demonstração: sem servidor, respostas do mock local");
  }
  await new Promise((r) => setTimeout(r, 500 + Math.random() * 700));
  return { ...mockTurn(req, Math.random), mock: true, usage: { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } };
}

export const api = { chat, summarize };
export type ChatApi = typeof api;

export function errorMessage(e: unknown): string {
  if (e instanceof ApiRequestError) return e.message;
  return "algo deu errado…";
}
