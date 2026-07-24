import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Network, Sparkles } from "lucide-react";
import { BrandCandidateGrid } from "@/components/brand/brand-candidate-grid";
import { MarketingPage, SectionIntro } from "@/components/marketing/marketing-shell";
import { HeroProductOrchestra, RolePortalStudio } from "@/components/marketing/product-scenes";
import { marketingProductCatalog } from "@/lib/marketing/catalog";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Producto",
  description: "Conoce cómo Orqena conecta clientes, trabajo, ventas, compras, agenda, documentos, equipo y finanzas.",
  alternates: { canonical: "/producto" },
  openGraph: { images: [brand.socialImage] },
};

export default function ProductPage() {
  return (
    <MarketingPage>
      <section className="marketing-container v4-section">
        <SectionIntro
          eyebrow="Producto conectado"
          title="Una operación completa, explicada por sus relaciones."
          description="Orqena une personas, clientes, trabajo, agenda, documentos y decisiones. El contexto acompaña a la actividad en lugar de quedarse atrapado en una pantalla."
        />
        <div className="mt-12"><HeroProductOrchestra /></div>
      </section>

      <section className="product-catalog-section">
        <div className="marketing-container v4-section">
          <div className="v4-section__intro">
            <p className="marketing-eyebrow">Diez experiencias</p>
            <h2 className="marketing-title">Cada área resuelve un problema distinto. Todas comparten el mismo hilo.</h2>
          </div>
          <div className="product-catalog-grid">
            {marketingProductCatalog.map((item, index) => (
              <Link href={`/producto/${item.slug}`} key={item.slug} className={`product-catalog-card is-${item.visualTone}`}>
                <span>{String(index + 1).padStart(2, "0")} · {item.eyebrow}</span>
                <h2>{item.name}</h2>
                <p>{item.result}</p>
                <ul>{item.relations.map((relation) => <li key={relation}>{relation}</li>)}</ul>
                <i>{item.cta} <ArrowRight size={16} /></i>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="marketing-container v4-section">
        <div className="product-portal-intro">
          <div>
            <p className="marketing-eyebrow">Portales auténticos</p>
            <h2 className="marketing-title">La responsabilidad cambia la experiencia, no solo la visibilidad.</h2>
            <ul>
              {["Navegación priorizada", "Acción principal propia", "Datos económicos solo cuando corresponden"].map((item) => (
                <li key={item}><Check size={17} />{item}</li>
              ))}
            </ul>
          </div>
          <RolePortalStudio />
        </div>
      </section>

      <section className="product-principles">
        <div className="marketing-container">
          <article><Network /><h2>Relaciones antes que silos</h2><p>Cliente, trabajo y documento conservan el vínculo que explica la actividad.</p></article>
          <article><Sparkles /><h2>Propuestas antes que automatismos</h2><p>Orqena prepara el siguiente paso y espera una decisión humana cuando importa.</p></article>
        </div>
      </section>

      <BrandCandidateGrid />

      <section className="v4-final">
        <div className="marketing-container">
          <p className="marketing-eyebrow">Explora con datos sintéticos</p>
          <h2>Recorre Orqena desde el sector y el perfil que te interesan.</h2>
          <p>La demo pública no presenta cifras, empresas ni testimonios como prueba social.</p>
          <div><Link href="/demo" className="marketing-button marketing-button--light">Abrir demo <ArrowRight size={18} /></Link></div>
        </div>
      </section>
    </MarketingPage>
  );
}
