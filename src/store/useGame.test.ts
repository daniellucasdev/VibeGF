import { describe, expect, it } from "vitest";
import { SAVE_KEY, SAVE_VERSION, createSafeStorage } from "./save";
import { PROFILE, memoryStorage } from "./testUtils";
import { createGameStore } from "./useGame";

const read = (storage: Storage) => JSON.parse(storage.getItem(SAVE_KEY) ?? "null");

describe("store com persist (seção 10)", () => {
  it("salva em 'kokoro-save' com version 1, sem as ações", () => {
    const storage = memoryStorage();
    const store = createGameStore(createSafeStorage(() => storage));
    store.getState().startGame({ ...PROFILE }, "lento");
    const saved = read(storage);
    expect(saved.version).toBe(SAVE_VERSION);
    expect(saved.state.profile).toEqual(PROFILE);
    expect(saved.state.settings.pace).toBe("lento");
    expect(Object.values(saved.state).some((v) => typeof v === "function")).toBe(false);
    expect(Object.keys(saved.state)).toEqual(expect.arrayContaining([
      "profile", "settings", "relationship", "messages", "summarizedUpTo", "memories", "summary", "milestones", "lastInteractionAt",
    ]));
    expect(saved.state.relationship).toEqual(expect.objectContaining({ dailyGains: expect.any(Object), days: expect.any(Object), mood: expect.any(Object), confession: expect.any(Object), pendingConflict: null }));
  });

  it("recarregar mantém tudo", () => {
    const storage = memoryStorage();
    const a = createGameStore(createSafeStorage(() => storage));
    a.getState().startGame({ ...PROFILE }, "normal");
    a.getState().appendMessage({ role: "user", text: "oi", at: new Date().toISOString(), status: "sent", reaction: null });
    a.getState().updateSettings({ readThoughts: true });

    const b = createGameStore(createSafeStorage(() => storage));
    expect(b.getState().profile).toEqual(PROFILE);
    expect(b.getState().messages.map((m) => m.text)).toEqual(["oi"]);
    expect(b.getState().settings.readThoughts).toBe(true);
    expect(typeof b.getState().appendMessage).toBe("function");
  });

  it("versão diferente passa pelo migrate", () => {
    const storage = memoryStorage({
      [SAVE_KEY]: JSON.stringify({ version: 0, state: { profile: { name: "Ana", pronouns: "ela", honorific: "chan" }, memories: [{ id: 7, text: "gosta de chuva", at: "2026-09-20T10:00:00.000Z" }] } }),
    });
    const store = createGameStore(createSafeStorage(() => storage));
    expect(store.getState().profile?.name).toBe("Ana");
    expect(store.getState().memories.map((m) => m.text)).toEqual(["gosta de chuva"]);
    expect(store.getState().nextId).toBe(8);
    expect(read(storage).version).toBe(SAVE_VERSION); // regravado já migrado
  });

  it("save estragado na versão atual também é validado", () => {
    const storage = memoryStorage({ [SAVE_KEY]: JSON.stringify({ version: SAVE_VERSION, state: { profile: { name: "" }, messages: "x" } }) });
    const store = createGameStore(createSafeStorage(() => storage));
    expect(store.getState().profile).toBeNull();
    expect(store.getState().messages).toEqual([]);
  });

  it("apagar memória e apagar tudo", () => {
    const store = createGameStore(createSafeStorage(() => memoryStorage()));
    store.getState().startGame({ ...PROFILE }, "normal");
    store.setState({ memories: [{ id: 1, text: "a", at: "2026-09-20T10:00:00.000Z" }, { id: 2, text: "b", at: "2026-09-20T10:00:00.000Z" }], nextId: 3 });
    store.getState().deleteMemory(1);
    expect(store.getState().memories.map((m) => m.text)).toEqual(["b"]);
    store.getState().resetAll();
    expect(store.getState().profile).toBeNull();
    expect(store.getState().memories).toEqual([]);
  });

  it("resumo: guarda até onde já foi resumido e nunca volta", () => {
    const store = createGameStore(createSafeStorage(() => memoryStorage()));
    store.getState().setSummary("x".repeat(1500), 40);
    expect(store.getState().summary).toHaveLength(1200);
    store.getState().setSummary("outro", 10);
    expect(store.getState().summarizedUpTo).toBe(40);
  });
});
