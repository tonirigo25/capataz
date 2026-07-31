import type { MetadataRoute } from "next";
import { brand } from "@/lib/brand";
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
    sitemap: `${brand.publicUrl}/sitemap.xml`,
  };
}
