import { useLayoutEffect, useMemo, useRef } from "react";
import { AnimatePresence, useReducedMotion } from "motion/react";
import { chatEngine } from "../chat/instance";
import { buildRows } from "../chat/rows";
import type { Emotion } from "../../shared/types";
import { useChatUi } from "../store/useChatUi";
import { useGame } from "../store/useGame";
import { DaySeparator } from "./DaySeparator";
import { ErrorBubble } from "./ErrorBubble";
import { HanaBubble, UserBubble } from "./MessageBubble";
import { SceneCaption } from "./SceneCaption";
import { TypingIndicator } from "./TypingIndicator";

/** Perto do fim da lista: mensagens novas rolam sozinhas. */
const STICK_PX = 96;

/** A conversa: separadores de dia, cenas, bolhas, "digitando…" e o balão de erro. */
export function MessageList() {
  const messages = useGame((s) => s.messages);
  const readThoughts = useGame((s) => s.settings.readThoughts);
  const typing = useChatUi((s) => s.typing);
  const error = useChatUi((s) => s.error);
  const reduce = useReducedMotion() ?? false;

  const rows = useMemo(() => buildRows(messages), [messages]);
  // Só o que chega depois da montagem anima (recarregar não "digita" tudo de novo).
  const firstNewId = useRef<number | null>(null);
  if (firstNewId.current === null) firstNewId.current = (messages.at(-1)?.id ?? 0) + 1;
  const isNew = (id: number) => id >= (firstNewId.current ?? 0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const mounted = useRef(false);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const lastIsUser = messages.at(-1)?.role === "user";
    if (!mounted.current || stick.current || lastIsUser) {
      el.scrollTo({ top: el.scrollHeight, behavior: mounted.current && !reduce ? "smooth" : "auto" });
    }
    mounted.current = true;
  }, [messages, typing, error, readThoughts, reduce]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_PX;
  };

  let prevHanaEmotion: Emotion | null = null;

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className="chat-scroll min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-2 min-[900px]:px-5"
      role="log"
      aria-live="polite"
      aria-label="conversa com a Hana"
      tabIndex={0}
    >
      {messages.length === 0 && !typing && (
        <p className="grid h-full place-items-center text-center text-ink-muted">
          <span>
            <span className="block text-2xl" aria-hidden="true">(－_－) zZz</span>
            nenhuma mensagem ainda… ✿
          </span>
        </p>
      )}
      <ol className="flex flex-col gap-1">
        {rows.map((row) => {
          if (row.kind === "day") {
            prevHanaEmotion = null;
            return <DaySeparator key={row.key} label={row.label} />;
          }
          if (row.kind === "gap") {
            prevHanaEmotion = null;
            return (
              <li key={row.key}>
                <SceneCaption text={row.text} typewriter={isNew(row.msgId)} />
              </li>
            );
          }
          const { msg, first, last } = row;
          if (msg.role === "scene") {
            prevHanaEmotion = null;
            return (
              <li key={row.key}>
                <SceneCaption text={msg.text} typewriter={isNew(msg.id)} />
              </li>
            );
          }
          if (msg.role === "user") {
            prevHanaEmotion = null;
            return <UserBubble key={row.key} msg={msg} first={first} last={last} isNew={isNew(msg.id)} />;
          }
          const showAvatar = first || msg.emotion !== prevHanaEmotion;
          prevHanaEmotion = msg.emotion;
          return (
            <HanaBubble
              key={row.key}
              msg={msg}
              first={first}
              showAvatar={showAvatar}
              showThought={readThoughts}
              isNew={isNew(msg.id)}
            />
          );
        })}
      </ol>
      <AnimatePresence>
        {typing && <TypingIndicator key="typing" />}
        {error && !typing && <ErrorBubble key="error" message={error.message} onRetry={chatEngine.retry} />}
      </AnimatePresence>
    </div>
  );
}
