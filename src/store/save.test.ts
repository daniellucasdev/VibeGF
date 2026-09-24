import { describe, expect, it, vi } from "vitest";
import { initialRelationship } from "../game/relationship";
import {
  DEFAULT_SETTINGS, INITIAL_SUMMARY, MAX_MESSAGES,
  commitTurn, createSafeStorage, initialSave, markSeen, migrateSave, pickSave, pushMessage, sanitizeSave, setMood,
  type ChatMessage, type SaveData,
} from "./save";
import { PROFILE, makeTurn, memoryStorage } from "./testUtils";

const T0 = new Date(2026, 8, 23, 15, 0);
const iso = (min = 0) => new Date(T0.getTime() + min * 60_000).toISOString();

const game = (over: Partial<SaveData> = {}): SaveData => ({ ...initialSave(T0), profile: { ...PROFILE }, openingDone: true, ...over });

function withUser(save: SaveData, ...texts: string[]): { save: SaveData; ids: number[] } {
  const ids: number[] = [];
  for (const text of texts) {
    const out = pushMessage(save, { role: "user", text, at: iso(), status: "sent", reaction: null });
    save = out.save;
    ids.push(out.id);
  }
  return { save, ids };
}

describe("save inicial", () => {
  it("resumo inicial, ajustes padrão e nenhuma conversa", () => {
    const s = initialSave(T0);
    expect(s.summary).toBe(INITIAL_SUMMARY);
    expect(s.settings).toEqual(DEFAULT_SETTINGS);
    expect(s.settings.readThoughts).toBe(false);
    expect(s.settings.showNumbers).toBe(false);
    expect(s.settings.idleNudge).toBe(true);
    expect([s.profile, s.messages.length, s.nextId, s.openingDone]).toEqual([null, 0, 1, false]);
  });

  it("pickSave tira as ações e mantém só o que é salvo", () => {
    const withActions = { ...game(), startGame: () => {} };
    const picked = pickSave(withActions);
    expect(Object.keys(picked).sort()).toEqual(Object.keys(game()).sort());
  });
});

describe("sanitizeSave (validação do que vem do disco)", () => {
  it("lixo vira o save inicial", () => {
    for (const raw of [null, undefined, 42, "oi", [], { profile: 3 }]) {
      const s = sanitizeSave(raw, T0);
      expect(s.profile).toBeNull();
      expect(s.messages).toEqual([]);
    }
  });

  it("um save válido passa intacto", () => {
    const { save } = withUser(game({ summary: "resumo", memories: [{ id: 50, text: "gosta de chuva", at: iso() }], nextId: 51 }), "oi");
    const round = sanitizeSave(JSON.parse(JSON.stringify(save)), T0);
    expect(round).toEqual(save);
  });

  it("aproveita cada campo válido e descarta só o que estragou", () => {
    const good: ChatMessage = { id: 3, role: "hana", text: "oi", at: iso(), emotion: "shy", thought: null };
    const s = sanitizeSave({
      profile: { ...PROFILE },
      settings: { theme: "night", showNumbers: "sim", pace: "turbo" },
      relationship: { affection: 10 },
      messages: [{ id: 1, role: "robot", text: "x", at: iso() }, good, { id: 2, role: "user", text: "fora de ordem", at: iso(), status: "sent", reaction: null }],
      summary: 12,
      nextId: -5,
    }, T0);
    expect(s.profile).toEqual(PROFILE);
    expect(s.settings).toEqual({ ...DEFAULT_SETTINGS, theme: "night" });
    expect(s.relationship).toEqual(initialRelationship(T0));
    expect(s.messages).toEqual([good]);
    expect(s.summary).toBe(INITIAL_SUMMARY);
    expect(s.nextId).toBe(4);
  });

  it("sentimentos e intensidade fora da faixa são limitados, não descartados", () => {
    const rel = { ...initialRelationship(T0), affection: 140, trust: -3 };
    rel.mood = { ...rel.mood, intensity: 1.5 };
    const s = sanitizeSave({ relationship: rel }, T0);
    expect([s.relationship.affection, s.relationship.trust, s.relationship.mood.intensity]).toEqual([100, 0, 1]);
  });

  it("guarda no máximo 400 mensagens e o nextId fica acima do maior id", () => {
    const messages = Array.from({ length: 450 }, (_, i) => ({ id: i + 1, role: "scene", text: "…", at: iso() }));
    const s = sanitizeSave({ messages, nextId: 3 }, T0);
    expect(s.messages).toHaveLength(MAX_MESSAGES);
    expect(s.messages[0].id).toBe(51);
    expect(s.nextId).toBe(451);
  });

  it("save sem openingDone: a abertura já passou se houver conversa", () => {
    expect(sanitizeSave({ messages: [{ id: 1, role: "scene", text: "…", at: iso() }] }, T0).openingDone).toBe(true);
    expect(sanitizeSave({ messages: [] }, T0).openingDone).toBe(false);
  });

  it("migrate (versão antiga ou desconhecida) aproveita o que reconhece", () => {
    const old = { profile: { name: "  Dan  ", pronouns: "ele", honorific: "none" }, memories: [{ id: 1, text: "gosta de gatos", at: iso() }] };
    const s = migrateSave(old, 0, T0);
    expect(s.profile).toEqual({ name: "Dan", pronouns: "ele", honorific: "none" });
    expect(s.memories.map((m) => m.text)).toEqual(["gosta de gatos"]);
    expect(s.nextId).toBe(2);
  });
});

