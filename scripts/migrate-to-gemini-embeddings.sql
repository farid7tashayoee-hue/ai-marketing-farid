-- تغییر از Voyage AI (1024 dim) به Gemini (768 dim)
-- اجرا در Supabase SQL Editor

-- حذف جدول قدیمی (داده‌های قبلی پاک می‌شن)
DROP TABLE IF EXISTS documents;

-- ساخت جدول جدید با 768 dim
CREATE TABLE documents (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content    TEXT NOT NULL,
  embedding  vector(768),
  source     TEXT,
  category   TEXT DEFAULT 'knowledge_base',
  metadata   JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_cat ON documents(category);

-- آپدیت تابع جستجو برای 768 dim
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding  vector(768),
  match_count      INT DEFAULT 5,
  filter_category  TEXT DEFAULT NULL
)
RETURNS TABLE (id UUID, content TEXT, source TEXT, metadata JSONB, similarity FLOAT)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT d.id, d.content, d.source, d.metadata,
    1 - (d.embedding <=> query_embedding) AS similarity
  FROM documents d
  WHERE (filter_category IS NULL OR d.category = filter_category)
    AND d.embedding IS NOT NULL
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
