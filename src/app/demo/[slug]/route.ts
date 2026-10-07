import { loadDemoPageHtml } from "@/check/demo-page";

// A route handler, not a page: it returns the template's HTML as-is, outside the app's layout and without streaming.
export async function GET(_request: Request, ctx: RouteContext<"/demo/[slug]">) {
  const html = await loadDemoPageHtml((await ctx.params).slug);
  if (html === null) return new Response("Page not found", { status: 404, headers: { "content-type": "text/plain" } });
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
