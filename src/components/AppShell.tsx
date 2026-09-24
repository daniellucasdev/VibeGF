import type { ReactNode } from "react";
import { BackgroundScene } from "./BackgroundScene";

type AppShellProps = {
  theme: "day" | "night";
  character: ReactNode;
  chat: ReactNode;
  onOpenMemories: () => void;
  onOpenAlbum: () => void;
  onOpenSettings: () => void;
  soundOn: boolean;
  onToggleSound: () => void;
};

const HEADER_BTN =
  "squish grid size-9 place-items-center rounded-full border-2 border-border bg-surface-2 text-base shadow-kawaii min-[900px]:size-11 min-[900px]:text-lg";

export function Logo() {
  return (
    <h1 className="relative select-none text-2xl min-[900px]:text-3xl">
      <span className="kokoro-logo">Kokoro ♡</span>
      <span className="logo-sparkle -right-3 -top-1" aria-hidden="true">✧</span>
      <span className="logo-sparkle -left-2 bottom-0" style={{ animationDelay: "-1.1s" }} aria-hidden="true">✦</span>
    </h1>
  );
}

/** Estrutura geral: fundo, header com logo e duas colunas (Hana à esquerda, chat à direita). */
export function AppShell({ theme, character, chat, onOpenMemories, onOpenAlbum, onOpenSettings, soundOn, onToggleSound }: AppShellProps) {
  return (
    <div className="flex min-h-dvh flex-col min-[900px]:h-dvh">
      <BackgroundScene theme={theme} />
      <header className="mx-auto flex w-full max-w-[1200px] items-center justify-between gap-3 px-4 py-2 min-[900px]:py-3">
        <Logo />
        <nav className="flex gap-1.5 min-[900px]:gap-2" aria-label="menu">
          <button type="button" aria-label="memórias" title="O que a Hana lembra de você ✎" onClick={onOpenMemories} className={HEADER_BTN}>
            <span aria-hidden="true">📒</span>
          </button>
          <button type="button" aria-label="álbum" title="Os momentos de vocês dois 📸" onClick={onOpenAlbum} className={HEADER_BTN}>
            <span aria-hidden="true">📸</span>
          </button>
          <button type="button" aria-label="ajustes" title="Ajustes ⚙️" onClick={onOpenSettings} className={HEADER_BTN}>
            <span aria-hidden="true">⚙️</span>
          </button>
          <button
            type="button"
            aria-label={soundOn ? "desligar som" : "ligar som"}
            aria-pressed={soundOn}
            title={soundOn ? "Som ligado 🔊" : "Som desligado 🔇"}
            onClick={onToggleSound}
            className={HEADER_BTN}
          >
            <span aria-hidden="true">{soundOn ? "🔊" : "🔇"}</span>
          </button>
        </nav>
      </header>
      <main className="mx-auto grid w-full max-w-[1200px] min-h-0 flex-1 grid-cols-1 gap-5 px-4 pb-5 pt-2 min-[900px]:grid-cols-[minmax(360px,440px)_1fr]">
        {character}
        {chat}
      </main>
    </div>
  );
}
