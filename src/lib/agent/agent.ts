import { generateText, type CoreMessage } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { buildSystemPrompt } from "./system-prompt";
import { createTools } from "./tools";
import { getUserMemoryBlock } from "@/lib/memory/long-term";

const FREE_MODELS = [
  "qwen/qwen3-235b-a22b:free",
  "mistralai/mistral-7b-instruct:free",
  "google/gemma-3-27b-it:free",
  "meta-llama/llama-3.3-70b-instruct:free",
];

function getOpenRouter() {
  return createOpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
  });
}

interface AgentParams {
  sessionId: string;
  userId?: string;
  messages: CoreMessage[];
  channel: "web" | "telegram";
}

export async function runAgent(params: AgentParams): Promise<string> {
  const { sessionId, userId, messages, channel } = params;

  const userMemoryBlock = userId ? await getUserMemoryBlock(userId) : "";
  const systemPrompt = buildSystemPrompt({ userMemoryBlock, channel });
  const tools = createTools(sessionId, userId);
  const openrouter = getOpenRouter();

  let lastError: unknown;
  for (const modelId of FREE_MODELS) {
    try {
      const result = await generateText({
        model: openrouter(modelId),
        system: systemPrompt,
        messages,
        tools,
        maxSteps: 5,
        temperature: 0.7,
      });
      return result.text;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.includes("429") ||
        msg.includes("rate") ||
        msg.includes("unavailable") ||
        msg.includes("404") ||
        msg.includes("RetryError")
      ) {
        console.warn(`[agent] ${modelId} failed, trying next. ${msg.slice(0, 100)}`);
        lastError = err;
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}
