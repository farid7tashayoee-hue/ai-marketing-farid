import { streamText, generateText, type CoreMessage } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { buildSystemPrompt } from "./system-prompt";
import { createTools } from "./tools";
import { getUserMemoryBlock } from "@/lib/memory/long-term";

function getModel() {
  const openrouter = createOpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
  });
  return openrouter("google/gemma-3-27b-it:free");
}

interface AgentParams {
  sessionId: string;
  userId?: string;
  messages: CoreMessage[];
  channel: "web" | "telegram";
  streaming: true;
}

interface AgentParamsNoStream {
  sessionId: string;
  userId?: string;
  messages: CoreMessage[];
  channel: "web" | "telegram";
  streaming: false;
}

export async function runAgent(
  params: AgentParams | AgentParamsNoStream
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const { sessionId, userId, messages, channel, streaming } = params;

  const userMemoryBlock = userId ? await getUserMemoryBlock(userId) : "";
  const systemPrompt = buildSystemPrompt({ userMemoryBlock, channel });
  const tools = createTools(sessionId, userId);

  if (streaming) {
    return streamText({
      model: getModel(),
      system: systemPrompt,
      messages,
      tools,
      maxSteps: 5,
      temperature: 0.7,
    });
  }

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
