import { publicRequestContext } from "@/lib/platform/request-boundary";

export async function GET() {
  return publicRequestContext("GET /marketing-internal/robots.txt", undefined, async () => (
    new Response(
      [
        "User-agent: *",
        "Allow: /",
        "Disallow: /api/",
        "Disallow: /login",
        "Disallow: /registro",
        "Disallow: /marketing-internal",
        "Sitemap: https://orqenatech.com/sitemap.xml",
        "",
      ].join("\n"),
      { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } },
    )
  ));
}
