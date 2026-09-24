import { describe, expect, it } from "vitest";
import type { ConfessionState, HanaEvent } from "../../shared/types";
import {
  DECLINED_COOLDOWN_MS, REJECTED_COOLDOWN_MS, applyConfessionEvent, confessionNote, initialConfession,
  refreshConfession, type Confession,
} from "./confession";
import { DAY, HOUR } from "./time";

const T0 = new Date(2026, 8, 23, 20, 0);
const at = (ms: number) => new Date(T0.getTime() + ms);
const inState = (state: ConfessionState, over: Partial<Confession> = {}): Confession =>
  ({ ...initialConfession(), state, ...over });

describe("refreshConfession", () => {
  it("locked → open no estágio 4 com os requisitos cumpridos", () => {
    const c = refreshConfession(initialConfession(), { stage: 4, ready: true, now: T0 });
    expect(c.state).toBe("open");
    expect(c.openSince).toBe(T0.toISOString());
  });

  it("continua locked sem requisitos ou antes do estágio 4", () => {
    expect(refreshConfession(initialConfession(), { stage: 4, ready: false, now: T0 }).state).toBe("locked");
    expect(refreshConfession(initialConfession(), { stage: 3, ready: true, now: T0 }).state).toBe("locked");
  });

  it("open volta a locked se os requisitos deixarem de valer", () => {
    const open = inState("open", { openSince: T0.toISOString() });
    expect(refreshConfession(open, { stage: 4, ready: false, now: T0 }).state).toBe("locked");
  });

  it("estágio 5 → together", () => {
    const c = refreshConfession(initialConfession(), { stage: 5, ready: true, now: T0 });
    expect(c.state).toBe("together");
    expect(c.togetherSince).toBe(T0.toISOString());
  });

  it("she_confessed espera a resposta", () => {
    const c = inState("she_confessed");
    expect(refreshConfession(c, { stage: 4, ready: false, now: at(10 * DAY) })).toBe(c);
  });

  it("cooldown vale até o fim e depois recalcula", () => {
    const c = applyConfessionEvent(initialConfession(), "confession_declined", T0).confession;
    expect(refreshConfession(c, { stage: 4, ready: true, now: at(DECLINED_COOLDOWN_MS - 1) }).state).toBe("cooldown");
    expect(refreshConfession(c, { stage: 4, ready: true, now: at(DECLINED_COOLDOWN_MS) }).state).toBe("open");
    expect(refreshConfession(c, { stage: 2, ready: false, now: at(DECLINED_COOLDOWN_MS) }).state).toBe("locked");
  });
});

describe("applyConfessionEvent", () => {
  const all: ConfessionState[] = ["locked", "open", "she_confessed", "cooldown", "together"];
  const valid: Record<string, ConfessionState[]> = {
    she_confessed: ["open"],
    confession_accepted: ["open", "she_confessed"],
    confession_declined: ["locked", "open", "cooldown"],
    confession_rejected: ["she_confessed"],
  };

  for (const [event, states] of Object.entries(valid)) {
    for (const s of all) {
      const ok = states.includes(s);
      it(`${event} em ${s} → ${ok ? "vale" : "ignorado"}`, () => {
        const before = inState(s);
        const out = applyConfessionEvent(before, event as HanaEvent, T0);
        expect(out.accepted).toBe(ok);
        if (!ok) expect(out.confession).toBe(before);
      });
    }
  }

  it("she_confessed: open → she_confessed", () => {
    expect(applyConfessionEvent(inState("open"), "she_confessed", T0).confession.state).toBe("she_confessed");
  });

  it("confession_accepted: vira casal, com data", () => {
    const out = applyConfessionEvent(inState("she_confessed"), "confession_accepted", T0);
    expect(out.becomeCouple).toBe(true);
    expect(out.confession).toMatchObject({ state: "together", togetherSince: T0.toISOString() });
  });

  it("confession_accepted em locked (cedo demais) é ignorado", () => {
    const out = applyConfessionEvent(initialConfession(), "confession_accepted", T0);
    expect(out).toMatchObject({ accepted: false, becomeCouple: false });
    expect(out.confession.state).toBe("locked");
  });

  it("confession_declined: cooldown de 24 h e humor shy", () => {
    const out = applyConfessionEvent(inState("open"), "confession_declined", T0);
    expect(out.forceMood).toBe("shy");
    expect(out.confession).toMatchObject({ state: "cooldown", cooldownKind: "declined", cooldownUntil: at(24 * HOUR).toISOString() });
  });

  it("confession_rejected: cooldown de 48 h, humor sad, doki-doki −10", () => {
    const out = applyConfessionEvent(inState("she_confessed"), "confession_rejected", T0);
    expect(out).toMatchObject({ forceMood: "sad", romanceDelta: -10 });
    expect(out.confession).toMatchObject({ state: "cooldown", cooldownKind: "rejected", cooldownUntil: at(REJECTED_COOLDOWN_MS).toISOString() });
  });

  it("eventos que não são de declaração não mexem em nada", () => {
    const c = inState("open");
    expect(applyConfessionEvent(c, "inside_joke", T0)).toMatchObject({ accepted: false, confession: c });
  });
});

describe("confessionNote", () => {
  it("frases da tabela 5.4", () => {
    expect(confessionNote(inState("locked"), T0)).toBe("você ainda não está pronta para namorar");
    expect(confessionNote(inState("open", { openSince: T0.toISOString() }), at(HOUR))).toBe(
      "se o usuário se declarar, você pode aceitar; você também pode se declarar se surgir um momento especial",
    );
    expect(confessionNote(inState("she_confessed"), T0)).toBe("você acabou de se declarar e espera a resposta, morrendo de vergonha");
    expect(confessionNote(inState("cooldown", { cooldownKind: "declined" }), T0)).toBe("o usuário se declarou e você pediu tempo");
    expect(confessionNote(inState("cooldown", { cooldownKind: "rejected" }), T0)).toBe("você se declarou e ele recusou; está triste, mas seguindo");
    expect(confessionNote(inState("cooldown", { cooldownKind: "rejected" }), T0, "ela")).toContain("e ela recusou");
    expect(confessionNote(inState("together", { togetherSince: T0.toISOString() }), T0)).toBe("vocês estão namorando desde 23/09/2026");
  });

  it("depois de 2 dias em open, ela está decidida a se declarar", () => {
    const c = inState("open", { openSince: T0.toISOString() });
    expect(confessionNote(c, at(2 * DAY - 1))).not.toContain("decidida");
    expect(confessionNote(c, at(2 * DAY))).toContain("você está decidida a se declarar hoje, se o clima permitir");
  });
});
