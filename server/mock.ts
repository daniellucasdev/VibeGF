// Modo mock (MOCK_LLM=true, 6.8): turnos válidos sem chamar a API.
// Serve para desenvolver a UI inteira sem chave e sem custo. As emoções variam
// de propósito, os deltas ficam entre +1 e +3 e alguns turnos trazem eventos.

import { localParts } from "../shared/dailyLife";
import { sanitizeTurn } from "../shared/schema";
import type { ChatRequest, Emotion, HanaEvent, HanaTurn, Reaction, Stage, SummarizeRequest } from "../shared/types";

export type Rng = () => number;

/** Uma fala com a emoção que combina com ela. `{nome}` vira o `addressAs`. */
export type MockLine = readonly [emotion: Emotion, text: string];

export const MOCK_LINES: Record<Stage, readonly MockLine[]> = {
  0: [
    ["neutral", "ah… desculpa de novo pelo número errado"],
    ["shy", "é estranho conversar com alguém que eu nem conheço (・・;)"],
    ["thinking", "hmm… e como eu sei que você não é um golpe?"],
    ["neutral", "tá, mas você é de Hoshimachi mesmo?"],
    ["surprised", "ué, você respondeu mesmo?"],
    ["shy", "eu não costumo falar com desconhecidos…"],
    ["neutral", "o Daifuku voltou, aliás. tava dormindo no depósito"],
    ["thinking", "você sempre responde número desconhecido assim?"],
    ["happy", "obrigada por não ter bloqueado, {nome}"],
    ["neutral", "eu trabalho num cat café, por isso o drama do gato"],
    ["pouty", "não ri de mim, eu tava desesperada"],
    ["shy", "desculpa, eu fico sem graça fácil"],
    ["thinking", "você fala de um jeito engraçado"],
    ["neutral", "tenho que estudar, mas… pode falar"],
    ["surprised", "sério? não esperava isso"],
    ["happy", "hehe, tá bom"],
    ["neutral", "e você faz o quê da vida?"],
    ["sleepy", "tô meio cansada hoje, foi um dia longo"],
    ["thinking", "ainda não sei se confio em você, viu"],
    ["shy", "hm… tá, pode me chamar de Hana"],
  ],
  1: [
    ["happy", "oi, {nome}! a aula de Tipografia hoje foi ok"],
    ["excited", "o Daifuku fugiu de novo!! achei ele no telhado"],
    ["neutral", "o que você almoçou hoje?"],
    ["thinking", "você parece gostar de ficar acordado até tarde, né"],
    ["teasing", "admite que você só responde porque tá entediado"],
    ["happy", "a Mochi acabou de sentar no meu teclado"],
    ["shy", "é bom ter alguém pra conversar à noite"],
    ["surprised", "espera, você também gosta disso?"],
    ["pouty", "o professor devolveu meu trabalho todo rabiscado…"],
    ["neutral", "eu tô no trem agora, a conexão tá ruim"],
    ["excited", "hoje tem episódio novo daquele anime!"],
    ["thinking", "me conta uma coisa que ninguém sabe de você"],
    ["happy", "hehe, você é mais legal do que eu achei"],
    ["sleepy", "bocejei três vezes escrevendo isso"],
    ["sad", "queimei o dedo na máquina de café hoje (╥﹏╥)"],
    ["teasing", "você digita muito rápido, é robô?"],
    ["neutral", "a Yui perguntou quem é você, eu disse que ninguém kkk"],
    ["happy", "boa noite de verdade dessa vez, {nome}"],
    ["surprised", "você lembrou disso? nossa"],
    ["shy", "tá, talvez eu esteja curiosa sobre você"],
  ],
  2: [
    ["excited", "{nome}!! adivinha quem ganhou elogio do professor?"],
    ["happy", "salvei uma foto da Mochi dormindo pra te mandar"],
    ["teasing", "você de novo por aqui? não tem mais o que fazer? ( ˘ ³˘)"],
    ["pouty", "a Yui comeu meu pudim da geladeira do café"],
    ["thinking", "tô sem ideia pro próximo projeto, me dá uma sugestão"],
    ["happy", "hoje o dia tá bonito em Hoshimachi"],
    ["surprised", "NÃO acredito que você nunca comeu taiyaki"],
    ["sad", "tive um dia meio chato… mas passou"],
    ["excited", "o café vai ter um gatinho novo!!"],
    ["neutral", "o que você vai fazer no fim de semana?"],
    ["teasing", "hmm, você tá muito educado hoje, aconteceu algo?"],
    ["happy", "obrigada por ouvir minhas reclamações, sério"],
    ["shy", "você é um bom amigo, sabia?"],
    ["sleepy", "fiquei desenhando até tarde e agora tô um zumbi"],
    ["crying", "o final daquele anime me destruiu (ಥ﹏ಥ)"],
    ["thinking", "você acha que eu devia mudar o cabelo?"],
    ["happy", "hehe, conversar com você melhora meu dia"],
    ["surprised", "espera, você fez isso sozinho?"],
    ["pouty", "você demorou pra responder, hein"],
    ["excited", "vou te apresentar o Daifuku um dia!"],
  ],
  3: [
    ["happy", "sabe que você é a primeira pessoa que eu quis contar isso?"],
    ["shy", "eu… mostrei um desenho meu pra Yui hoje. só pra ela e agora pra você"],
    ["teasing", "meu melhor amigo digital ♪"],
    ["excited", "{nome}!! o Daifuku fez amizade com a Mochi!"],
    ["thinking", "você já pensou em largar tudo e ir morar no interior?"],
    ["flustered", "q-quê? eu não fiquei vermelha, você que imaginou"],
    ["sad", "minha mãe ligou e eu fiquei com saudade de casa"],
    ["happy", "guardei um lugar pra você na minha lista de pessoas favoritas"],
    ["pouty", "você falou com outra pessoa sobre isso antes de mim?"],
    ["surprised", "você lembrou do meu mangá? ninguém lembra!"],
    ["neutral", "tô desenhando agora, me conta como foi seu dia"],
    ["sleepy", "só mais cinco minutinhos de conversa…"],
    ["excited", "vamos maratonar alguma coisa juntos (cada um na sua casa)?"],
    ["shy", "às vezes eu fico pensando no que você tá fazendo"],
    ["teasing", "admite que sentiu minha falta"],
    ["happy", "obrigada por estar aqui, {nome}"],
    ["crying", "eu tava precisando tanto ouvir isso…"],
    ["thinking", "a gente se entende bem, né? é estranho"],
    ["flustered", "esquece o que eu falei!! é sério!"],
    ["happy", "hehe, você é bobo"],
  ],
  4: [
    ["flustered", "p-por que você falou isso assim do nada?! (〃＞＿＜;〃)"],
    ["love", "eu fico sorrindo sozinha quando você manda mensagem…"],
    ["shy", "{nome}… nada. esquece"],
    ["teasing", "você tá tentando me deixar sem graça, né?"],
    ["happy", "hoje eu desenhei um personagem parecido com você"],
    ["flustered", "meu coração tá fazendo doki doki, que vergonha"],
    ["love", "é bom demais conversar com você"],
    ["pouty", "você nem percebeu que eu mudei a foto de perfil…"],
    ["excited", "a Yui disse que eu falo muito de você!!"],
    ["shy", "se a gente se encontrasse… o que você faria?"],
    ["thinking", "tô pensando numa coisa… mas não sei se falo"],
    ["surprised", "você também pensa em mim?"],
    ["happy", "guardei o último taiyaki pra você (mentalmente)"],
    ["sleepy", "não quero dormir ainda… quero falar mais com você"],
    ["love", "boa noite, {nome}. sonha comigo, tá? …brincadeira. ou não"],
    ["sad", "fiquei com medo de você não responder hoje"],
    ["flustered", "N-NÃO LEIA ISSO. apaguei. não aconteceu"],
    ["teasing", "você fica fofo quando fica sem jeito"],
    ["shy", "posso te contar um segredo? …outro dia"],
    ["excited", "vamos no festival de verão juntos?!"],
  ],
  5: [
    ["love", "bom dia, meu amor ♡"],
    ["happy", "contei pra Mochi que a gente tá namorando. ela ignorou"],
    ["teasing", "meu namorado é tão bobo ( ˘ ³˘)♥"],
    ["love", "eu penso em você o dia inteiro, sabia?"],
    ["flustered", "ainda não acostumei a te chamar de namorado…"],
    ["excited", "{nome}!! vamos no Neko no Mori juntos sábado?"],
    ["pouty", "você não me deu boa noite ontem…"],
    ["happy", "desenhei a gente no meu mangá. não vou mostrar ainda"],
    ["shy", "obrigada por ter respondido aquela mensagem errada"],
    ["love", "você é a melhor coisa que me aconteceu esse ano"],
    ["sleepy", "vou dormir pensando em você… boa noite ♡"],
    ["sad", "tive um dia ruim… me dá um abraço virtual?"],
    ["surprised", "você planejou isso?? que fofo!"],
    ["teasing", "ciúmes? eu? jamais. quem é ela?"],
    ["happy", "a Yui disse que a gente é melado demais kkk"],
    ["thinking", "onde você acha que a gente vai estar daqui um ano?"],
    ["crying", "desculpa, é que eu fiquei feliz demais (ಥ﹏ಥ)"],
    ["love", "te amo, {nome}"],
    ["flustered", "p-para de me elogiar, eu vou derreter"],
    ["excited", "achei um café com tema de estrelas, vamos!!"],
  ],
};

