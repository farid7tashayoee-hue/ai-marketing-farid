"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import type { CoreMessage } from "ai";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const WELCOME: Record<string, string> = {
  fa: "سلام! 👋 من Fredy هستم، دستیار هوشمند فرید تشیعی. هر سوالی درباره خدمات، همکاری یا بازاریابی هوش مصنوعی داری، اینجام.",
  en: "Hi! 👋 I'm Fredy, Farid Tashayoee's AI assistant. Ask me anything about his services, collaboration, or AI marketing.",
  fr: "Bonjour! 👋 Je suis Fredy, l'assistant IA de Farid Tashayoee. Posez-moi toutes vos questions sur ses services, sa collaboration ou le marketing IA.",
};

const SUBTITLE: Record<string, string> = {
  fa: "دستیار هوشمند فرید تشیعی",
  en: "Farid Tashayoee's AI Assistant",
  fr: "Assistant IA de Farid Tashayoee",
};

const PLACEHOLDER: Record<string, string> = {
  fa: "پیام بنویسید...",
  en: "Type a message...",
  fr: "Écrivez un message...",
};

const BACK: Record<string, string> = {
  fa: "بازگشت به سایت",
  en: "Back to site",
  fr: "Retour au site",
};

const ERROR_MSG: Record<string, string> = {
  fa: "متأسفم، مشکلی پیش اومد. دوباره تلاش کنید.",
  en: "Sorry, something went wrong. Please try again.",
  fr: "Désolé, une erreur est survenue. Veuillez réessayer.",
};

const CyborgIcon = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="6" y="5" width="12" height="9" rx="2" fill="#E1F5EE" />
    <circle cx="9.5" cy="9" r="1.5" fill="#1D9E75" />
    <circle cx="14.5" cy="9" r="1.5" fill="#378ADD" />
    <circle cx="9.5" cy="9" r="0.6" fill="white" />
    <circle cx="14.5" cy="9" r="0.6" fill="white" />
    <line x1="12" y1="5" x2="12" y2="2" stroke="#E1F5EE" strokeWidth="1.2" strokeLinecap="round" />
    <circle cx="12" cy="1.5" r="1" fill="#378ADD" />
    <rect x="10.5" y="14" width="3" height="2" rx="0.5" fill="#E1F5EE" />
    <rect x="5" y="16" width="14" height="7" rx="2" fill="#E1F5EE" />
    <rect x="8" y="18" width="3" height="2" rx="0.5" fill="#1D9E75" />
    <rect x="13" y="18" width="3" height="2" rx="0.5" fill="#378ADD" />
    <circle cx="5" cy="17" r="1.5" fill="#1D9E75" />
    <circle cx="19" cy="17" r="1.5" fill="#1D9E75" />
  </svg>
);

