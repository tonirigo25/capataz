import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Capataz",
    short_name: "Capataz",
    description: "Tu asistente IA para reformas y construcción.",
    start_url: "/hoy",
    scope: "/",
    display: "standalone",
    background_color: "#f6f7f8",
    theme_color: "#f6c945",
    orientation: "portrait",
    icons: [
      {
        src: "/icons/capataz.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable"
      }
    ]
  };
}
