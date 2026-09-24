import type { ReactNode } from "react";

type WindowProps = {
  title: string;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Adesivos decorativos nos cantos (superior esquerdo, inferior direito). */
  stickers?: readonly [string, string];
};

/** Janela "kawaii OS": raio de 22 px, barra de título em gradiente e botõezinhos decorativos. */
export function Window({ title, children, className = "", bodyClassName = "", stickers = ["✿", "★"] }: WindowProps) {
  return (
    <section className={`kawaii-window ${className}`} aria-label={title}>
      <span className="kawaii-sticker tl" aria-hidden="true">{stickers[0]}</span>
      <header className="kawaii-titlebar">
        <h2 className="truncate text-[inherit] font-normal">{title}</h2>
        <div className="kawaii-titlebar-dots" aria-hidden="true">
          <span>♡</span>
          <span>✿</span>
          <span>✕</span>
        </div>
      </header>
      <div className={`min-h-0 flex-1 ${bodyClassName}`}>{children}</div>
      <span className="kawaii-sticker br" aria-hidden="true">{stickers[1]}</span>
    </section>
  );
}
