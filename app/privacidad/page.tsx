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
          OpenAI presta las funciones de IA únicamente a las empresas expresamente habilitadas. Se envía el contexto mínimo permitido para cada caso, con minimización y redacción previa. La IA prepara propuestas: el usuario puede revisarlas, corregirlas, desactivar la IA para su empresa y debe confirmar cualquier acción sensible. Aplicamos límites de uso y coste. Solicitamos <code>store=false</code> en las llamadas compatibles; esto no equivale a Zero Data Retention ni garantiza la ausencia absoluta de registros técnicos del proveedor.
        </Block>
        <Block title="Mensajes y comunicaciones">
          Resend procesa la dirección del destinatario y metadatos de entrega para recuperación y cambio de contraseña, invitaciones, contacto y avisos operativos autorizados. El marketing masivo y el seguimiento permanecen desactivados. La aceptación del mensaje por el proveedor no se presenta como entrega confirmada: rebotes, quejas y supresiones se registran mediante eventos firmados.
        </Block>
        <Block title="Conservación y eliminación">
          No guardamos prompts, documentos ni respuestas en los registros agregados de uso de IA. Para idempotencia y revisión, Orqena puede conservar una envolvente de respuesta durante un máximo de siete días, además de metadatos técnicos seudonimizados conforme a la política aplicable. El proveedor puede mantener registros de seguridad según las condiciones vigentes de su cuenta. Puedes solicitar acceso, corrección, oposición, limitación, portabilidad o eliminación escribiendo a {legalConfig.privacyEmail}; cada solicitud debe verificar identidad y respetar las obligaciones legales aplicables.
        </Block>
        <Block title="Compartición de datos">
          Railway presta el alojamiento, el almacenamiento privado conserva los documentos, OpenAI actúa como proveedor de las funciones de IA controladas y Resend entrega el correo transaccional. Stripe y los proveedores de fiscalidad, analítica no esencial o marketing no están activos. Cada integración se limita a su finalidad y debe mantener minimización, contrato, ubicación y salvaguardas documentadas.
          No se presenta ningún proveedor externo como activo por defecto: OpenAI y Resend sólo operan en los casos autorizados y bajo los controles descritos en esta política.
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
