import { useEffect, useState } from "react";
import { AnimatePresence, MotionConfig } from "motion/react";
import type { Emotion } from "./ascii/expressions";
import { AppShell } from "./components/AppShell";
import { CharacterPanel } from "./components/CharacterPanel";
import { ChatWindow } from "./components/ChatWindow";
import { DebugPanel, type ThemeChoice } from "./components/DebugPanel";

/** Noite das 19h às 6h (seção 8.1). O ajuste de tema definitivo entra na fase 7. */
function autoTheme(date: Date): "day" | "night" {
  const h = date.getHours();
  return h >= 19 || h < 6 ? "night" : "day";
}

function debugFromUrl(): boolean {
  return new URLSearchParams(window.location.search).get("debug") === "1";
}

export default function App() {
  const [emotion, setEmotion] = useState<Emotion>("neutral");
  const [intensity, setIntensity] = useState(0.5);
  const [talking, setTalking] = useState(false);
  const [lookAtChat, setLookAtChat] = useState(false);
  const [themeChoice, setThemeChoice] = useState<ThemeChoice>("auto");
  const [debugOpen, setDebugOpen] = useState(debugFromUrl);

  const theme = themeChoice === "auto" ? autoTheme(new Date()) : themeChoice;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

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

  return (
    <MotionConfig reducedMotion="user">
      <AppShell
        theme={theme}
        character={<CharacterPanel emotion={emotion} intensity={intensity} talking={talking} lookAtChat={lookAtChat} />}
        chat={<ChatWindow />}
      />
      <AnimatePresence>
        {debugOpen && (
          <DebugPanel
            key="debug"
            onClose={() => setDebugOpen(false)}
            emotion={emotion}
            setEmotion={setEmotion}
            intensity={intensity}
            setIntensity={setIntensity}
            talking={talking}
            setTalking={setTalking}
            lookAtChat={lookAtChat}
            setLookAtChat={setLookAtChat}
            theme={themeChoice}
            setTheme={setThemeChoice}
          />
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
