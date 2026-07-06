import type { Message } from "./ChatWindow";

export default function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-start" : "justify-end"}`}>
      <div
        dir="auto"
        className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
          isUser
            ? "bg-primary/70 text-mint-light rounded-tr-sm"
            : "bg-secondary/20 text-mint-light rounded-tl-sm border border-secondary/30"
        }`}
      >
        {message.content || (
          <span className="opacity-40 italic text-xs">در حال تایپ...</span>
        )}
      </div>
    </div>
  );
}
