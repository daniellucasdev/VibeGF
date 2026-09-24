// Cena de abertura (9.1): roteirizada, sem chamar a API.
import type { Emotion } from "../../shared/types";

export const OPENING_CAPTION = "[Uma notificação de um número desconhecido…]";

/** Tempo da legenda na tela escurecida (a máquina de escrever cabe aqui dentro). */
export const OPENING_CAPTION_MS = 3600;
/** A tela clareia antes do primeiro "digitando…". */
export const OPENING_UNDIM_MS = 600;

export type ScriptedLine = {
  text: string;
  emotion: Emotion;
  intensity: number;
  /** Pausa antes do "digitando…" deste balão (padrão: 300–700 ms). */
  pauseBeforeMs?: number;
};

export const OPENING_LINES: readonly ScriptedLine[] = [
  { text: "YUIII socorro", emotion: "excited", intensity: 0.8 },
  { text: "o Daifuku fugiu do café de novo e eu tô correndo atrás dele de avental no meio da rua 😭", emotion: "crying", intensity: 0.7 },
  { text: "…espera", emotion: "surprised", intensity: 0.6, pauseBeforeMs: 2500 },
  { text: "esse não é o número da Yui, né", emotion: "surprised", intensity: 0.8 },
  { text: "ai não. desculpa!!! número errado (；・∀・)", emotion: "flustered", intensity: 0.8 },
];
