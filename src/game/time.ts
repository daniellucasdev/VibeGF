// Relógio central, períodos do dia, intervalos humanizados e dias conversados.
import { dateKey, localParts } from "../../shared/dailyLife";

export { dateKey };

// ------------------------------------------------------------ now() central
// Toda a lógica pede a hora por aqui, para a viagem no tempo do DebugPanel valer em tudo.

let offsetMs = 0;
let fixedMs: number | null = null;

export function now(): Date {
  return new Date(fixedMs ?? Date.now() + offsetMs);
}

/** Avança (ou volta) o relógio em `ms`. Acumula. */
export function travel(ms: number): void {
  if (fixedMs !== null) fixedMs += ms;
  else offsetMs += ms;
}

/** Congela o relógio numa data (ou solta, com `null`). */
export function setFixedClock(date: Date | null): void {
  fixedMs = date ? date.getTime() : null;
}

export function resetClock(): void {
  offsetMs = 0;
  fixedMs = null;
}

export function clockState(): { offsetMs: number; fixed: Date | null } {
  return { offsetMs, fixed: fixedMs === null ? null : new Date(fixedMs) };
}

// ------------------------------------------------------------------ períodos

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export type DayPeriod = "morning" | "afternoon" | "sunset" | "night";

/** Período do fundo: manhã 6–11h, tarde 11–17h, pôr do sol 17–19h, noite 19–6h. */
export function dayPeriod(date: Date, timeZone?: string): DayPeriod {
  const h = localParts(date, timeZone).hour;
  if (h >= 6 && h < 11) return "morning";
  if (h >= 11 && h < 17) return "afternoon";
  if (h >= 17 && h < 19) return "sunset";
  return "night";
}

/** Tema automático: noite das 19h às 6h. */
export function isNightTime(date: Date, timeZone?: string): boolean {
  return dayPeriod(date, timeZone) === "night";
}

/** Rótulo do período para o bloco AGORA; 0h–6h é "madrugada". */
export function periodLabel(date: Date, timeZone?: string): string {
  const h = localParts(date, timeZone).hour;
  if (h < 6) return "madrugada";
  return { morning: "manhã", afternoon: "tarde", sunset: "fim de tarde", night: "noite" }[dayPeriod(date, timeZone)];
}

// ---------------------------------------------------------------- intervalos

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "agora mesmo", "há 5 minutos", "há 3 horas", "ontem", "há 3 dias". */
export function humanizeGap(ms: number): string {
  const gap = Math.max(0, ms);
  if (gap < MINUTE) return "agora mesmo";
  if (gap < HOUR) return `há ${plural(Math.floor(gap / MINUTE), "minuto", "minutos")}`;
  if (gap < DAY) return `há ${plural(Math.floor(gap / HOUR), "hora", "horas")}`;
  const days = Math.floor(gap / DAY);
  return days === 1 ? "ontem" : `há ${days} dias`;
}

/** Indicação de cena entre duas mensagens: só com mais de 3 h. "[5 horas depois]", "[2 dias depois]". */
export function sceneGapMarker(ms: number): string | null {
  if (ms <= 3 * HOUR) return null;
  if (ms < DAY) return `[${Math.floor(ms / HOUR)} horas depois]`;
  return `[${plural(Math.floor(ms / DAY), "dia", "dias")} depois]`;
}

// ------------------------------------------------------------ dias conversados

/** Dias com 3+ mensagens do usuário contam em `daysTalked`. */
export const MESSAGES_PER_DAY = 3;

export type DayLog = {
  /** Datas locais (YYYY-MM-DD) distintas em que o usuário mandou 3+ mensagens. */
  daysTalked: string[];
  /** Contagem de mensagens do dia corrente. */
  today: { date: string; count: number };
};

export const emptyDayLog = (): DayLog => ({ daysTalked: [], today: { date: "", count: 0 } });

/** Registra `n` mensagens do usuário na data `key`. */
export function recordUserMessages(log: DayLog, key: string, n: number): DayLog {
  if (n <= 0) return log;
  const count = (log.today.date === key ? log.today.count : 0) + n;
  const qualifies = count >= MESSAGES_PER_DAY && !log.daysTalked.includes(key);
  return {
    daysTalked: qualifies ? [...log.daysTalked, key] : log.daysTalked,
    today: { date: key, count },
  };
}
