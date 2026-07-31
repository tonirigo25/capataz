import { headers } from "next/headers";
import { brand } from "@/lib/brand";

type Breadcrumb = readonly [name: string, path: string];
type FAQ = readonly [question: string, answer: string];

export async function PublicStructuredData({ data }: { data: unknown }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <script
      nonce={nonce}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</gu, "\\u003c") }}
    />
  );
}

export function structuredGraph(...items: unknown[]) {
  return { "@context": "https://schema.org", "@graph": items };
}

export function breadcrumbList(items: readonly Breadcrumb[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map(([name, path], index) => ({
      "@type": "ListItem",
      position: index + 1,
      name,
      item: `${brand.publicUrl}${path}`,
    })),
  };
}

export function faqPage(items: readonly FAQ[]) {
  return {
    "@type": "FAQPage",
    mainEntity: items.map(([question, answer]) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  };
}

export function publicPage(type: string, path: string, name: string, description: string) {
  return {
    "@type": type,
    name,
    description,
    url: `${brand.publicUrl}${path}`,
    isPartOf: { "@type": "WebSite", name: brand.productName, url: brand.publicUrl },
  };
}

export function softwareApplication(path: string, name: string, description: string) {
  return {
    "@type": "SoftwareApplication",
    name,
    description,
    url: `${brand.publicUrl}${path}`,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    provider: { "@type": "Organization", name: brand.legalName, url: brand.publicUrl },
  };
}
