import { describe, expect, it } from "vitest";
import { initialRelationship } from "../game/relationship";
import { HOUR, MINUTE } from "../game/time";
import { formatDayLabel } from "../lib/format";
import { initialSave, type ChatMessage, type SaveData } from "../store/save";
import { PROFILE } from "../store/testUtils";
import { buildChatRequest, summarizeBatch, unansweredUserIds } from "./request";
import { buildRows, splitActions } from "./rows";
import { balloonGapMs, readDelayMs, talkTailMs, typingDelayMs } from "./timing";

const T0 = new Date(2026, 8, 23, 15, 0); // quarta, 23/09/2026 15:00 local
const at = (ms: number) => new Date(T0.getTime() + ms).toISOString();

let seq = 0;
const user = (ms = 0, text = "oi"): ChatMessage => ({ id: ++seq, role: "user", text, at: at(ms), status: "seen", reaction: null });
const hana = (ms = 0, text = "oi!"): ChatMessage => ({ id: ++seq, role: "hana", text, at: at(ms), emotion: "happy", thought: null });
const scene = (ms = 0): ChatMessage => ({ id: ++seq, role: "scene", text: "[…]", at: at(ms) });

describe("tempos da conversa (9.2)", () => {
  it("digitando: min(600 + 35 × caracteres, 3500)", () => {
    expect(typingDelayMs("oi")).toBe(670);
    expect(typingDelayMs("😭😭")).toBe(670); // emoji conta como 1 caractere
    expect(typingDelayMs("a".repeat(100))).toBe(3500);
  });

  it("visto: 400–1200 ms, ou 2–4 s emburrada/com briga", () => {
    expect([readDelayMs(false, () => 0), readDelayMs(false, () => 1)]).toEqual([400, 1200]);
    expect([readDelayMs(true, () => 0), readDelayMs(true, () => 1)]).toEqual([2000, 4000]);
  });

  it("300–700 ms entre balões; a boca para um pouco depois do último", () => {
    expect([balloonGapMs(() => 0), balloonGapMs(() => 1)]).toEqual([300, 700]);
    expect(talkTailMs("oi")).toBe(350);
    expect(talkTailMs("a".repeat(400))).toBe(1500);
  });
});

describe("buildChatRequest (6.1)", () => {
  const save = (over: Partial<SaveData> = {}): SaveData => ({ ...initialSave(T0), profile: { ...PROFILE }, openingDone: true, ...over });

  it("perfil com o tratamento do estágio e relação resumida", () => {
    const req = buildChatRequest(save(), "reply", T0, "America/Sao_Paulo");
    expect(req.mode).toBe("reply");
    expect(req.profile).toEqual({ ...PROFILE, addressAs: "Dan-san" });
    expect(req.relationship).toMatchObject({ stage: 0, affection: 5, trust: 5, romance: 0, daysTalked: 0, distant: false, pendingConflict: null, confession: "locked", togetherSince: null });
    expect(req.relationship.confessionNote).toBe("você ainda não está pronta para namorar");
    expect(req.client).toEqual({ nowIso: T0.toISOString(), timeZone: "America/Sao_Paulo" });
    const r2 = buildChatRequest(save({ relationship: { ...initialRelationship(T0), stage: 2, affection: 40, trust: 35 } }), "reply", T0, "UTC");
    expect(r2.profile.addressAs).toBe("Dan-kun");
  });

  it("humor já com decaimento", () => {
    const rel = { ...initialRelationship(T0), mood: { emotion: "excited" as const, intensity: 1, at: at(-20 * MINUTE) } };
    expect(buildChatRequest(save({ relationship: rel }), "reply", T0, "UTC").mood).toEqual({ emotion: "excited", intensity: 0.5 });
    const old = { ...rel, mood: { ...rel.mood, at: at(-3 * HOUR) } };
    expect(buildChatRequest(save({ relationship: old }), "reply", T0, "UTC").mood.emotion).toBe("neutral");
  });

  it("só as últimas 30 mensagens, memórias como texto e briga em aberto", () => {
    const messages = Array.from({ length: 45 }, (_, i) => (i % 2 ? hana(i * MINUTE) : user(i * MINUTE)));
    const rel = { ...initialRelationship(T0), pendingConflict: { reason: "ele riu do meu mangá", at: at(0) } };
    const req = buildChatRequest(save({ messages, relationship: rel, memories: [{ id: 900, text: "gosta de gatos", at: at(0) }] }), "reply", T0, "UTC");
    expect(req.history).toHaveLength(30);
    expect(req.history[29]).toEqual({ role: messages[44].role, text: messages[44].text, at: messages[44].at });
    expect(req.memories).toEqual(["gosta de gatos"]);
    expect(req.relationship.pendingConflict).toBe("ele riu do meu mangá");
  });

  it("sem perfil não dá pra montar", () => {
    expect(() => buildChatRequest(initialSave(T0), "reply", T0, "UTC")).toThrow();
  });
});

