import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ChatRequestSchema, HanaTurnSchema } from "../shared/schema";
import { createApp } from "./app";
import { rateLimit } from "./rateLimit";
import { makeRequest } from "./testUtils";

let server: Server;
let base = "";

beforeAll(async () => {
  const app = createApp({ mock: true, dev: true, model: "claude-sonnet-5", rateLimit: { limit: 100, windowMs: 60_000 } });
  server = app.listen(0);
  await new Promise<void>((r) => server.once("listening", () => r()));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

const post = (path: string, body: unknown) =>
  fetch(base + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("validação do ChatRequest (6.1)", () => {
  it("aceita um request válido", () => {
    expect(ChatRequestSchema.safeParse(makeRequest()).success).toBe(true);
  });

  it("rejeita mensagem do usuário com mais de 500 caracteres", () => {
    const at = "2026-09-23T21:00:00.000Z";
    expect(ChatRequestSchema.safeParse(makeRequest({ history: [{ role: "user", text: "a".repeat(500), at }] })).success).toBe(true);
    expect(ChatRequestSchema.safeParse(makeRequest({ history: [{ role: "user", text: "a".repeat(501), at }] })).success).toBe(false);
  });

  it("rejeita histórico com mais de 40 itens", () => {
    const item = { role: "user" as const, text: "oi", at: "2026-09-23T21:00:00.000Z" };
    expect(ChatRequestSchema.safeParse(makeRequest({ history: Array(40).fill(item) })).success).toBe(true);
    expect(ChatRequestSchema.safeParse(makeRequest({ history: Array(41).fill(item) })).success).toBe(false);
  });

  it("rejeita estágio, fuso, modo e sentimentos inválidos", () => {
    const bad = (over: Record<string, unknown>, rel: Record<string, unknown> = {}) => {
      const r = makeRequest();
      return ChatRequestSchema.safeParse({ ...r, ...over, relationship: { ...r.relationship, ...rel } }).success;
    };
    expect(bad({}, { stage: 6 })).toBe(false);
    expect(bad({}, { affection: 101 })).toBe(false);
    expect(bad({ mode: "hack" })).toBe(false);
    expect(bad({ client: { nowIso: "2026-09-23T21:00:00Z", timeZone: "Marte/Olympus" } })).toBe(false);
    expect(bad({ client: { nowIso: "ontem", timeZone: "UTC" } })).toBe(false);
  });
});

describe("rotas", () => {
  it("GET /api/health", async () => {
    const res = await fetch(base + "/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, mock: true, model: "claude-sonnet-5" });
  });

  it("POST /api/chat devolve um turno válido com usage em dev", async () => {
    const res = await post("/api/chat", makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(HanaTurnSchema.safeParse(body).success).toBe(true);
    expect(body.usage.cache_read_input_tokens).toBe(0);
    expect(body.mock).toBe(true);
  });

  it("POST /api/chat com body inválido → 400", async () => {
    const res = await post("/api/chat", { mode: "reply" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("pedido inválido");
  });

  it("JSON malformado → 400", async () => {
    const res = await fetch(base + "/api/chat", {
      method: "POST", headers: { "content-type": "application/json" }, body: "{oops",
    });
    expect(res.status).toBe(400);
  });

  it("POST /api/summarize", async () => {
    const at = "2026-09-23T21:00:00.000Z";
    const res = await post("/api/summarize", { previousSummary: "Início.", messages: [{ role: "user", text: "oi", at }] });
    expect(res.status).toBe(200);
    expect((await res.json()).summary).toMatch(/^Início\./);
  });

  it("rota desconhecida → 404 em JSON", async () => {
    const res = await fetch(base + "/api/nada");
    expect(res.status).toBe(404);
  });

});

describe("rate limit (20/min por IP)", () => {
  type Hit = { status: number; headers: Record<string, string> };
  const hit = (mw: ReturnType<typeof rateLimit>, ip: string): Hit => {
    const out: Hit = { status: 200, headers: {} };
    const res = {
      setHeader: (k: string, v: string) => { out.headers[k] = v; },
      status: (s: number) => { out.status = s; return res; },
      json: () => res,
    };
    // Mocks mínimos de req/res: o middleware só usa ip, setHeader, status e json.
    mw({ ip } as never, res as never, () => {});
    return out;
  };

  it("bloqueia a 21ª requisição do mesmo IP e libera na janela seguinte", () => {
    let t = 0;
    const mw = rateLimit({ limit: 20, windowMs: 60_000, now: () => t });
    for (let i = 0; i < 20; i++) expect(hit(mw, "1.1.1.1").status).toBe(200);
    const blocked = hit(mw, "1.1.1.1");
    expect(blocked.status).toBe(429);
    expect(blocked.headers["Retry-After"]).toBe("60");
    expect(hit(mw, "2.2.2.2").status).toBe(200); // outro IP não é afetado
    t = 60_000;
    expect(hit(mw, "1.1.1.1").status).toBe(200);
  });

  it("o app responde 429 depois do limite", async () => {
    const app = createApp({ mock: true, dev: false, model: "m", rateLimit: { limit: 2, windowMs: 60_000 } });
    const s = app.listen(0);
    await new Promise<void>((r) => s.once("listening", () => r()));
    const url = `http://127.0.0.1:${(s.address() as AddressInfo).port}/api/chat`;
    const statuses: number[] = [];
    for (let i = 0; i < 3; i++) {
      const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(makeRequest()) });
      statuses.push(res.status);
      if (i === 0) expect(await res.json()).not.toHaveProperty("usage"); // sem usage fora de dev
    }
    expect(statuses).toEqual([200, 200, 429]);
    await new Promise<void>((r) => s.close(() => r()));
  });
});