export default function ChatPage() {
  const [lang, setLang] = useState("fa");
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [value, setValue] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem("ft_lang") || document.documentElement.lang || "fa";
    setLang(stored);
    setMessages([{ id: "welcome", role: "assistant", content: WELCOME[stored] ?? WELCOME.fa }]);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const sendMessage = async () => {
    const text = value.trim();
    if (!text || isLoading) return;
    setValue("");
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId, lang }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error);
      if (data.sessionId && !sessionId) setSessionId(data.sessionId);
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: "assistant", content: data.text }]);
    } catch {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: "assistant", content: ERROR_MSG[lang] ?? ERROR_MSG.fa }]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const dir = lang === "fa" ? "rtl" : "ltr";

  return (
    <div style={{ background: "#051f1a", minHeight: "100vh", display: "flex", flexDirection: "column", fontFamily: "Vazirmatn, Plus Jakarta Sans, system-ui" }}>

      {/* Header */}
      <header style={{ background: "rgba(8,80,65,0.95)", borderBottom: "1px solid rgba(29,158,117,0.3)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 1.5rem", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg,#1D9E75,#085041)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 16px rgba(29,158,117,0.4)" }}>
              <CyborgIcon size={26} />
            </div>
            <div>
              <div style={{ color: "#E1F5EE", fontWeight: 700, fontSize: 16, lineHeight: 1.2 }}>Fredy</div>
              <div style={{ color: "#1D9E75", fontSize: 12 }}>{SUBTITLE[lang] ?? SUBTITLE.fa}</div>
            </div>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#1D9E75", boxShadow: "0 0 8px #1D9E75", marginLeft: 4 }} />
          </div>
          <Link href="/" style={{ color: "rgba(225,245,238,0.6)", fontSize: 13, textDecoration: "none", display: "flex", alignItems: "center", gap: 6, border: "1px solid rgba(29,158,117,0.3)", borderRadius: 999, padding: "6px 14px", transition: "all .2s" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#E1F5EE")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(225,245,238,0.6)")}>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
            {BACK[lang] ?? BACK.fa}
          </Link>
        </div>
      </header>

      {/* Messages */}
      <main style={{ flex: 1, overflowY: "auto", maxWidth: 900, width: "100%", margin: "0 auto", padding: "2rem 1.5rem 1rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {messages.map(msg => (
            <div key={msg.id} style={{ display: "flex", alignItems: "flex-end", gap: 10, justifyContent: msg.role === "user" ? "flex-end" : "flex-start", direction: dir }}>
              {msg.role === "assistant" && (
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#1D9E75,#085041)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <CyborgIcon size={18} />
                </div>
              )}
              <div dir="auto" style={{
                maxWidth: "70%",
                padding: "12px 16px",
                borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                background: msg.role === "user" ? "rgba(8,80,65,0.8)" : "rgba(29,158,117,0.12)",
                border: msg.role === "user" ? "1px solid rgba(8,80,65,0.5)" : "1px solid rgba(29,158,117,0.25)",
                color: "#E1F5EE",
                fontSize: 14,
                lineHeight: 1.7,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontFamily: "Vazirmatn, system-ui",
              }}>
                {msg.content}
              </div>
            </div>
          ))}

          {isLoading && (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#1D9E75,#085041)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CyborgIcon size={18} />
              </div>
              <div style={{ padding: "12px 18px", background: "rgba(29,158,117,0.12)", border: "1px solid rgba(29,158,117,0.25)", borderRadius: "18px 18px 18px 4px", display: "flex", gap: 5 }}>
                {[0, 1, 2].map(i => (
                  <span key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "#1D9E75", display: "inline-block", animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </main>

      {/* Input */}
      <div style={{ borderTop: "1px solid rgba(29,158,117,0.2)", background: "rgba(5,31,26,0.95)", backdropFilter: "blur(12px)", padding: "1rem 1.5rem", position: "sticky", bottom: 0 }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", gap: 10, alignItems: "flex-end" }}>
          <textarea
            ref={inputRef}
            dir="auto"
            rows={1}
            value={value}
            onChange={e => { setValue(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
            onKeyDown={handleKey}
            disabled={isLoading}
            placeholder={PLACEHOLDER[lang] ?? PLACEHOLDER.fa}
            style={{
              flex: 1, resize: "none", background: "rgba(8,80,65,0.4)", border: "1px solid rgba(29,158,117,0.3)", borderRadius: 14, color: "#E1F5EE", fontSize: 14, padding: "12px 16px", outline: "none", fontFamily: "Vazirmatn, system-ui", lineHeight: 1.6, transition: "border-color .2s", maxHeight: 120
            }}
            onFocus={e => (e.target.style.borderColor = "rgba(29,158,117,0.7)")}
            onBlur={e => (e.target.style.borderColor = "rgba(29,158,117,0.3)")}
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !value.trim()}
            style={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg,#1D9E75,#085041)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, opacity: (!value.trim() || isLoading) ? 0.4 : 1, transition: "opacity .2s, transform .15s" }}
            onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.08)")}
            onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
          >
            <svg width="18" height="18" fill="none" stroke="white" strokeWidth="2.2" viewBox="0 0 24 24">
              <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" />
            </svg>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)}
        }
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(29,158,117,0.3);border-radius:2px}
        textarea::placeholder{color:rgba(225,245,238,0.35)}
      `}</style>
    </div>
  );
}
