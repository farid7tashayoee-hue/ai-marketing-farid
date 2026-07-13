import { type NextRequest, NextResponse } from "next/server";
import { parseUpdate } from "@/lib/telegram/webhook";
import { sendTelegramMessage } from "@/lib/telegram/sender";
import { getOrCreateTelegramSession, getSessionMessages, saveMessage } from "@/lib/memory/short-term";
import { runAgent } from "@/lib/agent/agent";
import type { CoreMessage } from "ai";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  // Verify webhook secret
  const secret = req.headers.get("x-telegram-bot-api-secret-token");
  if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await req.json();
  const update = parseUpdate(body);

  if (!update?.message?.text) return NextResponse.json({ ok: true });

  const { chat, from, text } = update.message;
  const userId = `tg_${from.id}`;

  const sessionId = await getOrCreateTelegramSession(chat.id, userId);
  await saveMessage(sessionId, "user", text);

  const history = await getSessionMessages(sessionId, 20);
  const messages: CoreMessage[] = [
    ...history.slice(0, -1),
    { role: "user", content: text },
  ];

  const result = await runAgent({
    sessionId,
    userId,
    messages,
    channel: "telegram",
  });

  await saveMessage(sessionId, "assistant", result.text, {
    model: result.model,
    inputTokens: result.usage.promptTokens,
    outputTokens: result.usage.completionTokens,
    ragSources: result.ragSources,
  });
  await sendTelegramMessage(chat.id, result.text);

  return NextResponse.json({ ok: true });
}
