import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Clock3, ExternalLink, ShieldAlert } from "lucide-react";
import { MarketingPage } from "@/components/marketing/marketing-shell";
import { PublicStructuredData, breadcrumbList, publicPage, structuredGraph } from "@/components/marketing/public-structured-data";
import { brand } from "@/lib/brand";
import mobileCapabilities from "@/contracts/mobile/v1/capability-matrix.json";

export const metadata: Metadata = {
  title: "Estado y disponibilidad",
  description: `Estado verificable de las capacidades públicas, beta y externas de ${brand.productName}.`,
  alternates: { canonical: "/estado" },
  openGraph: {
    title: `Estado de ${brand.productName}`,
    description: "Capacidades disponibles, beta y pendientes sin afirmar un SLA no contratado.",
    images: [brand.socialImage],
  },
};

const states = [
  {
    status: "Disponible en el RC",
    icon: CheckCircle2,
    items: ["Clientes, presupuestos y trabajos", "Compras, documentos y control económico", "Permisos, aislamiento y confirmación humana"],
  },
  {
    status: "Activación controlada",
    icon: CheckCircle2,
    items: ["IA real sólo para empresas autorizadas", "Voz y transcripción con revisión humana", "Correo transaccional: recuperación, invitaciones y contacto"],
  },
  {
    status: "Beta privada",
    icon: Clock3,
    items: ["Incorporación acompañada", "Pilotos y métricas todavía no reales", "Registro autónomo cerrado por defecto"],
  },
  {
    status: "Gate externo",
    icon: ShieldAlert,
    items: ["Indexación y registro público", "Billing, precios y transmisión fiscal", "SLA, PITR nativo y distribución móvil firmada"],
  },
] as const;

export default function StatusPage() {
  return (
    <MarketingPage>
      <PublicStructuredData data={structuredGraph(
        publicPage("WebPage", "/estado", "Estado de Orqena", "Capacidades disponibles, beta y pendientes sin afirmar un SLA no contratado."),
        breadcrumbList([["Inicio", ""], ["Estado", "/estado"]]),
      )} />
      <section className="marketing-container py-16 lg:py-24">
        <p className="marketing-eyebrow">Estado del producto</p>
        <h1 className="marketing-display mt-4 max-w-5xl">Lo disponible se separa de lo que aún necesita una aprobación.</h1>
        <p className="marketing-lede mt-5 max-w-3xl">
          Esta página no declara un SLA, porcentaje histórico de disponibilidad ni
          certificación. El health endpoint informa del proceso actual, no sustituye
          un historial de incidentes.
        </p>
        <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {states.map(({ status, icon: Icon, items }) => (
            <article className="card p-6" key={status}>
              <Icon aria-hidden="true" />
              <h2 className="mt-5 text-xl font-black">{status}</h2>
              <ul className="mt-4 grid gap-3 text-sm leading-6 text-content-secondary">
                {items.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </article>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          <a className="marketing-outline-button" href="/api/status">
            Consultar health actual <ExternalLink size={16} aria-hidden="true" />
          </a>
          <Link className="marketing-outline-button" href="/seguridad">Seguridad</Link>
          <Link className="marketing-outline-button" href="/privacidad">Privacidad</Link>
          <Link className="marketing-button" href="/contacto">Preguntar por un gate</Link>
        </div>
        <section className="mt-16 border-t border-border pt-10" aria-labelledby="mobile-capabilities">
          <p className="marketing-eyebrow">Promesa móvil verificable</p>
          <h2 className="mt-3 text-3xl font-black" id="mobile-capabilities">Web y PWA ahora; stores solo después de sus gates.</h2>
          <p className="marketing-lede mt-4 max-w-4xl">{mobileCapabilities.publicPromise}</p>
          <div
            aria-label="Matriz de capacidades móviles desplazable"
            className="mt-8 overflow-x-auto"
            tabIndex={0}
          >
            <table className="min-w-full border-collapse text-left text-sm">
              <thead><tr><th className="border-b border-border px-3 py-3">Capacidad</th><th className="border-b border-border px-3 py-3">Estado</th><th className="border-b border-border px-3 py-3">Evidencia necesaria</th></tr></thead>
              <tbody>{mobileCapabilities.capabilities.map((capability) => <tr key={capability.id}><th className="border-b border-border px-3 py-3 font-bold">{capability.label}</th><td className="border-b border-border px-3 py-3">{mobileStatus(capability.status)}</td><td className="border-b border-border px-3 py-3 text-content-secondary">{capability.evidence}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      </section>
    </MarketingPage>
  );
}

function mobileStatus(status: string) {
  return ({
    AVAILABLE_IN_RC: "Disponible en el RC",
    PREPARED_NOT_SUBMITTED: "Preparado, no enviado",
    READY_FOR_EXTERNAL_INPUT: "Pendiente de entrada externa",
    NOT_SUPPORTED: "No soportado",
  } as Record<string, string>)[status] ?? status;
}
