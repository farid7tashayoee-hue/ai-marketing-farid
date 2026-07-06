import { createServerClient } from "@/lib/supabase/server";
import { embedBatch } from "./embeddings";

const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    chunks.push(text.slice(start, end).trim());
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks.filter((c) => c.length > 20);
}

export async function indexDocument(params: {
  content: string;
  source: string;
  category?: string;
  metadata?: Record<string, unknown>;
}): Promise<number> {
  const supabase = createServerClient();
  const { content, source, category = "knowledge_base", metadata = {} } = params;

  const chunks = chunkText(content);
  if (chunks.length === 0) return 0;

  const embeddings = await embedBatch(chunks);

  const rows = chunks.map((chunk, i) => ({
    content: chunk,
    embedding: JSON.stringify(embeddings[i]),
    source,
    category,
    metadata,
  }));

  const { error } = await supabase.from("documents").insert(rows);
  if (error) throw new Error(`indexDocument: ${error.message}`);

  return chunks.length;
}
