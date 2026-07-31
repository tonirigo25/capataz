import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, LifeBuoy, LockKeyhole, MessagesSquare } from "lucide-react";
import { MarketingPage } from "@/components/marketing/marketing-shell";
import { PublicPageHero } from "@/components/marketing/public-page-hero";
import { brand } from "@/lib/brand";

export const metadata: Metadata = { title: "Soporte", description: `Ayuda, privacidad y soporte para usar ${brand.productName} con tranquilidad.`, alternates: { canonical: "/soporte" }, openGraph: { title: `Soporte ${brand.productName}`, description: "Ayuda útil con el contexto justo.", images: [brand.socialImage] } };
export default function SupportPage() {
  return (
    <MarketingPage>
      <PublicPageHero actions={<><a href={`mailto:${brand.supportEmail}`}>Escribir a soporte <ArrowRight size={18} /></a><Link href="/privacidad">Consultar privacidad</Link></>} breadcrumbs={[{ label: "Inicio", href: "/" }, { label: "Soporte" }]} compact description="Podemos ayudarte con el acceso, una incidencia, la revisión de datos o una solicitud de privacidad. Nunca envíes contraseñas, códigos o documentos sensibles por correo." eyebrow="Soporte" id="soporte" title="Ayuda útil, con el contexto justo." variant="centered" />
      <section className="marketing-container py-12 lg:py-16">
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {[
            [LifeBuoy, "Uso e incidencias", "Describe la pantalla, el resultado esperado y lo que ocurrió."],
            [LockKeyhole, "Privacidad y datos", "Solicita acceso, rectificación o eliminación desde un canal identificado."],
            [MessagesSquare, "Acompañamiento temporal", "El soporte solo accede al contexto autorizado y durante el tiempo necesario."],
          ].map(([Icon, title, copy]) => { const Mark = Icon as typeof LifeBuoy; return <article key={title as string} className="marketing-security-card"><Mark size={24} /><h2>{title as string}</h2><p>{copy as string}</p></article>; })}
        </div>
      </section>
    </MarketingPage>
  );
}
