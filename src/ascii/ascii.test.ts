import { describe, expect, it } from "vitest";
import { ART_COLS, ART_ROWS, BASE_LINES, TOKEN_LETTERS, TOKEN_WIDTH } from "./base";
import { BLINK_EYES, BLINK_LIDS, EMOTION_LIST, EXPRESSIONS, EXPRESSION_META, LOOK_AT_CHAT_EYES } from "./expressions";
import { classAt, colorize, fill, tokenValues, type FillOptions } from "./render";
import { MAX_AMBIENT, MAX_PARTICLES, ambientParticles, burstParticles } from "./particles";

/** Largura em colunas (code points): ♥ conta como 1. */
const width = (s: string) => Array.from(s).length;

const FRAMES: [string, FillOptions][] = [
  ["base", {}],
  ["piscando", { blinking: true }],
  ["falando", { talkFrame: true }],
  ["olhando pro chat", { lookAtChat: true }],
  ["piscando + falando + olhando", { blinking: true, talkFrame: true, lookAtChat: true }],
];

describe("arte base", () => {
  it("tem 21 linhas e no máximo 42 colunas", () => {
    expect(BASE_LINES).toHaveLength(ART_ROWS);
    for (const line of BASE_LINES) expect(width(line)).toBeLessThanOrEqual(ART_COLS);
  });

  it("cada sequência de token tem a largura documentada", () => {
    for (const line of BASE_LINES) {
      for (const m of line.matchAll(/([A-Z])\1*/g)) {
        const letter = m[1] as keyof typeof TOKEN_WIDTH;
        expect(TOKEN_LETTERS).toContain(letter);
        expect(m[0].length).toBe(TOKEN_WIDTH[letter]);
      }
    }
  });

  it("não tem letras maiúsculas fora dos tokens nem caracteres fora do ASCII", () => {
    for (const line of BASE_LINES) {
      expect(line).toMatch(/^[\x20-\x7E]*$/);
      for (const ch of line.replace(/[^A-Z]/g, "")) expect(TOKEN_LETTERS).toContain(ch);
    }
  });

  it("mantém o laço, a presilha e o ahoge nas posições da máscara", () => {
    expect(BASE_LINES[6][7]).toBe("*");
    expect(BASE_LINES[0].trim()).toBe(",");
    expect(BASE_LINES[4].slice(32, 40)).toBe(".-.  .-.");
  });
});

describe("expressões", () => {
  it("tem as 13 emoções com rótulo e kaomoji", () => {
    expect(EMOTION_LIST).toHaveLength(13);
    for (const e of EMOTION_LIST) {
      expect(EXPRESSION_META[e].label).not.toBe("");
      expect(EXPRESSION_META[e].kaomoji).not.toBe("");
    }
  });

  it("cada valor tem a largura do seu token (incluindo talk, piscada e olhar)", () => {
    for (const e of EMOTION_LIST) {
      const exp = EXPRESSIONS[e];
      for (const letter of TOKEN_LETTERS) expect(width(exp[letter]), `${e}.${letter}`).toBe(TOKEN_WIDTH[letter]);
      expect(width(exp.talk), `${e}.talk`).toBe(TOKEN_WIDTH.M);
    }
    expect(width(BLINK_LIDS)).toBe(TOKEN_WIDTH.K);
    expect(width(BLINK_EYES)).toBe(TOKEN_WIDTH.L);
    expect(width(LOOK_AT_CHAT_EYES)).toBe(TOKEN_WIDTH.L);
  });
});

describe("fill: alinhamento", () => {
  for (const e of EMOTION_LIST) {
    for (const [frame, opts] of FRAMES) {
      it(`${e} (${frame}): nenhuma letra-token sobra e toda linha mantém o comprimento`, () => {
        const lines = fill(e, opts);
        expect(lines).toHaveLength(BASE_LINES.length);
        lines.forEach((line, row) => {
          expect(width(line), `linha ${row}`).toBe(width(BASE_LINES[row]));
          expect(line, `linha ${row}`).not.toMatch(/[A-Z]/);
        });
        // colorize gera exatamente o mesmo texto que fill
        const rows = colorize(e, opts);
        rows.forEach((segs, row) => expect(segs.map((s) => s.text).join("")).toBe(lines[row]));
      });
    }
  }

  it("piscar só fecha os olhos de quem pisca", () => {
    const neutral = tokenValues("neutral", { blinking: true });
    expect(neutral.K).toBe(BLINK_LIDS);
    expect(neutral.L).toBe(BLINK_EYES);
    const happy = tokenValues("happy", { blinking: true });
    expect(happy.L).toBe(EXPRESSIONS.happy.L);
  });

  it("falar troca M por talk", () => {
    expect(tokenValues("shy", { talkFrame: true }).M).toBe(EXPRESSIONS.shy.talk);
    expect(tokenValues("shy").M).toBe(EXPRESSIONS.shy.M);
  });

  it("olhar pro chat só vale em neutral", () => {
    expect(tokenValues("neutral", { lookAtChat: true }).L).toBe(LOOK_AT_CHAT_EYES);
    expect(tokenValues("pouty", { lookAtChat: true }).L).toBe(EXPRESSIONS.pouty.L);
  });

  it("é memoizado", () => {
    expect(fill("love", { talkFrame: true })).toBe(fill("love", { talkFrame: true }));
    expect(colorize("love")).toBe(colorize("love"));
  });
});

describe("máscara de cores", () => {
  it("segue as regras em ordem", () => {
    expect(classAt(11, 12, "K")).toBe("eye");
    expect(classAt(10, 12, "A")).toBe("brow");
    expect(classAt(13, 11, "B")).toBe("blush");
    expect(classAt(14, 19, "M")).toBe("mouth");
    expect(classAt(4, 32, ".")).toBe("ribbon");
    expect(classAt(6, 7, "*")).toBe("accent");
    expect(classAt(0, 20, ",")).toBe("hair ahoge");
    expect(classAt(9, 20, "'")).toBe("hair");
    expect(classAt(15, 2, "|")).toBe("hair");
    expect(classAt(15, 35, "|")).toBe("hair");
    expect(classAt(19, 12, ".")).toBe("clothes");
    expect(classAt(17, 20, "_")).toBe("line");
  });

  it("tokens viram segmentos com a largura do token", () => {
    const eyes = colorize("love")[12].filter((s) => s.tok > 0);
    expect(eyes.map((s) => [s.text, s.cls, s.tok])).toEqual([
      ["( ♥ )", "eye", 5],
      ["( ♥ )", "eye", 5],
    ]);
  });
});

describe("partículas", () => {
  it("nunca passam de 12 simultâneas", () => {
    for (const e of EMOTION_LIST) {
      const ambient = ambientParticles(e, 1);
      expect(ambient.length).toBeLessThanOrEqual(MAX_AMBIENT);
      expect(ambient.length + burstParticles("✧", "accent", 1).length).toBeLessThanOrEqual(MAX_PARTICLES);
    }
  });

  it("neutral não tem partículas e a intensidade controla a quantidade", () => {
    expect(ambientParticles("neutral", 1)).toHaveLength(0);
    expect(ambientParticles("love", 1).length).toBeGreaterThan(ambientParticles("love", 0).length);
  });

  it("são estáveis entre chamadas (sem pular a cada render)", () => {
    expect(ambientParticles("happy", 0.5)).toEqual(ambientParticles("happy", 0.5));
  });
});
