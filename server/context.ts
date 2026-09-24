// Tudo o que muda a cada chamada: o bloco AGORA (6.6), que vai no system depois
// do ponto de cache, e as mensagens da conversa (6.4).

import type Anthropic from "@anthropic-ai/sdk";
import { activityNow, happeningsToday, localParts } from "../shared/dailyLife";
import { STAGES } from "../shared/stages";
import type { ChatRequest, HistoryItem } from "../shared/types";
import { EXPRESSION_META } from "../src/ascii/expressions";
import { DAY, HOUR, MINUTE, humanizeGap, periodLabel, sceneGapMarker } from "../src/game/time";

const WEEKDAYS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"] as const;

/** Abertura da história, quando o histórico começa com a Hana (6.4). */
export const OPENING_SCENE = "[Uma notificação de um número desconhecido…]";

/** Só por segurança: o modo `reply` sempre termina com o usuário, e a API não aceita pré-preenchimento. */
export const CONTINUE_SCENE = "[A conversa continua.]";

const pad = (n: number) => String(n).padStart(2, "0");

/** Texto do request numa linha só: quebras de linha não bagunçam o formato do bloco. */
const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();

/** Termina com pontuação, para as frases prontas do cliente caberem na linha. */
const sentence = (s: string) => (/[.!?…]$/.test(s) ? s : `${s}.`);

const time = (iso: string) => Date.parse(iso);

/**
 * Momento da conversa anterior ao turno atual. No modo `reply`, as mensagens do
 * usuário no fim do histórico são o turno atual e ficam de fora.
 */
export function previousAt(req: ChatRequest): number | null {
  let end = req.history.length;
  if (req.mode === "reply") while (end > 0 && req.history[end - 1].role === "user") end--;
  return end > 0 ? time(req.history[end - 1].at) : null;
}

/** "alguns instantes", "5 minutos", "uma hora", "3 horas", "um dia", "2 dias". */
export function gapPhrase(ms: number): string {
  const gap = Math.max(0, ms);
  if (gap < MINUTE) return "alguns instantes";
  if (gap < HOUR) {
    const m = Math.floor(gap / MINUTE);
    return m === 1 ? "um minuto" : `${m} minutos`;
  }
  if (gap < DAY) {
    const h = Math.floor(gap / HOUR);
    return h === 1 ? "uma hora" : `${h} horas`;
  }
  const d = Math.floor(gap / DAY);
  return d === 1 ? "um dia" : `${d} dias`;
}

function relationLine(rel: ChatRequest["relationship"]): string {
  const parts: string[] = [];
  if (rel.pendingConflict !== null) {
    const reason = oneLine(rel.pendingConflict);
    parts.push(`vocês brigaram${reason ? ` (motivo: ${reason})` : ""}; você continua magoada até o usuário conversar sobre isso`);
  }
  if (rel.distant) parts.push("você anda distante e magoada");
  return parts.length ? parts.join("; ") : "tudo bem";
}

/** Bloco AGORA (6.6): horário, estágio, sentimentos, humor, rotina, memórias e resumo. */
export function buildNowBlock(req: ChatRequest): string {
  const { profile, relationship: rel, mood, client } = req;
  const now = new Date(client.nowIso);
  const tz = client.timeZone;
  const p = localParts(now, tz);
  const prev = previousAt(req);
  const memories = req.memories.map(oneLine).filter(Boolean);
  const summary = oneLine(req.summary);

  const lines = [
    "# AGORA",
    `- Momento: ${WEEKDAYS[p.weekday]}, ${pad(p.day)}/${pad(p.month)}, ${pad(p.hour)}:${pad(p.minute)} (${periodLabel(now, tz)}).`,
    `- Última conversa: ${prev === null ? "esta é a primeira" : humanizeGap(now.getTime() - prev)}.`,
    `- Usuário: ${oneLine(profile.name)} (pronomes: ${profile.pronouns}). Chame de: "${oneLine(profile.addressAs) || oneLine(profile.name)}".`,
    `- Estágio ${rel.stage}: ${STAGES[rel.stage].name}. Dias em que conversaram: ${rel.daysTalked}.`,
    `- Sentimentos: afeição ${Math.round(rel.affection)}/100 · confiança ${Math.round(rel.trust)}/100 · doki-doki ${Math.round(rel.romance)}/100.`,
    `- Seu humor agora: ${EXPRESSION_META[mood.emotion].label} (${mood.intensity.toFixed(1)}).`,
    `- Relação: ${relationLine(rel)}.`,
    `- Declaração: ${sentence(oneLine(rel.confessionNote))}`,
    `- Agora você provavelmente está: ${activityNow(now, tz).description}.`,
    `- Hoje na sua vida: ${happeningsToday(now, tz).join("; ")}.`,
    memories.length ? "- Você lembra sobre o usuário:" : "- Você lembra sobre o usuário: nada ainda.",
    ...memories.map((m) => `  - ${m}`),
    `- Resumo do que já aconteceu: ${summary || "nada ainda."}`,
  ];
  return lines.join("\n");
}

const sceneText = (text: string) => {
  const t = text.trim();
  return t.startsWith("[") && t.endsWith("]") ? t : `[${t}]`;
};

/**
 * Mensagens para a API (6.4):
 * - `user` → user; `hana` → assistant (balões unidos por `\n`); `scene` → narração entre colchetes no turno do usuário;
 * - mais de 3 h entre duas mensagens → "[5 horas depois]" / "[2 dias depois]" antes da seguinte, no turno do usuário;
 * - papéis iguais consecutivos viram um turno só;
 * - a primeira mensagem é sempre `user` (abre com a notificação se o histórico começa com a Hana);
 * - `greet_return` e `idle_nudge` acrescentam a indicação de cena do modo; a última é sempre `user`.
 */
export function buildMessages(req: ChatRequest): Anthropic.MessageParam[] {
  const turns: { role: "user" | "assistant"; parts: string[] }[] = [];
  const push = (role: "user" | "assistant", text: string) => {
    const last = turns[turns.length - 1];
    if (last?.role === role) last.parts.push(text);
    else turns.push({ role, parts: [text] });
  };

  let prev: HistoryItem | null = null;
  for (const item of req.history) {
    const text = item.text.trim();
    if (!text) continue;
    const marker = prev ? sceneGapMarker(time(item.at) - time(prev.at)) : null;
    if (marker) push("user", marker);
    if (item.role === "hana") push("assistant", text);
    else push("user", item.role === "scene" ? sceneText(text) : text);
    prev = item;
  }

  if (turns[0]?.role === "assistant") turns.unshift({ role: "user", parts: [OPENING_SCENE] });

  if (req.mode === "greet_return") {
    const at = previousAt(req);
    const gap = gapPhrase(at === null ? 0 : time(req.client.nowIso) - at);
    push("user", `[O usuário abriu a conversa de novo depois de ${gap}, mas ainda não disse nada. Puxe assunto do seu jeito, coerente com o horário e com o quanto vocês são próximos.]`);
  } else if (req.mode === "idle_nudge") {
    push("user", "[O usuário está em silêncio há alguns minutos depois da sua última mensagem.]");
  } else if (turns[turns.length - 1]?.role !== "user") {
    push("user", CONTINUE_SCENE);
  }

  return turns.map((t) => ({ role: t.role, content: t.parts.join("\n") }));
}
