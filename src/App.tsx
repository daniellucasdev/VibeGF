import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, MotionConfig } from "motion/react";
import type { PaceKey, Profile } from "../shared/types";
import { chatEngine } from "./chat/instance";
import { AlbumDrawer } from "./components/AlbumDrawer";
import { AppShell } from "./components/AppShell";
import { CharacterPanel } from "./components/CharacterPanel";
import { ChatWindow } from "./components/ChatWindow";
import { ConfessionScene } from "./components/ConfessionScene";
import { DebugPanel } from "./components/DebugPanel";
import { MemoriesDrawer } from "./components/MemoriesDrawer";
import { Onboarding } from "./components/Onboarding";
import { OpeningOverlay } from "./components/OpeningOverlay";
import { SettingsModal } from "./components/SettingsModal";
import { ToastLayer } from "./components/Toasts";
import { dayPeriod, isNightTime } from "./game/time";
import { IdleWatcher } from "./hooks/IdleWatcher";
import { useNow } from "./hooks/useNow";
import { gameStore, useGame } from "./store/useGame";
import { chatUiStore, useChatUi } from "./store/useChatUi";

function debugFromUrl(): boolean {
  return new URLSearchParams(window.location.search).get("debug") === "1";
}

export default function App() {
  const hasProfile = useGame((s) => s.profile !== null);
  const themeChoice = useGame((s) => s.settings.theme);
  const messages = useGame((s) => s.messages);
  const idleNudge = useGame((s) => s.settings.idleNudge);
  const confession = useChatUi((s) => s.confession);
  const clock = useNow(60_000);
  const [debugOpen, setDebugOpen] = useState(debugFromUrl);
  const [memoriesOpen, setMemoriesOpen] = useState(false);
  const [albumOpen, setAlbumOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const sound = useGame((s) => s.settings.sound);

  // Tema automático: noite das 19h às 6h (8.1), com o relógio central.
  const theme = themeChoice === "auto" ? (isNightTime(clock) ? "night" : "day") : themeChoice;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.period = dayPeriod(clock);
  }, [theme, clock]);

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
  const openAlbum = useCallback(() => setAlbumOpen(true), []);
  const closeAlbum = useCallback(() => setAlbumOpen(false), []);
  const closeDebug = useCallback(() => setDebugOpen(false), []);
  const closeConfession = useCallback(() => chatUiStore.setState({ confession: null }), []);
  const pokeIdle = useCallback(() => chatEngine.pokeIdle(), []);
  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  const toggleSound = useCallback(() => gameStore.getState().updateSettings({ sound: !gameStore.getState().settings.sound }), []);

  const lastMsg = messages[messages.length - 1];
  const lastIsHana = lastMsg?.role === "hana" && !confession;

  return (
    <MotionConfig reducedMotion="user">
      {hasProfile ? (
        <AppShell
          theme={theme}
          onOpenMemories={openMemories}
          onOpenAlbum={openAlbum}
          onOpenSettings={openSettings}
          soundOn={sound}
          onToggleSound={toggleSound}
          character={<CharacterPanel />}
          chat={<ChatWindow />}
        />
      ) : (
        <Onboarding theme={theme} onStart={start} />
      )}
      <OpeningOverlay />
      <MemoriesDrawer open={memoriesOpen} onClose={closeMemories} />
      <AlbumDrawer open={albumOpen} onClose={closeAlbum} />
      <SettingsModal open={settingsOpen} onClose={closeSettings} />
      <ToastLayer />
      <ConfessionScene open={confession !== null} quote={confession?.quote ?? ""} onClose={closeConfession} />
      <IdleWatcher lastIsHana={lastIsHana} enabled={idleNudge && hasProfile} onIdle={pokeIdle} />
      <AnimatePresence>{debugOpen && <DebugPanel key="debug" onClose={closeDebug} />}</AnimatePresence>
    </MotionConfig>
  );
}
