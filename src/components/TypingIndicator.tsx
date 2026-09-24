import { motion } from "motion/react";

/** Três coraçõezinhos pulando e "Hana está digitando…". */
export function TypingIndicator() {
  return (
    <motion.div
      className="flex items-center gap-2 pb-1 pl-1 pt-2"
      role="status"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <span className="typing-hearts" aria-hidden="true">
        <span>♥</span>
        <span>♥</span>
        <span>♥</span>
      </span>
      <span className="text-sm text-ink-muted">Hana está digitando…</span>
    </motion.div>
  );
}
