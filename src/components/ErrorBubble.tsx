import { motion } from "motion/react";
import { KaoAvatar } from "./MessageBubble";

type ErrorBubbleProps = { message: string; onRetry: () => void };

/** Balão de erro fofo com "tentar de novo" (nunca tenta sozinho). */
export function ErrorBubble({ message, onRetry }: ErrorBubbleProps) {
  return (
    <motion.div
      className="flex items-start gap-2 pt-3"
      role="alert"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
    >
      <KaoAvatar emotion="crying" />
      <div className="error-bubble max-w-[80%]">
        <p>a mensagem não chegou até a Hana… (╥﹏╥)</p>
        <p className="mt-0.5 text-xs text-ink-muted">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="squish mt-2 rounded-full border-2 border-border bg-surface-2 px-3 py-1 text-sm text-ink"
        >
          ↻ tentar de novo
        </button>
      </div>
    </motion.div>
  );
}
