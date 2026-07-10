import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 60;

const KNOWLEDGE: { source: string; category: string; content: string }[] = [
  {
    source: "درباره فرید تشیعی",
    category: "about",
    content: `# فرید تشیعی — متخصص AI Marketing

فرید تشیعی یک متخصص بازاریابی دیجیتال و هوش مصنوعی است که در ایران فعالیت می‌کند. او سئو، داده و هوش مصنوعی را در یک تخصص ترکیب می‌کند و نتایج را با رتبه‌های گوگل و اعداد واقعی اثبات می‌کند.

## تخصص‌ها
- AI Marketing (بازاریابی با هوش مصنوعی)
- سئوی داده‌محور (Data-Driven SEO)
- اتوماسیون با هوش مصنوعی
- ساخت چت‌بات هوشمند
- استراتژی محتوا، دیجیتال مارکتینگ
- کمپین و پرفورمنس، طراحی وب

## سابقه کاری
- اکسیراز (Exiraz) — مدیر دیجیتال مارکتینگ (از اکتبر ۲۰۲۵): رتبه ۱-۵ گوگل خرید شمش طلا
- تکنولایف — سئو ارشد (از دسامبر ۲۰۲۳): ساخت تیم سئو از صفر
- گلدیران — سئو ارشد (۲۰۲۳-۲۰۲۵): حوزه لوازم خانگی
- بیمه دات کام — متخصص سئو (۲۰۲۱-۲۰۲۳): حوزه بیمه
- آژانس پل مارکام (۲۰۱۸-۲۰۲۱): Dove، Domestos، OMO، Hoffenberg

## مهارت‌ها
AI Marketing، سئو، Python، Gemini API، Facebook Ads، Ahrefs، Google Search Console، Data Analytics، SQL

## زبان‌ها: فارسی، انگلیسی، فرانسوی

## تماس
واتساپ: +989198198087 | لینکدین: linkedin.com/in/farid-tashayoee | اینستاگرام: farid.tashh | ایمیل: farid7tashayoee@gmail.com`,
  },
  {
    source: "خدمات فرید تشیعی",
    category: "services",
    content: `# خدمات فرید تشیعی

## سئوی داده‌محور
رساندن کلمات کلیدی رقابتی به صفحه اول گوگل. شامل تحلیل رقبا، بهینه‌سازی فنی، لینک‌سازی، پایش مداوم. اثبات‌شده در طلا، لوازم خانگی، بیمه و موبایل.

## اتوماسیون با هوش مصنوعی
ساخت ابزارهای AI: تحلیل کامنت با Gemini API، اتوماسیون گزارش‌دهی، ابزارهای تحقیق کلمات کلیدی، خودکارسازی فرآیندهای بازاریابی.

## ساخت چت‌بات هوشمند
چت‌بات‌های AI که: ۲۴ ساعته پاسخگو هستند، بر پایه داده واقعی آموزش دیده‌اند، لید جمع می‌کنند، روی وب و تلگرام کار می‌کنند، فارسی و انگلیسی و فرانسوی بلدند.

## استراتژی محتوا
تقویم محتوایی داده‌محور، تحلیل رقبا، تولید محتوای SEO-friendly، پایش و بهینه‌سازی.

## دیجیتال مارکتینگ
سئو + تبلیغات کلیکی + شبکه‌های اجتماعی + ایمیل به عنوان یک قیف یکپارچه.

## کمپین و پرفورمنس
Facebook Ads و Google Ads. اندازه‌گیری CAC، ROAS و نرخ تبدیل.

## طراحی وب و لندینگ‌پیج
صفحات فرود با نرخ تبدیل بالا، سریع، هم‌راستا با برند، پشتیبانی RTL.

## برای همکاری: واتساپ +989198198087`,
  },
  {
    source: "نتایج و پروژه‌های اثبات‌شده",
    category: "results",
    content: `# نتایج و پروژه‌های فرید تشیعی

## اکسیراز — حوزه طلا
رتبه ۱-۵ گوگل: «خرید شمش طلا»، «قیمت شمش طلا»، «شمش ۲۴ عیار»

## تکنولایف — لوازم خانگی و موبایل
ساخت تیم سئو از صفر. رتبه ۱-۵: «خرید یخچال»، «خرید لباسشویی»، «خرید گوشی»

## گلدیران — بیمه لوازم خانگی
رتبه ۱-۵: «بیمه لوازم خانگی»، «بیمه لباسشویی»، «بیمه تلویزیون»، «بیمه ماکروفر»

## بیمه دات کام — حوزه بیمه
رتبه ۱-۵: «خرید بیمه»، «بیمه شخص ثالث»، «بیمه بدنه»

## ایران بازالت — حوزه سنگ
رتبه ۱-۵: «خرید سنگ بازالت»، «قیمت سنگ بازالت»

## ابزار تحلیل کامنت دیجی‌کالا
ساخته‌شده با Gemini API — استفاده در استراتژی محتوا — seo.irandevs.com

## سمینار جت‌سئو
مدرس وبینار — ۳۷ اسلاید درباره AI در سئو — هزاران بازدید

## مجموعه سمینارهای سئو و AI
eseminar.tv: کشف فرصت‌های پنهان سئو با AI، دیده‌شدن در جستجوی هوش مصنوعی`,
  },
  {
    source: "سوالات متداول",
    category: "faq",
    content: `# سوالات متداول

## همکاری
چطور با فرید همکاری کنم؟ واتساپ +989198198087 یا فرم تماس سایت. مشاوره اولیه رایگان است.
آیا پروژه فریلنسری می‌پذیرد؟ بله.
آیا با شرکت‌های خارج از ایران کار می‌کند؟ بله.

## سئو
نتیجه سئو چقدر طول می‌کشد؟ ۳ تا ۶ ماه اول اثرات اولیه، ۶ تا ۱۲ ماه نتایج پایدار.
ضمانت رتبه اول می‌دهید؟ هیچ متخصص صادقی ضمانت نمی‌دهد، اما با روش‌های اثبات‌شده حداکثر شانس ایجاد می‌شود.

## چت‌بات
چت‌بات چقدر کمک می‌کند؟ ۲۴ ساعته پاسخگو، جمع‌آوری لید، بهبود تجربه کاربری.
روی چه پلتفرم‌هایی کار می‌کند؟ وب‌سایت، تلگرام، اینستاگرام.
آیا فارسی بلد است؟ بله، کاملاً فارسی، انگلیسی و فرانسوی.

## AI Marketing
چیست؟ ترکیب هوش مصنوعی با استراتژی‌های بازاریابی برای تحلیل داده، شخصی‌سازی و اتوماسیون.
برای کسب‌وکارهای کوچک مناسب است؟ بله، AI به آن‌ها کمک می‌کند در برابر رقبای بزرگ‌تر رقابت کنند.

## تماس
واتساپ: +989198198087
لینکدین: linkedin.com/in/farid-tashayoee
اینستاگرام: instagram.com/farid.tashh
ایمیل: farid7tashayoee@gmail.com`,
  },
];

