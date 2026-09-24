// O que a Hana lembra do usuário (5.6): dedupe normalizado e teto de 60.
import { cutChars } from "../lib/text";
import { normalizeMessage } from "./relationship";

export const MAX_MEMORIES = 60;
/** Mesmo limite que o servidor aceita por memória (REQUEST_LIMITS.memoryChars). */
export const MEMORY_MAX_CHARS = 200;

/** Chave de comparação: minúsculas, sem pontuação nem emoji (a mesma normalização do anti-grind). */
export const memoryKey = (text: string): string => normalizeMessage(text);

/**
 * Acrescenta as memórias novas que ainda não existem (comparando pela chave normalizada,
 * inclusive entre as novas) e mantém só as 60 mais recentes.
 * `make` cria o item a partir do texto já limpo (espaços colapsados, até 200 caracteres).
 */
export function addMemories<T extends { text: string }>(
  list: readonly T[],
  incoming: readonly string[],
  make: (text: string) => T,
): T[] {
  const seen = new Set(list.map((m) => memoryKey(m.text)));
  const out = [...list];
  for (const raw of incoming) {
    const text = cutChars(raw.replace(/\s+/g, " ").trim(), MEMORY_MAX_CHARS);
    const key = memoryKey(text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(make(text));
  }
  return out.slice(-MAX_MEMORIES);
}
