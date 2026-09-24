// Toasts da relação (9.4): StageUpToast (banner central estilo visual novel,
// 3,5 s com brilhos e chime) e MilestoneToast (canto discreto).
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { chime } from "../lib/sound";
import { useGame } from "../store/useGame";

export type ToastState = {
  /** Banner grande de estágio: ícone + frase do STAGES. */
  stageUp: { icon: string; text: string; key: number } | null;
  /** Cantinho discreto de marcos menores. */
  milestone: { icon: string; text: string; key: number } | null;
};

let setters: ((t: ToastState | ((prev: ToastState) => ToastState)) => void) | null = null;

/** Dispara os toasts de fora do React (engine). */
export const toasts = {
  stageUp(icon: string, text: string) {
    setters?.({ stageUp: { icon, text, key: Date.now() }, milestone: null });
  },
  milestone(icon: string, text: string) {
    setters?.((prev) => ({ ...prev, milestone: { icon, text, key: Date.now() } }));
  },
  clear() {
    setters?.({ stageUp: null, milestone: null });
  },
};

const STAGE_MS = 3500;
const MILESTONE_MS = 4200;

export function ToastLayer() {
  const [state, setState] = useState<ToastState>({ stageUp: null, milestone: null });
  const sound = useGame((s) => s.settings.sound);

  useEffect(() => {
    setters = setState;
    return () => {
      setters = null;
    };
  }, []);

  useEffect(() => {
    if (state.stageUp && sound) chime();
  }, [state.stageUp?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!state.stageUp) return;
    const t = setTimeout(() => setState((s) => (s.stageUp?.key === state.stageUp!.key ? { ...s, stageUp: null } : s)), STAGE_MS);
    return () => clearTimeout(t);
  }, [state.stageUp]);

  useEffect(() => {
    if (!state.milestone) return;
    const t = setTimeout(() => setState((s) => (s.milestone?.key === state.milestone!.key ? { ...s, milestone: null } : s)), MILESTONE_MS);
    return () => clearTimeout(t);
  }, [state.milestone]);

  return (
    <div className="pointer-events-none fixed inset-0 z-40 grid place-items-center overflow-hidden">
      <AnimatePresence>
        {state.stageUp && (
          <motion.div
            key={state.stageUp.key}
            className="toast-stage"
            role="status"
            initial={{ opacity: 0, y: 26, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -14, scale: 0.98 }}
            transition={{ duration: 0.32, ease: "easeOut" }}
          >
            <span className="toast-sparkle" style={{ left: "8%", animationDelay: "-0.4s" }}>✧</span>
            <span className="toast-sparkle" style={{ right: "10%", animationDelay: "-1.6s" }}>✦</span>
            <span className="toast-sparkle" style={{ left: "18%", top: "70%", animationDelay: "-2.4s" }}>✧</span>
            <span aria-hidden="true" className="text-4xl">{state.stageUp.icon}</span>
            <p className="font-display text-lg">{state.stageUp.text}</p>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {state.milestone && (
          <motion.div
            key={state.milestone.key}
            className="absolute bottom-4 left-1/2 -translate-x-1/2"
            role="status"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <div className="toast-milestone">
              <span aria-hidden="true">{state.milestone.icon}</span>
              <span>{state.milestone.text}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
