import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_WEB_BASE_URL ?? "http://localhost:3000";
  return ["", "/privacidad", "/terminos", "/soporte"].map(path => ({ url: `${baseUrl}${path}`, changeFrequency: "monthly" as const }));
}