export const MOCK_THOUGHTS: Record<Stage, readonly string[]> = {
  0: ["ainda não sei quem é essa pessoa…", "pelo menos ele foi educado", "melhor não falar demais"],
  1: ["até que é divertido conversar", "será que ele lembra do que eu contei?", "estou curiosa"],
  2: ["gosto de conversar com ele", "ele é um bom amigo", "vou contar do meu dia"],
  3: ["ele me entende de verdade", "posso confiar nele", "por que eu fiquei vermelha?"],
  4: ["meu coração tá acelerado", "será que ele sente o mesmo?", "não posso deixar ele perceber"],
  5: ["eu amo ele", "que sorte a minha", "quero ficar assim pra sempre"],
};

const GREET_RETURN: readonly (readonly MockLine[])[] = [
  [["neutral", "ah, oi de novo. o Daifuku mandou lembranças (mentira, ele só dormiu)"], ["shy", "oi… tudo bem por aí?"]],
  [["happy", "{nome}! sumiu, hein"], ["excited", "você voltou! tenho uma coisa pra te contar"]],
  [["love", "senti sua falta, sabia? ♡"], ["pouty", "demorou, hein… mas tudo bem, você voltou"]],
];

const IDLE_NUDGE: readonly (readonly MockLine[])[] = [
  [["thinking", "…você ainda tá aí?"]],
  [["teasing", "dormiu no meio da conversa, {nome}?"], ["pouty", "me deixou no vácuo, é?"]],
  [["shy", "tá tudo bem? fiquei pensando em você"], ["love", "ei… saudade já ♡"]],
];

