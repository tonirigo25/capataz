import Link from "next/link";
import { LegalBackButton } from "@/components/legal-back-button";
import { brand } from "@/lib/brand";
import type { Metadata } from "next";
import { legalConfig } from "@/lib/config/legal";

export const metadata: Metadata = { title: "Privacidad", description: `Cómo trata ${brand.productName} los datos necesarios para prestar el servicio.`, alternates: { canonical: "/privacidad" }, openGraph: { title: `Privacidad en ${brand.productName}`, description: "Información sobre datos, control y derechos.", images: [brand.socialImage] } };

export default function PrivacyPage() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-3xl px-4 pb-8 pt-20 sm:px-6">
      <LegalBackButton />
      <Link href="/" className="text-sm font-bold text-slate-600 hover:text-obra-ink">{brand.productName}</Link>
      <h1 className="mt-4 text-3xl font-black text-obra-ink">Política de privacidad</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        Borrador parametrizado {legalConfig.documentVersion}. Requiere revisión legal antes de publicación comercial.
      </p>

      <section className="card mt-6 grid gap-4 p-5 text-sm leading-6 text-slate-600">
        <Block title="Responsable y contacto">
          {legalConfig.controllerName}. {legalConfig.controllerAddress}. Contacto de privacidad: {legalConfig.privacyEmail}. {legalConfig.registrationReference}.
        </Block>
        <Block title={`Datos que puede tratar ${brand.productName}`}>
          Datos de usuario y empresa, datos fiscales, logo, sello, datos de clientes finales, trabajos, presupuestos, facturas, pagos, gastos, agenda, recordatorios y notas operativas.
        </Block>
        <Block title="Finalidad">
          Usamos estos datos para mostrar el espacio de trabajo, organizar clientes y actividad, generar documentos, controlar cobros, preparar recordatorios y ayudar al usuario a gestionar su operación.
        </Block>
        <Block title="IA y automatizaciones">
          Cuando la IA esté activada, podrá proponer acciones o redactar borradores. El usuario mantiene el control final y las acciones sensibles requieren confirmación antes de ejecutarse.
        </Block>
        <Block title="Mensajes y comunicaciones">
          Las comunicaciones y documentos se preparan como borradores. Su envío exige confirmación humana y un proveedor live correctamente configurado; en su ausencia, el sistema falla de forma cerrada.
        </Block>
        <Block title="Conservación y eliminación">
          Puedes solicitar acceso, corrección, oposición, limitación, portabilidad o eliminación escribiendo a {legalConfig.privacyEmail}. Cada solicitud debe verificar identidad y respetar retención y obligaciones legales.
        </Block>
        <Block title="Compartición de datos">
          No se presenta ningún proveedor externo como activo por defecto. Cada integración live requiere finalidad, base jurídica, minimización, contrato, ubicación y salvaguardas revisadas antes de habilitarse.
        </Block>
      </section>
    </main>
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
