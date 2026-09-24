import { AnimatePresence, motion } from "motion/react";
import type { Reaction } from "../../shared/types";

export const REACTION_STICKERS: Record<Exclude<Reaction, "none">, { emoji: string; label: string }> = {
  heart: { emoji: "💗", label: "coração" },
  laugh: { emoji: "😂", label: "risada" },
  sparkle: { emoji: "✨", label: "brilhinho" },
  sad: { emoji: "🥺", label: "tristinha" },
  angry: { emoji: "💢", label: "brava" },
  surprised: { emoji: "😳", label: "surpresa" },
};

/** Adesivo da reação da Hana que "pula" no canto da bolha do usuário. */
export function ReactionBadge({ reaction }: { reaction: Reaction | null }) {
  const sticker = reaction && reaction !== "none" ? REACTION_STICKERS[reaction] : null;
  return (
    <AnimatePresence initial={false}>
      {sticker && (
        <motion.span
          key={reaction}
          className="reaction-badge"
          role="img"
          aria-label={`reação da Hana: ${sticker.label}`}
          initial={{ scale: 0, rotate: -25 }}
          animate={{ scale: 1, rotate: -8 }}
          transition={{ type: "spring", stiffness: 520, damping: 11 }}
        >
          {sticker.emoji}
        </motion.span>
      )}
    </AnimatePresence>
  );
}
