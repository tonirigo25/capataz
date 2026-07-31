import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Gauge, HardDrive, UsersRound } from "lucide-react";
import { MarketingPage } from "@/components/marketing/marketing-shell";
import { PublicPageHero } from "@/components/marketing/public-page-hero";
import { brand } from "@/lib/brand";
import { planCatalog } from "@/lib/commercial/plans";
import { PUBLIC_PRICING_ENABLED } from "@/lib/commercial/unit-economics";

export const metadata: Metadata = {
  title: "Planes",
  description: `Compara capacidades, límites y soporte de los planes de ${brand.productName} sin precios públicos no aprobados.`,
  alternates: { canonical: "/planes" },
  openGraph: { title: `Planes ${brand.productName}`, description: "Capacidades y límites explicados con claridad.", images: [brand.socialImage] },
};

const displayNames = { STARTER: "Inicial", PROFESSIONAL: "Profesional", BUSINESS: "Empresa", ENTERPRISE: "A medida" } as const;
const support = { STARTER: "Soporte estándar", PROFESSIONAL: "Acompañamiento de equipo", BUSINESS: "Soporte prioritario", ENTERPRISE: "Acuerdo de soporte" } as const;

export default function PlansPage() {
  return (
    <MarketingPage>
      <PublicPageHero breadcrumbs={[{ label: "Inicio", href: "/" }, { label: "Planes" }]} compact description="La beta privada mantiene el precio público desactivado. Compara empresas, personas, documentos, IA, almacenamiento y soporte." eyebrow="Planes y límites" id="planes" title="Elige por capacidad, no por una cifra sin contexto." variant="centered"><p><strong>Precio público desactivado.</strong> Los costes internos y el margen sólo se modelan en el control interno autorizado.</p></PublicPageHero>

      <section className="marketing-container plans-grid" data-public-pricing={PUBLIC_PRICING_ENABLED ? "enabled" : "disabled"}>
        {Object.entries(planCatalog).map(([key, plan], index) => {
          const planKey = key as keyof typeof displayNames;
          const features = Object.entries(plan.entitlements).filter(([, value]) => value === true).map(([name]) => featureLabel(name)).slice(0, 6);
          const storage = Number(plan.entitlements.storage_bytes ?? 0) / 1_000_000_000;
          return (
            <article key={key} className={index === 1 ? "is-featured" : ""}>
              <header><p className="marketing-eyebrow">{String(index + 1).padStart(2, "0")}</p><h2>{displayNames[planKey]}</h2><p>{plan.audience}</p></header>
              <div className="plans-grid__limits">
                <Limit icon={UsersRound} label="Personas" value={limit(plan.entitlements.max_members)} />
                <Limit icon={Gauge} label="Empresas" value={limit(plan.entitlements.max_companies)} />
                <Limit icon={HardDrive} label="Documentos/mes" value={limit(plan.entitlements.max_documents)} />
                <Limit icon={Gauge} label={`Acciones ${brand.productName}`} value={limit(plan.entitlements.monthly_orqena_actions)} />
                <Limit icon={HardDrive} label="Almacenamiento" value={`${storage.toLocaleString("es-ES")} GB`} />
              </div>
              <div className="plans-grid__features"><strong>Incluye</strong><ul>{features.map((feature) => <li key={feature}><Check size={15} />{feature}</li>)}</ul></div>
              <dl><div><dt>Soporte</dt><dd>{support[planKey]}</dd></div><div><dt>Sobreuso</dt><dd>{planKey === "STARTER" ? "Revisión antes de ampliar" : "Allowance y recarga bajo acuerdo"}</dd></div></dl>
              <Link href="/demo" className={index === 1 ? "marketing-button" : "marketing-outline-button"}>Revisar {displayNames[planKey]} <ArrowRight size={16} /></Link>
            </article>
          );
        })}
      </section>

      <section className="plans-explainer">
        <div className="marketing-container">
          <div><p className="marketing-eyebrow">Cómo leer los límites</p><h2 className="marketing-title">Capacidad incluida, aviso y decisión antes del sobreuso.</h2><p>“A medida” no significa ilimitado: infraestructura, almacenamiento, procesamiento documental e IA tienen costes que deben acordarse.</p></div>
          <ol><li><span>01</span><strong>Uso visible</strong><p>La empresa conoce su consumo.</p></li><li><span>02</span><strong>Aviso previo</strong><p>El límite no aparece por sorpresa.</p></li><li><span>03</span><strong>Decisión comercial</strong><p>Ninguna ampliación se presenta como aplicada sin revisión.</p></li></ol>
        </div>
      </section>

      <section className="marketing-container plans-close">
        <h2 className="marketing-title">La elección empieza por entender cómo trabaja tu equipo.</h2>
        <p>Selecciona sector, perfil y objetivo para recorrer el producto antes de hablar de condiciones.</p>
        <Link className="marketing-button" href="/demo">Explorar la demo <ArrowRight size={18} /></Link>
      </section>
    </MarketingPage>
  );
}

function Limit({ icon: Icon, label, value }: { icon: typeof UsersRound; label: string; value: string }) {
  return <div><Icon size={16} /><span><small>{label}</small><strong>{value}</strong></span></div>;
}
function limit(value: unknown) { return Number(value ?? 0).toLocaleString("es-ES"); }
function featureLabel(value: string) {
  const labels: Record<string, string> = { multi_company: "Multiempresa", advanced_permissions: "Permisos avanzados", custom_roles: "Roles configurables", team_management: "Gestión de equipo", team_scopes: "Alcances por equipo", orqena_chat: `Consultas con ${brand.productName}`, orqena_actions: "Acciones bajo confirmación", orqena_memory: "Memoria de negocio", document_extraction: "Extracción documental", advanced_reports: "Informes avanzados", automations: "Automatizaciones", audit_log: "Registro de auditoría" };
  return labels[value] ?? value.replaceAll("_", " ");
}