const CHUNK_SIZE = 600;
const OVERLAP = 80;

function chunk(text: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    const end = Math.min(i + CHUNK_SIZE, text.length);
    const c = text.slice(i, end).trim();
    if (c.length > 30) out.push(c);
    i += CHUNK_SIZE - OVERLAP;
  }
  return out;
}

async function embed(texts: string[], apiKey: string): Promise<number[][]> {
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ input: texts, model: "voyage-3-large" }),
  });
  if (!res.ok) throw new Error(`Voyage: ${res.status} ${await res.text()}`);
  const j = await res.json();
  return j.data.map((d: { embedding: number[] }) => d.embedding);
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-ingest-secret");
  if (secret !== process.env.DASHBOARD_PASSWORD) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const voyageKey = process.env.VOYAGE_API_KEY!;

  let total = 0;
  const results: string[] = [];

  for (const doc of KNOWLEDGE) {
    const chunks = chunk(doc.content);
    const embeddings = await embed(chunks, voyageKey);
    const rows = chunks.map((c, i) => ({
      content: c, source: doc.source, category: doc.category,
      embedding: JSON.stringify(embeddings[i]), metadata: {},
    }));
    const { error } = await db.from("documents").insert(rows);
    if (error) {
      results.push(`❌ ${doc.source}: ${error.message}`);
    } else {
      results.push(`✅ ${doc.source}: ${chunks.length} chunks`);
      total += chunks.length;
    }
  }

  return NextResponse.json({ total, results });
}
