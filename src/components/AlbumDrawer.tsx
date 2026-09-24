// Álbum (8.3): linha do tempo de marcos como polaroids com kaomoji, data e frase.
import { motion } from "motion/react";
import { EXPRESSION_META } from "../ascii/expressions";
import { STAGES } from "../../shared/stages";
import { useGame } from "../store/useGame";
import type { Milestone, MilestoneKind } from "../store/save";

type AlbumDrawerProps = { open: boolean; onClose: () => void };

const KIND_META: Record<MilestoneKind, { icon: string; label: string }> = {
  first_message: { icon: "✉", label: "a primeira mensagem" },
  stage_up: { icon: "✨", label: "novo estágio" },
  first_name_basis: { icon: "💬", label: "ela te chamou só pelo nome" },
  nickname: { icon: "🎀", label: "vocês combinaram um apelido" },
  inside_joke: { icon: "😂", label: "piada interna" },
  date_invite: { icon: "📅", label: "combinaram de sair" },
  fight: { icon: "💢", label: "briga" },
  made_up: { icon: "🕊", label: "pazes feitas" },
  confession_accepted: { icon: "💞", label: "a declaração" },
};

function Polaroid({ m }: { m: Milestone }) {
  const meta = KIND_META[m.kind];
  const emo = EXPRESSION_META[m.emotion];
  const d = new Date(m.at);
  const date = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const stage = STAGES[m.stage];
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 14, rotate: -1.5 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className="album-polaroid"
    >
      <div className="grid h-16 place-items-center text-3xl" aria-hidden="true">
        {m.kind === "stage_up" ? stage.icon : meta.icon}
      </div>
      <div className="mt-1 text-center font-mono text-xs text-ink-soft">{emo.kaomoji} {date}</div>
      <div className="mt-1 text-center text-xs font-medium text-ink">{meta.label}</div>
      {m.quote && (
        <p className="mt-1 line-clamp-3 text-center text-xs italic text-ink-soft">“{m.quote}”</p>
      )}
    </motion.li>
  );
}

export function AlbumDrawer({ open, onClose }: AlbumDrawerProps) {
  const milestones = useGame((s) => s.milestones);

  return (
    <motion.div
      className="fixed inset-0 z-40 flex items-end justify-center bg-ink/20 backdrop-blur-sm min-[900px]:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="álbum de memórias"
      initial={false}
      animate={{ opacity: open ? 1 : 0 }}
      style={{ pointerEvents: open ? "auto" : "none" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.section
        className="kawaii-window flex max-h-[88dvh] w-full max-w-[720px] flex-col"
        initial={false}
        animate={{ y: open ? 0 : 40, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.26, ease: "easeOut" }}
      >
        <header className="kawaii-titlebar">
          <h2 className="font-normal">📸 álbum.exe</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="fechar álbum"
            className="squish grid size-7 place-items-center rounded-full border-2 border-border bg-surface-2 text-xs text-pink-strong"
          >
            ✕
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {milestones.length === 0 ? (
            <p className="py-10 text-center text-sm text-ink-soft">
              ainda vazio… os momentos especiais aparecem aqui ✿
            </p>
          ) : (
            <ol className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
              {milestones.map((m) => (
                <Polaroid key={m.id} m={m} />
              ))}
            </ol>
          )}
        </div>
      </motion.section>
    </motion.div>
  );
}
