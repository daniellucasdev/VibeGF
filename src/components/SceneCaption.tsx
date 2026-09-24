import { useEffect, useMemo, useState } from "react";
import { useReducedMotion } from "motion/react";

type SceneCaptionProps = {
  text: string;
  /** Efeito de máquina de escrever (desligado com movimento reduzido). */
  typewriter?: boolean;
  className?: string;
};

const TYPE_MS = 45;

/** Narração de cena: itálico, centralizada, "[3 horas depois]". */
export function SceneCaption({ text, typewriter = true, className = "" }: SceneCaptionProps) {
  const reduce = useReducedMotion() ?? false;
  const chars = useMemo(() => Array.from(text), [text]);
  const animate = typewriter && !reduce;
  const [shown, setShown] = useState(animate ? 0 : chars.length);

  useEffect(() => {
    if (!animate) {
      setShown(chars.length);
      return;
    }
    setShown(0);
    const id = setInterval(() => {
      setShown((n) => {
        if (n + 1 >= chars.length) clearInterval(id);
        return Math.min(chars.length, n + 1);
      });
    }, TYPE_MS);
    return () => clearInterval(id);
  }, [animate, chars]);

  const done = shown >= chars.length;
  return (
    <p className={`scene-caption ${className}`}>
      <span className="sr-only">{text}</span>
      {/* o resto fica invisível mas ocupa espaço: a linha não pula enquanto digita */}
      <span aria-hidden="true">
        {chars.slice(0, shown).join("")}
        {!done && <span className="scene-caret">▍</span>}
        <span className="invisible">{chars.slice(shown).join("")}</span>
      </span>
    </p>
  );
}
