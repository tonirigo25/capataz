import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, ChevronDown, Link2, UsersRound } from "lucide-react";
import { notFound } from "next/navigation";
import { MarketingPage } from "@/components/marketing/marketing-shell";
import { ModuleSignatureScene } from "@/components/marketing/module-scenes";
import { brand } from "@/lib/brand";
import { getMarketingModule, marketingProductCatalog } from "@/lib/marketing/catalog";

export function generateStaticParams() {
  return marketingProductCatalog.map((module) => ({ modulo: module.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ modulo: string }> }): Promise<Metadata> {
  const { modulo } = await params;
  const item = getMarketingModule(modulo);
  if (!item) return {};
  return {
    title: item.metadata.title,
    description: item.metadata.description,
    alternates: { canonical: `/producto/${item.slug}` },
    openGraph: { title: item.metadata.title, description: item.metadata.description, images: [brand.socialImage] },
  };
}

export default async function ModulePage({ params }: { params: Promise<{ modulo: string }> }) {
  const { modulo } = await params;
  const item = getMarketingModule(modulo);
  if (!item) notFound();

  return (
    <MarketingPage>
      <section className={`module-hero module-hero--${item.visualTone} module-family--${item.family}`}>
        <div className="marketing-container">
          <div>
            <p className="marketing-eyebrow">Producto / {item.eyebrow}</p>
            <h1>{item.name}</h1>
            <p>{item.result}</p>
            <div><Link href={`/demo?objetivo=${item.slug}`} className="marketing-button">Explorar con datos sintéticos <ArrowRight size={18} /></Link></div>
          </div>
          <aside>
            <span>Problema que resuelve</span>
            <p>{item.problem}</p>
            <strong>Resultado visible</strong>
            <p>{item.result}</p>
          </aside>
        </div>
      </section>

      <section className="marketing-container module-scene-section">
        <ModuleSignatureScene slug={item.slug} />
      </section>

      <section className="module-journey">
        <div className="marketing-container">
          <div><p className="marketing-eyebrow">Recorrido</p><h2 className="marketing-title">Una secuencia completa, no una función aislada.</h2></div>
          <ol>{item.workflow.map((step, index) => <li key={step}><span>{String(index + 1).padStart(2, "0")}</span><strong>{step}</strong>{index < item.workflow.length - 1 ? <ArrowRight size={16} /> : <Check size={16} />}</li>)}</ol>
        </div>
      </section>

      <section className="module-details">
        <div className="marketing-container">
          <div><UsersRound /><p className="marketing-eyebrow">Perfiles</p><h2>La responsabilidad cambia el foco.</h2><ul>{item.profiles.map((profile) => <li key={profile}>{profile}</li>)}</ul></div>
          <div><Link2 /><p className="marketing-eyebrow">Relaciones</p><h2>El contexto continúa en otras áreas.</h2><ul>{item.relations.map((relation) => <li key={relation}>{relation}</li>)}</ul></div>
        </div>
      </section>

      <section className="marketing-container module-outcomes">
        <div><p className="marketing-eyebrow">Resultados concretos</p><h2 className="marketing-title">Lo necesario para avanzar con una explicación.</h2></div>
        <ol>{item.features.map((feature, index) => <li key={feature}><span>{String(index + 1).padStart(2, "0")}</span><Check size={18} /><strong>{feature}</strong><small>{index === 0 ? "Contexto visible" : index === 1 ? "Estado comprensible" : "Siguiente acción clara"}</small></li>)}</ol>
      </section>

      <section className="v4-faq module-faq">
        <div className="marketing-container v4-faq__layout">
          <div><p className="marketing-eyebrow">Preguntas de {item.name}</p><h2 className="marketing-title">Alcance claro antes de explorar.</h2></div>
          <div>{item.faq.map(([question, answer]) => <details key={question}><summary>{question}<ChevronDown size={18} /></summary><p>{answer}</p></details>)}</div>
        </div>
      </section>

      <section className="v4-final module-final">
        <div className="marketing-container">
          <p className="marketing-eyebrow">Siguiente paso</p>
          <h2>{item.cta}</h2>
          <p>Selecciona sector, perfil y objetivo. No necesitas registrarte para recorrer la demo.</p>
          <div><Link href={`/demo?objetivo=${item.slug}`} className="marketing-button marketing-button--light">Abrir demo <ArrowRight size={18} /></Link></div>
        </div>
      </section>
    </MarketingPage>
  );
}
