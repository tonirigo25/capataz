import type { MetadataRoute } from "next";
import { isPublicIndexingEnabled, PUBLIC_ROBOTS_ALLOW_PATHS } from "@/lib/public-indexing";

export default function robots(): MetadataRoute.Robots {
  if (!isPublicIndexingEnabled()) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: {
      userAgent: "*",
      allow: [...PUBLIC_ROBOTS_ALLOW_PATHS],
      disallow: "/",
    },
    sitemap: `${process.env.NEXT_PUBLIC_WEB_BASE_URL ?? "http://localhost:3000"}/sitemap.xml`,
  };
}
