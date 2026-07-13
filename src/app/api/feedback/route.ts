import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const { messageId, rating } = await req.json().catch(() => ({}));

  if (typeof messageId !== "string" || !messageId) {
    return NextResponse.json({ error: "messageId الزامی است" }, { status: 400 });
  }
  if (rating !== "up" && rating !== "down") {
    return NextResponse.json({ error: "rating باید up یا down باشد" }, { status: 400 });
  }

  const supabase = createServerClient();
  const { data: message } = await supabase
    .from("messages")
    .select("session_id")
    .eq("id", messageId)
    .single();

  if (!message) {
    return NextResponse.json({ error: "پیام یافت نشد" }, { status: 404 });
  }

  const { error } = await supabase
    .from("message_feedback")
    .insert({ message_id: messageId, session_id: message.session_id, rating });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
