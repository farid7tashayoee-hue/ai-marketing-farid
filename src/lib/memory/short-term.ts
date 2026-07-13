import { createServerClient } from "@/lib/supabase/server";
import type { CoreMessage } from "ai";

export async function createSession(
  channel: "web" | "telegram",
  userId?: string,
  telegramChatId?: number
): Promise<string> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("sessions")
    .insert({ channel, user_id: userId, telegram_chat_id: telegramChatId })
    .select("id")
    .single();
  if (error) throw new Error(`createSession: ${error.message}`);
  return data.id;
}

export async function getOrCreateTelegramSession(
  chatId: number,
  userId: string
): Promise<string> {
  const supabase = createServerClient();
  const { data: existing } = await supabase
    .from("sessions")
    .select("id")
    .eq("telegram_chat_id", chatId)
    .eq("channel", "telegram")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (existing) return existing.id;
  return createSession("telegram", userId, chatId);
}

export async function getSessionMessages(
  sessionId: string,
  limit = 20
): Promise<CoreMessage[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(`getSessionMessages: ${error.message}`);
  return (data ?? []) as CoreMessage[];
}

export interface SaveMessageMeta {
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  ragSources?: unknown;
}

export async function saveMessage(
  sessionId: string,
  role: "user" | "assistant",
  content: string,
  meta?: SaveMessageMeta
): Promise<string | undefined> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("messages")
    .insert({
      session_id: sessionId,
      role,
      content,
      model: meta?.model,
      input_tokens: meta?.inputTokens,
      output_tokens: meta?.outputTokens,
      rag_sources: meta?.ragSources,
    })
    .select("id")
    .single();
  await supabase
    .from("sessions")
    .update({ last_activity: new Date().toISOString() })
    .eq("id", sessionId);
  return data?.id;
}