describe("resumo (5.6)", () => {
  const list = (n: number) => Array.from({ length: n }, (_, i) => (i % 2 ? hana(i) : user(i)));

  it("só com mais de 40 mensagens não resumidas fora da janela de 30", () => {
    expect(summarizeBatch(list(70), 0)).toBeNull(); // 40 fora da janela
    const msgs = list(71);
    const batch = summarizeBatch(msgs, 0);
    expect(batch).toHaveLength(41);
    expect(batch?.at(-1)?.id).toBe(msgs[40].id);
  });

  it("ignora o que já foi resumido", () => {
    const msgs = list(100); // 70 fora da janela
    expect(summarizeBatch(msgs, msgs[29].id)).toBeNull(); // sobram 40
    expect(summarizeBatch(msgs, msgs[28].id)).toHaveLength(41);
  });

  it("mensagens do usuário sem resposta depois da última fala dela", () => {
    const a = hana();
    const b = user();
    const c = scene();
    const d = user();
    expect(unansweredUserIds([user(), a, b, c, d])).toEqual([b.id, d.id]);
    expect(unansweredUserIds([user(), hana()])).toEqual([]);
  });
});

describe("linhas da conversa", () => {
  it("separador de dia na primeira mensagem e a cada dia novo", () => {
    const rows = buildRows([hana(0), user(MINUTE), user(20 * HOUR)]);
    const days = rows.filter((r) => r.kind === "day");
    expect(days.map((d) => d.kind === "day" && d.label)).toEqual([formatDayLabel(T0), formatDayLabel(new Date(T0.getTime() + 20 * HOUR))]);
  });

  it("indicação de cena só com mais de 3 h", () => {
    const rows = buildRows([hana(0), user(3 * HOUR), hana(3 * HOUR + 1), user(8 * HOUR + 1)]);
    expect(rows.filter((r) => r.kind === "gap").map((r) => r.kind === "gap" && r.text)).toEqual(["[5 horas depois]"]);
  });

  it("sem indicação de cena colada numa cena", () => {
    expect(buildRows([scene(0), hana(5 * HOUR)]).some((r) => r.kind === "gap")).toBe(false);
  });

  it("agrupa balões seguidos do mesmo papel", () => {
    const rows = buildRows([hana(0), hana(1), user(2), hana(3)]).filter((r) => r.kind === "msg");
    expect(rows.map((r) => r.kind === "msg" && [r.first, r.last])).toEqual([[true, false], [false, true], [true, true], [true, true]]);
  });

  it("*ações* separadas do texto", () => {
    expect(splitActions("q-quem disse? *esconde o rosto* …baka")).toEqual([
      { text: "q-quem disse? ", action: false },
      { text: "esconde o rosto", action: true },
      { text: " …baka", action: false },
    ]);
    expect(splitActions("sem ação")).toEqual([{ text: "sem ação", action: false }]);
  });

  it("dia por extenso em pt-BR", () => {
    expect(formatDayLabel(new Date(2026, 8, 26))).toBe("sábado, 26 de setembro");
  });
});
