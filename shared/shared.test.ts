import { describe, expect, it } from "vitest";
import { EMOTION_LIST } from "../src/ascii/expressions";
import { HANA_TURN_JSON_SCHEMA, HanaTurnSchema, parseHanaTurn, sanitizeTurn } from "./schema";
import { STAGES, callName, clampDeltas, stageProgress, TIME_HINT } from "./stages";
import { EMOTIONS, type HanaTurn } from "./types";

const valid: HanaTurn = {
  thought: "ele parece legal",
  emotion: "happy",
  intensity: 0.6,
  messages: ["oi!", "tudo bem?"],
  reaction: "heart",
  deltas: { affection: 1, trust: 1, romance: 0 },
  newMemories: ["tem um cachorro chamado Thor"],
  event: "none",
};

describe("schema do turno", () => {
  it("as 13 emoções batem com as expressões ASCII", () => {
    expect([...EMOTIONS].sort()).toEqual([...EMOTION_LIST].sort());
  });

  it("thought é a primeira propriedade (Zod e JSON Schema)", () => {
    expect(Object.keys(HanaTurnSchema.shape)[0]).toBe("thought");
    expect(Object.keys(HANA_TURN_JSON_SCHEMA.properties)[0]).toBe("thought");
  });

  it("JSON Schema: todo objeto fechado, todos os campos required, sem restrições numéricas", () => {
    const visit = (node: unknown): void => {
      if (!node || typeof node !== "object") return;
      const o = node as Record<string, unknown>;
      if (o.type === "object") {
        expect(o.additionalProperties).toBe(false);
        expect([...(o.required as string[])].sort()).toEqual(Object.keys(o.properties as object).sort());
      }
      for (const k of ["minimum", "maximum", "minLength", "maxLength", "minItems", "maxItems"]) expect(o).not.toHaveProperty(k);
      Object.values(o).forEach(visit);
    };
    visit(HANA_TURN_JSON_SCHEMA);
    expect(Object.keys(HANA_TURN_JSON_SCHEMA.properties).sort()).toEqual(Object.keys(HanaTurnSchema.shape).sort());
  });

  it("Zod aceita um turno válido e rejeita emoção desconhecida ou delta fracionado", () => {
    expect(HanaTurnSchema.safeParse(valid).success).toBe(true);
    expect(HanaTurnSchema.safeParse({ ...valid, emotion: "angry" }).success).toBe(false);
    expect(HanaTurnSchema.safeParse({ ...valid, deltas: { ...valid.deltas, trust: 1.5 } }).success).toBe(false);
  });

  it("sanitizeTurn aplica os limites do código", () => {
    const t = sanitizeTurn({
      ...valid,
      intensity: 7,
      messages: ["  ", "a".repeat(450), "dois", "três", "quatro"],
      newMemories: ["x", "", "y", "z"],
      deltas: { affection: 20, trust: -20, romance: 9 },
    })!;
    expect(t.intensity).toBe(1);
    expect(t.messages).toHaveLength(3);
    expect(t.messages[0]).toHaveLength(400);
    expect(t.newMemories).toEqual(["x", "y"]);
    expect(t.deltas).toEqual({ affection: 4, trust: -8, romance: 4 });
  });

  it("sem nenhum balão não vazio → null (retry)", () => {
    expect(sanitizeTurn({ ...valid, messages: ["", "   "] })).toBeNull();
  });

  it("parseHanaTurn: JSON inválido ou fora do schema → null", () => {
    expect(parseHanaTurn(JSON.stringify(valid))).toEqual(valid);
    expect(parseHanaTurn("{oops")).toBeNull();
    expect(parseHanaTurn(JSON.stringify({ ...valid, event: "wedding" }))).toBeNull();
  });
});

describe("stages", () => {
  it("6 estágios com ícones", () => {
    expect(STAGES.map((s) => s.icon).join("")).toBe("🌱🌸🌷💐💗💞");
    expect(STAGES[5].req.confession).toBe(true);
  });

  it("clampDeltas", () => {
    expect(clampDeltas({ affection: 5, trust: -9, romance: -6 })).toEqual({ affection: 4, trust: -8, romance: -5 });
  });

  it("callName segue o estágio e a preferência", () => {
    const p = { name: "Dan", honorific: "kun" as const };
    expect(callName(p, 0)).toBe("Dan-san");
    expect(callName(p, 1)).toBe("Dan-san");
    expect(callName(p, 2)).toBe("Dan-kun");
    expect(callName({ ...p, honorific: "chan" }, 4)).toBe("Dan-chan");
    expect(callName({ ...p, honorific: "none" }, 3)).toBe("Dan");
    expect(callName(p, 5)).toBe("Dan");
    expect(callName(p, 5, "Dantinho")).toBe("Dantinho");
  });

  it("stageProgress: menor progresso entre os requisitos", () => {
    const p = stageProgress(0, { affection: 15, trust: 5, romance: 0, daysTalked: 1, userMessages: 20 }, "normal");
    expect(p.next).toBe(1);
    expect(p.ratio).toBe(0.5);
    expect(p.hearts).toBe(2);
    expect(p.hint).toBe(STAGES[0].hint);
  });

  it("stageProgress: quando só falta tempo, dica de voltar amanhã", () => {
    const p = stageProgress(1, { affection: 40, trust: 40, romance: 5, daysTalked: 1, userMessages: 80 }, "normal");
    expect(p.onlyTimeMissing).toBe(true);
    expect(p.hint).toBe(TIME_HINT);
    expect(stageProgress(5, { affection: 0, trust: 0, romance: 0, daysTalked: 0, userMessages: 0 }, "normal").next).toBeNull();
  });
});
