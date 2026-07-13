import { createServerClient } from "@/lib/supabase/server";
import { embedText } from "./embeddings";

interface RetrieveParams {
  query: string;
  category?: string;
  topK?: number;
}

export interface RetrievedChunk {
  id: string;
  content: string;
  source: string;
  category: string;
  similarity: number;
}

export async function retrieveChunks({
  query,
  category,
  topK = 5,
}: RetrieveParams): Promise<RetrievedChunk[]> {
  const supabase = createServerClient();
  const embedding = await embedText(query);

  const { data, error } = await supabase.rpc("match_documents", {
    query_embedding: embedding,
    match_count: topK,
    filter_category: category ?? null,
  });

  if (error) throw new Error(`retriever: ${error.message}`);
  return (data ?? []) as RetrievedChunk[];
}

export async function retrieveContext(params: RetrieveParams): Promise<string> {
  const chunks = await retrieveChunks(params);
  if (!chunks.length) return "";

  return chunks
    .map((d) => `[منبع: ${d.source ?? "دانش‌پایه"} | شباهت: ${Math.round(d.similarity * 100)}%]\n${d.content}`)
    .join("\n\n---\n\n");
}
