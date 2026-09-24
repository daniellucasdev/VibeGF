import { useState } from "react";
import { motion } from "motion/react";
import { useShallow } from "zustand/react/shallow";
import { AsciiGirl } from "../ascii/AsciiGirl";
import { EMOTION_LIST, EXPRESSIONS, EXPRESSION_META, type Emotion } from "../ascii/expressions";
import { chatEngine } from "../chat/instance";
import { clockState, resetClock, setFixedClock, travel } from "../game/time";
import type { Settings, ThemeChoice } from "../store/save";
import { chatUiStore, useChatUi, type DebugStage } from "../store/useChatUi";
import { gameStore, useGame } from "../store/useGame";
import { toasts } from "./Toasts";

type DebugPanelProps = { onClose: () => void };

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (b: boolean) => void }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border-2 border-border bg-surface-2 px-3 py-1 text-sm">
      <input type="checkbox" className="accent-pink-strong" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

const setStage = (patch: Partial<DebugStage>) => chatUiStore.setState((s) => ({ debug: { ...s.debug, ...patch } }));
const setSetting = (patch: Partial<Settings>) => gameStore.getState().updateSettings(patch);

/**
 * Painel de debug (?debug=1 ou Ctrl+Shift+D): palco da Hana, galeria de expressões,
 * ajustes provisórios (até a janela de ajustes da fase 7), último turno e recomeçar.
 */
