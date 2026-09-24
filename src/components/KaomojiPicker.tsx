import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { motion } from "motion/react";

export const KAOMOJI_TABS = [
  { id: "feliz", label: "feliz", items: ["(＾▽＾)", "(≧▽≦)", "٩(◕‿◕)۶", "ヽ(・∀・)ﾉ"] },
  { id: "timida", label: "tímida", items: ["(〃▽〃)", "(〃・ω・〃)", "(⁄ ⁄•⁄ω⁄•⁄ ⁄)", "(//▽//)"] },
  { id: "triste", label: "triste", items: ["(╥﹏╥)", "(｡•́︿•̀｡)", "(´；ω；`)", "(T_T)"] },
  { id: "brava", label: "brava", items: ["(｀へ´)", "(╬ Ò﹏Ó)", "(＃`Д´)", "(¬_¬)"] },
  { id: "amor", label: "amor", items: ["(♡˙︶˙♡)", "(´∀`)♡", "(◍•ᴗ•◍)❤", "(っ˘з(˘⌣˘ )"] },
  { id: "bichinhos", label: "bichinhos", items: ["(=^･ω･^=)", "ʕ•ᴥ•ʔ", "(・⊝・)", "U・ᴥ・U"] },
] as const;

type KaomojiPickerProps = {
  onPick: (kaomoji: string) => void;
  onClose: () => void;
};

/** 24 kaomojis em abas. Setas trocam de aba, Esc fecha. */
export function KaomojiPicker({ onPick, onClose }: KaomojiPickerProps) {
  const [tab, setTab] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    tabRefs.current[0]?.focus();
    const onDown = (e: PointerEvent) => {
      const trigger = (e.target as HTMLElement).closest("[data-kaomoji-trigger]");
      if (!trigger && rootRef.current && !rootRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [onClose]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
    }
  };

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = (tab + dir + KAOMOJI_TABS.length) % KAOMOJI_TABS.length;
    setTab(next);
    tabRefs.current[next]?.focus();
  };

  const current = KAOMOJI_TABS[tab];
  // Sem .kawaii-window aqui: o position: relative dela (fora de @layer) venceria o `absolute`.
  return (
    <motion.div
      ref={rootRef}
      role="dialog"
      aria-label="kaomojis"
      onKeyDown={onKeyDown}
      className="absolute bottom-[calc(100%+.5rem)] left-0 z-30 w-[min(21rem,calc(100vw-2.5rem))] rounded-kawaii border-2 border-border bg-surface-2 p-2 shadow-kawaii"
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.97 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      <div role="tablist" aria-label="categorias" className="flex flex-wrap gap-1 pb-2">
        {KAOMOJI_TABS.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`kao-tab-${t.id}`}
            aria-selected={i === tab}
            aria-controls="kao-panel"
            tabIndex={i === tab ? 0 : -1}
            onClick={() => setTab(i)}
            onKeyDown={onTabKey}
            className={`squish rounded-full border-2 px-2.5 py-0.5 text-xs ${
              i === tab ? "border-pink-strong bg-surface-2 text-ink" : "border-transparent text-ink-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div id="kao-panel" role="tabpanel" aria-labelledby={`kao-tab-${current.id}`} className="grid grid-cols-2 gap-1.5">
        {current.items.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => onPick(k)}
            className="squish rounded-[14px] border-2 border-border bg-surface-2 px-2 py-2 text-sm text-ink"
          >
            {k}
          </button>
        ))}
      </div>
    </motion.div>
  );
}
