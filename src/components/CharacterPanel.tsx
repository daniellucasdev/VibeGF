import { AsciiGirl } from "../ascii/AsciiGirl";
import type { Emotion } from "../ascii/expressions";
import { MoodBadge } from "./MoodBadge";
import { Window } from "./Window";

type CharacterPanelProps = {
  emotion: Emotion;
  intensity: number;
  talking: boolean;
  lookAtChat: boolean;
};

/** Janela ♡ hana.exe. Status, estágio, barras e corações de progresso entram nas próximas fases. */
export function CharacterPanel({ emotion, intensity, talking, lookAtChat }: CharacterPanelProps) {
  return (
    <Window title="♡ hana.exe" stickers={["✿", "♡"]} bodyClassName="overflow-x-hidden overflow-y-auto">
      <div className="flex flex-col items-center gap-3 px-3 pb-5 pt-6">
        <div className="max-w-full px-2 pt-6">
          <AsciiGirl emotion={emotion} intensity={intensity} talking={talking} lookAtChat={lookAtChat} />
        </div>
        <h3 className="font-display text-xl text-pink-strong">Hana Mizuki</h3>
        <MoodBadge emotion={emotion} />
      </div>
    </Window>
  );
}
