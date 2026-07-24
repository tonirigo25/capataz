import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_WEB_BASE_URL ?? "http://localhost:3000";
  return ["", "/producto", "/sectores", "/sectores/construction", "/sectores/installations", "/sectores/professional-services", "/sectores/repair-workshop", "/sectores/hospitality", "/planes", "/seguridad", "/demo", "/contacto", "/privacidad", "/terminos", "/soporte"].map(path => ({ url: `${baseUrl}${path}`, changeFrequency: "monthly" as const }));
}
