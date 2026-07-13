"use client";
import { useState, useEffect, useCallback, type ReactNode } from "react";

type Tab = "conversations" | "contacts" | "leads" | "knowledge" | "telegram";
type AddMode = "text" | "file" | "url";

interface Session {
  id: string; channel: string; created_at: string; last_activity: string;
  last_message: string; message_count: number;
}
interface Contact { id: string; name: string; email: string; message: string; created_at: string; }
interface Lead { id: string; name?: string; email?: string; phone?: string; notes?: string; source?: string; status?: string; created_at: string; }
interface Message { role: string; content: string; created_at: string; }
interface DocMetadata { sourceType?: string; tags?: string[]; }
interface KnowledgeDoc { id: string; source: string; category: string; content: string; metadata?: DocMetadata; created_at: string; }
interface KnowledgeGroup { source: string; category: string; content: string; chunkCount: number; metadata?: DocMetadata; }
interface TestChunk { id: string; source: string; category: string; content: string; similarity: number; }
interface ModelStat { model: string; count: number; inputTokens: number; outputTokens: number; cost: number; }
interface Stats {
  sessionCount: number; leadCount: number; unansweredCount: number; uniqueUsers: number;
  channelCounts: Record<string, number>; satisfactionRate: number | null;
  feedbackUp: number; feedbackDown: number; conversionRate: number;
  modelStats: ModelStat[]; totalCost: number;
}
interface TelegramStatus {
  webhook: { url?: string; pending_update_count?: number } | null;
  userCount: number;
}

const CAT_LABEL: Record<string, string> = {
  about: "درباره", contact: "تماس", services: "خدمات", experience: "سابقه کاری",
  education: "تحصیلات", projects: "پروژه‌ها", faq: "سوالات متداول", results: "نتایج", knowledge: "دانش عمومی",
};
const LEAD_STATUSES = ["جدید", "تماس گرفته شد", "جلسه تنظیم شد", "موفق", "منصرف"];
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
    metadata: chunks[0].metadata,
  }));
}

