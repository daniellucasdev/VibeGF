// Servidor do Kokoro ♡: guarda a API key e monta os prompts. É stateless.
// POST /api/chat, POST /api/summarize, GET /api/health.
// Em produção (`npm start`) também serve o `dist/`.

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createApp } from "./app";

try {
  process.loadEnvFile(); // .env é opcional: sem ele, valem os padrões
} catch {
  /* sem .env */
}

const PORT = Number(process.env.PORT ?? 8787);
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";
const DEV = process.env.NODE_ENV !== "production";

// Fase 3: o servidor só tem o mock. O Claude de verdade entra na fase 5, então
// MOCK_LLM ausente vale `true` e MOCK_LLM=false ainda cai no mock, com aviso.
const wantsMock = (process.env.MOCK_LLM ?? "true").trim().toLowerCase() !== "false";
if (!wantsMock) console.warn("[kokoro] MOCK_LLM=false, mas o Claude de verdade só entra na fase 5: usando o mock.");
const MOCK = true;

const dist = resolve(import.meta.dirname, "../dist");

const app = createApp({
  mock: MOCK,
  dev: DEV,
  model: MODEL,
  mockDelayMs: Number(process.env.MOCK_DELAY_MS ?? 600),
  staticDir: !DEV && existsSync(dist) ? dist : undefined,
});

app.listen(PORT, () => {
  console.log(`[kokoro] servidor em http://localhost:${PORT} (${MOCK ? "mock" : MODEL})`);
});
