import { describe, expect, it } from "vitest";
import { MAX_MEMORIES, MEMORY_MAX_CHARS, addMemories } from "./memories";

type M = { id: number; text: string };
let seq = 0;
const make = (text: string): M => ({ id: ++seq, text });
const texts = (list: M[]) => list.map((m) => m.text);

describe("addMemories (5.6)", () => {
  it("acrescenta memórias novas no fim", () => {
    const out = addMemories([make("tem um cachorro chamado Thor")], ["trabalha com programação"], make);
    expect(texts(out)).toEqual(["tem um cachorro chamado Thor", "trabalha com programação"]);
  });

  it("não repete: ignora maiúsculas, pontuação e emoji", () => {
    const list = [make("Tem um cachorro chamado Thor.")];
    const out = addMemories(list, ["tem um cachorro chamado thor", "TEM UM CACHORRO CHAMADO THOR 🐶!!"], make);
    expect(texts(out)).toEqual(["Tem um cachorro chamado Thor."]);
  });

  it("não repete dentro do mesmo lote", () => {
    const out = addMemories([], ["gosta de café", "Gosta de café!"], make);
    expect(texts(out)).toEqual(["gosta de café"]);
  });

  it("limpa espaços, ignora vazias e corta em 200 caracteres", () => {
    const out = addMemories([], ["  mora   em  Hoshimachi  ", "   ", "…", "a".repeat(300)], make);
    expect(texts(out)).toEqual(["mora em Hoshimachi", "a".repeat(MEMORY_MAX_CHARS)]);
  });

  it("teto de 60: descarta as mais antigas", () => {
    const list = Array.from({ length: MAX_MEMORIES }, (_, i) => make(`fato número ${i}`));
    const out = addMemories(list, ["fato novo A", "fato novo B"], make);
    expect(out).toHaveLength(MAX_MEMORIES);
    expect(out[0].text).toBe("fato número 2");
    expect(texts(out).slice(-2)).toEqual(["fato novo A", "fato novo B"]);
  });

  it("não muda a lista original", () => {
    const list = [make("gosta de chuva")];
    addMemories(list, ["gosta de sol"], make);
    expect(texts(list)).toEqual(["gosta de chuva"]);
  });
});
