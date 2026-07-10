const BASE = "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001";
const OUTPUT_DIM = 768;

export async function embedText(text: string): Promise<number[]> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  const res = await fetch(`${BASE}:embedContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "models/gemini-embedding-001",
      content: { parts: [{ text }] },
      outputDimensionality: OUTPUT_DIM,
    }),
  });
  if (!res.ok) throw new Error(`Gemini embed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.embedding.values as number[];
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  const res = await fetch(`${BASE}:batchEmbedContents?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: texts.map((text) => ({
        model: "models/gemini-embedding-001",
        content: { parts: [{ text }] },
        outputDimensionality: OUTPUT_DIM,
      })),
    }),
  });
  if (!res.ok) throw new Error(`Gemini batch embed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.embeddings.map((e: { values: number[] }) => e.values);
}
