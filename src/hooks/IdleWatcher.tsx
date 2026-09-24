// Timer do silêncio (5.5): 5 min sem interação, aba visível e a última fala
// sendo dela → UMA mensagem (idle_nudge). Reinicia a cada interação.
import { useEffect } from "react";
import { IDLE_NUDGE_MS } from "../chat/engine";

type IdleWatchProps = {
  /** A última mensagem é dela (o silêncio começou depois da fala da Hana). */
  lastIsHana: boolean;
  enabled: boolean;
  onIdle: () => void;
};

export function IdleWatcher({ lastIsHana, enabled, onIdle }: IdleWatchProps) {
  useEffect(() => {
    if (!enabled || !lastIsHana) return;
    let elapsed = 0;
    const tick = 5_000;
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return; // só com a aba visível
      elapsed += tick;
      if (elapsed >= IDLE_NUDGE_MS) {
        clearInterval(timer);
        onIdle();
      }
    }, tick);
    return () => clearInterval(timer);
  }, [lastIsHana, enabled, onIdle]);

  return null;
}
