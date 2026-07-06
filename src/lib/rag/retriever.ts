import { createServerClient } from "@/lib/supabase/server";
import { embedText } from "./embeddings";

interface RetrieveParams {
  query: string;
  category?: string;
  topK?: number;
}

export async function retrieveContext({
  query,
  category,
  topK = 5,
}: RetrieveParams): Promise<string> {
  const supabase = createServerClient();
  const embedding = await embedText(query);

  const { data, error } = await supabase.rpc("match_documents", {
    query_embedding: embedding,
    match_count: topK,
    filter_category: category ?? null,
  });

  if (error) throw new Error(`retriever: ${error.message}`);
  if (!data?.length) return "";

  return (data as { content: string; source: string; similarity: number }[])
    .map((d) => `[منبع: ${d.source ?? "دانش‌پایه"} | شباهت: ${Math.round(d.similarity * 100)}%]\n${d.content}`)
    .join("\n\n---\n\n");
}
