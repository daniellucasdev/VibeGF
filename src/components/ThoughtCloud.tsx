import { motion } from "motion/react";

/** O que ela pensou (ajuste "ler pensamentos 💭"), numa nuvem translúcida embaixo das falas dela. */
export function ThoughtCloud({ text }: { text: string }) {
  return (
    <motion.p
      className="thought-cloud"
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <span aria-hidden="true">💭 </span>
      <span className="sr-only">pensamento da Hana: </span>
      {text}
    </motion.p>
  );
}
