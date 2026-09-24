import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, MotionConfig } from "motion/react";
import type { PaceKey, Profile } from "../shared/types";
import { chatEngine } from "./chat/instance";
import { AppShell } from "./components/AppShell";
import { CharacterPanel } from "./components/CharacterPanel";
import { ChatWindow } from "./components/ChatWindow";
import { DebugPanel } from "./components/DebugPanel";
import { MemoriesDrawer } from "./components/MemoriesDrawer";
import { Onboarding } from "./components/Onboarding";
import { OpeningOverlay } from "./components/OpeningOverlay";
import { isNightTime } from "./game/time";
import { useNow } from "./hooks/useNow";
import { gameStore, useGame } from "./store/useGame";

function debugFromUrl(): boolean {
  return new URLSearchParams(window.location.search).get("debug") === "1";
}

export default function App() {
  const hasProfile = useGame((s) => s.profile !== null);
  const themeChoice = useGame((s) => s.settings.theme);
  const clock = useNow(60_000);
  const [debugOpen, setDebugOpen] = useState(debugFromUrl);
  const [memoriesOpen, setMemoriesOpen] = useState(false);

  // Tema automático: noite das 19h às 6h (8.1), com o relógio central.
  const theme = themeChoice === "auto" ? (isNightTime(clock) ? "night" : "day") : themeChoice;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // Abertura pela metade ou mensagens sem resposta: o motor resolve uma vez, na carga.
  useEffect(() => {
    chatEngine.boot();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        setDebugOpen((o) => !o);
      } else if (e.key === "Escape") {
        setDebugOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const start = useCallback((profile: Profile, pace: PaceKey) => {
    gameStore.getState().startGame(profile, pace);
    void chatEngine.playOpening();
  }, []);
  const openMemories = useCallback(() => setMemoriesOpen(true), []);
  const closeMemories = useCallback(() => setMemoriesOpen(false), []);
  const closeDebug = useCallback(() => setDebugOpen(false), []);

  return (
    <MotionConfig reducedMotion="user">
      {hasProfile ? (
        <AppShell theme={theme} onOpenMemories={openMemories} character={<CharacterPanel />} chat={<ChatWindow />} />
      ) : (
        <Onboarding theme={theme} onStart={start} />
      )}
      <OpeningOverlay />
      <MemoriesDrawer open={memoriesOpen} onClose={closeMemories} />
      <AnimatePresence>{debugOpen && <DebugPanel key="debug" onClose={closeDebug} />}</AnimatePresence>
    </MotionConfig>
  );
}
