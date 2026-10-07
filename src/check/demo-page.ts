import { eq } from "drizzle-orm";
import { db } from "../db";
import { approvedTexts, demoPages } from "../db/schema";

// Demo affiliate pages are stored on ads as a path, so they work on localhost, preview URLs and after Reset.
export const DEMO_PAGE_PATH = /^\/demo\/([^/\s?#]+)$/;

export type DemoPageFields = Pick<typeof demoPages.$inferSelect, "headline" | "body" | "showDisclosure" | "hiddenText">;

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ESCAPES[char]);
}

function paragraphs(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .filter((paragraph) => paragraph.trim())
    .map((paragraph) => `<p>${escapeHtml(paragraph.trim()).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

// The fixed template. Extraction must give exactly demoPageText in the seed: no <title> or meta description (the extractor
// reads both), the disclosure after the body, and the hidden text once. Everything typed is escaped, so it's shown as text.
export function renderDemoPage(page: DemoPageFields, disclosure: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
body { margin: 0; background: #f7f7f5; color: #1c1c1c; font: 17px/1.6 Georgia, serif; }
main { max-width: 680px; margin: 0 auto; padding: 48px 20px; }
h1 { font-size: 32px; line-height: 1.2; }
.disclosure { margin-top: 40px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 13px; color: #666; }
</style>
</head>
<body>
<main>
<h1>${escapeHtml(page.headline)}</h1>
${paragraphs(page.body)}
${page.showDisclosure ? `<p class="disclosure">${escapeHtml(disclosure)}</p>` : ""}
${page.hiddenText.trim() ? `<div hidden>${escapeHtml(page.hiddenText)}</div>` : ""}
</main>
</body>
</html>
`;
}

// null when there's no demo page with that slug.
export async function loadDemoPageHtml(slug: string): Promise<string | null> {
  const [page] = await db.select().from(demoPages).where(eq(demoPages.slug, slug));
  if (!page) return null;
  const [disclosure] = await db.select().from(approvedTexts).where(eq(approvedTexts.id, "affiliate_disclosure"));
  return renderDemoPage(page, disclosure.text);
}
