// Linhas da lista de mensagens: separador de dia, indicação de cena "[3 horas depois]"
// e as bolhas agrupadas por quem fala.
import { dateKey } from "../../shared/dailyLife";
import { sceneGapMarker } from "../game/time";
import { formatDayLabel } from "../lib/format";
import type { ChatMessage } from "../store/save";

export type Row =
  | { kind: "day"; key: string; label: string }
  | { kind: "gap"; key: string; text: string; msgId: number }
  | { kind: "msg"; key: string; msg: ChatMessage; first: boolean; last: boolean };

export function buildRows(messages: readonly ChatMessage[]): Row[] {
  // Quebras antes de cada mensagem (dia novo e/ou intervalo de mais de 3 h).
  const breaks = messages.map((m, i) => {
    const prev = messages[i - 1];
    const at = new Date(m.at);
    const day = !prev || dateKey(at) !== dateKey(new Date(prev.at)) ? formatDayLabel(at) : null;
    // cenas já são narração; não empilha outra indicação ao lado delas
    const gap = prev && m.role !== "scene" && prev.role !== "scene"
      ? sceneGapMarker(at.getTime() - new Date(prev.at).getTime())
      : null;
    return { day, gap };
  });

  const rows: Row[] = [];
  messages.forEach((m, i) => {
    const { day, gap } = breaks[i];
    if (day) rows.push({ kind: "day", key: `day-${m.id}`, label: day });
    if (gap) rows.push({ kind: "gap", key: `gap-${m.id}`, text: gap, msgId: m.id });
    const prev = messages[i - 1];
    const next = messages[i + 1];
    const first = !prev || prev.role !== m.role || Boolean(day || gap);
    const last = !next || next.role !== m.role || Boolean(breaks[i + 1].day || breaks[i + 1].gap);
    rows.push({ kind: "msg", key: `m-${m.id}`, msg: m, first, last });
  });
  return rows;
}

/** Divide o texto dela em trechos normais e `*ações*` (itálico e cor suave). */
export function splitActions(text: string): { text: string; action: boolean }[] {
  const out: { text: string; action: boolean }[] = [];
  const re = /\*([^*\n]+)\*/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    const start = m.index ?? 0;
    if (start > last) out.push({ text: text.slice(last, start), action: false });
    out.push({ text: m[1], action: true });
    last = start + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), action: false });
  return out;
}
