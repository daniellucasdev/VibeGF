import { useShallow } from "zustand/react/shallow";
import { activityNow } from "../../shared/dailyLife";
import { AsciiGirl } from "../ascii/AsciiGirl";
import { displayMood } from "../chat/request";
import { useNow } from "../hooks/useNow";
import { useChatUi } from "../store/useChatUi";
import { useGame } from "../store/useGame";
import { MoodBadge } from "./MoodBadge";
import { NextStageHearts, StageBadge } from "./StageBadge";
import { StatBars } from "./StatBars";
import { Window } from "./Window";

/** Janela ♡ hana.exe: a Hana em ASCII, humor, estágio, rotina e barras. */
export function CharacterPanel() {
  const relationship = useGame((s) => s.relationship);
  const showNumbers = useGame((s) => s.settings.showNumbers);
  const { talking, composing, lastDeltas, debug } = useChatUi(
    useShallow((s) => ({ talking: s.talking, composing: s.composing, lastDeltas: s.lastDeltas, debug: s.debug })),
  );
  const clock = useNow(30_000);
  const mood = displayMood({ relationship }, clock);
  const emotion = debug.emotion ?? mood.emotion;
  const intensity = debug.intensity ?? mood.intensity;
  const activity = activityNow(clock);

  return (
    <Window title="♡ hana.exe" stickers={["✿", "♡"]} bodyClassName="overflow-x-hidden overflow-y-auto">
      <div className="flex flex-col items-center gap-3 px-4 pb-5 pt-6">
        <div className="max-w-full px-2 pt-6">
          <AsciiGirl
            emotion={emotion}
            intensity={intensity}
            talking={talking || debug.talking}
            lookAtChat={composing || debug.lookAtChat}
            stage={relationship.stage}
          />
        </div>
        <h3 className="font-display text-xl text-pink-strong">Hana Mizuki</h3>
        <p className="text-sm text-ink-soft" title="o que ela está fazendo agora">
          {activity.status}
        </p>
        <MoodBadge emotion={emotion} />
        <StageBadge stage={relationship.stage} />
        <div className="w-full max-w-[340px] pt-2">
          <StatBars feelings={relationship} stage={relationship.stage} showNumbers={showNumbers} lastDeltas={lastDeltas} />
        </div>
        <div className="w-full max-w-[340px] pt-1">
          <NextStageHearts relationship={relationship} />
        </div>
      </div>
    </Window>
  );
}
