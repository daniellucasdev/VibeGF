// Emoção -> valores dos tokens, kaomoji, rótulo e partícula.
// Cada token tem largura fixa (ver TOKEN_WIDTH em base.ts). `talk` é a boca
// alternativa usada enquanto ela "fala"; `blink` diz se a expressão pisca.
export const EXPRESSIONS = {
  neutral:    { A: "    ", Z: "    ", K: ",---.", J: ".---,", L: "( @ )", R: "( @ )", B: "   ", C: "   ", M: " -- ", talk: " () ", blink: true },
  happy:      { A: "    ", Z: "    ", K: " .-. ", J: " .-. ", L: "/   \\", R: "/   \\", B: "   ", C: "   ", M: "\\__/", talk: "\\()/", blink: false },
  excited:    { A: "    ", Z: "    ", K: ",---.", J: ".---,", L: "( * )", R: "( * )", B: "   ", C: "   ", M: "\\__/", talk: "\\()/", blink: true },
  shy:        { A: "    ", Z: "    ", K: ",---.", J: ".---,", L: "(@  )", R: "(@  )", B: "///", C: "///", M: " ~~ ", talk: " ~o ", blink: true },
  flustered:  { A: "    ", Z: "    ", K: " `-. ", J: " .-' ", L: " .-' ", R: " `-. ", B: "///", C: "///", M: " ~~ ", talk: " ~o ", blink: false },
  love:       { A: "    ", Z: "    ", K: ",---.", J: ".---,", L: "( ♥ )", R: "( ♥ )", B: "///", C: "///", M: "\\__/", talk: "\\()/", blink: true },
  sad:        { A: "_.-'", Z: "'-._", K: ".---.", J: ".---.", L: "( o )", R: "( o )", B: "   ", C: "   ", M: " /\\ ", talk: " () ", blink: true },
  crying:     { A: "_.-'", Z: "'-._", K: "-===-", J: "-===-", L: "  |  ", R: "  |  ", B: " ; ", C: " ; ", M: " /\\ ", talk: " () ", blink: false },
  pouty:      { A: "'-._", Z: "_.-'", K: "-----", J: "-----", L: "( @ )", R: "( @ )", B: "   ", C: "   ", M: " ^^ ", talk: " ^o ", blink: true },
  surprised:  { A: "    ", Z: "    ", K: ".---.", J: ".---.", L: "( . )", R: "( . )", B: "   ", C: "   ", M: " () ", talk: " () ", blink: true },
  thinking:   { A: "    ", Z: "    ", K: ",---.", J: ".---,", L: "(  @)", R: "(  @)", B: "   ", C: "   ", M: " -. ", talk: " -o ", blink: true },
  sleepy:     { A: "    ", Z: "    ", K: "     ", J: "     ", L: "'---'", R: "'---'", B: "   ", C: "   ", M: " () ", talk: " () ", blink: false },
  teasing:    { A: "    ", Z: "    ", K: "-----", J: "-----", L: "( @ )", R: "( @ )", B: "   ", C: "   ", M: " ww ", talk: " wo ", blink: true },
} as const;
// Piscada: K/J = "     " e L/R = "'---'" por 140 ms.
// Olhando para o chat (usuário digitando, só em neutral): L/R = "(  @)".
export const BLINK_LIDS = "     ";
export const BLINK_EYES = "'---'";
export const LOOK_AT_CHAT_EYES = "(  @)";

export type Emotion = keyof typeof EXPRESSIONS;
export const EMOTION_LIST = Object.keys(EXPRESSIONS) as Emotion[];

export type ParticleKind =
  | "none"
  | "notes"     // ♪ subindo
  | "sparkles"  // ✧ estourando em volta
  | "sweat"     // gotinha na têmpora
  | "steam"     // vapor ~ saindo da cabeça
  | "hearts"    // ♡ subindo
  | "rain"      // nuvenzinha com chuva
  | "tears"     // lágrimas caindo dos olhos
  | "anger"     // 💢 na têmpora
  | "bang"      // "!" sobre a cabeça
  | "ponder"    // "?" e "…"
  | "zzz"       // zZz
  | "tease";    // "~" e ♪

export const EXPRESSION_META: Record<Emotion, { label: string; kaomoji: string; particle: ParticleKind }> = {
  neutral:   { label: "neutra",     kaomoji: "(・ω・)",       particle: "none" },
  happy:     { label: "feliz",      kaomoji: "(＾▽＾)",       particle: "notes" },
  excited:   { label: "animada",    kaomoji: "(≧▽≦)",       particle: "sparkles" },
  shy:       { label: "tímida",     kaomoji: "(〃・ω・〃)",   particle: "sweat" },
  flustered: { label: "corada",     kaomoji: "(>﹏<)",       particle: "steam" },
  love:      { label: "apaixonada", kaomoji: "(♡˙︶˙♡)",     particle: "hearts" },
  sad:       { label: "triste",     kaomoji: "(｡•́︿•̀｡)",    particle: "rain" },
  crying:    { label: "chorando",   kaomoji: "(╥﹏╥)",       particle: "tears" },
  pouty:     { label: "emburrada",  kaomoji: "(｀へ´)",       particle: "anger" },
  surprised: { label: "surpresa",   kaomoji: "(°ロ°)",       particle: "bang" },
  thinking:  { label: "pensativa",  kaomoji: "(・_・?)",      particle: "ponder" },
  sleepy:    { label: "sonolenta",  kaomoji: "(－_－)",       particle: "zzz" },
  teasing:   { label: "provocando", kaomoji: "(￣ω￣)",       particle: "tease" },
};
