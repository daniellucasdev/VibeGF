import { AnimatePresence, motion } from "motion/react";
import { useChatUi } from "../store/useChatUi";
import { SceneCaption } from "./SceneCaption";

/** A tela escurece um pouco e aparece a legenda da cena de abertura (9.1). */
export function OpeningOverlay() {
  const caption = useChatUi((s) => s.openingCaption);
  return (
    <AnimatePresence>
      {caption && (
        <motion.div
          key="opening"
          className="opening-overlay"
          role="status"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          <SceneCaption text={caption} className="opening-caption" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
