// App Express sem `listen`, para os testes subirem numa porta livre.

import { resolve } from "node:path";
import express, { type ErrorRequestHandler, type Response } from "express";
import type { z } from "zod";
import { ChatRequestSchema, SummarizeRequestSchema } from "../shared/schema";
import type { ApiError, ChatResponse, SummarizeResponse } from "../shared/types";
import { mockSummary, mockTurn, type Rng } from "./mock";
import { rateLimit } from "./rateLimit";

export type AppOptions = {
  /** Respostas falsas, sem chamar a API. Nesta fase é sempre `true`. */
  mock: boolean;
  /** Inclui `usage` (e `mock`) na resposta, para o painel de debug. */
  dev: boolean;
  model: string;
  /** Atraso artificial do mock, para a UI ter "digitando…" de verdade. */
  mockDelayMs?: number;
  rateLimit?: { limit: number; windowMs: number };
  rng?: Rng;
  /** Pasta do build do front (produção): servida com fallback para o index.html. */
  staticDir?: string;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function badRequest(res: Response<ApiError & { issues?: string[] }>, error: z.ZodError) {
  const issues = error.issues.slice(0, 10).map((i) => `${i.path.join(".") || "(body)"}: ${i.message}`);
  res.status(400).json({ error: "pedido inválido", issues });
}

function notYet(res: Response<ApiError>) {
  // O Claude de verdade entra na fase 5 (server/claude.ts).
  res.status(501).json({ error: "o Claude de verdade ainda não está ligado — use MOCK_LLM=true" });
}

export function createApp(opts: AppOptions) {
  const app = express();
  app.disable("x-powered-by");
  app.use("/api", express.json({ limit: "200kb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, mock: opts.mock, model: opts.model });
  });

  const limiter = rateLimit(opts.rateLimit ?? { limit: 20, windowMs: 60_000 });

  app.post("/api/chat", limiter, async (req, res: Response<ChatResponse | ApiError>) => {
    const parsed = ChatRequestSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error);
    if (!opts.mock) return notYet(res);
    if (opts.mockDelayMs) await sleep(opts.mockDelayMs);
    const turn = mockTurn(parsed.data, opts.rng);
    const zero = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
    res.json(opts.dev ? { ...turn, usage: zero, mock: true } : turn);
  });

  app.post("/api/summarize", limiter, async (req, res: Response<SummarizeResponse | ApiError>) => {
    const parsed = SummarizeRequestSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error);
    if (!opts.mock) return notYet(res);
    res.json({ summary: mockSummary(parsed.data) });
  });

  if (opts.staticDir) {
    const index = resolve(opts.staticDir, "index.html");
    app.use(express.static(opts.staticDir));
    app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(index));
  }

  app.use("/api", (_req, res: Response<ApiError>) => {
    res.status(404).json({ error: "rota não encontrada" });
  });

  const onError: ErrorRequestHandler = (err: unknown, _req, res, _next) => {
    const status = typeof err === "object" && err && "status" in err && typeof err.status === "number" ? err.status : 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status === 413 ? "mensagem grande demais" : status < 500 ? "pedido inválido" : "algo deu errado no servidor" });
  };
  app.use(onError);

  return app;
}