describe("createSafeStorage (try/catch na leitura e na escrita)", () => {
  it("JSON estragado vira null em vez de quebrar", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const storage = createSafeStorage(() => memoryStorage({ "kokoro-save": "{não é json" }));
    expect(storage.getItem("kokoro-save")).toBeNull();
    warn.mockRestore();
  });

  it("erro ao escrever (cota cheia) não quebra", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const full = memoryStorage();
    full.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    const storage = createSafeStorage(() => full);
    expect(() => storage.setItem("kokoro-save", { state: game(), version: 1 })).not.toThrow();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("sem localStorage (ou acesso negado) tudo vira no-op", () => {
    const storage = createSafeStorage(() => {
      throw new Error("SecurityError");
    });
    expect(storage.getItem("kokoro-save")).toBeNull();
    expect(() => storage.setItem("kokoro-save", { state: game(), version: 1 })).not.toThrow();
    expect(() => storage.removeItem("kokoro-save")).not.toThrow();
  });
});

describe("mensagens", () => {
  it("pushMessage dá ids crescentes e atualiza lastInteractionAt (menos em cena)", () => {
    let s = game();
    const a = pushMessage(s, { role: "scene", text: "[…]", at: iso(1) });
    expect(a.save.lastInteractionAt).toBeNull();
    s = a.save;
    const b = pushMessage(s, { role: "user", text: "oi", at: iso(2), status: "sent", reaction: null });
    expect([a.id, b.id, b.save.nextId]).toEqual([1, 2, 3]);
    expect(b.save.lastInteractionAt).toBe(iso(2));
  });

  it("guarda no máximo 400 mensagens", () => {
    let s = game();
    for (let i = 0; i < MAX_MESSAGES + 5; i++) s = pushMessage(s, { role: "scene", text: `${i}`, at: iso() }).save;
    expect(s.messages).toHaveLength(MAX_MESSAGES);
    expect(s.messages[0].text).toBe("5");
  });

  it("markSeen: ✓ enviado → ✓✓ visto só nas mensagens pedidas", () => {
    const { save, ids } = withUser(game(), "a", "b");
    const s = markSeen(save, [ids[0]]);
    expect(s.messages.map((m) => (m.role === "user" ? m.status : null))).toEqual(["seen", "sent"]);
  });

  it("setMood passa pelas correções (love antes do estágio 4 vira shy)", () => {
    expect(setMood(game(), "love", 3, T0).relationship.mood).toMatchObject({ emotion: "shy", intensity: 1 });
  });
});

describe("commitTurn", () => {
  it("aplica o turno com as mensagens do usuário daquele turno", () => {
    const { save, ids } = withUser(game(), "oi, tudo bem?", "acho que você errou o número");
    const { save: s, result } = commitTurn(save, { turn: makeTurn({ deltas: { affection: 3, trust: 2, romance: 1 } }), userIds: ids, now: T0 });
    expect(result.applied).toEqual({ affection: 3, trust: 2, romance: 1 });
    expect(s.relationship.userMessages).toBe(2);
    expect(s.relationship.mood.emotion).toBe("happy");
    expect(s.lastInteractionAt).toBe(T0.toISOString());
  });

  it("a reação vai na última mensagem do usuário do turno", () => {
    const { save, ids } = withUser(game(), "a", "b");
    const { save: s } = commitTurn(save, { turn: makeTurn({ reaction: "laugh" }), userIds: ids, now: T0 });
    expect(s.messages.map((m) => (m.role === "user" ? m.reaction : null))).toEqual([null, "laugh"]);
  });

  it("reação 'none' não marca nada", () => {
    const { save, ids } = withUser(game(), "a");
    const { save: s } = commitTurn(save, { turn: makeTurn({ reaction: "none" }), userIds: ids, now: T0 });
    expect(s.messages[0]).toMatchObject({ reaction: null });
  });

  it("memórias novas entram com dedupe", () => {
    const base = game({ memories: [{ id: 99, text: "tem um cachorro chamado Thor", at: iso() }], nextId: 100 });
    const { save, ids } = withUser(base, "meu cachorro Thor e eu programamos");
    const { save: s } = commitTurn(save, {
      turn: makeTurn({ newMemories: ["Tem um cachorro chamado Thor!", "trabalha com programação"] }),
      userIds: ids,
      now: T0,
    });
    expect(s.memories.map((m) => m.text)).toEqual(["tem um cachorro chamado Thor", "trabalha com programação"]);
    expect(new Set([...s.memories, ...s.messages].map((x) => x.id)).size).toBe(s.memories.length + s.messages.length);
  });

  it("marcos: subida de estágio e eventos entram no álbum", () => {
    const rel = { ...initialRelationship(T0), affection: 14, trust: 10, userMessages: 19, days: { daysTalked: ["2026-09-20"], today: { date: "", count: 0 } } };
    const { save, ids } = withUser(game({ relationship: rel }), "uma mensagem bem diferente");
    const { save: s, result } = commitTurn(save, { turn: makeTurn({ messages: ["hehe"], deltas: { affection: 2, trust: 0, romance: 0 } }), userIds: ids, now: T0 });
    expect(result.stageUp).toBe(1);
    expect(s.milestones).toEqual([expect.objectContaining({ kind: "stage_up", stage: 1, quote: "hehe", emotion: "happy" })]);
  });

  it("evento ignorado pelo código não vira marco", () => {
    const { save, ids } = withUser(game(), "desculpa");
    const { save: s } = commitTurn(save, { turn: makeTurn({ event: "made_up" }), userIds: ids, now: T0 });
    expect(s.milestones).toEqual([]);
  });
});
