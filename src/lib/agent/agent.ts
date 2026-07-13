import { generateText, type CoreMessage } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { buildSystemPrompt } from "./system-prompt";
import { createTools, type RagSourceUsed } from "./tools";
import { getUserMemoryBlock } from "@/lib/memory/long-term";

const PRIMARY_MODEL_NAME = "gemini-2.5-flash";
const FALLBACK_MODEL_NAME = "nvidia/nemotron-nano-9b-v2:free";

function getPrimaryModel() {
  // Gemini 2.5 Flash via Google's OpenAI-compatible endpoint
  const google = createOpenAI({
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    apiKey: process.env.GOOGLE_AI_API_KEY,
  });
  return google("gemini-2.5-flash");
}

function getFallbackModel() {
  // Used when Gemini's free-tier daily quota is exhausted
  const openrouter = createOpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
  });
  return openrouter("nvidia/nemotron-nano-9b-v2:free");
}

interface AgentParams {
  sessionId: string;
  userId?: string;
  messages: CoreMessage[];
  channel: "web" | "telegram";
  lang?: string;
}

export interface AgentResult {
  text: string;
  model: string;
  usage: { promptTokens: number; completionTokens: number };
  ragSources: RagSourceUsed[];
}

export async function runAgent(params: AgentParams): Promise<AgentResult> {
  const { sessionId, userId, messages, channel, lang } = params;

  const userMemoryBlock = userId ? await getUserMemoryBlock(userId) : "";
  const systemPrompt = buildSystemPrompt({ userMemoryBlock, channel, lang });
  const ragSources: RagSourceUsed[] = [];
  const tools = createTools(sessionId, userId, ragSources);

  const generate = (model: ReturnType<typeof getPrimaryModel>) =>
    generateText({
      model,
      system: systemPrompt,
      messages,
      tools,
      maxSteps: 5,
      temperature: 0.7,
    });

  try {
    const result = await generate(getPrimaryModel());
    return {
      text: result.text,
      model: PRIMARY_MODEL_NAME,
      usage: { promptTokens: result.usage.promptTokens, completionTokens: result.usage.completionTokens },
      ragSources,
    };
  } catch (err) {
    console.error("[agent] Gemini failed, falling back to OpenRouter:", err);
    const result = await generate(getFallbackModel());
    return {
      text: result.text,
      model: FALLBACK_MODEL_NAME,
      usage: { promptTokens: result.usage.promptTokens, completionTokens: result.usage.completionTokens },
      ragSources,
    };
  }
}
