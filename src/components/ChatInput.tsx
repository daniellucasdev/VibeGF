import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { AnimatePresence } from "motion/react";
import { Heart } from "lucide-react";
import { chatEngine } from "../chat/instance";
import { cutChars } from "../lib/text";
import { USER_MESSAGE_MAX_CHARS } from "../store/save";
import { chatUiStore, useChatUi } from "../store/useChatUi";
import { KaomojiPicker } from "./KaomojiPicker";

const COUNTER_FROM = 400;

/** Input em pílula: Enter envia, Shift+Enter quebra a linha, coração pulsa quando há texto. */
export function ChatInput() {
  const [text, setText] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const scripted = useChatUi((s) => s.scripted);
  const ref = useRef<HTMLTextAreaElement>(null);
  const ready = text.trim().length > 0 && !scripted;

  // Ela olha para o chat enquanto o usuário escreve.
  useEffect(() => {
    const composing = text.trim().length > 0;
    if (chatUiStore.getState().composing !== composing) chatUiStore.setState({ composing });
  }, [text]);
  useEffect(() => () => chatUiStore.setState({ composing: false }), []);

  // Cresce com o texto até ~5 linhas.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);

  const submit = () => {
    if (!ready) return;
    chatEngine.send(text);
    setText("");
    ref.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  const insert = (kaomoji: string) => {
    const el = ref.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    const next = cutChars(text.slice(0, start) + kaomoji + text.slice(end), USER_MESSAGE_MAX_CHARS);
    setText(next);
    setPickerOpen(false);
    requestAnimationFrame(() => {
      const caret = Math.min(next.length, start + kaomoji.length);
      el?.focus();
      el?.setSelectionRange(caret, caret);
    });
  };

  const closePicker = useCallback(() => {
    setPickerOpen(false);
    ref.current?.focus();
  }, []);

  return (
    <form
      className="flex items-end gap-2 border-t-2 border-border px-2.5 py-2.5 min-[900px]:px-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="relative">
        <button
          type="button"
          data-kaomoji-trigger
          className="round-btn squish px-2.5 text-xs"
          aria-label="escolher kaomoji"
          aria-haspopup="dialog"
          aria-expanded={pickerOpen}
          onClick={() => setPickerOpen((o) => !o)}
          disabled={scripted}
        >
          (◕‿◕)
        </button>
        <AnimatePresence>{pickerOpen && <KaomojiPicker onPick={insert} onClose={closePicker} />}</AnimatePresence>
      </div>
      <div className="chat-pill">
        <label htmlFor="chat-input" className="sr-only">
          mensagem para a Hana
        </label>
        <textarea
          id="chat-input"
          ref={ref}
          rows={1}
          maxLength={USER_MESSAGE_MAX_CHARS}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={scripted ? "…" : "Escreva algo para a Hana…"}
          disabled={scripted}
          className="chat-textarea"
        />
        {text.length >= COUNTER_FROM && (
          <span className="self-center px-1 font-mono text-[11px] text-ink-muted" aria-live="polite">
            {text.length}/{USER_MESSAGE_MAX_CHARS}
          </span>
        )}
        <button type="submit" className={`round-btn send-heart squish ${ready ? "is-ready" : ""}`} aria-label="enviar" disabled={!ready}>
          <Heart aria-hidden="true" size={19} strokeWidth={2.4} fill={ready ? "currentColor" : "none"} />
        </button>
      </div>
    </form>
  );
}
