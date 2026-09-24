import { motion } from "motion/react";
import { EXPRESSION_META, type Emotion } from "../ascii/expressions";
import { splitActions } from "../chat/rows";
import { formatClock } from "../lib/format";
import type { HanaMessage, UserMessage } from "../store/save";
import { ReactionBadge } from "./ReactionBadge";
import { ThoughtCloud } from "./ThoughtCloud";

/** Avatar redondo com o kaomoji da emoção daquela mensagem. */
export function KaoAvatar({ emotion }: { emotion: Emotion }) {
  const meta = EXPRESSION_META[emotion];
  return (
    <span className="kao-avatar" role="img" aria-label={`Hana ${meta.label}`} title={meta.label}>
      {meta.kaomoji}
    </span>
  );
}

const enter = (isNew: boolean) => ({
  initial: isNew ? { opacity: 0, y: 10 } : false,
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.24, ease: "easeOut" },
}) as const;

type HanaBubbleProps = {
  msg: HanaMessage;
  /** Primeira do grupo: rabinho na bolha. */
  first: boolean;
  /** Mostra o avatar (primeira do grupo ou emoção diferente da anterior). */
  showAvatar: boolean;
  showThought: boolean;
  isNew: boolean;
};

export function HanaBubble({ msg, first, showAvatar, showThought, isNew }: HanaBubbleProps) {
  return (
    <motion.li className={`flex items-start gap-2 ${first ? "mt-2" : ""}`} {...enter(isNew)}>
      {showAvatar ? <KaoAvatar emotion={msg.emotion} /> : <span className="w-[2.9rem] shrink-0" aria-hidden="true" />}
      <div className="flex min-w-0 max-w-[80%] flex-col items-start">
        <p className={`bubble bubble-hana ${first ? "tail" : ""}`} title={formatClock(new Date(msg.at))}>
          <span className="sr-only">Hana: </span>
          {splitActions(msg.text).map((seg, i) =>
            seg.action ? (
              <em key={i} className="bubble-action">
                {seg.text}
              </em>
            ) : (
              <span key={i}>{seg.text}</span>
            ),
          )}
        </p>
        {showThought && msg.thought && <ThoughtCloud text={msg.thought} />}
      </div>
    </motion.li>
  );
}

type UserBubbleProps = { msg: UserMessage; first: boolean; last: boolean; isNew: boolean };

export function UserBubble({ msg, first, last, isNew }: UserBubbleProps) {
  return (
    <motion.li className={`flex flex-col items-end ${first ? "mt-2" : ""} ${msg.reaction ? "mb-3" : ""}`} {...enter(isNew)}>
      <p className={`bubble bubble-user max-w-[80%] ${first ? "tail" : ""}`} title={formatClock(new Date(msg.at))}>
        <span className="sr-only">Você: </span>
        {msg.text}
        <ReactionBadge reaction={msg.reaction} />
      </p>
      {last && <span className="msg-status">{msg.status === "seen" ? "✓✓ visto" : "✓ enviado"}</span>}
    </motion.li>
  );
}
