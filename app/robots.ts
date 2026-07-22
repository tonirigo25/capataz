import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const staging = process.env.NEXT_PUBLIC_APP_ENV === "staging";
  return {
    rules: staging ? { userAgent: "*", disallow: "/" } : { userAgent: "*", allow: "/", disallow: ["/api/", "/plataforma", "/configuracion"] },
    sitemap: staging ? undefined : `${process.env.NEXT_PUBLIC_WEB_BASE_URL ?? "http://localhost:3000"}/sitemap.xml`
  };
}
