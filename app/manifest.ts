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
    background_color: "#f8f5ed",
    theme_color: "#087a68",
    orientation: "portrait",
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/brand/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/brand/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/brand/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      }
    ]
  };
}
