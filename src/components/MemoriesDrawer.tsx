import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { MAX_MEMORIES } from "../game/memories";
import { useGame } from "../store/useGame";

type MemoriesDrawerProps = { open: boolean; onClose: () => void };

/** "O que a Hana lembra de você ✎": caderninho pautado com opção de apagar cada item. */
export function MemoriesDrawer({ open, onClose }: MemoriesDrawerProps) {
  const memories = useGame((s) => s.memories);
  const deleteMemory = useGame((s) => s.deleteMemory);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="memories"
          className="fixed inset-0 z-40 flex justify-end bg-ink/20 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="memories-title"
            className="kawaii-window m-2 h-[calc(100dvh-1rem)] w-full max-w-[400px]"
            initial={{ x: "105%" }}
            animate={{ x: 0 }}
            exit={{ x: "105%" }}
            transition={{ duration: 0.28, ease: "easeOut" }}
          >
            <header className="kawaii-titlebar">
              <h2 className="font-normal">📒 memorias.txt</h2>
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                aria-label="fechar memórias"
                className="squish grid size-7 place-items-center rounded-full border-2 border-border bg-surface-2 text-xs text-pink-strong"
              >
                ✕
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5 pt-4">
              <h3 id="memories-title" className="font-display text-lg text-pink-strong">
                O que a Hana lembra de você ✎
              </h3>
              <p className="mb-4 mt-1 text-xs text-ink-muted">
                {memories.length}/{MAX_MEMORIES} · ela anota o que você conta de importante. Apagar aqui faz ela esquecer.
              </p>
              {memories.length === 0 ? (
                <p className="rounded-[18px] border-2 border-dashed border-border px-4 py-6 text-center text-sm text-ink-muted">
                  <span className="mb-1 block text-xl" aria-hidden="true">(・ω・)</span>
                  ela ainda não sabe muito sobre você…
                </p>
              ) : (
                <ul className="notebook text-sm text-ink">
                  {memories.map((m) => (
                    <li key={m.id}>
                      <span>✎ {m.text}</span>
                      <button
                        type="button"
                        onClick={() => deleteMemory(m.id)}
                        aria-label={`apagar memória: ${m.text}`}
                        title="apagar"
                        className="squish mt-1.5 grid size-6 shrink-0 place-items-center rounded-full border-2 border-border bg-surface-2 text-[10px] leading-none text-ink-muted hover:text-pink-strong"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
