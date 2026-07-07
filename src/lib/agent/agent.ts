import { generateText, type CoreMessage } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { buildSystemPrompt } from "./system-prompt";
import { createTools } from "./tools";
import { getUserMemoryBlock } from "@/lib/memory/long-term";

function getModel() {
  // Gemini 2.5 Flash via Google's OpenAI-compatible endpoint
  const google = createOpenAI({
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    apiKey: process.env.GOOGLE_AI_API_KEY,
  });
  return google("gemini-2.5-flash");
}

interface AgentParams {
  sessionId: string;
  userId?: string;
  messages: CoreMessage[];
  channel: "web" | "telegram";
  lang?: string;
}

export async function runAgent(params: AgentParams): Promise<string> {
  const { sessionId, userId, messages, channel, lang } = params;

  const userMemoryBlock = userId ? await getUserMemoryBlock(userId) : "";
  const systemPrompt = buildSystemPrompt({ userMemoryBlock, channel, lang });
  const tools = createTools(sessionId, userId);
  const result = await generateText({
    model: getModel(),
    system: systemPrompt,
    messages,
    tools,
    maxSteps: 5,
    temperature: 0.7,
  });
  return result.text;
}
