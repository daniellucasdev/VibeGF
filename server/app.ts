// App Express sem `listen`, para os testes subirem numa porta livre.

import { resolve } from "node:path";
import express, { type ErrorRequestHandler, type Response } from "express";
import type { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { ChatRequestSchema, SummarizeRequestSchema } from "../shared/schema";
import type { ApiError, ChatResponse, SummarizeResponse } from "../shared/types";
import { createHana, httpErrorFrom, summarizeWithClaude, type ClaudeOptions } from "./claude";
import { mockSummary, mockTurn, type Rng } from "./mock";
import { rateLimit } from "./rateLimit";

export type AppOptions = {
  /** Respostas falsas, sem chamar a API. */
  mock: boolean;
  /** Inclui `usage` (e `mock`) na resposta, para o painel de debug. */
  dev: boolean;
  model: string;
  /** Opções do Claude real (`mock: false`). Sem `create`, usa o cliente real. */
  claude?: ClaudeOptions;
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

export function createApp(opts: AppOptions) {
  const app = express();
  app.disable("x-powered-by");
  app.use("/api", express.json({ limit: "200kb" }));

  // Cliente do Claude criado uma vez (a chave vem do ambiente, nunca do body).
  // Em mock, ou sem chave, as rotas reais respondem 503 com aviso claro.
  const anthropic =
    opts.mock || !process.env.ANTHROPIC_API_KEY
      ? null
      : new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const chat = anthropic ? createHana(anthropic, opts.claude ?? { model: opts.model, effort: "low" }) : null;

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, mock: opts.mock, model: opts.model });
  });

  const limiter = rateLimit(opts.rateLimit ?? { limit: 20, windowMs: 60_000 });

  app.post("/api/chat", limiter, async (req, res: Response<ChatResponse | ApiError>) => {
    const parsed = ChatRequestSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error);

    if (opts.mock) {
      if (opts.mockDelayMs) await sleep(opts.mockDelayMs);
      const turn = mockTurn(parsed.data, opts.rng);
      const zero = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
      return res.json(opts.dev ? { ...turn, usage: zero, mock: true } : turn);
    }

    if (!chat) {
      return res.status(503).json({ error: "MOCK_LLM=false sem ANTHROPIC_API_KEY — configure o .env" });
    }
    try {
      const { turn, usage } = await chat(parsed.data);
      res.json(opts.dev ? { ...turn, usage } : turn);
    } catch (err) {
      const e = httpErrorFrom(err);
      res.status(e.status).json({ error: e.message });
    }
  });

  app.post("/api/summarize", limiter, async (req, res: Response<SummarizeResponse | ApiError>) => {
    const parsed = SummarizeRequestSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error);

    if (opts.mock) {
      if (opts.mockDelayMs) await sleep(opts.mockDelayMs);
      return res.json({ summary: mockSummary(parsed.data) });
    }

    if (!anthropic) {
      return res.status(503).json({ error: "MOCK_LLM=false sem ANTHROPIC_API_KEY — configure o .env" });
    }
    try {
      const summary = await summarizeWithClaude(anthropic, opts.model, parsed.data, opts.claude?.create);
      res.json({ summary });
    } catch (err) {
      const e = httpErrorFrom(err);
      res.status(e.status).json({ error: e.message });
    }
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
