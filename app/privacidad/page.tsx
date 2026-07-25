import Link from "next/link";
import { LegalBackButton } from "@/components/legal-back-button";
import { brand } from "@/lib/brand";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacidad", description: "Cómo trata Orqena los datos necesarios para prestar el servicio.", alternates: { canonical: "/privacidad" }, openGraph: { title: "Privacidad en Orqena", description: "Información sobre datos, control y derechos.", images: [brand.socialImage] } };

export default function PrivacyPage() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-3xl px-4 pb-8 pt-20 sm:px-6">
      <LegalBackButton />
      <Link href="/" className="text-sm font-bold text-slate-600 hover:text-obra-ink">Orqena</Link>
      <h1 className="mt-4 text-3xl font-black text-obra-ink">Política de privacidad</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        Esta política explica qué datos puede tratar Orqena y cómo se usan para prestar el servicio de gestión empresarial.
      </p>

      <section className="card mt-6 grid gap-4 p-5 text-sm leading-6 text-slate-600">
        <Block title="Datos que puede guardar Orqena">
          Datos de usuario y empresa, datos fiscales, logo, sello, datos de clientes finales, trabajos, presupuestos, facturas, pagos, gastos, agenda, recordatorios y notas operativas.
        </Block>
        <Block title="Finalidad">
          Usamos estos datos para mostrar el espacio de trabajo, organizar clientes y actividad, generar documentos, controlar cobros, preparar recordatorios y ayudar al usuario a gestionar su operación.
        </Block>
        <Block title="IA y automatizaciones">
          Cuando la IA esté activada, podrá proponer acciones o redactar borradores. El usuario mantiene el control final y las acciones sensibles requieren confirmación antes de ejecutarse.
        </Block>
        <Block title="Mensajes y comunicaciones">
          Orqena no envía comunicaciones ni documentos reales sin consentimiento explícito del usuario.
        </Block>
        <Block title="Conservación y eliminación">
          Puedes solicitar acceso, corrección o eliminación de datos escribiendo a {brand.supportEmail}. Las demostraciones identificadas como sintéticas pueden reiniciarse.
        </Block>
        <Block title="Compartición de datos">
          No vendemos datos personales. Sólo se compartirán datos con proveedores necesarios para prestar el servicio cuando se activen integraciones reales, con las garantías correspondientes.
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
