export function GET() {
  return new Response(
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
  );
}
