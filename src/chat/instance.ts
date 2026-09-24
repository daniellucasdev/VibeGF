// O motor da conversa do app, ligado aos stores e à API de verdade.
import { api } from "../lib/api";
import { chatUiStore } from "../store/useChatUi";
import { gameStore } from "../store/useGame";
import { createChatEngine } from "./engine";

export const chatEngine = createChatEngine({ game: gameStore, ui: chatUiStore, api });
