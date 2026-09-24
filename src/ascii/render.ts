import { BASE_LINES, TOKEN_LETTERS, isTokenLetter, type TokenLetter } from "./base";
import {
  BLINK_EYES,
  BLINK_LIDS,
  EXPRESSIONS,
  LOOK_AT_CHAT_EYES,
  type Emotion,
} from "./expressions";

export type FillOptions = {
  blinking?: boolean;
  talkFrame?: boolean;
  lookAtChat?: boolean;
};

export type CharClass =
  | "eye"
  | "brow"
  | "blush"
  | "mouth"
  | "ribbon"
  | "accent"
  | "hair ahoge"
  | "hair"
  | "clothes"
  | "line";

export type Segment = {
  text: string;
  /** null = espaço em branco (sem cor, não recebe animação nem clique). */
  cls: CharClass | null;
  /** Largura do token em colunas; 0 para texto comum. */
  tok: number;
};

const TOKEN_CLASS: Record<TokenLetter, CharClass> = {
  K: "eye", J: "eye", L: "eye", R: "eye",
  A: "brow", Z: "brow",
  B: "blush", C: "blush",
  M: "mouth",
};

/** Máscara de cores (seção 7.3). Linhas e colunas começam em 0; regras em ordem. */
export function classAt(row: number, col: number, ch: string): CharClass {
  if (isTokenLetter(ch)) return TOKEN_CLASS[ch];
  if (row >= 4 && row <= 6 && col >= 32 && col <= 39) return "ribbon";
  if (row === 6 && col === 7) return "accent";
  if (row <= 1) return "hair ahoge";
  if (row <= 9 || col <= 8 || col >= 33) return "hair";
  if (row >= 19) return "clothes";
  return "line";
}

/** Valores de cada token para uma expressão e quadro de animação. */
export function tokenValues(emotion: Emotion, opts: FillOptions = {}): Record<TokenLetter, string> {
  const exp = EXPRESSIONS[emotion];
  const values = {} as Record<TokenLetter, string>;
  for (const letter of TOKEN_LETTERS) values[letter] = exp[letter];

  if (opts.talkFrame) values.M = exp.talk;
  if (opts.blinking && exp.blink) {
    values.K = BLINK_LIDS;
    values.J = BLINK_LIDS;
    values.L = BLINK_EYES;
    values.R = BLINK_EYES;
  } else if (opts.lookAtChat && emotion === "neutral") {
    values.L = LOOK_AT_CHAT_EYES;
    values.R = LOOK_AT_CHAT_EYES;
  }
  return values;
}

function cacheKey(emotion: Emotion, opts: FillOptions): string {
  return `${emotion}|${opts.blinking ? 1 : 0}${opts.talkFrame ? 1 : 0}${opts.lookAtChat ? 1 : 0}`;
}

/** Percorre a arte base emitindo trechos de texto comum e tokens já preenchidos. */
function walk(
  emotion: Emotion,
  opts: FillOptions,
  emit: (row: number, text: string, cls: CharClass | null, tok: number) => void,
): void {
  const values = tokenValues(emotion, opts);
  BASE_LINES.forEach((line, row) => {
    let col = 0;
    while (col < line.length) {
      const ch = line[col];
      if (isTokenLetter(ch)) {
        let end = col;
        while (line[end] === ch) end++;
        emit(row, values[ch], TOKEN_CLASS[ch], end - col);
        col = end;
      } else {
        emit(row, ch, ch === " " ? null : classAt(row, col, ch), 0);
        col++;
      }
    }
  });
}

const fillCache = new Map<string, readonly string[]>();

/** Troca cada sequência de letras-token pelo valor da expressão. */
export function fill(emotion: Emotion, opts: FillOptions = {}): readonly string[] {
  const key = cacheKey(emotion, opts);
  const cached = fillCache.get(key);
  if (cached) return cached;

  const lines = BASE_LINES.map(() => "");
  walk(emotion, opts, (row, text) => {
    lines[row] += text;
  });
  fillCache.set(key, lines);
  return lines;
}

const colorCache = new Map<string, readonly (readonly Segment[])[]>();

/** Agrupa caracteres consecutivos da mesma classe em segmentos `{ text, cls, tok }`. */
export function colorize(emotion: Emotion, opts: FillOptions = {}): readonly (readonly Segment[])[] {
  const key = cacheKey(emotion, opts);
  const cached = colorCache.get(key);
  if (cached) return cached;

  const rows: Segment[][] = BASE_LINES.map(() => []);
  walk(emotion, opts, (row, text, cls, tok) => {
    const segs = rows[row];
    const prev = segs[segs.length - 1];
    if (tok === 0 && prev && prev.tok === 0 && prev.cls === cls) {
      prev.text += text;
    } else {
      segs.push({ text, cls, tok });
    }
  });
  colorCache.set(key, rows);
  return rows;
}
