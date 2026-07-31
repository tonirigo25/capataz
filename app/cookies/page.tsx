import { LegalPublicPage } from "@/components/marketing/legal-public-page";
import type { Metadata } from "next";
import { brand } from "@/lib/brand";
import { legalConfig } from "@/lib/config/legal";

export const metadata: Metadata = { title: "Cookies", description: `Uso de cookies y almacenamiento técnico en ${brand.productName}.`, alternates: { canonical: "/cookies" }, openGraph: { title: `Cookies en ${brand.productName}`, description: "Información sobre almacenamiento técnico.", images: [brand.socialImage] } };

export default function CookiesPage() {
  return (
    <LegalPublicPage title="Política de cookies" description={<>Borrador parametrizado {legalConfig.documentVersion}. Describe el comportamiento técnico actual de {brand.productName}.</>}>
      <section className="card mt-6 grid gap-4 p-5 text-sm leading-6 text-slate-600">
        <Block title="Uso actual">
          La sesión, seguridad, preferencias y funcionamiento básico usan almacenamiento estrictamente necesario y no dependen del consentimiento de analítica.
        </Block>
        <Block title="Analítica y marketing">
          No hay publicidad ni marketing activados. La analítica propia solo está disponible si el entorno la habilita y no empieza hasta que la persona pulsa “Aceptar analítica”. “Solo esenciales” mantiene el reporter sin montar y no envía métricas.
        </Block>
        <Block title="Gestión">
          El botón “Privacidad” permite retirar o conceder la analítica. También puedes borrar cookies y datos del sitio desde el navegador; algunas funciones esenciales requerirán volver a iniciar sesión.
        </Block>
      </section>
    </LegalPublicPage>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-black text-obra-ink">{title}</h2>
      <p className="mt-1">{children}</p>
    </div>
  );
}
