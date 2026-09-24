import { describe, expect, it } from "vitest";
import { PACE, ROMANCE_CAP, requirementsFor } from "../../shared/stages";
import type { Deltas, HanaEvent, HanaTurn, PaceKey, Stage } from "../../shared/types";
import {
  applyTurn, classifyGrind, distantOf, initialRelationship, isSimilar, normalizeMessage, nextStage,
  type RelationshipState, type TurnInput,
} from "./relationship";
import { DAY, HOUR, dateKey } from "./time";

const T0 = new Date(2026, 8, 23, 15, 0); // quarta, 23/09/2026 15:00 local

const turn = (over: Partial<HanaTurn> = {}): HanaTurn => ({
  thought: "hmm",
  emotion: "neutral",
  intensity: 0.5,
  messages: ["oi"],
  reaction: "none",
  deltas: { affection: 0, trust: 0, romance: 0 },
  newMemories: [],
  event: "none",
  ...over,
});

let msgSeq = 0;
/** Mensagem nova e diferente de todas as anteriores (não dispara anti-grind). */
const fresh = () => `mensagem original numero ${++msgSeq} sobre assunto ${msgSeq * 7919}`;

const run = (s: RelationshipState, deltas: Partial<Deltas>, over: Partial<TurnInput> = {}, t: Partial<HanaTurn> = {}) =>
  applyTurn(s, {
    turn: turn({ deltas: { affection: 0, trust: 0, romance: 0, ...deltas }, ...t }),
    userMessages: [fresh()],
    now: T0,
    pace: "normal",
    ...over,
  });

/** Estado com os números dados, já com dias e mensagens suficientes. */
function stateWith(over: Partial<RelationshipState> & { daysTalked?: number } = {}): RelationshipState {
  const { daysTalked = 0, ...rest } = over;
  const base = initialRelationship(T0);
  const days = Array.from({ length: daysTalked }, (_, i) => dateKey(new Date(T0.getTime() - (i + 10) * DAY)));
  return { ...base, days: { daysTalked: days, today: { date: "", count: 0 } }, ...rest };
}

describe("estado inicial", () => {
  it("começa em 5/5/0, estágio 0, declaração locked", () => {
    const s = initialRelationship(T0);
    expect([s.affection, s.trust, s.romance, s.stage]).toEqual([5, 5, 0, 0]);
    expect(s.confession.state).toBe("locked");
  });
});

describe("clamp por mensagem", () => {
  it("afeição e confiança em [−8, +4]", () => {
    const s = stateWith({ affection: 50, trust: 50, stage: 3 });
    expect(run(s, { affection: 10, trust: 9 }).applied).toMatchObject({ affection: 4, trust: 4 });
    expect(run(s, { affection: -20, trust: -30 }).applied).toMatchObject({ affection: -8, trust: -8 });
  });

  it("doki-doki em [−5, +4]", () => {
    const s = stateWith({ romance: 30, stage: 4 });
    expect(run(s, { romance: 9 }).applied.romance).toBe(4);
    expect(run(s, { romance: -9 }).applied.romance).toBe(-5);
  });

  it("valores ficam em 0–100", () => {
    expect(run(stateWith({ affection: 2, trust: 1 }), { affection: -8, trust: -8 }).state).toMatchObject({ affection: 0, trust: 0 });
    const top = run(stateWith({ affection: 99, trust: 98, stage: 3 }), { affection: 4, trust: 4 }).state;
    expect([top.affection, top.trust]).toEqual([100, 100]);
  });
});

