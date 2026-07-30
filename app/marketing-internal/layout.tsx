import type { Metadata } from "next";
import { brand } from "@/lib/brand";
import { getPublicRobotsMetadata } from "@/lib/public-indexing";

export const metadata: Metadata = {
  metadataBase: new URL(brand.publicUrl),
  title: { default: `${brand.productName} — ${brand.tagline}`, template: `%s · ${brand.productName}` },
  description: brand.metadata.description,
  applicationName: brand.productName,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "es_ES",
    siteName: brand.productName,
    title: `${brand.productName} — ${brand.tagline}`,
    description: brand.metadata.description,
    url: brand.publicUrl,
    images: [brand.socialImage],
  },
  robots: getPublicRobotsMetadata(),
  manifest: null,
};

export default function MarketingInternalLayout({ children }: { children: React.ReactNode }) {
  return children;
}