const LATE_NIGHT: readonly MockLine[] = [
  ["sleepy", "hm… eu tava quase dormindo…"],
  ["sleepy", "{nome}… por que você tá acordado a essa hora? *boceja*"],
  ["sleepy", "zzz… ah, oi. fala baixinho"],
];

const EVENT_LINES: Partial<Record<HanaEvent, readonly MockLine[]>> = {
  first_name_basis: [["shy", "posso te chamar só de {nome}? a gente já é amigo, né"]],
  nickname: [["teasing", "decidi que você tem apelido agora. não aceito reclamação"]],
  inside_joke: [["happy", "kkkk isso vai virar piada nossa agora"]],
  date_invite: [["flustered", "e se… a gente fosse tomar um café? só um café!"]],
  fight: [["pouty", "sério que você falou isso? fiquei chateada"]],
  made_up: [["happy", "tá… eu te desculpo. obrigada por conversar sobre isso"]],
  she_confessed: [["flustered", "{nome}, eu… eu gosto de você. muito. pronto, falei (〃▽〃)"]],
  confession_accepted: [["love", "eu também gosto de você… muito ♡"], ["crying", "você tá falando sério?? eu tô chorando"]],
  confession_declined: [["shy", "eu… preciso de um tempo pra pensar nisso"], ["flustered", "não é um não! só… me dá um tempinho"]],
  confession_rejected: [["sad", "ah… tudo bem. obrigada por ser sincero"]],
};

const REACTION_OF: Record<Emotion, readonly Reaction[]> = {
  neutral: ["none"], happy: ["heart", "sparkle"], excited: ["sparkle", "laugh"], shy: ["none", "heart"],
  flustered: ["surprised"], love: ["heart"], sad: ["sad"], crying: ["sad"], pouty: ["angry"],
  surprised: ["surprised"], thinking: ["none"], sleepy: ["none"], teasing: ["laugh"],
};

const CONFESS_RE = /te amo|gosto (muito )?de voc[eê]|quer namorar|namora comigo|estou apaixonad/i;
const REJECT_RE = /s[oó] (como )?amig|n[aã]o sinto o mesmo|n[aã]o posso|desculpa,? mas/i;
const APOLOGY_RE = /desculpa|perd[aã]o|foi mal/i;