describe("teto diário", () => {
  it.each(Object.keys(PACE) as PaceKey[])("ritmo %s segura os ganhos do dia", (pace) => {
    let s = stateWith({ stage: 3, affection: 10, trust: 10 });
    for (let i = 0; i < 20; i++) s = run(s, { affection: 4, trust: 4 }, { pace }).state;
    expect(s.affection).toBe(10 + PACE[pace].dailyCap);
    expect(s.trust).toBe(10 + PACE[pace].dailyCap);
  });

  it("o teto zera no dia seguinte (data local)", () => {
    let s = stateWith({ stage: 3, affection: 10 });
    for (let i = 0; i < 10; i++) s = run(s, { affection: 4 }).state;
    expect(s.affection).toBe(22);
    expect(run(s, { affection: 4 }).applied.affection).toBe(0);
    const tomorrow = new Date(T0.getTime() + DAY);
    expect(run(s, { affection: 4 }, { now: tomorrow }).applied.affection).toBe(4);
  });

  it("perdas nunca têm teto", () => {
    let s = stateWith({ stage: 3, affection: 90 });
    for (let i = 0; i < 5; i++) s = run(s, { affection: -8 }).state;
    expect(s.affection).toBe(50);
  });

  it("o teto só conta o que foi ganho de fato (perdas não liberam mais ganho)", () => {
    let s = stateWith({ stage: 3, affection: 50 });
    for (let i = 0; i < 3; i++) s = run(s, { affection: 4 }).state; // +12
    s = run(s, { affection: -8 }).state;
    expect(run(s, { affection: 4 }).applied.affection).toBe(0);
  });
});

describe("anti-grind", () => {
  it("normaliza: minúsculas, sem pontuação nem emoji", () => {
    expect(normalizeMessage("Você é LINDA!!! 😍✨")).toBe("você é linda");
    expect(isSimilar(normalizeMessage("você é linda"), normalizeMessage("VOCÊ É LINDA 💕"))).toBe(true);
  });

  it("Jaccard ≥ 0,8 conta como repetição", () => {
    const a = normalizeMessage("você é a garota mais linda e fofa do mundo inteiro");
    expect(isSimilar(a, normalizeMessage("você é a garota mais linda e fofa do mundo"))).toBe(true); // 9/10
    expect(isSimilar(a, normalizeMessage("hoje choveu muito aqui na cidade"))).toBe(false);
  });

  it("repetir uma das últimas 10 mensagens multiplica os positivos por 0,25 (para baixo)", () => {
    let s = stateWith({ stage: 3, affection: 50, trust: 50, romance: 20 });
    s = run(s, { affection: 1 }, { userMessages: ["você é muito linda sabia"] }).state;
    const r = run(s, { affection: 4, trust: 3, romance: 2 }, { userMessages: ["Você é muito linda, sabia?!"] });
    expect(r.grind).toBe("repeat");
    expect(r.applied).toEqual({ affection: 1, trust: 0, romance: 0 });
  });

  it("repetição não alivia perdas", () => {
    let s = stateWith({ stage: 3, affection: 50 });
    s = run(s, {}, { userMessages: ["chata"] }).state;
    expect(run(s, { affection: -5 }, { userMessages: ["chata"] }).applied.affection).toBe(-5);
  });

  it("só olha as últimas 10 mensagens", () => {
    let s = stateWith({ stage: 3, affection: 50 });
    s = run(s, {}, { userMessages: ["mensagem antiga especial"] }).state;
    for (let i = 0; i < 10; i++) s = run(s, {}).state;
    expect(run(s, { affection: 4 }, { userMessages: ["mensagem antiga especial"] }).grind).toBeNull();
  });

  it("repetição dentro do mesmo turno também conta", () => {
    expect(classifyGrind(["te amo hana", "te amo hana"], [])).toBeNull(); // a primeira é nova
    expect(classifyGrind(["te amo hana", "te amo hana"], ["te amo hana"])).toBe("repeat");
  });

  it("mensagem com menos de 3 caracteres: no máximo +1 de afeição e 0 no resto", () => {
    const s = stateWith({ stage: 3, affection: 50, trust: 50, romance: 20 });
    const r = run(s, { affection: 4, trust: 3, romance: 2 }, { userMessages: ["oi"] });
    expect(r.grind).toBe("short");
    expect(r.applied).toEqual({ affection: 1, trust: 0, romance: 0 });
    expect(run(s, { trust: -3 }, { userMessages: ["k"] }).applied.trust).toBe(-3);
  });

  it("sem mensagem do usuário (retorno/silêncio) não há ganho", () => {
    const s = stateWith({ stage: 3, affection: 50 });
    const r = run(s, { affection: 3, trust: 2 }, { userMessages: [] });
    expect(r.grind).toBe("silent");
    expect(r.applied).toEqual({ affection: 0, trust: 0, romance: 0 });
  });
});

