const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";

export async function embedText(text: string): Promise<number[]> {
  const res = await fetch(VOYAGE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({
      input: [text],
      model: "voyage-3-large",
    }),
  });
  if (!res.ok) throw new Error(`Voyage API error: ${res.status}`);
  const json = await res.json();
  return json.data[0].embedding as number[];
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const res = await fetch(VOYAGE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({ input: texts, model: "voyage-3-large" }),
  });
  if (!res.ok) throw new Error(`Voyage API error: ${res.status}`);
  const json = await res.json();
  return json.data.map((d: { embedding: number[] }) => d.embedding);
}
