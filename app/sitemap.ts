import type { MetadataRoute } from "next";
import { marketingProductCatalog, marketingSectorCatalog } from "@/lib/marketing/catalog";
import { marketingSolutions } from "@/lib/marketing/solutions";
import { isPublicIndexingEnabled } from "@/lib/public-indexing";

export default function sitemap(): MetadataRoute.Sitemap {
  if (!isPublicIndexingEnabled()) return [];

  const baseUrl = process.env.NEXT_PUBLIC_WEB_BASE_URL ?? "http://localhost:3000";
  const routes = [
    "", "/producto", ...marketingProductCatalog.map((item) => `/producto/${item.slug}`),
    "/soluciones", ...marketingSolutions.map((item) => `/soluciones/${item.slug}`),
    "/sectores", ...marketingSectorCatalog.map((item) => `/sectores/${item.slug}`),
    "/planes", "/seguridad", "/estado", "/demo", "/contacto", "/privacidad", "/terminos", "/cookies", "/soporte",
    "/recursos/calculadora-margen-obra", "/recursos/checklist-factura-recibida",
  ];
  return routes.map(path => ({ url: `${baseUrl}${path}`, changeFrequency: "monthly" as const }));
}
