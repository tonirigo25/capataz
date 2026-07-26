import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, ChevronDown, Smartphone, Sparkles } from "lucide-react";
import { notFound } from "next/navigation";
import { MarketingPage } from "@/components/marketing/marketing-shell";
import { MobileWorkDemo, OrqenaActionDemo } from "@/components/marketing/product-scenes";
import { PortalPreview } from "@/components/marketing/portal-preview";
import { SectorHeroScene } from "@/components/marketing/sector-scenes";
import { brand } from "@/lib/brand";
import { getMarketingSector, marketingSectorCatalog } from "@/lib/marketing/catalog";

export function generateStaticParams() {
  return marketingSectorCatalog.map((sector) => ({ sector: sector.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ sector: string }> }): Promise<Metadata> {
  const { sector } = await params;
  const item = getMarketingSector(sector);
  if (!item) return {};
  return {
    title: item.name,
    description: item.lead,
    alternates: { canonical: `/sectores/${item.slug}` },
    openGraph: { title: `${item.name} con ${brand.productName}`, description: item.lead, images: [brand.socialImage] },
  };
}

export default async function SectorPage({ params }: { params: Promise<{ sector: string }> }) {
  const { sector } = await params;
  const item = getMarketingSector(sector);
  if (!item) notFound();
  const index = marketingSectorCatalog.findIndex((entry) => entry.slug === item.slug);
  const flow = [item.terminology.clientSingular, "Propuesta", item.terminology.workSingular, "Documento", "Resultado"];
  const modules = ["Clientes", item.terminology.workPlural, "Agenda", "Documentos", "Equipo", brand.productName];

  return (
    <MarketingPage>
      <section className={`sector-detail-hero variant-${index % 4}`}>
        <div className="marketing-container">
          <div><p className="marketing-eyebrow">Sectores / {item.name}</p><h1>{item.name}</h1><p>{item.lead}</p><Link href={`/demo?sector=${item.slug}`} className="marketing-button">Explorar este perfil <ArrowRight size={18} /></Link></div>
          <SectorHeroScene sectorKey={item.key} work={item.terminology.workSingular} owner={item.terminology.owner} />
        </div>
      </section>

      <section className="marketing-container sector-journey">
        <div><p className="marketing-eyebrow">Flujo típico</p><h2 className="marketing-title">{item.story}</h2><p>El ejemplo adapta la operación, no promete una integración ni un caso de éxito.</p></div>
        <ol>{flow.map((step, stepIndex) => <li key={`${step}-${stepIndex}`}><span>{String(stepIndex + 1).padStart(2, "0")}</span><strong>{step}</strong>{stepIndex < flow.length - 1 ? <ArrowRight size={16} /> : <Check size={16} />}</li>)}</ol>
      </section>

      <section className="sector-portals">
        <div className="marketing-container"><div><p className="marketing-eyebrow">Portales</p><h2 className="marketing-title">{item.terminology.owner}, coordinación y equipo comparten contexto, no necesariamente acceso.</h2></div><PortalPreview /></div>
      </section>

      <section className="marketing-container sector-module-strip">
        <div><p className="marketing-eyebrow">Base recomendada</p><h2 className="marketing-title">Seis áreas sostienen este recorrido.</h2></div>
        <div>{modules.map((module, moduleIndex) => <span key={module}><i>{String(moduleIndex + 1).padStart(2, "0")}</i><strong>{module}</strong><small>{moduleIndex < 2 ? "Contexto central" : moduleIndex < 4 ? "Continuidad" : "Responsabilidad"}</small></span>)}</div>
      </section>

      <section className="sector-mobile">
        <div className="marketing-container">
          <div><Smartphone /><p className="marketing-eyebrow">Móvil</p><h2>Una acción clara para el trabajo cotidiano.</h2><p>Instrucciones, avance, evidencia sintética y sincronización con el responsable.</p></div>
          <MobileWorkDemo />
        </div>
      </section>

      <section className="marketing-container sector-assistant">
        <div><Sparkles /><p className="marketing-eyebrow">Orqena en {item.name}</p><h2 className="marketing-title">El contexto ayuda a hablar el mismo idioma.</h2><p>La escena es determinista, usa datos sintéticos y espera confirmación.</p></div>
        <OrqenaActionDemo />
      </section>

      <section className="v4-faq">
        <div className="marketing-container v4-faq__layout">
          <div><p className="marketing-eyebrow">Preguntas del sector</p><h2 className="marketing-title">Alcance profesional, sin promesas regulatorias.</h2></div>
          <div>{[item.faq, ["¿Cambia la seguridad entre sectores?", "No. Cambian vocabulario y prioridades; los accesos se conservan."]].map(([question, answer]) => <details key={question}><summary>{question}<ChevronDown size={18} /></summary><p>{answer}</p></details>)}</div>
        </div>
      </section>

      <section className="v4-final">
        <div className="marketing-container"><p className="marketing-eyebrow">Ejemplo sintético</p><h2>Recorre {item.name.toLocaleLowerCase("es-ES")} desde el perfil que te importa.</h2><p>Sin empresas ficticias presentadas como clientes y sin cifras como prueba social.</p><div><Link href={`/demo?sector=${item.slug}`} className="marketing-button marketing-button--light">Abrir demo <ArrowRight size={18} /></Link></div></div>
      </section>
    </MarketingPage>
  );
}
