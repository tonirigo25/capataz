import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Link2, UsersRound } from "lucide-react";
import { notFound } from "next/navigation";
import { MarketingPage } from "@/components/marketing/marketing-shell";
import { MarketingScene } from "@/components/marketing/scene-resolver";
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
    openGraph: { images: [brand.socialImage] },
  };
}

export default async function ModulePage({ params }: { params: Promise<{ modulo: string }> }) {
  const { modulo } = await params;
  const item = getMarketingModule(modulo);
  if (!item) notFound();

  return (
    <MarketingPage>
      <section className={`module-hero module-hero--${item.visualTone}`}>
        <div className="marketing-container">
          <div>
            <p className="marketing-eyebrow">Producto / {item.eyebrow}</p>
            <h1>{item.name}</h1>
            <p>{item.result}</p>
            <div><Link href="/demo" className="marketing-button">Explorar con datos demo <ArrowRight size={18} /></Link></div>
          </div>
          <aside>
            <span>El problema</span>
            <p>{item.problem}</p>
            <strong>El resultado</strong>
            <p>{item.result}</p>
          </aside>
        </div>
      </section>

      <section className="marketing-container v4-section">
        <MarketingScene name={item.scene} />
      </section>

      <section className="module-details">
        <div className="marketing-container">
          <div>
            <UsersRound />
            <p className="marketing-eyebrow">Perfiles</p>
            <h2>Una experiencia adaptada a la responsabilidad.</h2>
            <ul>{item.profiles.map((profile) => <li key={profile}>{profile}</li>)}</ul>
          </div>
          <div>
            <Link2 />
            <p className="marketing-eyebrow">Relaciones</p>
            <h2>No funciona como una isla.</h2>
            <ul>{item.relations.map((relation) => <li key={relation}>{relation}</li>)}</ul>
          </div>
        </div>
      </section>

      <section className="marketing-container v4-section">
        <div className="module-features">
          <div><p className="marketing-eyebrow">Funciones con propósito</p><h2 className="marketing-title">Lo necesario para avanzar sin perder la explicación.</h2></div>
          <ol>{item.features.map((feature, index) => <li key={feature}><span>{String(index + 1).padStart(2, "0")}</span><Check size={18} /><strong>{feature}</strong></li>)}</ol>
        </div>
      </section>

      <section className="v4-final">
        <div className="marketing-container">
          <p className="marketing-eyebrow">Siguiente paso</p>
          <h2>{item.cta}</h2>
          <p>Selecciona un sector y un perfil para ver cómo cambia el lenguaje sin cambiar la base de seguridad.</p>
          <div><Link href="/demo" className="marketing-button marketing-button--light">Abrir demo <ArrowRight size={18} /></Link></div>
        </div>
      </section>
    </MarketingPage>
  );
}
