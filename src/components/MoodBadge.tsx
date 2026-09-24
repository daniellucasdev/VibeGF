import { EXPRESSION_META, type Emotion } from "../ascii/expressions";

/** Badge de humor: kaomoji + rótulo da emoção. */
export function MoodBadge({ emotion }: { emotion: Emotion }) {
  const meta = EXPRESSION_META[emotion];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border-2 border-border bg-surface-2 px-3 py-1 text-sm text-ink"
      aria-label={`humor: ${meta.label}`}
    >
      <span aria-hidden="true">{meta.kaomoji}</span>
      <span className="text-ink-soft">{meta.label}</span>
    </span>
  );
}