function csvEscape(v: string) {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map(r => r.map(csvEscape).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
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
  const [addMode, setAddMode] = useState<AddMode>("text");
  const [formUrl, setFormUrl] = useState("");
  const [formTags, setFormTags] = useState("");
  const [rebuildingSource, setRebuildingSource] = useState<string | null>(null);
  const [testQuery, setTestQuery] = useState("");
  const [testResults, setTestResults] = useState<TestChunk[] | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testError, setTestError] = useState("");

  const [leadSearch, setLeadSearch] = useState("");
  const [updatingLead, setUpdatingLead] = useState<string | null>(null);

  const [stats, setStats] = useState<Stats | null>(null);

  const [telegramStatus, setTelegramStatus] = useState<TelegramStatus | null>(null);
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [broadcastText, setBroadcastText] = useState("");
  const [broadcastResult, setBroadcastResult] = useState("");
  const [broadcastSending, setBroadcastSending] = useState(false);

  const token = typeof window !== "undefined" ? sessionStorage.getItem("db_token") : "";

  const apiFetch = useCallback(async (url: string) => {
    const t = sessionStorage.getItem("db_token");
    const res = await fetch(url, { headers: { Authorization: `Bearer ${t}` } });
    return res.json();
  }, []);

  const load = useCallback(async (t: Tab) => {
    if (t === "telegram") {
      setTelegramLoading(true);
      const res = await apiFetch(`/api/dashboard/telegram`);
      setTelegramStatus(res.error ? null : res);
      setTelegramLoading(false);
      return;
    }
    setLoading(true);
    const res = await apiFetch(`/api/dashboard?type=${t}`);
    const data = res.data;
    if (t === "conversations") setSessions(data ?? []);
    if (t === "contacts") setContacts(data ?? []);
    if (t === "leads") setLeads(data ?? []);
    if (t === "knowledge") { setKnowledgeDocs(data ?? []); setSystemPrompt(res.systemPrompt ?? ""); }
    setLoading(false);
  }, [apiFetch]);

  const loadStats = useCallback(async () => {
    const res = await apiFetch(`/api/dashboard?type=stats`);
    if (!res.error) setStats(res);
  }, [apiFetch]);

  useEffect(() => {
    if (authed) load(tab);
  }, [authed, tab, load]);

  useEffect(() => {
    if (authed) loadStats();
  }, [authed, loadStats]);

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

  const putKnowledgeDoc = async (body: Record<string, unknown>) => {
    const t = sessionStorage.getItem("db_token");
    const res = await fetch("/api/dashboard", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    return { ok: res.ok, json };
  };

  const saveKnowledgeDoc = async () => {
    if (!formSource.trim() || !formCategory.trim()) {
      setSaveError("عنوان و دسته‌بندی الزامی است");
      return;
    }
    if (addMode !== "url" && !formContent.trim()) {
      setSaveError("متن الزامی است");
      return;
    }
    if (addMode === "url" && !formUrl.trim()) {
      setSaveError("آدرس وب الزامی است");
      return;
    }
    setSaving(true);
    setSaveError("");
    const body: Record<string, unknown> = { source: formSource, category: formCategory, tags: formTags };
    if (addMode === "url") body.url = formUrl;
    else { body.content = formContent; body.sourceType = addMode; }

    const { ok, json } = await putKnowledgeDoc(body);
    setSaving(false);
    if (!ok) { setSaveError(json.error ?? "خطا در ذخیره‌سازی"); return; }
    setShowAddForm(false);
    setFormSource(""); setFormCategory(""); setFormContent(""); setFormUrl(""); setFormTags(""); setAddMode("text");
    load("knowledge");
  };

  const onFileSelected = async (file: File) => {
    const text = await file.text();
    const ext = file.name.split(".").pop()?.toLowerCase();
    const cleaned = ext === "html" || ext === "htm" ? text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : text;
    setFormContent(cleaned);
    if (!formSource.trim()) setFormSource(file.name.replace(/\.[^.]+$/, ""));
  };

  const rebuildDoc = async (doc: KnowledgeGroup) => {
    setRebuildingSource(doc.source);
    await putKnowledgeDoc({
      source: doc.source,
      category: doc.category,
      content: doc.content,
      tags: (doc.metadata?.tags ?? []).join(","),
      sourceType: doc.metadata?.sourceType,
    });
    setRebuildingSource(null);
    load("knowledge");
  };

  const runTestSearch = async () => {
    if (!testQuery.trim()) return;
    setTestLoading(true);
    setTestError("");
    const res = await apiFetch(`/api/dashboard?type=test-search&q=${encodeURIComponent(testQuery)}`);
    setTestLoading(false);
    if (res.error) { setTestError(res.error); setTestResults(null); return; }
    setTestResults(res.data ?? []);
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

  const updateLeadStatus = async (id: string, status: string) => {
    setUpdatingLead(id);
    const t = sessionStorage.getItem("db_token");
    await fetch("/api/dashboard", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: JSON.stringify({ id, status }),
    });
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l));
    setUpdatingLead(null);
  };

  const exportLeadsCsv = () => {
    const rows = [
      ["نام", "تلفن", "ایمیل", "منبع", "وضعیت", "یادداشت", "تاریخ"],
      ...leads.map(l => [l.name ?? "", l.phone ?? "", l.email ?? "", l.source ?? "", l.status ?? "", l.notes ?? "", fmt(l.created_at)]),
    ];
    downloadCsv(`leads-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  const telegramAction = async (body: Record<string, unknown>) => {
    const t = sessionStorage.getItem("db_token");
    const res = await fetch("/api/dashboard/telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: JSON.stringify(body),
    });
    return res.json();
  };

  const sendBroadcast = async () => {
    if (!broadcastText.trim()) return;
    setBroadcastSending(true);
    setBroadcastResult("");
    const res = await telegramAction({ action: "broadcast", text: broadcastText });
    setBroadcastSending(false);
    if (res.error) { setBroadcastResult(`خطا: ${res.error}`); return; }
    setBroadcastResult(`ارسال شد: ${res.sent} از ${res.total} (${res.failed} ناموفق)`);
    setBroadcastText("");
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
    { id: "telegram", label: "تلگرام", icon: "✈️", count: 0 },
  ];

  const categories = Array.from(new Set(knowledgeDocs.map(d => d.category)));
  const knowledgeGroups = groupBySource(knowledgeDocs);
  const visibleGroups = activeCat === "all" ? knowledgeGroups : knowledgeGroups.filter(d => d.category === activeCat);
  const filteredLeads = leadSearch.trim()
    ? leads.filter(l => [l.name, l.phone, l.email, l.notes].some(f => f?.toLowerCase().includes(leadSearch.trim().toLowerCase())))
    : leads;
  const maxChannelCount = stats ? Math.max(1, ...Object.values(stats.channelCounts)) : 1;
  const CHANNEL_LABEL: Record<string, string> = { web: "وب‌سایت", telegram: "تلگرام" };

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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 16 }}>
          {[
            { label: "کل مکالمات", value: sessions.length, color: C.teal, icon: "💬" },
            { label: "کاربران یکتا", value: stats?.uniqueUsers ?? "—", color: C.blue, icon: "👤" },
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: "2rem" }}>
          {[
            { label: "نرخ رضایت", value: stats?.satisfactionRate != null ? `${stats.satisfactionRate}%` : "—", color: C.teal, icon: "😊" },
            { label: "نرخ تبدیل به لید", value: stats ? `${stats.conversionRate}%` : "—", color: C.blue, icon: "📈" },
            { label: "سوالات بی‌جواب", value: stats?.unansweredCount ?? "—", color: "#e0a555", icon: "❓" },
            { label: "هزینه تخمینی", value: stats ? `$${stats.totalCost.toFixed(4)}` : "—", color: "#9B6BE0", icon: "💰" },
          ].map(s => (
            <div key={s.label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: "1.25rem 1.5rem", display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ fontSize: 28 }}>{s.icon}</span>
              <div>
                <div style={{ color: s.color, fontSize: 24, fontWeight: 800, lineHeight: 1 }}>{s.value}</div>
                <div style={{ color: C.dim, fontSize: 13, marginTop: 2 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {stats && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: "2rem" }}>
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: "1.25rem 1.5rem" }}>
              <div style={{ color: C.mint, fontWeight: 700, fontSize: 13.5, marginBottom: 12 }}>گفتگوها به تفکیک کانال</div>
              {Object.entries(stats.channelCounts).map(([ch, count]) => (
                <div key={ch} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ color: C.dim, fontSize: 12, width: 60, flexShrink: 0 }}>{CHANNEL_LABEL[ch] ?? ch}</span>
                  <div style={{ flex: 1, background: "rgba(29,158,117,0.1)", borderRadius: 999, height: 10, overflow: "hidden" }}>
                    <div style={{ width: `${(count / maxChannelCount) * 100}%`, background: C.teal, height: "100%", borderRadius: 999 }} />
                  </div>
                  <span style={{ color: C.mint, fontSize: 12, width: 24, textAlign: "left", fontVariantNumeric: "tabular-nums" }}>{count}</span>
                </div>
              ))}
            </div>
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: "1.25rem 1.5rem" }}>
              <div style={{ color: C.mint, fontWeight: 700, fontSize: 13.5, marginBottom: 12 }}>مصرف توکن و هزینه به تفکیک مدل</div>
              {stats.modelStats.length === 0 && <div style={{ color: C.dim, fontSize: 12 }}>هنوز داده‌ای ثبت نشده</div>}
              {stats.modelStats.map(m => (
                <div key={m.model} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ color: C.dim, fontFamily: "monospace", direction: "ltr" }}>{m.model}</span>
                  <span style={{ color: C.dim }}>{m.count} پاسخ</span>
                  <span style={{ color: C.teal, fontVariantNumeric: "tabular-nums" }}>${m.cost.toFixed(4)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

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
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <input
                placeholder="جستجو در نام، تلفن، ایمیل یا یادداشت..." value={leadSearch}
                onChange={e => setLeadSearch(e.target.value)}
                style={{ flex: 1, minWidth: 200, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, color: C.mint, padding: "9px 14px", fontSize: 13, outline: "none", fontFamily: "inherit" }}
              />
              <button onClick={exportLeadsCsv} style={{ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 10, color: C.dim, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                خروجی CSV
              </button>
            </div>
            {filteredLeads.length === 0 && <div style={{ color: C.dim, textAlign: "center", padding: "3rem" }}>لیدی یافت نشد</div>}
            {filteredLeads.map(l => (
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
                <select
                  value={l.status ?? "جدید"}
                  disabled={updatingLead === l.id}
                  onChange={e => updateLeadStatus(l.id, e.target.value)}
                  style={{ background: "rgba(8,80,65,0.3)", border: `1px solid ${C.border}`, borderRadius: 8, color: C.mint, padding: "6px 10px", fontSize: 12, fontFamily: "inherit", flexShrink: 0 }}
                >
                  {LEAD_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
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
                  <div style={{ display: "flex", gap: 6 }}>
                    {([["text", "متن"], ["file", "فایل"], ["url", "آدرس وب"]] as [AddMode, string][]).map(([mode, label]) => (
                      <button key={mode} onClick={() => setAddMode(mode)} style={{
                        background: addMode === mode ? "rgba(29,158,117,0.15)" : "transparent",
                        border: `1px solid ${addMode === mode ? C.teal : C.border}`, borderRadius: 8,
                        color: addMode === mode ? C.mint : C.dim, padding: "5px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                      }}>{label}</button>
                    ))}
                  </div>
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

                  {addMode === "text" && (
                    <textarea
                      placeholder="متن کامل سند (می‌تونی از # و ## برای تیتر و - برای لیست استفاده کنی)" value={formContent}
                      onChange={e => setFormContent(e.target.value)}
                      rows={8}
                      style={{ background: "rgba(8,80,65,0.3)", border: `1px solid ${C.border}`, borderRadius: 8, color: C.mint, padding: "9px 12px", fontSize: 13, outline: "none", fontFamily: "inherit", resize: "vertical" }}
                    />
                  )}

                  {addMode === "file" && (
                    <div>
                      <input
                        type="file" accept=".txt,.md,.html,.htm,.csv"
                        onChange={e => { const f = e.target.files?.[0]; if (f) onFileSelected(f); }}
                        style={{ color: C.dim, fontSize: 13, fontFamily: "inherit" }}
                      />
                      {formContent && (
                        <div style={{ marginTop: 8, color: C.dim, fontSize: 11 }}>{formContent.length.toLocaleString("fa-IR")} کاراکتر خوانده شد</div>
                      )}
                    </div>
                  )}

                  {addMode === "url" && (
                    <input
                      placeholder="https://example.com/page" value={formUrl}
                      onChange={e => setFormUrl(e.target.value)}
                      dir="ltr"
                      style={{ background: "rgba(8,80,65,0.3)", border: `1px solid ${C.border}`, borderRadius: 8, color: C.mint, padding: "9px 12px", fontSize: 13, outline: "none", fontFamily: "inherit" }}
                    />
                  )}

                  <input
                    placeholder="برچسب‌ها (اختیاری، با ویرگول جدا کنید)" value={formTags}
                    onChange={e => setFormTags(e.target.value)}
                    style={{ background: "rgba(8,80,65,0.3)", border: `1px solid ${C.border}`, borderRadius: 8, color: C.mint, padding: "9px 12px", fontSize: 13, outline: "none", fontFamily: "inherit" }}
                  />
                  {saveError && <div style={{ color: "#e05555", fontSize: 12 }}>{saveError}</div>}
                  <button onClick={saveKnowledgeDoc} disabled={saving} style={{
                    background: C.teal, color: "#042019", border: "none", borderRadius: 8, padding: "10px",
                    fontWeight: 700, fontSize: 13, cursor: saving ? "default" : "pointer", fontFamily: "inherit", opacity: saving ? 0.6 : 1,
                  }}>{saving ? "در حال ایندکس‌کردن..." : "افزودن و ایندکس"}</button>
                </div>
              )}

              <div style={{ background: "rgba(29,158,117,0.05)", border: `1px dashed ${C.border}`, borderRadius: 14, padding: "1rem 1.25rem", marginBottom: 14 }}>
                <div style={{ color: C.mint, fontWeight: 700, fontSize: 13, marginBottom: 8 }}>🔍 جست‌وجوی آزمایشی</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    placeholder="یک سوال آزمایشی بنویسید تا chunk‌های بازیابی‌شده را ببینید..." value={testQuery}
                    onChange={e => setTestQuery(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && runTestSearch()}
                    style={{ flex: 1, background: "rgba(8,80,65,0.3)", border: `1px solid ${C.border}`, borderRadius: 8, color: C.mint, padding: "8px 12px", fontSize: 13, outline: "none", fontFamily: "inherit" }}
                  />
                  <button onClick={runTestSearch} disabled={testLoading} style={{
                    background: C.teal, color: "#042019", border: "none", borderRadius: 8, padding: "0 18px",
                    fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
                  }}>{testLoading ? "..." : "جست‌وجو"}</button>
                </div>
                {testError && <div style={{ color: "#e05555", fontSize: 12, marginTop: 8 }}>{testError}</div>}
                {testResults && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                    {testResults.length === 0 && <div style={{ color: C.dim, fontSize: 12 }}>نتیجه‌ای یافت نشد</div>}
                    {testResults.map(r => (
                      <div key={r.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 12px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ color: C.blue, fontSize: 11, fontWeight: 700 }}>{r.source}</span>
                          <span style={{ color: C.teal, fontSize: 11 }}>شباهت: {Math.round(r.similarity * 100)}%</span>
                        </div>
                        <div style={{ color: C.dim, fontSize: 12, lineHeight: 1.7 }}>{r.content}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

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
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${C.border}`, flexWrap: "wrap" }}>
                      <span style={{ color: C.mint, fontWeight: 700, fontSize: 13.5 }}>{doc.source}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
                        {doc.metadata?.sourceType && <span style={{ background: "rgba(55,138,221,0.12)", color: C.blue, borderRadius: 999, padding: "2px 10px", fontSize: 10.5, fontFamily: "monospace" }}>{doc.metadata.sourceType}</span>}
                        <span style={{ background: "rgba(29,158,117,0.12)", color: C.teal, borderRadius: 999, padding: "2px 10px", fontSize: 10.5, fontFamily: "monospace" }}>{doc.category}</span>
                        {(doc.metadata?.tags ?? []).map(tag => (
                          <span key={tag} style={{ background: "rgba(155,107,224,0.12)", color: "#9B6BE0", borderRadius: 999, padding: "2px 10px", fontSize: 10.5 }}>{tag}</span>
                        ))}
                        <span style={{ color: C.dim, fontSize: 10.5 }}>{doc.chunkCount} قطعه</span>
                        <button
                          onClick={() => rebuildDoc(doc)}
                          disabled={rebuildingSource === doc.source}
                          style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 8, color: C.dim, padding: "3px 10px", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}
                        >
                          {rebuildingSource === doc.source ? "..." : "بازسازی"}
                        </button>
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

        {/* Telegram */}
        {!loading && tab === "telegram" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: "1.25rem 1.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <span style={{ color: C.mint, fontWeight: 700, fontSize: 14 }}>✈️ وضعیت بات تلگرام</span>
                <button onClick={() => load("telegram")} disabled={telegramLoading} style={{ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 8, color: C.dim, padding: "5px 14px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                  {telegramLoading ? "..." : "تازه‌سازی"}
                </button>
              </div>
              {telegramLoading && !telegramStatus && <div style={{ color: C.dim, fontSize: 13 }}>در حال بارگذاری...</div>}
              {telegramStatus && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <span style={{ color: C.dim, width: 140, flexShrink: 0 }}>وضعیت Webhook:</span>
                    <span style={{ color: telegramStatus.webhook?.url ? C.teal : "#e05555" }}>{telegramStatus.webhook?.url ? "✅ فعال" : "❌ تنظیم نشده"}</span>
                  </div>
                  {telegramStatus.webhook?.url && (
                    <div style={{ display: "flex", gap: 8 }}>
                      <span style={{ color: C.dim, width: 140, flexShrink: 0 }}>آدرس Webhook:</span>
                      <span style={{ color: C.mint, fontFamily: "monospace", fontSize: 11, direction: "ltr", wordBreak: "break-all" }}>{telegramStatus.webhook.url}</span>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8 }}>
                    <span style={{ color: C.dim, width: 140, flexShrink: 0 }}>پیام‌های در صف:</span>
                    <span style={{ color: C.mint }}>{telegramStatus.webhook?.pending_update_count ?? 0}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <span style={{ color: C.dim, width: 140, flexShrink: 0 }}>کاربران تلگرام:</span>
                    <span style={{ color: C.mint }}>{telegramStatus.userCount}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button onClick={async () => { await telegramAction({ action: "set-webhook" }); load("telegram"); }} style={{ background: C.teal, color: "#042019", border: "none", borderRadius: 8, padding: "8px 16px", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>تنظیم دوباره Webhook</button>
                    <button onClick={async () => { await telegramAction({ action: "delete-webhook" }); load("telegram"); }} style={{ background: "none", border: "1px solid rgba(224,85,85,0.4)", borderRadius: 8, color: "#e05555", padding: "8px 16px", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>حذف Webhook</button>
                  </div>
                </div>
              )}
            </div>

            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: "1.25rem 1.5rem" }}>
              <div style={{ color: C.mint, fontWeight: 700, fontSize: 14, marginBottom: 10 }}>📢 پیام همگانی (Broadcast)</div>
              <textarea
                placeholder="پیامی که می‌خواهید برای همه‌ی کاربران تلگرام ارسال شود..." value={broadcastText}
                onChange={e => setBroadcastText(e.target.value)}
                rows={4}
                style={{ width: "100%", background: "rgba(8,80,65,0.3)", border: `1px solid ${C.border}`, borderRadius: 8, color: C.mint, padding: "9px 12px", fontSize: 13, outline: "none", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }}
              />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
                <span style={{ color: C.dim, fontSize: 12 }}>{telegramStatus?.userCount ?? 0} گیرنده</span>
                <button onClick={sendBroadcast} disabled={broadcastSending || !broadcastText.trim()} style={{
                  background: C.teal, color: "#042019", border: "none", borderRadius: 8, padding: "8px 18px",
                  fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", opacity: broadcastSending ? 0.6 : 1,
                }}>{broadcastSending ? "در حال ارسال..." : "ارسال به همه"}</button>
              </div>
              {broadcastResult && <div style={{ color: C.dim, fontSize: 12, marginTop: 8 }}>{broadcastResult}</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
