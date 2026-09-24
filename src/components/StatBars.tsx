import { motion } from "motion/react";
import type { Deltas, FeelingKey, Feelings, Stage } from "../../shared/types";

type StatBarsProps = {
  feelings: Feelings;
  stage: Stage;
  showNumbers: boolean;
  /** Variação do último turno: vira o "+2" flutuante (a chave troca a cada turno). */
  lastDeltas: { key: number; applied: Deltas } | null;
};

const BARS: readonly { key: FeelingKey; label: string; fill: string }[] = [
  { key: "affection", label: "Afeição ♡", fill: "stat-pink" },
  { key: "trust", label: "Confiança ✦", fill: "stat-mint" },
  { key: "romance", label: "Doki-doki 💓", fill: "stat-lilac" },
];

/** Doki-doki fica em segredo ("???") até o estágio 2. */
export const ROMANCE_REVEAL_STAGE = 2;

function levelText(v: number): string {
  if (v < 15) return "quase nada";
  if (v < 40) return "um pouco";
  if (v < 70) return "bastante";
  return "muito";
}

const signed = (n: number) => (n > 0 ? `+${n}` : `−${Math.abs(n)}`);

/** Três barras de sentimento que animam o ganho ou a perda com um "+N" flutuante. */
export function StatBars({ feelings, stage, showNumbers, lastDeltas }: StatBarsProps) {
  return (
    <ul className="w-full space-y-2.5" aria-label="sentimentos da Hana">
      {BARS.map((b) => {
        const hidden = b.key === "romance" && stage < ROMANCE_REVEAL_STAGE;
        const value = Math.round(feelings[b.key]);
        const delta = lastDeltas && !hidden ? lastDeltas.applied[b.key] : 0;
        const name = hidden ? "???" : b.label;
        return (
          <li key={b.key}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
              <span>{name}</span>
              <span className="flex items-baseline gap-2">
                {delta !== 0 && lastDeltas && (
                  <span key={lastDeltas.key} className="stat-float" aria-hidden="true">
                    {signed(delta)}
                  </span>
                )}
                {showNumbers && !hidden && <span className="font-mono text-xs text-ink-muted">{value}/100</span>}
              </span>
            </div>
            <div
              className="stat-track"
              role="meter"
              aria-label={hidden ? "sentimento secreto" : b.label}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={hidden ? undefined : value}
              aria-valuetext={hidden ? "???" : showNumbers ? `${value} de 100` : levelText(value)}
            >
              {hidden ? (
                <div className="stat-fill stat-mystery" />
              ) : (
                <motion.div
                  className={`stat-fill ${b.fill}`}
                  initial={false}
                  animate={{ width: `${value}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
