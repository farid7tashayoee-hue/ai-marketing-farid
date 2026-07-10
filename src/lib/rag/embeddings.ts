const GEMINI_EMBED_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent";

const GEMINI_BATCH_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:batchEmbedContents";

export async function embedText(text: string): Promise<number[]> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  const res = await fetch(`${GEMINI_EMBED_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "models/text-embedding-004",
      content: { parts: [{ text }] },
    }),
  });
  if (!res.ok) throw new Error(`Gemini embed error: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.embedding.values as number[];
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  const res = await fetch(`${GEMINI_BATCH_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: texts.map((text) => ({
        model: "models/text-embedding-004",
        content: { parts: [{ text }] },
      })),
    }),
  });
  if (!res.ok) throw new Error(`Gemini batch embed error: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.embeddings.map((e: { values: number[] }) => e.values);
}
