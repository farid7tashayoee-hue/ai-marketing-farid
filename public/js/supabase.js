/* ============================================================
   supabase.js — database connection for contacts & leads
   ============================================================ */

const SUPABASE_URL = 'https://tgbmkyygwcdrczrgpkfu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRnYm1reXlnd2NkcmN6cmdwa2Z1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0NDQwMTEsImV4cCI6MjA5NzAyMDAxMX0.VqXIYbSjp6_z5dg9BT86omWqKlNBFvqQiUiJVCPdHBg';

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function saveContact(name, email, message) {
  try {
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, message })
    });
    const data = await res.json();
    return data.ok ? null : new Error('server error');
  } catch (e) {
    return e;
  }
}

async function saveLead(email) {
  await db.from('leads').insert([{ email }]);
}
