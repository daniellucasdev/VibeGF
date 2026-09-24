// Badge de estágio (8.2) e os cinco corações de progresso (8.3).
import { stageProgress, STAGES } from "../../shared/stages";
import type { PaceKey } from "../../shared/types";
import { useGame } from "../store/useGame";
import type { RelationshipState } from "../game/relationship";

export function StageBadge({ stage }: { stage: number }) {
  const s = STAGES[stage];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-border bg-surface-2 px-3 py-0.5 text-sm text-ink">
      <span aria-hidden="true">{s.icon}</span>
      <span>
        estágio {stage} · {s.name}
      </span>
    </span>
  );
}

export function NextStageHearts({ relationship }: { relationship: RelationshipState }) {
  const pace = useGame((s) => s.settings.pace) as PaceKey;
  const p = stageProgress(relationship.stage, {
    affection: relationship.affection,
    trust: relationship.trust,
    romance: relationship.romance,
    daysTalked: relationship.days.daysTalked.length,
    userMessages: relationship.userMessages,
  }, pace);

  if (relationship.stage === 5) {
    return (
      <div className="text-center text-sm text-ink-soft">
        💞 vocês estão namorando
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex gap-1" role="img" aria-label={`${p.hearts} de 5 corações para o próximo estágio`}>
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            aria-hidden="true"
            className={`text-lg leading-none transition-transform ${i < p.hearts ? "heart-full" : "heart-empty opacity-30"}`}
            style={{ transitionDelay: `${i * 40}ms` }}
          >
            ♡
          </span>
        ))}
      </div>
      <p className="text-center text-xs text-ink-soft">{p.hint}</p>
    </div>
  );
}
