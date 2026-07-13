"use client";
import { useState, useRef, useEffect } from "react";
import MessageList from "./MessageList";
import ChatInput from "./ChatInput";
import TypingIndicator from "./TypingIndicator";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export default function ChatWindow({ onClose, lang = "fa" }: { onClose: () => void; lang?: string }) {
  const WELCOME: Record<string, string> = {
    fa: "سلام! 👋 من Fredy هستم، دستیار فرید. چطور می‌تونم کمکتون کنم؟",
    en: "Hi! 👋 I'm Fredy, Farid's assistant. How can I help you?",
    fr: "Bonjour! 👋 Je suis Fredy, l'assistant de Farid. Comment puis-je vous aider?",
  };

  const SUBTITLE: Record<string, string> = {
    fa: "دستیار فرید تشیعی",
    en: "Farid's AI Assistant",
    fr: "Assistant de Farid",
  };

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: WELCOME[lang] ?? WELCOME.fa,
    },
  ]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(prev =>
      prev.map(m => m.id === "welcome" ? { ...m, content: WELCOME[lang] ?? WELCOME.fa } : m)
    );
  }, [lang]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId, lang }),
      });

      const data = await res.json();

      if (!res.ok || data.error) throw new Error(data.error ?? "خطا در ارتباط با سرور");

      const newSessionId = data.sessionId ?? res.headers.get("X-Session-Id");
      if (newSessionId && !sessionId) setSessionId(newSessionId);

      setMessages((prev) => [
        ...prev,
        { id: data.messageId ?? (Date.now() + 1).toString(), role: "assistant", content: data.text },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role: "assistant", content: "متأسفم، مشکلی پیش اومد. دوباره تلاش کنید." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col rounded-2xl overflow-hidden shadow-2xl border border-secondary/30"
      style={{ background: "#0a2e26", height: "480px" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-primary">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center overflow-hidden" style={{background: "linear-gradient(135deg, #1D9E75, #085041)"}}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Head */}
              <rect x="6" y="5" width="12" height="9" rx="2" fill="#E1F5EE" />
              {/* Eyes */}
              <circle cx="9.5" cy="9" r="1.5" fill="#1D9E75" />
              <circle cx="14.5" cy="9" r="1.5" fill="#378ADD" />
              {/* Eye glow */}
              <circle cx="9.5" cy="9" r="0.6" fill="white" />
              <circle cx="14.5" cy="9" r="0.6" fill="white" />
              {/* Antenna */}
              <line x1="12" y1="5" x2="12" y2="2" stroke="#E1F5EE" strokeWidth="1.2" strokeLinecap="round"/>
              <circle cx="12" cy="1.5" r="1" fill="#378ADD" />
              {/* Neck */}
              <rect x="10.5" y="14" width="3" height="2" rx="0.5" fill="#E1F5EE" />
              {/* Body */}
              <rect x="5" y="16" width="14" height="7" rx="2" fill="#E1F5EE" />
              {/* Chest panel */}
              <rect x="8" y="18" width="3" height="2" rx="0.5" fill="#1D9E75" />
              <rect x="13" y="18" width="3" height="2" rx="0.5" fill="#378ADD" />
              {/* Shoulder joints */}
              <circle cx="5" cy="17" r="1.5" fill="#1D9E75" />
              <circle cx="19" cy="17" r="1.5" fill="#1D9E75" />
            </svg>
          </div>
          <div>
            <p className="text-mint-light text-sm font-bold">Fredy</p>
            <p className="text-secondary text-xs">{SUBTITLE[lang] ?? SUBTITLE.fa}</p>
          </div>
        </div>
        <button onClick={onClose} className="text-mint-light/60 hover:text-mint-light transition-colors">
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <MessageList messages={messages} />
        {isLoading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <ChatInput onSend={sendMessage} disabled={isLoading} lang={lang} />
    </div>
  );
}