describe("teto de doki-doki por estágio", () => {
  it.each([0, 1, 2, 3, 4] as Stage[])("estágio %i limita em ROMANCE_CAP", (stage) => {
    let s = stateWith({ stage, romance: ROMANCE_CAP[stage] - 1 });
    s = run(s, { romance: 4 }).state;
    expect(s.romance).toBe(ROMANCE_CAP[stage]);
  });

  it("flertar no estágio 0 não passa de 5", () => {
    let s = initialRelationship(T0);
    for (let d = 0; d < 5; d++) {
      for (let i = 0; i < 5; i++) s = run(s, { romance: 4 }, { now: new Date(T0.getTime() + d * DAY) }).state;
    }
    expect(s.romance).toBe(5);
  });
});

describe("subida de estágio", () => {
  const ready = (stage: Stage, pace: PaceKey = "normal") => {
    const r = requirementsFor((stage + 1) as Stage, pace);
    return stateWith({
      stage, affection: r.affection, trust: r.trust, romance: Math.min(r.romance, ROMANCE_CAP[stage]),
      daysTalked: r.days, userMessages: r.messages,
    });
  };

  it.each([0, 1, 2, 3] as Stage[])("sobe de %i quando todos os requisitos estão cumpridos", (stage) => {
    const r = run(ready(stage), {});
    expect(r.stageUp).toBe(stage + 1);
    expect(r.state.stage).toBe(stage + 1);
  });

  it("não sobe se faltar qualquer requisito", () => {
    const base = ready(1);
    const r = requirementsFor(2, "normal");
    const missing: Partial<RelationshipState>[] = [
      { affection: r.affection - 1 },
      { trust: r.trust - 1 },
      { days: { daysTalked: base.days.daysTalked.slice(1), today: { date: "", count: 0 } } },
      { userMessages: r.messages - 2 }, // o turno soma +1
    ];
    for (const m of missing) expect(run({ ...base, ...m }, {}).stageUp).toBeNull();
  });

  it("estágio 4 exige doki-doki ≥ 40", () => {
    const s = ready(3);
    expect(run({ ...s, romance: 39 }, {}).stageUp).toBeNull();
    expect(run({ ...s, romance: 40 }, {}).stageUp).toBe(4);
  });

  it("dias e mensagens exigidos seguem o ritmo (Math.ceil)", () => {
    expect(requirementsFor(1, "lento")).toMatchObject({ days: 2, messages: 30 });
    expect(requirementsFor(1, "rapido")).toMatchObject({ days: 1, messages: 10 });
    expect(requirementsFor(3, "rapido")).toMatchObject({ days: 2, messages: 50 });
    const s = ready(0, "normal");
    expect(run(s, {}, { pace: "lento" }).stageUp).toBeNull();
    expect(run(ready(0, "lento"), {}, { pace: "lento" }).stageUp).toBe(1);
  });

  it("sobe no máximo um estágio por turno", () => {
    const s = stateWith({ stage: 0, affection: 90, trust: 90, romance: 5, daysTalked: 9, userMessages: 500 });
    const r1 = run(s, {});
    expect(r1.state.stage).toBe(1);
    const r2 = run(r1.state, {});
    expect(r2.state.stage).toBe(2);
  });

  it("nunca desce, mesmo com os sentimentos no chão", () => {
    let s = stateWith({ stage: 3, affection: 60, trust: 55 });
    for (let i = 0; i < 10; i++) s = run(s, { affection: -8, trust: -8 }).state;
    expect(s.affection).toBe(0);
    expect(s.stage).toBe(3);
  });

  it("o estágio 5 só vem pela declaração", () => {
    const s = stateWith({ stage: 4, affection: 100, trust: 100, romance: 100, daysTalked: 20, userMessages: 900 });
    expect(nextStage(s, "normal")).toBeNull();
    let r = run(s, {});
    expect(r.state.stage).toBe(4);
    expect(r.state.confession.state).toBe("open");
    r = run(r.state, {}, {}, { event: "confession_accepted", emotion: "love" });
    expect(r.state.stage).toBe(5);
    expect(r.stageUp).toBe(5);
    expect(r.confessionScene).toBe(true);
    expect(r.milestone).toBe("confession_accepted");
    expect(r.state.confession.state).toBe("together");
  });

  it("declaração aceita fora de hora é ignorada", () => {
    const r = run(stateWith({ stage: 2, affection: 40, trust: 35 }), {}, {}, { event: "confession_accepted" });
    expect(r.state.stage).toBe(2);
    expect(r.eventIgnored).toBe(true);
    expect(r.confessionScene).toBe(false);
  });
});

