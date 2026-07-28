import { LAUNCH_MARKETING_PATHS } from "@/lib/host-routing";
import { publicRequestContext } from "@/lib/platform/request-boundary";

export async function GET() {
  return publicRequestContext("GET /marketing-internal/sitemap.xml", undefined, async () => {
    const routes = [...LAUNCH_MARKETING_PATHS].sort();
    const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes.map((path) => `\n  <url><loc>https://orqenatech.com${path === "/" ? "" : escapeXml(path)}</loc></url>`).join("")}\n</urlset>\n`;
    return new Response(body, {
      headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
    });
  });
}

function escapeXml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}
