// Declaração (9.5): cena em tela cheia quando confession_accepted vale.
// Céu de fim de tarde, chuva de pétalas, arte grande flustered → love, falas
// letra por letra e o banner "💞 Agora vocês estão namorando!".
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AsciiGirl } from "../ascii/AsciiGirl";
import { useGame } from "../store/useGame";

type ConfessionSceneProps = {
  open: boolean;
  /** Fala final da Hana no turno da aceitação. */
  quote: string;
  onClose: () => void;
};

const LINES = (name: string): readonly { text: string; pauseMs: number }[] => [
  { text: "*ela segura a manga do casaco, o olho fixo no chão da estação*", pauseMs: 900 },
  { text: `…eu ensaiei isso umas cem vezes, ${name}.`, pauseMs: 1300 },
  { text: "você aparece do nada na minha vida, por um erro de número…", pauseMs: 1400 },
  { text: "e agora eu não consigo mais imaginar meus dias sem você.", pauseMs: 1500 },
  { text: "*respira fundo, vermelha até as orelhas*", pauseMs: 1000 },
  { text: "eu gosto de você. gosto de verdade.", pauseMs: 2200 },
];

/** Roteiro da declaração dela (usado quando ela se declara e é aceita). */
export function confessionLines(name: string) {
  return LINES(name).map((l) => l.text);
}

export function ConfessionScene({ open, quote, onClose }: ConfessionSceneProps) {
  const profile = useGame((s) => s.profile);
  const [step, setStep] = useState(0);
  const [typed, setTyped] = useState("");
  const [done, setDone] = useState(false);

  const lines = useMemo(() => LINES(profile?.name ?? "você"), [profile?.name]);
  const shown = lines.slice(0, step + 1);

  // máquina de escrever na fala atual
  useEffect(() => {
    if (!open) return;
    setStep(0);
    setTyped("");
    setDone(false);
    let i = 0;
    const line = lines[0].text;
    const typer = setInterval(() => {
      i++;
      setTyped(line.slice(0, i));
      if (i >= line.length) clearInterval(typer);
    }, 34);
    return () => clearInterval(typer);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open || step === 0) return;
    let i = 0;
    const line = lines[step].text;
    setTyped("");
    const typer = setInterval(() => {
      i++;
      setTyped(line.slice(0, i));
      if (i >= line.length) clearInterval(typer);
    }, 34);
    return () => clearInterval(typer);
  }, [open, step]); // eslint-disable-line react-hooks/exhaustive-deps

  const advance = () => {
    const line = lines[step].text;
    if (typed.length < line.length) {
      setTyped(line); // completa a fala na hora
      return;
    }
    if (step < lines.length - 1) {
      setTimeout(() => setStep((s) => s + 1), lines[step].pauseMs);
      setStep((s) => s + 1);
    } else {
      setDone(true);
    }
  };

  const petals = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        left: (i * 37) % 100,
        delay: -(i * 1.3) % 6,
        dur: 5 + ((i * 7) % 4),
        char: i % 3 === 0 ? "❀" : "🌸",
      })),
    [],
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="confession-scene fixed inset-0 z-50 flex flex-col items-center justify-end overflow-hidden"
          role="dialog"
          aria-modal="true"
          aria-label="declaração"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* pétalas */}
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            {petals.map((p, i) => (
              <span
                key={i}
                className="petal-fall"
                style={{ left: `${p.left}%`, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s` }}
              >
                {p.char}
              </span>
            ))}
          </div>

          {/* a Hana grande: corada e, no fim, apaixonada */}
          <div className="pointer-events-none absolute inset-x-0 top-[6vh] grid place-items-center">
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              <AsciiGirl
                emotion={done ? "love" : step >= 4 ? "flustered" : "shy"}
                intensity={0.9}
                talking={false}
                stage={5}
                fontSize="clamp(10px, 2.6vw, 16px)"
              />
            </motion.div>
          </div>

          {/* caixa de diálogo estilo visual novel */}
          <motion.div
            className="confession-dialog mx-auto mb-[8vh] w-full max-w-[720px] px-5"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.25, duration: 0.35, ease: "easeOut" }}
          >
            <div className="mb-2 font-display text-sm text-white/90">Hana ♡</div>
            <div className="space-y-2 min-h-[7.5em]">
              {shown.slice(0, -1).map((l, i) => (
                <p key={i} className="text-white/85 italic text-sm md:text-base">{l.text}</p>
              ))}
              <p className="text-base md:text-lg">
                {step === lines.length - 1 && done ? quote || lines[step].text : typed}
                <span className="caret" aria-hidden="true">♡</span>
              </p>
            </div>
            <div className="mt-4 flex justify-end">
              {!done ? (
                <button type="button" onClick={advance} className="confession-btn">…continuar</button>
              ) : (
                <motion.button
                  type="button"
                  onClick={onClose}
                  className="confession-btn confession-btn-love"
                  initial={{ scale: 0.9 }}
                  animate={{ scale: [1, 1.06, 1] }}
                  transition={{ repeat: Infinity, duration: 1.4 }}
                >
                  ♡ continuar
                </motion.button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
