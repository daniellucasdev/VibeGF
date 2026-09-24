import { ChatInput } from "./ChatInput";
import { MessageList } from "./MessageList";
import { Window } from "./Window";

/** Janela ✉ chat.exe: a conversa ocupa toda a altura e o input fica embaixo. */
export function ChatWindow() {
  return (
    <Window
      title="✉ chat.exe"
      stickers={["♡", "✿"]}
      className="h-[78dvh] min-[900px]:h-auto"
      bodyClassName="flex flex-col"
    >
      <MessageList />
      <ChatInput />
    </Window>
  );
}
