// Helpers de texto.

/** Caracteres de verdade (code points): emoji e kaomoji contam como um só. Usado nos tempos de digitação. */
export const charCount = (s: string): number => Array.from(s).length;

/**
 * Corta para caber em `max` unidades de `.length` — a mesma conta do `z.string().max()`
 * que valida os requests no servidor — sem partir um emoji ao meio.
 */
export function cutChars(s: string, max: number): string {
  if (s.length <= max) return s;
  let out = "";
  for (const ch of s) {
    if (out.length + ch.length > max) break;
    out += ch;
  }
  return out;
}