export function DebugPanel({ onClose }: DebugPanelProps) {
  const [galleryTalking, setGalleryTalking] = useState(false);
  const [galleryBlink, setGalleryBlink] = useState(false);
  const [galleryLook, setGalleryLook] = useState(false);
  const [galleryParticles, setGalleryParticles] = useState(true);
  const debug = useChatUi((s) => s.debug);
  const lastResponse = useChatUi((s) => s.lastResponse);
  const settings = useGame(useShallow((s) => s.settings));
  const relationship = useGame((s) => s.relationship);
  const galleryIntensity = debug.intensity ?? 0.5;

  const restart = () => {
    if (!window.confirm("Apagar o save e voltar para o onboarding?")) return;
    chatEngine.reset();
    gameStore.getState().resetAll();
    onClose();
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/20 p-2 backdrop-blur-sm min-[900px]:items-center min-[900px]:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
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
            onClick={onClose}
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
                  value={debug.emotion ?? ""}
                  onChange={(e) => setStage({ emotion: e.target.value ? (e.target.value as Emotion) : null })}
                >
                  <option value="">(humor real)</option>
                  {EMOTION_LIST.map((e) => (
                    <option key={e} value={e}>
                      {EXPRESSION_META[e].kaomoji} {EXPRESSION_META[e].label}
                    </option>
                  ))}
                </select>
              </label>
              <Toggle
                label="forçar intensidade"
                checked={debug.intensity !== null}
                onChange={(b) => setStage({ intensity: b ? 0.5 : null })}
              />
              {debug.intensity !== null && (
                <label className="inline-flex items-center gap-2 text-sm">
                  {debug.intensity.toFixed(2)}
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={debug.intensity}
                    onChange={(e) => setStage({ intensity: Number(e.target.value) })}
                    className="accent-pink-strong"
                  />
                </label>
              )}
              <Toggle label="falar" checked={debug.talking} onChange={(b) => setStage({ talking: b })} />
              <Toggle label="olhar pro chat" checked={debug.lookAtChat} onChange={(b) => setStage({ lookAtChat: b })} />
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="mb-2 font-display text-pink-strong">Relação ⏱ (viagem no tempo)</legend>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="squish rounded-full border-2 border-border bg-surface-2 px-3 py-1 text-sm" onClick={() => travel(3600_000)}>
                +1 h
              </button>
              <button type="button" className="squish rounded-full border-2 border-border bg-surface-2 px-3 py-1 text-sm" onClick={() => travel(24 * 3600_000)}>
                +1 dia
              </button>
              <button type="button" className="squish rounded-full border-2 border-border bg-surface-2 px-3 py-1 text-sm" onClick={() => setFixedClock(new Date())}>
                ⏸ relógio fixo
              </button>
              <button type="button" className="squish rounded-full border-2 border-border bg-surface-2 px-3 py-1 text-sm" onClick={resetClock}>
                ▶ relógio real
              </button>
              <span className="font-mono text-xs text-ink-soft">
                {clockState().fixed ? `fixo em ${clockState().fixed!.toLocaleString("pt-BR")}` : `offset: ${Math.round(clockState().offsetMs / 60000)} min`}
              </span>
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="mb-2 font-display text-pink-strong">Sentimentos e estágio 💗</legend>
            <div className="flex flex-wrap items-center gap-4">
              {(["affection", "trust", "romance"] as const).map((k) => (
                <label key={k} className="inline-flex items-center gap-2 text-sm">
                  {k}
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={relationship[k]}
                    onChange={(e) => gameStore.setState({ relationship: { ...relationship, [k]: Number(e.target.value) } })}
                    className="accent-pink-strong"
                  />
                  <span className="w-8 font-mono text-xs">{relationship[k]}</span>
                </label>
              ))}
              <label className="inline-flex items-center gap-2 text-sm">
                estágio
                <select
                  className="rounded-full border-2 border-border bg-surface-2 px-3 py-1"
                  value={relationship.stage}
                  onChange={(e) => gameStore.setState({ relationship: { ...relationship, stage: Number(e.target.value) as 0 | 1 | 2 | 3 | 4 | 5 } })}
                >
                  {[0, 1, 2, 3, 4, 5].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                declaração
                <select
                  className="rounded-full border-2 border-border bg-surface-2 px-3 py-1"
                  value={relationship.confession.state}
                  onChange={(e) =>
                    gameStore.setState({
                      relationship: {
                        ...relationship,
                        confession: { ...relationship.confession, state: e.target.value as typeof relationship.confession.state },
                      },
                    })
                  }
                >
                  {["locked", "open", "she_confessed", "cooldown", "together"].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="squish rounded-full border-2 border-border bg-surface-2 px-3 py-1 text-sm"
                onClick={() => chatUiStore.setState({ confession: { quote: "eu gosto de você… gosto de verdade.", key: Date.now() } })}
              >
                ♡ forçar cena de declaração
              </button>
              <button
                type="button"
                className="squish rounded-full border-2 border-border bg-surface-2 px-3 py-1 text-sm"
                onClick={() => toasts.stageUp("🌷", "🌷 Vocês agora são amigos!")}
              >
                ✨ forçar toast
              </button>
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="mb-2 font-display text-pink-strong">Ajustes provisórios ♡</legend>
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm">
                tema
                <select
                  className="rounded-full border-2 border-border bg-surface-2 px-3 py-1"
                  value={settings.theme}
                  onChange={(e) => setSetting({ theme: e.target.value as ThemeChoice })}
                >
                  <option value="auto">auto</option>
                  <option value="day">dia ☀</option>
                  <option value="night">noite ☾</option>
                </select>
              </label>
              <Toggle label="ler pensamentos 💭" checked={settings.readThoughts} onChange={(b) => setSetting({ readThoughts: b })} />
              <Toggle label="mostrar números" checked={settings.showNumbers} onChange={(b) => setSetting({ showNumbers: b })} />
              <button
                type="button"
                onClick={restart}
                className="squish rounded-full border-2 border-border bg-surface-2 px-3 py-1 text-sm"
              >
                ↺ recomeçar do zero
              </button>
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 font-display text-pink-strong">Último turno ✉</legend>
            {lastResponse ? (
              <pre className="max-h-64 overflow-auto rounded-[14px] border-2 border-border bg-surface-2 p-3 font-mono text-xs">
                {JSON.stringify(lastResponse, null, 2)}
              </pre>
            ) : (
              <p className="text-sm text-ink-muted">nenhuma resposta ainda nesta sessão.</p>
            )}
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
                      onClick={() => setStage({ emotion: e })}
                      aria-pressed={debug.emotion === e}
                      aria-label={`usar ${meta.label} no palco`}
                      className={`squish flex w-full flex-col items-center gap-1 rounded-[18px] border-2 bg-surface-2 px-2 pb-2 pt-5 ${
                        debug.emotion === e ? "border-pink-strong" : "border-border"
                      }`}
                    >
                      <AsciiGirl
                        emotion={e}
                        intensity={galleryIntensity}
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
