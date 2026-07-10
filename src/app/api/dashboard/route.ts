import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { FARID_KNOWLEDGE } from "@/lib/agent/system-prompt";
import { indexDocument } from "@/lib/rag/indexer";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function authorized(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${process.env.DASHBOARD_PASSWORD}`;
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
      .select("id, source, category, content, created_at")
      .order("category", { ascending: true })
      .order("source", { ascending: true });
    return NextResponse.json({ data: data ?? [], systemPrompt: FARID_KNOWLEDGE });
  }

  if (type === "messages") {
    const sid = new URL(req.url).searchParams.get("session");
    if (!sid) return NextResponse.json({ error: "session required" }, { status: 400 });
    const { data } = await db
      .from("messages")
      .select("role, content, created_at")
      .eq("session_id", sid)
      .order("created_at", { ascending: true });
    return NextResponse.json({ data: data ?? [] });
  }

  return NextResponse.json({ error: "Unknown type" }, { status: 400 });
}

export async function PUT(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { source, category, content } = await req.json();
  if (!source?.trim() || !category?.trim() || !content?.trim()) {
    return NextResponse.json({ error: "source, category, content الزامی است" }, { status: 400 });
  }

  const db = getAdmin();
  // upsert by source: drop any existing chunks for this source before re-indexing
  await db.from("documents").delete().eq("source", source.trim());

  try {
    const chunks = await indexDocument({ content: content.trim(), source: source.trim(), category: category.trim() });
    return NextResponse.json({ ok: true, chunks });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { source } = await req.json();
  if (!source?.trim()) return NextResponse.json({ error: "source الزامی است" }, { status: 400 });

  const db = getAdmin();
  const { error } = await db.from("documents").delete().eq("source", source.trim());
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
