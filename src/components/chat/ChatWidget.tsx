"use client";
import { useState, useEffect } from "react";
import ChatWindow from "./ChatWindow";

const NOTIF_TEXT: Record<string, string> = {
  fa: "سلام! 👋 آنلاینم، سوالی داری؟",
  en: "Hi! 👋 I'm online — got a question?",
  fr: "Bonjour! 👋 Je suis en ligne, une question?",
};

const CyborgFace = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
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
);

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [lang, setLang] = useState("en");

  useEffect(() => {
    const getLang = () => {
      try { return localStorage.getItem("ft_lang") || "en"; } catch { return "en"; }
    };
    setLang(getLang());

    // sync if user switches language
    const onStorage = () => setLang(getLang());
    window.addEventListener("storage", onStorage);

    const timer = setTimeout(() => setShowNotif(true), 2500);
    return () => { clearTimeout(timer); window.removeEventListener("storage", onStorage); };
  }, []);

  const handleOpen = () => {
    setOpen(true);
    setShowNotif(false);
  };

  return (
    <>
      {/* Notification popup */}
      {showNotif && !open && (
        <div
          className="fixed bottom-24 left-6 z-50 flex items-end gap-2 cursor-pointer animate-bounce-in"
          onClick={handleOpen}
          style={{animation: "slideUp 0.4s ease-out"}}
        >
          <div
            className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center shadow-lg"
            style={{background: "linear-gradient(135deg, #1D9E75, #085041)"}}
          >
            <CyborgFace />
          </div>
          <div className="relative bg-white text-gray-800 text-sm px-4 py-2 rounded-2xl rounded-bl-sm shadow-xl max-w-[200px] font-medium"
            style={{fontFamily: "Vazirmatn, sans-serif"}}>
            {NOTIF_TEXT[lang] ?? NOTIF_TEXT.en}
            <button
              onClick={(e) => { e.stopPropagation(); setShowNotif(false); }}
              className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-gray-200 text-gray-500 text-xs flex items-center justify-center hover:bg-gray-300"
            >×</button>
          </div>
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => { setOpen((v) => !v); setShowNotif(false); }}
        className="fixed bottom-6 left-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110"
        style={{background: "linear-gradient(135deg, #1D9E75, #085041)"}}
        aria-label="باز کردن چت"
      >
        {open ? (
          <svg width="22" height="22" fill="none" stroke="#E1F5EE" strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        ) : (
          <CyborgFace />
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 left-6 z-50 w-80 sm:w-96">
          <ChatWindow onClose={() => setOpen(false)} />
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
