import type { Message } from "./ChatWindow";

const CyborgIcon = () => (
  <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center" style={{background: "linear-gradient(135deg, #1D9E75, #085041)"}}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="5" width="12" height="9" rx="2" fill="#E1F5EE" />
      <circle cx="9.5" cy="9" r="1.5" fill="#1D9E75" />
      <circle cx="14.5" cy="9" r="1.5" fill="#378ADD" />
      <circle cx="9.5" cy="9" r="0.6" fill="white" />
      <circle cx="14.5" cy="9" r="0.6" fill="white" />
      <line x1="12" y1="5" x2="12" y2="2" stroke="#E1F5EE" strokeWidth="1.2" strokeLinecap="round"/>
      <circle cx="12" cy="1.5" r="1" fill="#378ADD" />
      <rect x="10.5" y="14" width="3" height="2" rx="0.5" fill="#E1F5EE" />
      <rect x="5" y="16" width="14" height="7" rx="2" fill="#E1F5EE" />
      <rect x="8" y="18" width="3" height="2" rx="0.5" fill="#1D9E75" />
      <rect x="13" y="18" width="3" height="2" rx="0.5" fill="#378ADD" />
      <circle cx="5" cy="17" r="1.5" fill="#1D9E75" />
      <circle cx="19" cy="17" r="1.5" fill="#1D9E75" />
    </svg>
  </div>
);

export default function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex items-end gap-2 ${isUser ? "justify-start" : "justify-end"}`}>
      {!isUser && <CyborgIcon />}
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
