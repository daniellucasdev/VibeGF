// Formatação de datas para a UI (sempre no fuso do navegador).

const DAY_FMT = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" });
const CLOCK_FMT = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

/** "sábado, 23 de setembro" (o DaySeparator põe os travessões). */
export const formatDayLabel = (date: Date): string => DAY_FMT.format(date);

/** "21:40" */
export const formatClock = (date: Date): string => CLOCK_FMT.format(date);
