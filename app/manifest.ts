import type { MetadataRoute } from "next";
import { brand } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: brand.pwa.name,
    short_name: brand.pwa.shortName,
    description: brand.metadata.description,
    id: "/",
    start_url: "/hoy",
    scope: "/",
    display: "standalone",
    background_color: "#f6f7f8",
    theme_color: "#f6c945",
    orientation: "portrait",
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/icons/orqena.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable"
      }
    ]
  };
}
