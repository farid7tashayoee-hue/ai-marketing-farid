// نرخ‌های تقریبی (دلار به ازای هر ۱ میلیون توکن) — برای تخمین هزینه در داشبورد، نه صورت‌حساب دقیق.
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "gemini-2.5-flash": { input: 0.3, output: 2.5 },
  "nvidia/nemotron-nano-9b-v2:free": { input: 0, output: 0 },
};

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const rate = MODEL_PRICING[model];
  if (!rate) return 0;
  return (inputTokens / 1_000_000) * rate.input + (outputTokens / 1_000_000) * rate.output;
}
