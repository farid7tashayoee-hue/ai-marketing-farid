import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authorized } from "@/lib/dashboard-auth";
import { sendTelegramMessage } from "@/lib/telegram/sender";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function botApi(method: string) {
  return `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [webhookRes, db] = [await fetch(botApi("getWebhookInfo")), getAdmin()];
  const webhookInfo = await webhookRes.json();

  const { data: sessions } = await db
    .from("sessions")
    .select("telegram_chat_id")
    .eq("channel", "telegram")
    .not("telegram_chat_id", "is", null);
  const userCount = new Set((sessions ?? []).map(s => s.telegram_chat_id)).size;

  return NextResponse.json({
    webhook: webhookInfo.result ?? null,
    userCount,
  });
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { action, text } = await req.json();

  if (action === "set-webhook") {
    const url = `${process.env.NEXT_PUBLIC_APP_URL}/api/telegram`;
    const res = await fetch(botApi("setWebhook"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, secret_token: process.env.TELEGRAM_WEBHOOK_SECRET }),
    });
    return NextResponse.json(await res.json());
  }

  if (action === "delete-webhook") {
    const res = await fetch(botApi("deleteWebhook"));
    return NextResponse.json(await res.json());
  }

  if (action === "broadcast") {
    if (!text?.trim()) return NextResponse.json({ error: "text الزامی است" }, { status: 400 });

    const db = getAdmin();
    const { data: sessions } = await db
      .from("sessions")
      .select("telegram_chat_id")
      .eq("channel", "telegram")
      .not("telegram_chat_id", "is", null);
    const chatIds = Array.from(new Set((sessions ?? []).map(s => s.telegram_chat_id as number)));

    let sent = 0;
    let failed = 0;
    for (const chatId of chatIds) {
      try {
        await sendTelegramMessage(chatId, text.trim());
        sent++;
      } catch {
        failed++;
      }
    }
    return NextResponse.json({ ok: true, sent, failed, total: chatIds.length });
  }

  return NextResponse.json({ error: "action نامعتبر است" }, { status: 400 });
}
