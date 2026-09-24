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
const EFFORT = (process.env.HANA_EFFORT ?? "low") as "low" | "medium" | "high";
const DEV = process.env.NODE_ENV !== "production";

// MOCK_LLM=true responde com falas falsas, sem chave e sem custo. Sem a
// variável definida, o mock continua valendo (aviso no log).
const wantsMock = (process.env.MOCK_LLM ?? "true").trim().toLowerCase() !== "false";
if (!wantsMock && !process.env.ANTHROPIC_API_KEY) {
  console.warn("[kokoro] MOCK_LLM=false sem ANTHROPIC_API_KEY: o Claude real não vai funcionar até configurar o .env.");
}
const MOCK = wantsMock;

const dist = resolve(import.meta.dirname, "../dist");

const app = createApp({
  mock: MOCK,
  dev: DEV,
  model: MODEL,
  claude: {
    model: MODEL,
    effort: EFFORT,
  },
  mockDelayMs: Number(process.env.MOCK_DELAY_MS ?? 600),
  staticDir: !DEV && existsSync(dist) ? dist : undefined,
});

app.listen(PORT, () => {
  console.log(`[kokoro] servidor em http://localhost:${PORT} (${MOCK ? "mock" : MODEL})`);
});
