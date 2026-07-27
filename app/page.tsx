import type { Metadata } from "next";
import { HeroDemo } from "@/app/marketing-v2/_components/hero-demo";
import { LandingSections, MarketingFooter } from "@/app/marketing-v2/_components/landing-sections";
import { MarketingHeader } from "@/app/marketing-v2/_components/marketing-header";
import styles from "@/app/marketing-v2/page.module.css";
import { brand } from "@/lib/brand";
import { headers } from "next/headers";

export const metadata: Metadata = {
  title: { absolute: `${brand.productName} — ${brand.tagline}` },
  description: `${brand.productName} conecta visitas, presupuestos, trabajos, compras, facturas y cobros para empresas de obra y reformas.`,
  alternates: { canonical: "/" },
  openGraph: {
    title: `${brand.productName} — ${brand.tagline}`,
    description: "Trabajo, documentos y decisiones preparados para revisar.",
    images: [brand.socialImage],
  },
};

const homeStructuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: brand.productName,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: `${brand.productName} conecta la operación desde la visita y el presupuesto hasta la factura y el cobro.`,
  provider: {
    "@type": "Organization",
    name: brand.legalName,
  },
} as const;

export default async function PublicHomePage() {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <div className={styles.page} id="top">
      <script
        nonce={nonce}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeStructuredData).replace(/</gu, "\\u003c") }}
      />
      <a className={styles.skipLink} href="#main-content">Saltar al contenido</a>
      <MarketingHeader />
      <main id="main-content" className={styles.mainContent} tabIndex={-1}>
        <HeroDemo />
        <LandingSections />
      </main>
      <MarketingFooter />
    </div>
  );
}
