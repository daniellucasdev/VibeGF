import { useState } from "react";
import { motion } from "motion/react";
import { AsciiGirl } from "../ascii/AsciiGirl";
import { EMOTION_LIST, EXPRESSIONS, EXPRESSION_META, type Emotion } from "../ascii/expressions";

export type ThemeChoice = "auto" | "day" | "night";

type DebugPanelProps = {
  onClose: () => void;
  emotion: Emotion;
  setEmotion: (e: Emotion) => void;
  intensity: number;
  setIntensity: (n: number) => void;
  talking: boolean;
  setTalking: (b: boolean) => void;
  lookAtChat: boolean;
  setLookAtChat: (b: boolean) => void;
  theme: ThemeChoice;
  setTheme: (t: ThemeChoice) => void;
};

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (b: boolean) => void }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border-2 border-border bg-surface-2 px-3 py-1 text-sm">
      <input type="checkbox" className="accent-pink-strong" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

/** Painel de debug (?debug=1 ou Ctrl+Shift+D). Nesta fase: palco da Hana, tema e galeria de expressões. */
export function DebugPanel(props: DebugPanelProps) {
  const [galleryTalking, setGalleryTalking] = useState(false);
  const [galleryBlink, setGalleryBlink] = useState(false);
  const [galleryLook, setGalleryLook] = useState(false);
  const [galleryParticles, setGalleryParticles] = useState(true);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/20 p-2 backdrop-blur-sm min-[900px]:items-center min-[900px]:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-label="debug.exe"
        className="kawaii-window max-h-[92dvh] w-full max-w-[1150px]"
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        <header className="kawaii-titlebar">
          <h2 className="font-normal">⚙ debug.exe</h2>
          <button
            type="button"
            onClick={props.onClose}
            aria-label="fechar debug"
            className="squish grid size-7 place-items-center rounded-full border-2 border-border bg-surface-2 text-xs text-pink-strong"
          >
            ✕
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4 text-ink">
          <fieldset className="space-y-3">
            <legend className="mb-2 font-display text-pink-strong">Palco ✿</legend>
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm">
                emoção
                <select
                  className="rounded-full border-2 border-border bg-surface-2 px-3 py-1"
                  value={props.emotion}
                  onChange={(e) => props.setEmotion(e.target.value as Emotion)}
                >
                  {EMOTION_LIST.map((e) => (
                    <option key={e} value={e}>
                      {EXPRESSION_META[e].kaomoji} {EXPRESSION_META[e].label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                intensidade {props.intensity.toFixed(2)}
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={props.intensity}
                  onChange={(e) => props.setIntensity(Number(e.target.value))}
                  className="accent-pink-strong"
                />
              </label>
              <Toggle label="falar" checked={props.talking} onChange={props.setTalking} />
              <Toggle label="olhar pro chat" checked={props.lookAtChat} onChange={props.setLookAtChat} />
              <label className="inline-flex items-center gap-2 text-sm">
                tema
                <select
                  className="rounded-full border-2 border-border bg-surface-2 px-3 py-1"
                  value={props.theme}
                  onChange={(e) => props.setTheme(e.target.value as ThemeChoice)}
                >
                  <option value="auto">auto</option>
                  <option value="day">dia ☀</option>
                  <option value="night">noite ☾</option>
                </select>
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 font-display text-pink-strong">Galeria de expressões ♡</legend>
            <div className="mb-3 flex flex-wrap gap-2">
              <Toggle label="falar" checked={galleryTalking} onChange={setGalleryTalking} />
              <Toggle label="piscar (olhos fechados)" checked={galleryBlink} onChange={setGalleryBlink} />
              <Toggle label="olhar pro chat" checked={galleryLook} onChange={setGalleryLook} />
              <Toggle label="partículas" checked={galleryParticles} onChange={setGalleryParticles} />
            </div>
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-3">
              {EMOTION_LIST.map((e) => {
                const meta = EXPRESSION_META[e];
                return (
                  <li key={e}>
                    <button
                      type="button"
                      onClick={() => props.setEmotion(e)}
                      aria-pressed={props.emotion === e}
                      aria-label={`usar ${meta.label} no palco`}
                      className={`squish flex w-full flex-col items-center gap-1 rounded-[18px] border-2 bg-surface-2 px-2 pb-2 pt-5 ${
                        props.emotion === e ? "border-pink-strong" : "border-border"
                      }`}
                    >
                      <AsciiGirl
                        emotion={e}
                        intensity={props.intensity}
                        talking={galleryTalking}
                        forceBlink={galleryBlink}
                        lookAtChat={galleryLook}
                        showParticles={galleryParticles}
                        fontSize="7px"
                      />
                      <span className="text-sm">
                        {meta.kaomoji} {meta.label}
                      </span>
                      <span className="font-mono text-[11px] text-ink-soft">
                        {e}
                        {EXPRESSIONS[e].blink ? " · pisca" : ""}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        </div>
      </motion.section>
    </motion.div>
  );
}
