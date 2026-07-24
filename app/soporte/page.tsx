import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, LifeBuoy, LockKeyhole, MessagesSquare } from "lucide-react";
import { MarketingPage, SectionIntro } from "@/components/marketing/marketing-shell";
import { brand } from "@/lib/brand";

export const metadata: Metadata = { title: "Soporte", description: "Ayuda, privacidad y soporte para usar Orqena con tranquilidad.", alternates: { canonical: "/soporte" } };
export default function SupportPage() {
  return (
    <MarketingPage>
      <section className="marketing-container py-14 lg:py-24">
        <SectionIntro eyebrow="Soporte" title="Ayuda útil, con el contexto justo." description="Podemos ayudarte con el acceso, una incidencia, la revisión de datos o una solicitud de privacidad. Nunca envíes contraseñas, códigos o documentos sensibles por correo." />
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {[
            [LifeBuoy, "Uso e incidencias", "Describe la pantalla, el resultado esperado y lo que ocurrió."],
            [LockKeyhole, "Privacidad y datos", "Solicita acceso, rectificación o eliminación desde un canal identificado."],
            [MessagesSquare, "Acompañamiento temporal", "El soporte solo accede al contexto autorizado y durante el tiempo necesario."],
          ].map(([Icon, title, copy]) => { const Mark = Icon as typeof LifeBuoy; return <article key={title as string} className="marketing-security-card"><Mark size={24} /><h2>{title as string}</h2><p>{copy as string}</p></article>; })}
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          <a className="marketing-button" href={`mailto:${brand.supportEmail}`}>Escribir a soporte <ArrowRight size={18} /></a>
          <Link className="marketing-outline-button" href="/privacidad">Consultar privacidad</Link>
        </div>
      </section>
    </MarketingPage>
  );
}
