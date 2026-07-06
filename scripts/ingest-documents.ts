/**
 * CLI برای اضافه کردن داده به RAG
 * استفاده:
 *   npx ts-node scripts/ingest-documents.ts --file ./data/guide.md --source "راهنمای اصلی" --category knowledge_base
 *   npx ts-node scripts/ingest-documents.ts --url https://example.com --source "سایت" --category website
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { indexDocument } from "../src/lib/rag/indexer";

async function main() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i + 1] : undefined;
  };

  const filePath = get("--file");
  const url = get("--url");
  const source = get("--source") ?? filePath ?? url ?? "unknown";
  const category = get("--category") ?? "knowledge_base";

  let content = "";

  if (filePath) {
    const fs = await import("fs/promises");
    content = await fs.readFile(filePath, "utf-8");
  } else if (url) {
    const res = await fetch(url);
    const html = await res.text();
    // strip tags
    content = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  } else {
    console.error("باید --file یا --url بدهید");
    process.exit(1);
  }

  console.log(`در حال پردازش "${source}" (${content.length} کاراکتر)...`);
  const count = await indexDocument({ content, source, category });
  console.log(`✅ ${count} chunk با موفقیت ایندکس شد.`);
}

main().catch((e) => {
  console.error("خطا:", e);
  process.exit(1);
});
