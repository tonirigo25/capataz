import type { Metadata } from "next";
import Link from "next/link";
import { DemoRequestForm } from "@/components/marketing/demo-request-form";
import { MarketingPage } from "@/components/marketing/marketing-shell";
import { PublicPageHero } from "@/components/marketing/public-page-hero";
import { PublicStructuredData, breadcrumbList, publicPage, structuredGraph } from "@/components/marketing/public-structured-data";
import { brand } from "@/lib/brand";

export const metadata: Metadata = { title: "Contacto", description: `Contacta con ${brand.productName} para hablar de la operación de tu equipo.`, alternates: { canonical: "/contacto" }, openGraph: { title: `Contacto ${brand.productName}`, description: "Hablemos de la operación de tu equipo.", images: [brand.socialImage] } };
export default function ContactPage() { return <MarketingPage><PublicStructuredData data={structuredGraph(publicPage("ContactPage", "/contacto", "Contacto Orqena", "Solicita información o una demostración privada de Orqena."), breadcrumbList([["Inicio", ""], ["Contacto", "/contacto"]]))} /><PublicPageHero actions={<><Link href="/soporte">Soporte e incidencias</Link><Link href="/privacidad">Privacidad y datos</Link></>} breadcrumbs={[{ label: "Inicio", href: "/" }, { label: "Contacto" }]} description="Ventas, colaboración y acceso a la beta privada se atienden desde este formulario persistente. No pedimos contraseñas, datos de acceso ni información sensible." eyebrow="Contacto" id="contacto" title="Hablemos de lo que hoy os frena." variant="split" visual={<DemoRequestForm kind="contact" />} /></MarketingPage>; }
