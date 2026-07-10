"use client";
import { useState, useEffect, useCallback, type ReactNode } from "react";

type Tab = "conversations" | "contacts" | "leads" | "knowledge";

interface Session {
  id: string; channel: string; created_at: string; last_activity: string;
  last_message: string; message_count: number;
}
interface Contact { id: string; name: string; email: string; message: string; created_at: string; }
interface Lead { id: string; name?: string; email?: string; phone?: string; notes?: string; source?: string; created_at: string; }
interface Message { role: string; content: string; created_at: string; }
interface KnowledgeDoc { id: string; source: string; category: string; content: string; created_at: string; }
interface KnowledgeGroup { source: string; category: string; content: string; chunkCount: number; }

const CAT_LABEL: Record<string, string> = {
  about: "درباره", contact: "تماس", services: "خدمات", experience: "سابقه کاری",
  education: "تحصیلات", projects: "پروژه‌ها", faq: "سوالات متداول", results: "نتایج", knowledge: "دانش عمومی",
};
const SOURCE_FILES_IN_CODE = 2; // system-prompt.ts + ingest/route.ts

function groupBySource(docs: KnowledgeDoc[]): KnowledgeGroup[] {
  const bySource = new Map<string, KnowledgeDoc[]>();
  for (const d of docs) {
    if (!bySource.has(d.source)) bySource.set(d.source, []);
    bySource.get(d.source)!.push(d);
  }
  return Array.from(bySource.entries()).map(([source, chunks]) => ({
    source,
    category: chunks[0].category,
    content: chunks.map(c => c.content).join("\n\n"),
    chunkCount: chunks.length,
  }));
}

function inlineNodes(text: string, keyPrefix: string) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={`${keyPrefix}-${i}`}>{part}</strong> : <span key={`${keyPrefix}-${i}`}>{part}</span>
  );
}