describe("distância", () => {
  it("afeição mais de 15 abaixo do mínimo do estágio → distante", () => {
    expect(distantOf(stateWith({ stage: 2, affection: 20 }))).toBe(false); // 35 − 15 = 20
    expect(distantOf(stateWith({ stage: 2, affection: 19 }))).toBe(true);
    expect(distantOf(stateWith({ stage: 5, affection: 64 }))).toBe(true);
    expect(distantOf(stateWith({ stage: 0, affection: 0 }))).toBe(false);
  });
});

describe("dias e mensagens", () => {
  it("conta mensagens do usuário e dias com 3+ mensagens", () => {
    let s = initialRelationship(T0);
    s = run(s, {}, { userMessages: [fresh(), fresh()] }).state;
    expect(s.userMessages).toBe(2);
    expect(s.days.daysTalked).toHaveLength(0);
    s = run(s, {}).state;
    expect(s.days.daysTalked).toEqual([dateKey(T0)]);
    s = run(s, {}, { now: new Date(T0.getTime() + 2 * HOUR) }).state;
    expect(s.days.daysTalked).toHaveLength(1);
  });
});

describe("eventos", () => {
  const ev = (s: RelationshipState, event: HanaEvent, thought = "hmm") => run(s, {}, {}, { event, thought });

  it.each(["first_name_basis", "nickname", "inside_joke", "date_invite"] as HanaEvent[])("%s vira marco", (event) => {
    const r = ev(stateWith({ stage: 2 }), event);
    expect(r.milestone).toBe(event);
    expect(r.event).toBe(event);
  });

  it("fight abre pendingConflict com o motivo; made_up limpa", () => {
    const r = ev(stateWith({ stage: 2 }), "fight", "ele riu do meu mangá");
    expect(r.state.pendingConflict).toEqual({ reason: "ele riu do meu mangá", at: T0.toISOString() });
    expect(r.milestone).toBe("fight");
    const r2 = ev(r.state, "made_up");
    expect(r2.state.pendingConflict).toBeNull();
    expect(r2.milestone).toBe("made_up");
  });

  it("made_up sem briga e fight com briga em aberto são ignorados", () => {
    expect(ev(stateWith(), "made_up")).toMatchObject({ eventIgnored: true, milestone: null });
    const fought = ev(stateWith(), "fight", "primeira").state;
    const again = ev(fought, "fight", "segunda");
    expect(again.eventIgnored).toBe(true);
    expect(again.state.pendingConflict?.reason).toBe("primeira");
  });

  it("confession_declined: cooldown de 24 h e humor shy", () => {
    const r = run(stateWith({ stage: 1 }), {}, {}, { event: "confession_declined", emotion: "surprised", intensity: 0.2 });
    expect(r.state.confession.state).toBe("cooldown");
    expect(r.state.mood.emotion).toBe("shy");
    expect(r.state.stage).toBe(1);
  });

  it("confession_rejected: doki-doki −10, humor sad, cooldown 48 h", () => {
    const s = stateWith({ stage: 4, affection: 90, trust: 90, romance: 70, daysTalked: 10, userMessages: 500 });
    let r = run(s, {}, {}, { event: "she_confessed" });
    expect(r.state.confession.state).toBe("she_confessed");
    r = run(r.state, {}, {}, { event: "confession_rejected", emotion: "crying" });
    expect(r.state.romance).toBe(60);
    expect(r.state.mood.emotion).toBe("sad");
    expect(r.state.confession.state).toBe("cooldown");
    expect(new Date(r.state.confession.cooldownUntil!).getTime() - T0.getTime()).toBe(48 * HOUR);
  });

  it("love antes do estágio 4 vira shy", () => {
    expect(run(stateWith({ stage: 3 }), {}, {}, { emotion: "love" }).state.mood.emotion).toBe("shy");
    expect(run(stateWith({ stage: 4 }), {}, {}, { emotion: "love" }).state.mood.emotion).toBe("love");
  });
});
