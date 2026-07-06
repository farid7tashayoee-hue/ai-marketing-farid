import { createServerClient } from "@/lib/supabase/server";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

function getModel() {
  const openrouter = createOpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
  });
  return openrouter("deepseek/deepseek-chat:free");
}

export async function getUserMemoryBlock(userId: string): Promise<string> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("user_memory")
    .select("key, value")
    .eq("user_id", userId);

  if (!data || data.length === 0) return "";
  const lines = data.map((f) => `- ${f.key}: ${f.value}`).join("\n");
  return `اطلاعات کاربر از مکالمات قبلی:\n${lines}`;
}

export async function saveMemoryFact(
  userId: string,
  key: string,
  value: string
): Promise<void> {
  const supabase = createServerClient();
  await supabase.from("user_memory").upsert(
    { user_id: userId, key, value, updated_at: new Date().toISOString() },
    { onConflict: "user_id,key" }
  );
}

export async function summarizeAndSaveSession(
  sessionId: string,
  userId: string
): Promise<void> {
  const supabase = createServerClient();
  const { data: msgs } = await supabase
    .from("messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(40);

  if (!msgs || msgs.length < 4) return;

  const transcript = msgs
    .map((m) => `${m.role === "user" ? "کاربر" : "دستیار"}: ${m.content}`)
    .join("\n");

  const { text } = await generateText({
    model: getModel(),
    prompt: `از این مکالمه، حداکثر ۵ حقیقت کلیدی درباره کاربر استخراج کن.
فقط JSON برگردان به این شکل: [{"key":"نام","value":"علی"},...]
اگر چیزی پیدا نکردی، آرایه خالی برگردان.

مکالمه:
${transcript}`,
  });

  let facts: { key: string; value: string }[] = [];
  try {
    const match = text.match(/\[[\s\S]*\]/);
    if (match) facts = JSON.parse(match[0]);
  } catch {
    return;
  }

  for (const fact of facts) {
    if (fact.key && fact.value) {
      await saveMemoryFact(userId, fact.key, fact.value);
    }
  }
}
