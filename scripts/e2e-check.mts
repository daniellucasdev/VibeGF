// E2E real da fase 5: duas chamadas /api/chat seguidas contra o servidor local
// com MOCK_LLM=false, validando o turno no schema e o cache_read_input_tokens.
import { HanaTurnSchema } from "../shared/schema";

const base = "http://localhost:8787";

const req = (history) => ({
  mode: "reply",
  profile: { name: "Dan", pronouns: "ele", honorific: "kun", addressAs: "Dan-san" },
  relationship: {
    stage: 0, affection: 5, trust: 5, romance: 0, daysTalked: 0, distant: false,
    pendingConflict: null, confession: "locked",
    confessionNote: "você ainda não está pronta para namorar", togetherSince: null,
  },
  mood: { emotion: "neutral", intensity: 0.3 },
  memories: [],
  summary: "A Hana mandou mensagem pro número errado (achou que era a Yui), contando que o gato Daifuku tinha fugido do café.",
  history,
  client: { nowIso: new Date().toISOString(), timeZone: "America/Sao_Paulo" },
});

const health = await fetch(base + "/api/health").then((r) => r.json());
console.log("health:", JSON.stringify(health));

const post = (body) =>
  fetch(base + "/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(async (r) => ({
    status: r.status,
    json: await r.json(),
  }));

// 1ª chamada: o usuário responde à cena de abertura
const t0 = new Date().toISOString();
const h1 = [
  { role: "hana", text: "YUIII socorro", at: t0 },
  { role: "hana", text: "o Daifuku fugiu do café de novo 😭", at: t0 },
  { role: "hana", text: "…espera, esse não é o número da Yui, né", at: t0 },
  { role: "hana", text: "ai não. desculpa!!! número errado", at: t0 },
  { role: "user", text: "kkkk acontece. o gato voltou?", at: new Date(Date.now() - 30_000).toISOString() },
];
const r1 = await post(req(h1));
console.log("call1 status:", r1.status);
console.log("call1 turn:", JSON.stringify(r1.json, null, 2));

// 2ª chamada: continuação
const h2 = [...h1, { role: "hana", text: r1.json.messages.join("\n"), at: new Date().toISOString() }, { role: "user", text: "vou torcer pra ele aparecer então. qual o nome do gato?", at: new Date().toISOString() }];
const r2 = await post(req(h2));
console.log("call2 status:", r2.status);
console.log("call2 messages:", JSON.stringify(r2.json.messages));
console.log("call2 usage:", JSON.stringify(r2.json.usage));

const v1 = HanaTurnSchema.safeParse(r1.json);
const v2 = HanaTurnSchema.safeParse(r2.json);
console.log("schema valid:", v1.success, v2.success);
console.log("cache_read call1:", r1.json.usage?.cache_read_input_tokens, "| call2:", r2.json.usage?.cache_read_input_tokens);
console.log(r2.json.usage?.cache_read_input_tokens > 0 ? "CACHE-OK" : "CACHE-FAIL");
