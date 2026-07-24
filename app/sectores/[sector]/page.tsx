import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, ChevronDown, Smartphone, Sparkles, UsersRound } from "lucide-react";
import { notFound } from "next/navigation";
import { MarketingPage } from "@/components/marketing/marketing-shell";
import { MobileWorkDemo, OrqenaActionDemo, RolePortalStudio } from "@/components/marketing/product-scenes";
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
    openGraph: { images: [brand.socialImage] },
  };
}

export default async function SectorPage({ params }: { params: Promise<{ sector: string }> }) {
  const { sector } = await params;
  const item = getMarketingSector(sector);
  if (!item) notFound();
  const flow = [item.terminology.clientSingular, "Presupuesto", item.terminology.workSingular, "Factura", "Resultado"];

  return (
    <MarketingPage>
      <section className="sector-profile-hero">
        <div className="marketing-container">
          <div>
            <p className="marketing-eyebrow">Sectores / {item.name}</p>
            <h1>{item.name}</h1>
            <p>{item.lead}</p>
            <Link href="/demo" className="marketing-button">Explorar este perfil <ArrowRight size={18} /></Link>
          </div>
          <aside>
            <span>Vocabulario activo</span>
            <dl>
              <div><dt>Relación</dt><dd>{item.terminology.clientSingular}</dd></div>
              <div><dt>Operación</dt><dd>{item.terminology.workSingular}</dd></div>
              <div><dt>Responsabilidad</dt><dd>{item.terminology.owner}</dd></div>
              <div><dt>Progreso</dt><dd>{item.terminology.progress}</dd></div>
            </dl>
          </aside>
        </div>
      </section>

      <section className="marketing-container v4-section sector-flow">
        <div><p className="marketing-eyebrow">Flujo adaptado</p><h2 className="marketing-title">{item.story}</h2></div>
        <ol>{flow.map((step, index) => <li key={`${step}-${index}`}><span>{index + 1}</span><strong>{step}</strong>{index < flow.length - 1 ? <ArrowRight /> : <Check />}</li>)}</ol>
      </section>

      <section className="sector-demo-section">
        <div className="marketing-container v4-section">
          <div className="sector-demo-intro"><UsersRound /><p className="marketing-eyebrow">Portales</p><h2 className="marketing-title">Cada responsabilidad recibe su propia prioridad.</h2><p>{item.terminology.owner}, coordinación y equipo comparten contexto sin compartir necesariamente el mismo acceso.</p></div>
          <RolePortalStudio />
        </div>
      </section>

      <section className="marketing-container v4-section sector-modules">
        <div><p className="marketing-eyebrow">Módulos recomendados</p><h2 className="marketing-title">La base que sostiene este recorrido.</h2></div>
        <div>{["Clientes", item.terminology.workPlural, "Agenda", "Documentos", "Equipo", "Orqena"].map((module) => <span key={module}>{module}</span>)}</div>
      </section>

      <section className="sector-split">
        <div className="marketing-container">
          <div><Smartphone /><p className="marketing-eyebrow">Móvil</p><h2>El trabajo cotidiano cabe en una acción clara.</h2><p>Agenda, tareas e instrucciones se priorizan según el portal.</p></div>
          <MobileWorkDemo />
        </div>
      </section>

      <section className="marketing-container v4-section sector-orqena">
        <div><Sparkles /><p className="marketing-eyebrow">Orqena</p><h2 className="marketing-title">El contexto sectorial ayuda a hablar el mismo idioma.</h2><p>La demo es determinista y no realiza llamadas externas.</p></div>
        <OrqenaActionDemo />
      </section>

      <section className="v4-faq">
        <div className="marketing-container v4-faq__layout">
          <div><p className="marketing-eyebrow">Preguntas del sector</p><h2 className="marketing-title">Alcance claro, sin promesas regulatorias.</h2></div>
          <div>
            {[item.faq, ["¿Cambia la seguridad entre sectores?", "No. El sector cambia vocabulario y prioridades; el sistema de acceso permanece."]].map(([question, answer]) => (
              <details key={question}><summary>{question}<ChevronDown size={18} /></summary><p>{answer}</p></details>
            ))}
          </div>
        </div>
      </section>

      <section className="v4-final">
        <div className="marketing-container">
          <p className="marketing-eyebrow">Demo sintética</p>
          <h2>Recorre {item.name.toLocaleLowerCase("es")} desde el perfil que te importa.</h2>
          <p>Sin clientes ficticios presentados como reales y sin cifras usadas como prueba social.</p>
          <div><Link href={`/demo?sector=${item.slug}`} className="marketing-button marketing-button--light">Abrir demo <ArrowRight size={18} /></Link></div>
        </div>
      </section>
    </MarketingPage>
  );
}
