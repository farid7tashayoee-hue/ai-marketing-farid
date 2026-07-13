-- =============================================================
-- فاز ۱ داشبورد مدیریت پیشرفته — Migration
-- اجرا یک‌بار در SQL editor پنل Supabase، قبل از deploy کد جدید
-- =============================================================

-- وضعیت لید (گردش کار CRM ساده)
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'جدید'
  CHECK (status IN ('جدید', 'تماس گرفته شد', 'جلسه تنظیم شد', 'موفق', 'منصرف'));

-- ردیابی مدل/توکن/منابع RAG به ازای هر پیام
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS model TEXT,
  ADD COLUMN IF NOT EXISTS input_tokens INT,
  ADD COLUMN IF NOT EXISTS output_tokens INT,
  ADD COLUMN IF NOT EXISTS rag_sources JSONB;

-- بازخورد کاربر (👍/👎) روی پاسخ‌های چت‌بات
CREATE TABLE IF NOT EXISTS message_feedback (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  session_id UUID REFERENCES sessions(id),
  rating     TEXT NOT NULL CHECK (rating IN ('up', 'down')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_message_feedback_message ON message_feedback(message_id);

-- سوالاتی که پایگاه دانش پاسخ مرتبطی برایشان نداشت
CREATE TABLE IF NOT EXISTS unanswered_questions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id),
  question   TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- جدول contacts از قبل مستقیم توی Supabase ساخته شده بود (بدون migration ثبت‌شده)
-- این خط فقط مستندسازی است، اگر جدول موجود باشد کاری انجام نمی‌دهد
CREATE TABLE IF NOT EXISTS contacts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT,
  email      TEXT,
  message    TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