const pick = <T>(xs: readonly T[], rng: Rng): T => xs[Math.min(xs.length - 1, Math.floor(rng() * xs.length))];
const between = (min: number, max: number, rng: Rng) => min + Math.floor(rng() * (max - min + 1));

/** Mensagens do usuário desde a última fala da Hana (o turno atual). */
export function pendingUserText(history: ChatRequest["history"]): string {
  const out: string[] = [];
  for (let i = history.length - 1; i >= 0 && history[i].role !== "hana"; i--) {
    if (history[i].role === "user") out.unshift(history[i].text);
  }
  return out.join("\n");
}

/** Evento do turno: reage a declarações e pedidos de desculpa; às vezes sorteia um marco. */
export function mockEvent(req: ChatRequest, userText: string, rng: Rng): HanaEvent {
  const { stage, confession, pendingConflict } = req.relationship;
  if (req.mode === "reply" && userText) {
    if (confession === "she_confessed") return REJECT_RE.test(userText) ? "confession_rejected" : "confession_accepted";
    if (CONFESS_RE.test(userText)) return confession === "open" ? "confession_accepted" : "confession_declined";
    if (pendingConflict && APOLOGY_RE.test(userText)) return "made_up";
  }
  if (confession === "open" && rng() < 0.15) return "she_confessed";
  if (rng() >= 0.12) return "none";
  const pool: HanaEvent[] = [];
  if (stage >= 2) pool.push("first_name_basis", "inside_joke");
  if (stage >= 3) pool.push("nickname", "date_invite");
  if (stage >= 1 && !pendingConflict) pool.push("fight");
  return pool.length ? pick(pool, rng) : "none";
}

/** Turno falso e válido, coerente com o estágio, o modo e o horário do cliente. */
export function mockTurn(req: ChatRequest, rng: Rng = Math.random): HanaTurn {
  const stage = req.relationship.stage;
  const userText = pendingUserText(req.history);
  const event = mockEvent(req, userText, rng);
  const tier = stage <= 1 ? 0 : stage <= 3 ? 1 : 2;
  const hour = localParts(new Date(req.client.nowIso), req.client.timeZone).hour;

  let lines: MockLine[];
  const eventLines = EVENT_LINES[event];
  if (eventLines) {
    lines = [pick(eventLines, rng)];
  } else if (req.mode === "greet_return") {
    lines = [pick(GREET_RETURN[tier], rng)];
  } else if (req.mode === "idle_nudge") {
    lines = [pick(IDLE_NUDGE[tier], rng)];
  } else {
    const pool = [...MOCK_LINES[stage]];
    lines = [];
    if (hour < 7 && rng() < 0.6) lines.push(pick(LATE_NIGHT, rng));
    const count = between(1, 3, rng) - lines.length;
    for (let i = 0; i < count && pool.length; i++) lines.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
    if (lines.length === 0) lines.push(pick(MOCK_LINES[stage], rng));
  }

  const emotion = lines[0][0];
  const name = req.profile.addressAs || req.profile.name;
  const memory = req.mode === "reply" && userText.length >= 12 && rng() < 0.15
    ? [`disse: "${Array.from(userText.replace(/\s+/g, " ")).slice(0, 80).join("")}"`]
    : [];

  const turn: HanaTurn = {
    thought: pick(MOCK_THOUGHTS[stage], rng),
    emotion,
    intensity: Math.round((0.3 + rng() * 0.6) * 100) / 100,
    messages: lines.map(([, text]) => text.replaceAll("{nome}", name)),
    reaction: req.mode === "reply" && userText ? pick(REACTION_OF[emotion], rng) : "none",
    deltas: { affection: between(1, 3, rng), trust: between(1, 3, rng), romance: between(1, 3, rng) },
    newMemories: memory,
    event,
  };
  // Passa pelos mesmos limites do turno real; as falas do mock nunca ficam vazias.
  return sanitizeTurn(turn) ?? turn;
}

/** Resumo falso: o anterior mais uma linha sobre as mensagens novas, até 1200 caracteres. */
export function mockSummary(req: SummarizeRequest): string {
  const users = req.messages.filter((m) => m.role === "user").length;
  const line = `Depois disso, conversaram mais um pouco (${req.messages.length} mensagens, ${users} do usuário).`;
  const text = [req.previousSummary.trim(), line].filter(Boolean).join(" ");
  return Array.from(text).slice(-1200).join("");
}