function renderMd(md: string, C: Record<string, string>) {
  const lines = md.split("\n");
  const nodes: ReactNode[] = [];
  let list: string[] = [];
  const flushList = (key: string) => {
    if (list.length) {
      nodes.push(
        <ul key={key} style={{ margin: "0 0 8px", paddingInlineStart: 20, color: C.dim, fontSize: 13, lineHeight: 1.8 }}>
          {list.map((item, i) => <li key={i}>{inlineNodes(item, `${key}-li-${i}`)}</li>)}
        </ul>
      );
      list = [];
    }
  };
  lines.forEach((raw, idx) => {
    const line = raw.trim();
    const key = `l-${idx}`;
    if (/^-\s+/.test(line)) { list.push(line.replace(/^-\s+/, "")); return; }
    flushList(key + "-flush");
    if (line === "") return;
    if (/^###\s+/.test(line)) {
      nodes.push(<div key={key} style={{ color: C.blue, fontWeight: 700, fontSize: 12.5, margin: "8px 0 3px" }}>{inlineNodes(line.replace(/^###\s+/, ""), key)}</div>);
    } else if (/^##\s+/.test(line)) {
      nodes.push(<div key={key} style={{ color: C.teal, fontWeight: 800, fontSize: 13.5, margin: "10px 0 4px" }}>{inlineNodes(line.replace(/^##\s+/, ""), key)}</div>);
    } else if (/^#\s+/.test(line)) {
      nodes.push(<div key={key} style={{ color: C.mint, fontWeight: 800, fontSize: 15, margin: "0 0 6px" }}>{inlineNodes(line.replace(/^#\s+/, ""), key)}</div>);
    } else {
      nodes.push(<p key={key} style={{ margin: "0 0 6px", color: C.dim, fontSize: 13, lineHeight: 1.8 }}>{inlineNodes(line, key)}</p>);
    }
  });
  flushList("end-flush");
  return nodes;
}

const C = { bg: "#051f1a", surface: "#0a2e26", border: "rgba(29,158,117,0.2)", teal: "#1D9E75", mint: "#E1F5EE", dim: "rgba(225,245,238,0.55)", blue: "#378ADD" };

function fmt(d: string) {
  return new Date(d).toLocaleString("fa-IR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function Dashboard() {
  const [authed, setAuthed] = useState(false);
  const [pass, setPass] = useState("");
  const [passErr, setPassErr] = useState(false);
  const [tab, setTab] = useState<Tab>("conversations");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [openSession, setOpenSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [knowledgeDocs, setKnowledgeDocs] = useState<KnowledgeDoc[]>([]);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [activeCat, setActiveCat] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formSource, setFormSource] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formContent, setFormContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [deletingSource, setDeletingSource] = useState<string | null>(null);

  const token = typeof window !== "undefined" ? sessionStorage.getItem("db_token") : "";

  const apiFetch = useCallback(async (url: string) => {
    const t = sessionStorage.getItem("db_token");
    const res = await fetch(url, { headers: { Authorization: `Bearer ${t}` } });
    return res.json();
  }, []);

  const load = useCallback(async (t: Tab) => {
    setLoading(true);
    const res = await apiFetch(`/api/dashboard?type=${t}`);
    const data = res.data;
    if (t === "conversations") setSessions(data ?? []);
    if (t === "contacts") setContacts(data ?? []);
    if (t === "leads") setLeads(data ?? []);
    if (t === "knowledge") { setKnowledgeDocs(data ?? []); setSystemPrompt(res.systemPrompt ?? ""); }
    setLoading(false);
  }, [apiFetch]);

  useEffect(() => {
    if (authed) load(tab);
  }, [authed, tab, load]);

  const login = async () => {
    const res = await fetch("/api/dashboard", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pass }) });
    if (res.ok) {
      sessionStorage.setItem("db_token", pass);
      setAuthed(true);
    } else {
      setPassErr(true);
    }
  };

  const openChat = async (sid: string) => {
    if (openSession === sid) { setOpenSession(null); return; }
    setOpenSession(sid);
    const { data } = await apiFetch(`/api/dashboard?type=messages&session=${sid}`);
    setMessages(data ?? []);
  };

  const saveKnowledgeDoc = async () => {
    if (!formSource.trim() || !formCategory.trim() || !formContent.trim()) {
      setSaveError("همه فیلدها الزامی است");
      return;
    }
    setSaving(true);
    setSaveError("");
    const t = sessionStorage.getItem("db_token");
    const res = await fetch("/api/dashboard", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: JSON.stringify({ source: formSource, category: formCategory, content: formContent }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) { setSaveError(json.error ?? "خطا در ذخیره‌سازی"); return; }
    setShowAddForm(false);
    setFormSource(""); setFormCategory(""); setFormContent("");
    load("knowledge");
  };

  const deleteKnowledgeDoc = async (source: string) => {
    if (!confirm(`سند «${source}» حذف شود؟`)) return;
    setDeletingSource(source);
    const t = sessionStorage.getItem("db_token");
    await fetch("/api/dashboard", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: JSON.stringify({ source }),
    });
    setDeletingSource(null);
    load("knowledge");
  };

  if (!authed) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Vazirmatn, system-ui" }}>
      <div style={{ width: 360, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: "2.5rem 2rem" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginBottom: "2rem" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: `linear-gradient(135deg,${C.teal},#085041)`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 20px rgba(29,158,117,0.4)` }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><rect x="3" y="11" width="18" height="11" rx="2" stroke="#E1F5EE" strokeWidth="1.8"/><path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="#1D9E75" strokeWidth="1.8" strokeLinecap="round"/><circle cx="12" cy="16" r="1.5" fill="#378ADD"/></svg>
          </div>
          <div style={{ color: C.mint, fontWeight: 700, fontSize: 20 }}>Dashboard</div>
          <div style={{ color: C.dim, fontSize: 13 }}>Farid Tashayoee · AI Marketing</div>
        </div>
        <input
          type="password" placeholder="رمز دسترسی..." value={pass}
          onChange={e => { setPass(e.target.value); setPassErr(false); }}
          onKeyDown={e => e.key === "Enter" && login()}
          style={{ width: "100%", background: "rgba(8,80,65,0.4)", border: `1px solid ${passErr ? "#e05555" : C.border}`, borderRadius: 10, color: C.mint, padding: "11px 14px", fontSize: 14, outline: "none", fontFamily: "inherit", marginBottom: 12, boxSizing: "border-box" }}
          dir="ltr"
        />
        {passErr && <div style={{ color: "#e05555", fontSize: 12, marginBottom: 10, textAlign: "center" }}>رمز اشتباه است</div>}
        <button onClick={login} style={{ width: "100%", background: `linear-gradient(135deg,${C.teal},#085041)`, border: "none", borderRadius: 10, color: "#fff", padding: "11px", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
          ورود
        </button>
      </div>
    </div>
  );

  const tabs: { id: Tab; label: string; icon: string; count: number }[] = [
    { id: "conversations", label: "مکالمات", icon: "💬", count: sessions.length },
    { id: "contacts", label: "پیام‌های تماس", icon: "📩", count: contacts.length },
    { id: "leads", label: "لیدها", icon: "🎯", count: leads.length },
    { id: "knowledge", label: "دانش‌پایه", icon: "📚", count: knowledgeDocs.length },
  ];

  const categories = Array.from(new Set(knowledgeDocs.map(d => d.category)));
  const knowledgeGroups = groupBySource(knowledgeDocs);
  const visibleGroups = activeCat === "all" ? knowledgeGroups : knowledgeGroups.filter(d => d.category === activeCat);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "Vazirmatn, system-ui", direction: "rtl" }}>

      {/* Header */}
      <header style={{ background: "rgba(8,80,65,0.95)", borderBottom: `1px solid ${C.border}`, backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 1.5rem", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: C.teal, fontSize: 22 }}>📊</span>
            <span style={{ color: C.mint, fontWeight: 700, fontSize: 17 }}>داشبورد مدیریت</span>
            <span style={{ color: C.dim, fontSize: 12 }}>· Farid Tashayoee</span>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <a href="/" style={{ color: C.dim, fontSize: 13, textDecoration: "none", border: `1px solid ${C.border}`, borderRadius: 999, padding: "5px 14px" }}>← سایت</a>
            <button onClick={() => { sessionStorage.clear(); setAuthed(false); }} style={{ background: "none", border: `1px solid rgba(224,85,85,0.4)`, borderRadius: 999, color: "#e05555", padding: "5px 14px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>خروج</button>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "2rem 1.5rem" }}>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: "2rem" }}>
          {[
            { label: "کل مکالمات", value: sessions.length, color: C.teal, icon: "💬" },
            { label: "پیام‌های تماس", value: contacts.length, color: C.blue, icon: "📩" },
            { label: "لیدها", value: leads.length, color: "#9B6BE0", icon: "🎯" },
            { label: "اسناد دانش‌پایه", value: knowledgeDocs.length, color: C.teal, icon: "📚" },
          ].map(s => (
            <div key={s.label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: "1.25rem 1.5rem", display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ fontSize: 28 }}>{s.icon}</span>
              <div>
                <div style={{ color: s.color, fontSize: 28, fontWeight: 800, lineHeight: 1 }}>{s.value}</div>
                <div style={{ color: C.dim, fontSize: 13, marginTop: 2 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: "1.5rem", borderBottom: `1px solid ${C.border}`, paddingBottom: "1rem" }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              background: tab === t.id ? `rgba(29,158,117,0.15)` : "transparent",
              border: `1px solid ${tab === t.id ? C.teal : C.border}`,
              borderRadius: 10, color: tab === t.id ? C.mint : C.dim,
              padding: "8px 18px", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, fontSize: 14,
              display: "flex", alignItems: "center", gap: 7
            }}>
              <span>{t.icon}</span> {t.label}
              {t.count > 0 && <span style={{ background: tab === t.id ? C.teal : "rgba(29,158,117,0.2)", color: tab === t.id ? "#042019" : C.teal, borderRadius: 999, padding: "1px 8px", fontSize: 11, fontWeight: 700 }}>{t.count}</span>}
            </button>
          ))}
        </div>

        {loading && <div style={{ color: C.dim, textAlign: "center", padding: "3rem" }}>در حال بارگذاری...</div>}

        {/* Conversations */}
        {!loading && tab === "conversations" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {sessions.length === 0 && <div style={{ color: C.dim, textAlign: "center", padding: "3rem" }}>مکالمه‌ای یافت نشد</div>}
            {sessions.map(s => (
              <div key={s.id} style={{ background: C.surface, border: `1px solid ${openSession === s.id ? C.teal : C.border}`, borderRadius: 14, overflow: "hidden", transition: "border-color .2s" }}>
                <div onClick={() => openChat(s.id)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "1rem 1.25rem", cursor: "pointer" }}>
                  <div style={{ width: 38, height: 38, borderRadius: "50%", background: s.channel === "telegram" ? "rgba(55,138,221,0.15)" : "rgba(29,158,117,0.15)", border: `1px solid ${s.channel === "telegram" ? C.blue : C.teal}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                    {s.channel === "telegram" ? "✈️" : "🌐"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                      <span style={{ color: C.mint, fontWeight: 600, fontSize: 14 }}>{s.channel === "telegram" ? "تلگرام" : "وب‌سایت"}</span>
                      <span style={{ color: C.dim, fontSize: 11 }}>{fmt(s.last_activity)}</span>
                      <span style={{ color: C.teal, fontSize: 11, background: "rgba(29,158,117,0.1)", borderRadius: 999, padding: "1px 8px" }}>{s.message_count} پیام</span>
                    </div>
                    <div style={{ color: C.dim, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.last_message || "—"}</div>
                  </div>
                  <span style={{ color: C.dim, fontSize: 20, transform: openSession === s.id ? "rotate(90deg)" : "none", transition: "transform .2s" }}>›</span>
                </div>
                {openSession === s.id && (
                  <div style={{ borderTop: `1px solid ${C.border}`, padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: 10, maxHeight: 360, overflowY: "auto", background: "rgba(5,31,26,0.5)" }}>
                    {messages.map((m, i) => (
                      <div key={i} style={{ display: "flex", gap: 8, justifyContent: m.role === "user" ? "flex-start" : "flex-end", direction: "ltr" }}>
                        <div style={{ maxWidth: "75%", padding: "8px 14px", borderRadius: m.role === "user" ? "12px 12px 12px 3px" : "12px 12px 3px 12px", background: m.role === "user" ? "rgba(8,80,65,0.7)" : "rgba(29,158,117,0.12)", border: `1px solid ${m.role === "user" ? "rgba(8,80,65,0.5)" : "rgba(29,158,117,0.25)"}`, color: C.mint, fontSize: 13, lineHeight: 1.6, direction: "auto" as any }}>
                          {m.content}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Contacts */}
        {!loading && tab === "contacts" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {contacts.length === 0 && <div style={{ color: C.dim, textAlign: "center", padding: "3rem" }}>پیامی یافت نشد</div>}
            {contacts.map(c => (
              <div key={c.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "1.25rem 1.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: `rgba(55,138,221,0.15)`, border: `1px solid ${C.blue}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>👤</div>
                    <div>
                      <div style={{ color: C.mint, fontWeight: 600, fontSize: 15 }}>{c.name || "—"}</div>
                      <div style={{ color: C.blue, fontSize: 12 }}>{c.email || "—"}</div>
                    </div>
                  </div>
                  <span style={{ color: C.dim, fontSize: 12 }}>{fmt(c.created_at)}</span>
                </div>
                <div style={{ color: C.dim, fontSize: 13, lineHeight: 1.7, borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>{c.message}</div>
              </div>
            ))}
          </div>
        )}

        {/* Leads */}
        {!loading && tab === "leads" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {leads.length === 0 && <div style={{ color: C.dim, textAlign: "center", padding: "3rem" }}>لیدی یافت نشد</div>}
            {leads.map(l => (
              <div key={l.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "1.25rem 1.5rem", display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(155,107,224,0.15)", border: "1px solid #9B6BE0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>🎯</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    {l.name && <span style={{ color: C.mint, fontWeight: 600, fontSize: 14 }}>{l.name}</span>}
                    {l.email && <span style={{ color: C.blue, fontSize: 13 }}>{l.email}</span>}
                    {l.phone && <span style={{ color: C.teal, fontSize: 13 }}>{l.phone}</span>}
                    {l.source && <span style={{ background: "rgba(155,107,224,0.15)", color: "#9B6BE0", borderRadius: 999, padding: "2px 10px", fontSize: 11 }}>{l.source}</span>}
                  </div>
                  {l.notes && <div style={{ color: C.dim, fontSize: 12, marginTop: 4 }}>{l.notes}</div>}
                </div>
                <span style={{ color: C.dim, fontSize: 12, flexShrink: 0 }}>{fmt(l.created_at)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Knowledge base */}
        {!loading && tab === "knowledge" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: "1.25rem 1.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 16 }}>🧠</span>
                <span style={{ color: C.mint, fontWeight: 700, fontSize: 14 }}>خلاصهٔ System Prompt</span>
                <span style={{ color: C.dim, fontSize: 11, fontFamily: "monospace", direction: "ltr" }}>system-prompt.ts</span>
              </div>
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10, maxHeight: 260, overflowY: "auto" }}>
                {systemPrompt ? renderMd(systemPrompt, C) : <div style={{ color: C.dim, fontSize: 13 }}>در حال بارگذاری...</div>}
              </div>
            </div>

            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: C.mint, fontWeight: 700, fontSize: 14 }}>📚 کتابخانهٔ کامل RAG</span>
                  <span style={{ color: C.dim, fontSize: 11, fontFamily: "monospace", direction: "ltr" }}>documents (Supabase)</span>
                </div>
                <button onClick={() => { setShowAddForm(v => !v); setSaveError(""); }} style={{
                  background: showAddForm ? "transparent" : C.teal, color: showAddForm ? C.dim : "#042019",
                  border: `1px solid ${showAddForm ? C.border : C.teal}`, borderRadius: 10, padding: "7px 16px",
                  fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                }}>{showAddForm ? "بستن ✕" : "+ افزودن سند جدید"}</button>
              </div>

              {/* mini stats */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 16 }}>
                {[
                  { label: "سند منبع (RAG)", value: knowledgeGroups.length },
                  { label: "Chunk ایندکس‌شده در Supabase", value: knowledgeDocs.length },
                  { label: "دسته‌بندی", value: categories.length },
                  { label: "فایل منبع در کد", value: SOURCE_FILES_IN_CODE },
                ].map(s => (
                  <div key={s.label} style={{ background: "rgba(29,158,117,0.06)", border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 12px" }}>
                    <div style={{ color: C.teal, fontSize: 20, fontWeight: 800 }}>{s.value}</div>
                    <div style={{ color: C.dim, fontSize: 11, marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {showAddForm && (
                <div style={{ background: C.surface, border: `1px solid ${C.teal}`, borderRadius: 14, padding: "1.1rem 1.35rem", marginBottom: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                  <input
                    placeholder="عنوان سند (مثلاً: خدمات طراحی وب)" value={formSource}
                    onChange={e => setFormSource(e.target.value)}
                    style={{ background: "rgba(8,80,65,0.3)", border: `1px solid ${C.border}`, borderRadius: 8, color: C.mint, padding: "9px 12px", fontSize: 13, outline: "none", fontFamily: "inherit" }}
                  />
                  <input
                    placeholder="دسته‌بندی (مثلاً: services)" value={formCategory}
                    onChange={e => setFormCategory(e.target.value)}
                    list="cat-suggestions"
                    style={{ background: "rgba(8,80,65,0.3)", border: `1px solid ${C.border}`, borderRadius: 8, color: C.mint, padding: "9px 12px", fontSize: 13, outline: "none", fontFamily: "inherit" }}
                  />
                  <datalist id="cat-suggestions">
                    {categories.map(cat => <option key={cat} value={cat} />)}
                  </datalist>
                  <textarea
                    placeholder="متن کامل سند (می‌تونی از # و ## برای تیتر و - برای لیست استفاده کنی)" value={formContent}
                    onChange={e => setFormContent(e.target.value)}
                    rows={8}
                    style={{ background: "rgba(8,80,65,0.3)", border: `1px solid ${C.border}`, borderRadius: 8, color: C.mint, padding: "9px 12px", fontSize: 13, outline: "none", fontFamily: "inherit", resize: "vertical" }}
                  />
                  {saveError && <div style={{ color: "#e05555", fontSize: 12 }}>{saveError}</div>}
                  <button onClick={saveKnowledgeDoc} disabled={saving} style={{
                    background: C.teal, color: "#042019", border: "none", borderRadius: 8, padding: "10px",
                    fontWeight: 700, fontSize: 13, cursor: saving ? "default" : "pointer", fontFamily: "inherit", opacity: saving ? 0.6 : 1,
                  }}>{saving ? "در حال ایندکس‌کردن..." : "ذخیره و ایندکس در RAG"}</button>
                </div>
              )}

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                <button onClick={() => setActiveCat("all")} style={{
                  background: activeCat === "all" ? C.teal : "transparent", color: activeCat === "all" ? "#042019" : C.dim,
                  border: `1px solid ${activeCat === "all" ? C.teal : C.border}`, borderRadius: 999, padding: "5px 14px",
                  fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                }}>همه ({knowledgeGroups.length})</button>
                {categories.map(cat => (
                  <button key={cat} onClick={() => setActiveCat(cat)} style={{
                    background: activeCat === cat ? C.teal : "transparent", color: activeCat === cat ? "#042019" : C.dim,
                    border: `1px solid ${activeCat === cat ? C.teal : C.border}`, borderRadius: 999, padding: "5px 14px",
                    fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                  }}>{CAT_LABEL[cat] ?? cat} ({knowledgeGroups.filter(d => d.category === cat).length})</button>
                ))}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {knowledgeGroups.length === 0 && <div style={{ color: C.dim, textAlign: "center", padding: "3rem" }}>سندی یافت نشد</div>}
                {visibleGroups.map(doc => (
                  <div key={doc.source} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "1.1rem 1.35rem" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${C.border}` }}>
                      <span style={{ color: C.mint, fontWeight: 700, fontSize: 13.5 }}>{doc.source}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                        <span style={{ background: "rgba(29,158,117,0.12)", color: C.teal, borderRadius: 999, padding: "2px 10px", fontSize: 10.5, fontFamily: "monospace" }}>{doc.category}</span>
                        <span style={{ color: C.dim, fontSize: 10.5 }}>{doc.chunkCount} chunk</span>
                        <button
                          onClick={() => deleteKnowledgeDoc(doc.source)}
                          disabled={deletingSource === doc.source}
                          style={{ background: "none", border: "1px solid rgba(224,85,85,0.4)", borderRadius: 8, color: "#e05555", padding: "3px 10px", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}
                        >
                          {deletingSource === doc.source ? "..." : "حذف"}
                        </button>
                      </div>
                    </div>
                    {renderMd(doc.content, C)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
