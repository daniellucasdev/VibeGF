import { useId, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { AsciiGirl } from "../ascii/AsciiGirl";
import { PACE } from "../../shared/stages";
import type { Honorific, PaceKey, Profile, Pronouns } from "../../shared/types";
import { NAME_MAX_CHARS } from "../store/save";
import { Logo } from "./AppShell";
import { BackgroundScene } from "./BackgroundScene";

type OnboardingProps = {
  theme: "day" | "night";
  onStart: (profile: Profile, pace: PaceKey) => void;
};

const PRONOUNS: readonly Pronouns[] = ["ele", "ela", "elu"];

/** Sugestão de tratamento pelo pronome, até o usuário escolher outro. */
const HONORIFIC_FOR: Record<Pronouns, Honorific> = { ele: "kun", ela: "chan", elu: "none" };

const PACE_HINT: Record<PaceKey, string> = {
  lento: "umas duas semanas; cada passo demora mais",
  normal: "cerca de uma semana de conversas até o namoro",
  rapido: "alguns dias; bom pra quem tem pressa",
};

function Choice({ name, checked, onChange, children, className = "" }: {
  name: string;
  checked: boolean;
  onChange: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`choice squish ${className}`}>
      <input type="radio" name={name} className="sr-only" checked={checked} onChange={onChange} />
      {children}
    </label>
  );
}

/** Primeira abertura (9.1): nome, pronomes, tratamento e ritmo. A Hana ainda está dormindo. */
export function Onboarding({ theme, onStart }: OnboardingProps) {
  const [name, setName] = useState("");
  const [pronouns, setPronouns] = useState<Pronouns>("ele");
  const [honorific, setHonorific] = useState<Honorific>("kun");
  const [honorificTouched, setHonorificTouched] = useState(false);
  const [pace, setPace] = useState<PaceKey>("normal");
  const nameId = useId();

  const trimmed = name.trim();
  const shown = trimmed || "você";
  const honorifics: readonly { id: Honorific; label: string; preview: string }[] = [
    { id: "kun", label: "-kun", preview: `${shown}-kun` },
    { id: "chan", label: "-chan", preview: `${shown}-chan` },
    { id: "none", label: "só o nome", preview: shown },
  ];

  const pickPronouns = (p: Pronouns) => {
    setPronouns(p);
    if (!honorificTouched) setHonorific(HONORIFIC_FOR[p]);
  };

  return (
    <div className="grid min-h-dvh place-items-center px-3 py-6">
      <BackgroundScene theme={theme} />
      <motion.section
        className="kawaii-window w-full max-w-[480px]"
        aria-labelledby="onboarding-title"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: "easeOut" }}
      >
        <span className="kawaii-sticker tl" aria-hidden="true">✿</span>
        <header className="kawaii-titlebar">
          <h2 id="onboarding-title" className="font-normal">✿ bem-vindo.exe</h2>
          <div className="kawaii-titlebar-dots" aria-hidden="true">
            <span>♡</span>
            <span>✿</span>
            <span>✕</span>
          </div>
        </header>

        <div className="flex flex-col items-center gap-3 px-4 pb-5 pt-4 min-[480px]:px-6">
          <Logo />
          <div className="pt-4">
            <AsciiGirl emotion="sleepy" intensity={0.6} fontSize="clamp(6px, 2.1vw, 9px)" />
          </div>
          <p className="text-center text-sm text-ink-muted">a Hana ainda está dormindo… mas o celular dela vai tocar já já ✿</p>

          <form
            className="flex w-full flex-col gap-4 pt-1"
            onSubmit={(e) => {
              e.preventDefault();
              if (trimmed) onStart({ name: trimmed, pronouns, honorific }, pace);
            }}
          >
            <div className="flex flex-col gap-1.5">
              <label htmlFor={nameId} className="font-display text-sm text-ink">
                Como você se chama?
              </label>
              <input
                id={nameId}
                required
                autoFocus
                autoComplete="given-name"
                maxLength={NAME_MAX_CHARS}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="seu nome ou apelido"
                className="rounded-full border-2 border-border bg-surface-2 px-4 py-2 text-ink placeholder:text-ink-muted focus-visible:border-focus"
              />
            </div>

            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1.5 font-display text-sm text-ink">Pronomes</legend>
              <div className="flex flex-wrap gap-2">
                {PRONOUNS.map((p) => (
                  <Choice key={p} name="pronouns" checked={pronouns === p} onChange={() => pickPronouns(p)}>
                    {p}
                  </Choice>
                ))}
              </div>
            </fieldset>

            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1.5 font-display text-sm text-ink">Quando ficarem próximos, ela deve te chamar de…</legend>
              <div className="flex flex-wrap gap-2">
                {honorifics.map((h) => (
                  <Choice
                    key={h.id}
                    name="honorific"
                    checked={honorific === h.id}
                    onChange={() => {
                      setHonorific(h.id);
                      setHonorificTouched(true);
                    }}
                  >
                    {h.label}
                    <span className="text-xs text-ink-muted">({h.preview})</span>
                  </Choice>
                ))}
              </div>
            </fieldset>

            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1.5 font-display text-sm text-ink">Ritmo do romance</legend>
              <div className="grid gap-2 min-[480px]:grid-cols-3">
                {(Object.keys(PACE) as PaceKey[]).map((k) => (
                  <Choice key={k} name="pace" checked={pace === k} onChange={() => setPace(k)} className="choice-card">
                    <span className="text-sm text-ink">{PACE[k].label}</span>
                    <span className="text-xs leading-snug text-ink-muted">{PACE_HINT[k]}</span>
                  </Choice>
                ))}
              </div>
            </fieldset>

            <button
              type="submit"
              disabled={!trimmed}
              className="squish mx-auto mt-1 rounded-full border-2 border-transparent bg-[linear-gradient(135deg,var(--user-a),var(--user-b))] px-8 py-2.5 font-display text-white shadow-kawaii disabled:cursor-not-allowed disabled:opacity-50"
            >
              Começar ✿
            </button>
          </form>
        </div>
        <span className="kawaii-sticker br" aria-hidden="true">♡</span>
      </motion.section>
    </div>
  );
}
