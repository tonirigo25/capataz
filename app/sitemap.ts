import type { MetadataRoute } from "next";
import { brand } from "@/lib/brand";
import { marketingProductCatalog, marketingSectorCatalog } from "@/lib/marketing/catalog";
import { marketingSolutions } from "@/lib/marketing/solutions";
import { isPublicIndexingEnabled } from "@/lib/public-indexing";

export default function sitemap(): MetadataRoute.Sitemap {
  if (!isPublicIndexingEnabled()) return [];

  const routes = new Set([
    "", "/producto", ...marketingProductCatalog.map((item) => `/producto/${item.slug}`),
    "/soluciones", ...marketingSolutions.map((item) => `/soluciones/${item.slug}`),
    "/sectores", ...marketingSectorCatalog.map((item) => `/sectores/${item.slug}`),
    "/precios", "/recursos", "/empresa", "/seguridad", "/estado", "/demo", "/contacto", "/privacidad", "/terminos", "/cookies", "/soporte",
    "/soluciones/clientes-y-presupuestos",
    "/soluciones/obras-y-trabajo",
    "/soluciones/control-costes-y-margen",
    "/soluciones/facturacion-y-cobros",
    "/soluciones/proveedores-y-subcontratas",
    "/soluciones/documentos-y-ocr",
    "/soluciones/equipo-y-agenda",
    "/soluciones/ia-operativa",
    "/recursos/calculadora-margen-obra", "/recursos/checklist-factura-recibida",
  ]);
  return [...routes].map(path => ({ url: `${brand.publicUrl}${path}`, changeFrequency: "monthly" as const }));
}
