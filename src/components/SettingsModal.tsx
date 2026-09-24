// Ajustes (seção 10): perfil, ritmo, tema, som, movimento, pensamentos,
// números, silêncio, exportar/importar save e apagar tudo.
import { useRef, useState } from "react";
import { motion } from "motion/react";
import { useShallow } from "zustand/react/shallow";
import type { PaceKey } from "../../shared/types";
import { PACE } from "../../shared/stages";
import { chatEngine } from "../chat/instance";
import type { ThemeChoice } from "../store/save";
import { gameStore, useGame } from "../store/useGame";

type SettingsModalProps = { open: boolean; onClose: () => void };

const selectCls = "rounded-full border-2 border-border bg-surface-2 px-3 py-1 text-sm";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (b: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-1.5 text-sm">
      <span>{label}</span>
      <input type="checkbox" className="size-4 accent-pink-strong" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { profile, settings } = useGame(useShallow((s) => ({ profile: s.profile, settings: s.settings })));
  const updateSettings = useGame((s) => s.updateSettings);
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmWipe, setConfirmWipe] = useState(false);

  const setProfile = (patch: Partial<NonNullable<typeof profile>>) => {
    if (!profile) return;
    gameStore.setState({ profile: { ...profile, ...patch } });
  };

  const exportSave = () => {
    const blob = new Blob([JSON.stringify({ app: "kokoro", version: 1, save: gameStore.getState() }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `kokoro-save-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importSave = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      if (data?.app !== "kokoro" || !data.save) throw new Error("arquivo inválido");
      localStorage.setItem("kokoro-save", JSON.stringify({ state: data.save, version: 1 }));
      window.location.reload();
    } catch (e) {
      window.alert("não consegui ler esse save 😢 (arquivo inválido?)");
    }
  };

  const wipe = () => {
    if (!confirmWipe) {
      setConfirmWipe(true);
      setTimeout(() => setConfirmWipe(false), 6000);
      return;
    }
    chatEngine.reset();
    gameStore.getState().resetAll();
    onClose();
  };

  return (
    <motion.div
      className="fixed inset-0 z-40 flex items-end justify-center bg-ink/20 backdrop-blur-sm min-[900px]:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="ajustes"
      initial={false}
      animate={{ opacity: open ? 1 : 0 }}
      style={{ pointerEvents: open ? "auto" : "none" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.section
        className="kawaii-window flex max-h-[88dvh] w-full max-w-[520px] flex-col"
        initial={false}
        animate={{ y: open ? 0 : 40, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.26, ease: "easeOut" }}
      >
        <header className="kawaii-titlebar">
          <h2 className="font-normal">⚙ ajustes.exe</h2>
          <button type="button" onClick={onClose} aria-label="fechar ajustes" className="squish grid size-7 place-items-center rounded-full border-2 border-border bg-surface-2 text-xs text-pink-strong">
            ✕
          </button>
        </header>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
          <fieldset>
            <legend className="mb-1 font-display text-pink-strong">Você ♡</legend>
            <Row label="nome">
              <input
                className={`${selectCls} w-40`}
                value={profile?.name ?? ""}
                maxLength={20}
                onChange={(e) => setProfile({ name: e.target.value })}
              />
            </Row>
            <Row label="pronomes">
              <select className={selectCls} value={profile?.pronouns ?? "ele"} onChange={(e) => setProfile({ pronouns: e.target.value as "ele" | "ela" | "elu" })}>
                <option value="ele">ele</option>
                <option value="ela">ela</option>
                <option value="elu">elu</option>
              </select>
            </Row>
            <Row label="honorífico">
              <select className={selectCls} value={profile?.honorific ?? "kun"} onChange={(e) => setProfile({ honorific: e.target.value as "kun" | "chan" | "none" })}>
                <option value="kun">-kun</option>
                <option value="chan">-chan</option>
                <option value="none">só o nome</option>
              </select>
            </Row>
          </fieldset>

          <fieldset>
            <legend className="mb-1 font-display text-pink-strong">Aparência ✿</legend>
            <Row label="tema">
              <select className={selectCls} value={settings.theme} onChange={(e) => updateSettings({ theme: e.target.value as ThemeChoice })}>
                <option value="auto">auto</option>
                <option value="day">dia ☀</option>
                <option value="night">noite ☾</option>
              </select>
            </Row>
            <Check label="som 🔊" checked={settings.sound} onChange={(b) => updateSettings({ sound: b })} />
            <Check label="reduzir animações" checked={settings.reduceMotion} onChange={(b) => updateSettings({ reduceMotion: b })} />
          </fieldset>

          <fieldset>
            <legend className="mb-1 font-display text-pink-strong">Jogo 💗</legend>
            <Row label="ritmo do romance">
              <select className={selectCls} value={settings.pace} onChange={(e) => updateSettings({ pace: e.target.value as PaceKey })}>
                {(Object.keys(PACE) as PaceKey[]).map((k) => (
                  <option key={k} value={k}>{PACE[k].label}</option>
                ))}
              </select>
            </Row>
            <Check label="ler pensamentos 💭 (spoiler!)" checked={settings.readThoughts} onChange={(b) => updateSettings({ readThoughts: b })} />
            <Check label="mostrar números das barras" checked={settings.showNumbers} onChange={(b) => updateSettings({ showNumbers: b })} />
            <Check label="mensagem de silêncio dela" checked={settings.idleNudge} onChange={(b) => updateSettings({ idleNudge: b })} />
          </fieldset>

          <fieldset>
            <legend className="mb-1 font-display text-pink-strong">Save ✎</legend>
            <div className="flex flex-wrap gap-2 py-1">
              <button type="button" onClick={exportSave} className="squish rounded-full border-2 border-border bg-surface-2 px-3 py-1 text-sm">
                ⬇ exportar
              </button>
              <button type="button" onClick={() => fileRef.current?.click()} className="squish rounded-full border-2 border-border bg-surface-2 px-3 py-1 text-sm">
                ⬆ importar
              </button>
              <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && void importSave(e.target.files[0])} />
              <button
                type="button"
                onClick={wipe}
                className={`squish rounded-full border-2 px-3 py-1 text-sm ${confirmWipe ? "border-pink-strong bg-pink/30 text-pink-strong" : "border-border bg-surface-2"}`}
              >
                {confirmWipe ? "Tem certeza? A Hana vai esquecer você… (╥﹏╥)" : "✕ apagar tudo"}
              </button>
            </div>
          </fieldset>
        </div>
      </motion.section>
    </motion.div>
  );
}
