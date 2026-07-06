-- =============================================================
-- چت‌بات هوشمند فارسی — Schema کامل Supabase
-- اجرا یک‌بار در SQL editor پنل Supabase
-- =============================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          TEXT,
  channel          TEXT NOT NULL DEFAULT 'web' CHECK (channel IN ('web','telegram')),
  telegram_chat_id BIGINT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  last_activity    TIMESTAMPTZ DEFAULT NOW(),
  metadata         JSONB DEFAULT '{}'
);

-- Messages (short-term memory)
CREATE TABLE IF NOT EXISTS messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role         TEXT NOT NULL CHECK (role IN ('user','assistant','tool')),
  content      TEXT NOT NULL,
  tool_calls   JSONB,
  tool_call_id TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, created_at);

-- User Memory (long-term memory)
CREATE TABLE IF NOT EXISTS user_memory (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT NOT NULL,
  key        TEXT NOT NULL,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, key)
);
CREATE INDEX IF NOT EXISTS idx_user_memory_uid ON user_memory(user_id);

-- Leads
CREATE TABLE IF NOT EXISTS leads (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id),
  user_id    TEXT,
  name       TEXT,
  phone      TEXT,
  email      TEXT,
  notes      TEXT,
  source     TEXT DEFAULT 'web',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Service Info
CREATE TABLE IF NOT EXISTS service_info (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category    TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  data        JSONB NOT NULL DEFAULT '{}',
  is_active   BOOLEAN DEFAULT TRUE,
  sort_order  INT DEFAULT 0,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_service_info_cat ON service_info(category, is_active);

-- Documents (RAG)
CREATE TABLE IF NOT EXISTS documents (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content    TEXT NOT NULL,
  embedding  vector(1024),
  source     TEXT,
  category   TEXT DEFAULT 'knowledge_base',
  metadata   JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_documents_cat ON documents(category);

-- pgvector search function
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding  vector(1024),
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
    AND 1 - (d.embedding <=> query_embedding) > 0.7
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
