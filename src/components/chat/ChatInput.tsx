"use client";
import { useState, type KeyboardEvent } from "react";

interface Props {
  onSend: (text: string) => void;
  disabled?: boolean;
  lang?: string;
}

const PLACEHOLDER: Record<string, string> = {
  fa: "پیام بنویسید...",
  en: "Type a message...",
  fr: "Écrivez un message...",
};

export default function ChatInput({ onSend, disabled, lang = "fa" }: Props) {
  const [value, setValue] = useState("");

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex items-end gap-2 px-3 py-3 border-t border-secondary/20 bg-primary/30">
      <textarea
        dir="auto"
        rows={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKey}
        disabled={disabled}
        placeholder={PLACEHOLDER[lang] ?? PLACEHOLDER.fa}
        className="flex-1 resize-none bg-transparent text-mint-light placeholder-mint-light/40 text-sm outline-none py-1 max-h-24"
        style={{ fontFamily: "Vazirmatn, system-ui" }}
      />
      <button
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center disabled:opacity-40 hover:bg-data-blue transition-colors shrink-0"
      >
        <svg width="16" height="16" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" />
        </svg>
      </button>
    </div>
  );
}
