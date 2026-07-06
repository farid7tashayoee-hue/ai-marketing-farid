/* ============================================================
   supabase.js — database connection for contacts & leads
   ============================================================ */

const SUPABASE_URL = 'https://tgbmkyygwcdrczrgpkfu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRnYm1reXlnd2NkcmN6cmdwa2Z1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0NDQwMTEsImV4cCI6MjA5NzAyMDAxMX0.VqXIYbSjp6_z5dg9BT86omWqKlNBFvqQiUiJVCPdHBg';

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function saveContact(name, email, message) {
  const { error } = await db.from('contacts').insert([{ name, email, message }]);
  return error;
}

async function saveLead(email) {
  await db.from('leads').insert([{ email }]);
}
