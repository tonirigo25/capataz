import { LegalPublicPage } from "@/components/marketing/legal-public-page";
import type { Metadata } from "next";
import { brand } from "@/lib/brand";
import { legalConfig } from "@/lib/config/legal";

export const metadata: Metadata = { title: "Términos de uso", description: `Condiciones de uso de ${brand.productName} durante la beta privada.`, alternates: { canonical: "/terminos" }, openGraph: { title: `Términos de ${brand.productName}`, description: "Condiciones de uso y control de las acciones.", images: [brand.socialImage] } };

export default function TermsPage() {
  return (
    <LegalPublicPage title="Términos de uso" description={<>Borrador parametrizado {legalConfig.documentVersion} para la beta privada de {brand.productName}. Requiere revisión legal antes de uso contractual.</>}>
      <section className="card mt-6 grid gap-4 p-5 text-sm leading-6 text-slate-600">
        <Block title="Uso de la herramienta">
          El usuario es responsable de introducir datos correctos, revisar propuestas y confirmar cualquier acción sensible antes de guardarla, enviarla o programarla.
        </Block>
        <Block title="Identidad contractual">
          {legalConfig.controllerName}. {legalConfig.controllerAddress}. {legalConfig.registrationReference}. Mientras estos campos no estén confirmados, esta página no constituye una oferta comercial ni un contrato definitivo.
        </Block>
        <Block title="Presupuestos y facturas">
          Los documentos generados son una ayuda operativa. Las facturas o borradores deben revisarse con una asesoría o gestoría si no hay facturación legal definitiva configurada.
        </Block>
        <Block title="Comunicaciones">
          {brand.productName} prepara mensajes y recordatorios, pero el envío exige confirmación explícita y una integración live habilitada. Los proveedores fake no transmiten contenido fuera del entorno aislado.
        </Block>
        <Block title="Modo demo">
          El modo demo usa datos ficticios para que revisores y usuarios puedan probar dashboard, agenda, presupuestos, facturas, PDFs, recordatorios y chat sin crear datos reales ni pagar.
        </Block>
        <Block title="Disponibilidad">
          La versión móvil puede depender de un backend web accesible. En entornos de prueba, algunas integraciones externas pueden estar simuladas o desactivadas.
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
