import type { MetadataRoute } from "next";
import { marketingProductCatalog, marketingSectorCatalog } from "@/lib/marketing/catalog";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_WEB_BASE_URL ?? "http://localhost:3000";
  const routes = [
    "", "/producto", ...marketingProductCatalog.map((item) => `/producto/${item.slug}`),
    "/sectores", ...marketingSectorCatalog.map((item) => `/sectores/${item.slug}`),
    "/planes", "/seguridad", "/demo", "/contacto", "/privacidad", "/terminos", "/cookies", "/soporte",
  ];
  return routes.map(path => ({ url: `${baseUrl}${path}`, changeFrequency: "monthly" as const }));
}
