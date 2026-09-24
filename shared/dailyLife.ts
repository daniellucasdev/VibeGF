// Rotina da Hana e o acontecimento do dia (sorteado com seed pela data).

export type LocalParts = { year: number; month: number; day: number; weekday: number; hour: number; minute: number };

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/**
 * Data e hora locais. Sem `timeZone`, usa o fuso do ambiente (o navegador);
 * com `timeZone` (IANA), usa Intl — é o que o servidor faz com o fuso do cliente.
 * weekday: 0 = domingo.
 */
export function localParts(date: Date, timeZone?: string): LocalParts {
  if (!timeZone) {
    return {
      year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate(),
      weekday: date.getDay(), hour: date.getHours(), minute: date.getMinutes(),
    };
  }
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "numeric", day: "numeric",
    weekday: "short", hour: "numeric", minute: "numeric", hourCycle: "h23",
  }).formatToParts(date);
  const get = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    year: Number(get("year")), month: Number(get("month")), day: Number(get("day")),
    weekday: WEEKDAY_INDEX[get("weekday")] ?? 0, hour: Number(get("hour")) % 24, minute: Number(get("minute")),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Data local no formato YYYY-MM-DD. */
export function dateKey(date: Date, timeZone?: string): string {
  const p = localParts(date, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

// ---------------------------------------------------------------- agenda

export type ActivityId = "class" | "cafe" | "drawing" | "anime" | "train" | "sleeping";

export type Activity = {
  id: ActivityId;
  /** Status curto da UI. */
  status: string;
  /** Frase para o bloco AGORA ("Agora você provavelmente está: …"). */
  description: string;
};

export const ACTIVITIES: Record<ActivityId, Activity> = {
  class:    { id: "class",    status: "📚 na aula",         description: "na faculdade, em aula" },
  cafe:     { id: "cafe",     status: "☕ no Neko no Mori", description: "trabalhando no Neko no Mori" },
  drawing:  { id: "drawing",  status: "✎ desenhando",       description: "em casa, desenhando" },
  anime:    { id: "anime",    status: "📺 vendo anime",     description: "em casa, vendo anime" },
  train:    { id: "train",    status: "🚃 no trem",         description: "no trem" },
  sleeping: { id: "sleeping", status: "💤 dormindo",        description: "dormindo (se o usuário escrever, você responde sonolenta)" },
};

const isWeekday = (wd: number) => wd >= 1 && wd <= 5;
const isCafeDay = (wd: number) => wd === 2 || wd === 4 || wd === 6; // ter, qui, sáb

/**
 * Agenda: 0h–7h dormindo; seg–sex 9h–13h aula; ter/qui/sáb 14h–19h no café;
 * trem na ida e na volta (8h nos dias de aula, 13h antes do café, 19h depois);
 * noite desenhando até 22h e depois vendo anime. No resto do tempo, desenhando.
 */
export function activityNow(date: Date, timeZone?: string): Activity {
  const { weekday: wd, hour: h } = localParts(date, timeZone);
  if (h < 7) return ACTIVITIES.sleeping;
  if (isWeekday(wd) && h === 8) return ACTIVITIES.train;
  if (isWeekday(wd) && h >= 9 && h < 13) return ACTIVITIES.class;
  if (isCafeDay(wd) && h === 13) return ACTIVITIES.train;
  if (isCafeDay(wd) && h >= 14 && h < 19) return ACTIVITIES.cafe;
  if (isCafeDay(wd) && h === 19) return ACTIVITIES.train;
  if (h >= 22) return ACTIVITIES.anime;
  return ACTIVITIES.drawing;
}

// ---------------------------------------------------- acontecimento do dia

export const HAPPENINGS = [
  "a Mochi derrubou o pote de tinta em cima de um desenho",
  "o Daifuku fugiu de novo",
  "o professor de Tipografia elogiou o trabalho dela",
  "esqueceu o guarda-chuva (de novo)",
  "está sem inspiração pro mangá",
  "viu uma estrela cadente do terraço",
  "a Yui arrastou ela pra um karaokê",
  "dormiu no trem e passou do ponto",
  "a mãe ligou perguntando se ela está comendo direito",
  "o Kenta mandou meme às 3h da manhã",
  "achou um caderno de papelaria lindo em promoção",
  "queimou o arroz tentando cozinhar",
  "um cliente do café deu gorjeta em forma de origami",
  "a Mochi dormiu em cima do tablet dela a tarde toda",
  "terminou uma página inteira do mangá e está orgulhosa",
  "perdeu no jogo de ritmo pra uma criança no fliperama",
  "choveu forte e ela ficou vendo a chuva da janela",
  "a Yui tentou arrumar um encontro pra ela (de novo)",
  "tomou um milk-shake de morango gigante",
  "o trabalho de grupo da faculdade está um caos",
  "o Daifuku sentou no colo de um cliente e não quis sair",
  "acordou atrasada e foi pra aula com o cabelo todo bagunçado",
  "comprou canetas novas e está testando todas",
  "tropeçou na frente da sala inteira",
  "viu um gatinho de rua parecido com a Mochi",
  "a professora de Ilustração pediu pra ela refazer um trabalho",
  "maratonou um shoujo antigo até tarde",
  "o dono do café trouxe bolo pra equipe",
  "a luz do apartamento acabou por uma hora",
  "ganhou um chaveiro de estrela numa máquina de pelúcia",
] as const;

/** Hash FNV-1a de 32 bits: estável entre execuções e plataformas. */
function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** PRNG mulberry32. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Dia da semana de uma data YYYY-MM-DD (0 = domingo), sem depender de fuso. */
function weekdayOfKey(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Acontecimentos do dia: 1 em dias úteis, 2 no fim de semana, estáveis pela data. */
export function happeningsFor(key: string): string[] {
  const rand = mulberry32(hashString(key));
  const wd = weekdayOfKey(key);
  const count = wd === 0 || wd === 6 ? 2 : 1;
  const pool: string[] = [...HAPPENINGS];
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(rand() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

export function happeningsToday(date: Date, timeZone?: string): string[] {
  return happeningsFor(dateKey(date, timeZone));
}
