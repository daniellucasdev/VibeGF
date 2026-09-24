// Estado do jogo (seção 10): zustand + persist no localStorage, chave "kokoro-save", versão 1.
// As regras ficam em funções puras (src/game/ e ./save.ts); aqui só se liga tudo ao store.
import { useStore } from "zustand";
import { persist } from "zustand/middleware";
import { createStore } from "zustand/vanilla";
import type { Emotion, PaceKey, Profile } from "../../shared/types";
import type { TurnResult } from "../game/relationship";
import { now } from "../game/time";
import {
  SAVE_KEY, SAVE_VERSION, SUMMARY_MAX_CHARS,
  browserStorage, commitTurn, createSafeStorage, initialSave, markSeen, migrateSave, pickSave, pushMessage,
  sanitizeSave, setMood,
  type CommitInput, type Milestone, type NewMessage, type SaveData, type Settings,
} from "./save";
import { cutChars } from "../lib/text";

export type GameActions = {
  /** Onboarding concluído: save novo com o perfil e o ritmo escolhidos. */
  startGame: (profile: Profile, pace: PaceKey) => void;
  /** Limpa a conversa para (re)tocar a cena de abertura. */
  restartOpening: () => void;
  finishOpening: () => void;
  /** Devolve o id da mensagem nova. */
  appendMessage: (msg: NewMessage) => number;
  markSeen: (ids: readonly number[]) => void;
  commitTurn: (input: CommitInput) => TurnResult;
  setMood: (emotion: Emotion, intensity: number) => void;
  addMilestone: (m: Omit<Milestone, "id">) => void;
  deleteMemory: (id: number) => void;
  setSummary: (summary: string, upTo: number) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  /** "Apagar tudo": volta para o onboarding. */
  resetAll: () => void;
};

export type GameState = SaveData & GameActions;

export function createGameStore(storage = createSafeStorage(browserStorage)) {
  return createStore<GameState>()(
    persist<GameState, [], [], SaveData>(
      (set, get) => {
        const save = (): SaveData => pickSave(get());
        return {
          ...initialSave(now()),

          startGame: (profile, pace) =>
            set({ ...initialSave(now()), profile, settings: { ...get().settings, pace } }),

          restartOpening: () => {
            const fresh = initialSave(now());
            set({
              relationship: fresh.relationship, messages: [], summarizedUpTo: 0, memories: [],
              summary: fresh.summary, milestones: [], lastInteractionAt: null, openingDone: false,
            });
          },

          finishOpening: () => set({ openingDone: true }),

          appendMessage: (msg) => {
            const out = pushMessage(save(), msg);
            set(out.save);
            return out.id;
          },

          markSeen: (ids) => set(markSeen(save(), ids)),

          commitTurn: (input) => {
            const out = commitTurn(save(), input);
            set(out.save);
            return out.result;
          },

          setMood: (emotion, intensity) => set(setMood(save(), emotion, intensity, now())),

          addMilestone: (m) => {
            const { nextId, milestones } = get();
            set({ milestones: [...milestones, { ...m, id: nextId }], nextId: nextId + 1 });
          },

          deleteMemory: (id) => set({ memories: get().memories.filter((m) => m.id !== id) }),

          setSummary: (summary, upTo) =>
            set({ summary: cutChars(summary, SUMMARY_MAX_CHARS), summarizedUpTo: Math.max(get().summarizedUpTo, upTo) }),

          updateSettings: (patch) => set({ settings: { ...get().settings, ...patch } }),

          resetAll: () => set(initialSave(now())),
        };
      },
      {
        name: SAVE_KEY,
        version: SAVE_VERSION,
        storage,
        partialize: (s) => pickSave(s),
        migrate: (persisted, version) => migrateSave(persisted, version, now()),
        // Mesmo na versão atual, o que vem do disco passa pela validação campo a campo.
        merge: (persisted, current) => ({ ...current, ...sanitizeSave(persisted, now()) }),
      },
    ),
  );
}

export const gameStore = createGameStore();
export type GameStore = typeof gameStore;

export function useGame<T>(selector: (s: GameState) => T): T {
  return useStore(gameStore, selector);
}
