import { type NextRequest, NextResponse } from "next/server";
import { type CoreMessage } from "ai";
import { runAgent } from "@/lib/agent/agent";
import {
  createSession,
  getSessionMessages,
  saveMessage,
} from "@/lib/memory/short-term";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { message, sessionId: existingSessionId, userId, lang } = await req.json();

    if (!message?.trim()) {
      return NextResponse.json({ error: "پیام خالی است" }, { status: 400 });
    }

    const sessionId =
      existingSessionId ?? (await createSession("web", userId));

    await saveMessage(sessionId, "user", message);

    const history = await getSessionMessages(sessionId, 20);

    const messages: CoreMessage[] = [
      ...history.slice(0, -1),
      { role: "user", content: message },
    ];

    const result = await runAgent({ sessionId, userId, messages, channel: "web", lang });

    const messageId = await saveMessage(sessionId, "assistant", result.text, {
      model: result.model,
      inputTokens: result.usage.promptTokens,
      outputTokens: result.usage.completionTokens,
      ragSources: result.ragSources,
    }).catch(() => undefined);

    return NextResponse.json(
      { text: result.text, sessionId, messageId },
      { headers: { "X-Session-Id": sessionId } }
    );
  } catch (err) {
    console.error("[chat/route]", err);
    return NextResponse.json({ error: "خطای داخلی سرور" }, { status: 500 });
  }
}
