// Estado passageiro da conversa (não vai para o save): "digitando…", boca falando,
// erro, cena de abertura, +N das barras e o último JSON para o debug.
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import type { ChatResponse, Deltas, Emotion } from "../../shared/types";

export type ChatError = { message: string };

export type DebugStage = {
  /** Força uma emoção no palco (null = humor real). */
  emotion: Emotion | null;
  intensity: number | null;
  talking: boolean;
  lookAtChat: boolean;
};

export type ChatUiState = {
  typing: boolean;
  talking: boolean;
  error: ChatError | null;
  /** Tela escurecida com a legenda da cena de abertura. */
  openingCaption: string | null;
  /** Cena de abertura rodando: o input fica travado. */
  scripted: boolean;
  /** O usuário está escrevendo (ela olha para o chat). */
  composing: boolean;
  /** Variação do último turno, para o "+2" flutuante das barras. */
  lastDeltas: { key: number; applied: Deltas } | null;
  lastResponse: ChatResponse | null;
  debug: DebugStage;
};

export const initialChatUi = (): ChatUiState => ({
  typing: false,
  talking: false,
  error: null,
  openingCaption: null,
  scripted: false,
  composing: false,
  lastDeltas: null,
  lastResponse: null,
  debug: { emotion: null, intensity: null, talking: false, lookAtChat: false },
});

export const createChatUiStore = () => createStore<ChatUiState>()(() => initialChatUi());

export const chatUiStore = createChatUiStore();
export type ChatUiStore = typeof chatUiStore;

export function useChatUi<T>(selector: (s: ChatUiState) => T): T {
  return useStore(chatUiStore, selector);
}
