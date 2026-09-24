import { Window } from "./Window";

/** Janela ✉ chat.exe. A conversa de verdade chega na fase 4. */
export function ChatWindow() {
  return (
    <Window title="✉ chat.exe" stickers={["♡", "✿"]} className="min-h-[50dvh] min-[900px]:min-h-0">
      <div className="grid h-full place-items-center p-6 text-center text-ink-soft">
        <p>
          <span className="block text-2xl" aria-hidden="true">(・ω・)</span>
          nenhuma mensagem ainda… ✿
        </p>
      </div>
    </Window>
  );
}
