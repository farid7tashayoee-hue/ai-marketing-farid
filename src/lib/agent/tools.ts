import { tool } from "ai";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { retrieveContext } from "@/lib/rag/retriever";

export function createTools(sessionId: string, userId?: string) {
  const supabase = createServerClient();

  const capture_lead = tool({
    description:
      "وقتی کاربر علاقه به همکاری، مشاوره یا دریافت اطلاعات بیشتر دارد، این ابزار را برای ثبت اطلاعات تماس فراخوانی کن.",
    parameters: z.object({
      name: z.string().optional().describe("نام کامل کاربر"),
      phone: z.string().optional().describe("شماره تلفن"),
      email: z.string().optional().describe("ایمیل"),
      notes: z.string().optional().describe("خلاصه‌ای از نیاز کاربر"),
    }),
    execute: async ({ name, phone, email, notes }) => {
      await supabase.from("leads").insert({
        session_id: sessionId,
        user_id: userId,
        name,
        phone,
        email,
        notes,
        source: "web",
      });

      // Telegram notification
      const token = process.env.TELEGRAM_BOT_TOKEN;
      const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
      if (token && adminChatId) {
        const msg = `🔔 لید جدید!\nنام: ${name ?? "—"}\nتلفن: ${phone ?? "—"}\nایمیل: ${email ?? "—"}\nنیاز: ${notes ?? "—"}`;
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: adminChatId, text: msg }),
        }).catch(() => null);
      }

      return "اطلاعات شما با موفقیت ثبت شد. فرید به زودی با شما تماس می‌گیرد. ممنون از اعتمادتان! 🙏";
    },
  });

  const get_table_info = tool({
    description:
      "اطلاعات خدمات، قیمت‌ها، تیم یا FAQ را از پایگاه داده بازیابی می‌کند.",
    parameters: z.object({
      category: z
        .enum(["pricing", "services", "faq", "team"])
        .describe("دسته‌بندی اطلاعات مورد نیاز"),
    }),
    execute: async ({ category }) => {
      const { data, error } = await supabase
        .from("service_info")
        .select("title, description, data")
        .eq("category", category)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (error || !data?.length) {
        return "متاسفانه اطلاعاتی در این بخش یافت نشد.";
      }

      return JSON.stringify(data, null, 2);
    },
  });

  const search_rag = tool({
    description:
      "در دانش‌پایه (مستندات، راهنماها، محتوای سایت) جستجو می‌کند تا پاسخ دقیق به سوالات تخصصی بدهد.",
    parameters: z.object({
      query: z.string().describe("سوال یا عبارت جستجو به فارسی"),
      category: z
        .string()
        .optional()
        .describe("دسته‌بندی اختیاری برای محدود کردن جستجو"),
    }),
    execute: async ({ query, category }) => {
      try {
        const context = await retrieveContext({ query, category, topK: 5 });
        return context || "اطلاعات مرتبطی در دانش‌پایه یافت نشد.";
      } catch {
        return "جستجو در دانش‌پایه با خطا مواجه شد.";
      }
    },
  });

  return { capture_lead, get_table_info, search_rag };
}
