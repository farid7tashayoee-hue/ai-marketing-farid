import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { FARID_KNOWLEDGE } from "@/lib/agent/system-prompt";
import { indexDocument } from "@/lib/rag/indexer";
import { retrieveChunks } from "@/lib/rag/retriever";
import { authorized } from "@/lib/dashboard-auth";
import { estimateCost } from "@/lib/agent/pricing";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  if (password !== process.env.DASHBOARD_PASSWORD) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const type = new URL(req.url).searchParams.get("type");
  const db = getAdmin();

  if (type === "contacts") {
    const { data } = await db
      .from("contacts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    return NextResponse.json({ data: data ?? [] });
  }

  if (type === "leads") {
    const { data } = await db
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    return NextResponse.json({ data: data ?? [] });
  }

  if (type === "conversations") {
    const { data: sessions } = await db
      .from("sessions")
      .select("id, channel, created_at, last_activity, metadata")
      .order("last_activity", { ascending: false })
      .limit(50);

    if (!sessions?.length) return NextResponse.json({ data: [] });

    const { data: lastMsgs } = await db
      .from("messages")
      .select("session_id, role, content, created_at")
      .in("session_id", sessions.map(s => s.id))
      .eq("role", "user")
      .order("created_at", { ascending: false });

    const lastBySession: Record<string, string> = {};
    for (const m of lastMsgs ?? []) {
      if (!lastBySession[m.session_id]) lastBySession[m.session_id] = m.content;
    }

    const { data: counts } = await db
      .from("messages")
      .select("session_id")
      .in("session_id", sessions.map(s => s.id));

    const countBySession: Record<string, number> = {};
    for (const m of counts ?? []) {
      countBySession[m.session_id] = (countBySession[m.session_id] ?? 0) + 1;
    }

    const result = sessions.map(s => ({
      ...s,
      last_message: lastBySession[s.id] ?? "",
      message_count: countBySession[s.id] ?? 0,
    }));
    return NextResponse.json({ data: result });
  }

  if (type === "knowledge") {
    const { data } = await db
      .from("documents")
      .select("id, source, category, content, metadata, created_at")
      .order("category", { ascending: true })
      .order("source", { ascending: true });
    return NextResponse.json({ data: data ?? [], systemPrompt: FARID_KNOWLEDGE });
  }

  if (type === "test-search") {
    const q = new URL(req.url).searchParams.get("q");
    if (!q?.trim()) return NextResponse.json({ error: "q الزامی است" }, { status: 400 });
    try {
      const chunks = await retrieveChunks({ query: q.trim(), topK: 5 });
      return NextResponse.json({ data: chunks });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
    }
  }

  if (type === "stats") {
    const { count: sessionCount } = await db.from("sessions").select("*", { count: "exact", head: true });
    const { count: leadCount } = await db.from("leads").select("*", { count: "exact", head: true });
    const { count: unansweredCount } = await db.from("unanswered_questions").select("*", { count: "exact", head: true });

    const { data: sessionsForUsers } = await db.from("sessions").select("id, user_id, channel");
    const uniqueUsers = new Set((sessionsForUsers ?? []).map(s => s.user_id ?? s.id)).size;
    const channelCounts: Record<string, number> = {};
    for (const s of sessionsForUsers ?? []) {
      channelCounts[s.channel] = (channelCounts[s.channel] ?? 0) + 1;
    }

    const { data: feedback } = await db.from("message_feedback").select("rating");
    const up = (feedback ?? []).filter(f => f.rating === "up").length;
    const down = (feedback ?? []).filter(f => f.rating === "down").length;
    const satisfactionRate = up + down > 0 ? Math.round((up / (up + down)) * 100) : null;

    const { data: msgStats } = await db
      .from("messages")
      .select("model, input_tokens, output_tokens")
      .not("model", "is", null);

    const byModel: Record<string, { count: number; inputTokens: number; outputTokens: number }> = {};
    for (const m of msgStats ?? []) {
      const key = m.model as string;
      if (!byModel[key]) byModel[key] = { count: 0, inputTokens: 0, outputTokens: 0 };
      byModel[key].count += 1;
      byModel[key].inputTokens += m.input_tokens ?? 0;
      byModel[key].outputTokens += m.output_tokens ?? 0;
    }
    const modelStats = Object.entries(byModel).map(([model, s]) => ({
      model,
      ...s,
      cost: estimateCost(model, s.inputTokens, s.outputTokens),
    }));
    const totalCost = modelStats.reduce((sum, m) => sum + m.cost, 0);

    return NextResponse.json({
      sessionCount: sessionCount ?? 0,
      leadCount: leadCount ?? 0,
      unansweredCount: unansweredCount ?? 0,
      uniqueUsers,
      channelCounts,
      satisfactionRate,
      feedbackUp: up,
      feedbackDown: down,
      conversionRate: sessionCount ? Math.round(((leadCount ?? 0) / sessionCount) * 100) : 0,
      modelStats,
      totalCost,
    });
  }

  if (type === "messages") {
    const sid = new URL(req.url).searchParams.get("session");
    if (!sid) return NextResponse.json({ error: "session required" }, { status: 400 });
    const { data } = await db
      .from("messages")
      .select("role, content, created_at, rag_sources")
      .eq("session_id", sid)
      .order("created_at", { ascending: true });
    return NextResponse.json({ data: data ?? [] });
  }

  if (type === "feedback") {
    const { data: unanswered } = await db
      .from("unanswered_questions")
      .select("id, question, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    const { data: negative } = await db
      .from("message_feedback")
      .select("id, created_at, message_id, messages(content)")
      .eq("rating", "down")
      .order("created_at", { ascending: false })
      .limit(100);

    const negativeFeedback = (negative ?? []).map((f) => ({
      id: f.id,
      created_at: f.created_at,
      content: (f.messages as unknown as { content: string } | null)?.content ?? "",
    }));

    return NextResponse.json({ unanswered: unanswered ?? [], negativeFeedback });
  }

  return NextResponse.json({ error: "Unknown type" }, { status: 400 });
}

export async function PUT(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { source, category, content, url, tags, sourceType: sourceTypeInput } = await req.json();
  if (!source?.trim() || !category?.trim() || (!content?.trim() && !url?.trim())) {
    return NextResponse.json({ error: "source، category و content یا url الزامی است" }, { status: 400 });
  }

  let finalContent = content?.trim();
  let sourceType: "text" | "file" | "url" = sourceTypeInput === "file" ? "file" : "text";
  if (url?.trim()) {
    try {
      const res = await fetch(url.trim());
      const html = await res.text();
      finalContent = stripHtml(html);
      sourceType = "url";
    } catch (e) {
      return NextResponse.json({ error: `دریافت آدرس ناموفق بود: ${e instanceof Error ? e.message : String(e)}` }, { status: 400 });
    }
  }
  if (!finalContent) {
    return NextResponse.json({ error: "متن استخراج‌شده خالی است" }, { status: 400 });
  }

  const tagList: string[] = typeof tags === "string"
    ? tags.split(",").map((t: string) => t.trim()).filter(Boolean)
    : [];

  const db = getAdmin();
  // upsert by source: drop any existing chunks for this source before re-indexing
  await db.from("documents").delete().eq("source", source.trim());

  try {
    const chunks = await indexDocument({
      content: finalContent,
      source: source.trim(),
      category: category.trim(),
      metadata: { sourceType, tags: tagList },
    });
    return NextResponse.json({ ok: true, chunks });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { source, unansweredId } = await req.json();
  const db = getAdmin();

  if (unansweredId) {
    const { error } = await db.from("unanswered_questions").delete().eq("id", unansweredId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (!source?.trim()) return NextResponse.json({ error: "source الزامی است" }, { status: 400 });
  const { error } = await db.from("documents").delete().eq("source", source.trim());
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, status } = await req.json();
  if (!id || !status) return NextResponse.json({ error: "id و status الزامی است" }, { status: 400 });

  const db = getAdmin();
  const { error } = await db.from("leads").update({ status }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
