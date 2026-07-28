import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Network, Smartphone, Sparkles } from "lucide-react";
import { MarketingPage } from "@/components/marketing/marketing-shell";
import { HeroProductOrchestra, RolePortalStudio } from "@/components/marketing/product-scenes";
import { marketingProductCatalog } from "@/lib/marketing/catalog";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Producto",
  description: `Descubre cómo ${brand.productName} conecta clientes, trabajo, ventas, compras, agenda, documentos, equipo y finanzas.`,
  alternates: { canonical: "/producto" },
  openGraph: { title: `Producto ${brand.productName}`, description: "Una operación conectada de principio a fin.", images: [brand.socialImage] },
};

const journeys = [
  ["Captar y convertir", "Cliente → propuesta → aprobación → trabajo", ["clientes", "ventas", "agenda"]],
  ["Coordinar y entregar", "Plan → equipo → avance → documento", ["trabajo", "equipo", "movil"]],
  ["Comprar y controlar", "Solicitud → factura → vencimiento → tesorería", ["compras", "documentos", "finanzas"]],
] as const;

export default function ProductPage() {
  return (
    <MarketingPage>
      <section className="product-hub-hero">
        <div className="marketing-container">
          <div>
            <p className="marketing-eyebrow">Producto conectado</p>
            <h1>Una operación. Todo conectado.</h1>
            <p>Personas, relaciones, trabajo, documentos y decisiones comparten contexto sin convertir la interfaz en un mapa de módulos.</p>
            <Link href="/demo" className="marketing-button">Explorar la demo <ArrowRight size={18} /></Link>
          </div>
          <HeroProductOrchestra />
        </div>
      </section>

      <section className="marketing-container product-map" aria-labelledby="product-map-title">
        <div><p className="marketing-eyebrow">Mapa de relaciones</p><h2 id="product-map-title" className="marketing-title">Diez experiencias. Un mismo hilo.</h2></div>
        <div className="product-map__canvas">
          <span className="is-core"><Network size={20} />Contexto</span>
          {marketingProductCatalog.map((item, index) => (
            <Link key={item.slug} href={`/producto/${item.slug}`} style={{ "--module-index": index } as React.CSSProperties}>
              <small>{item.eyebrow}</small><strong>{item.name}</strong><ArrowRight size={14} />
            </Link>
          ))}
        </div>
      </section>

      <section className="product-journeys">
        <div className="marketing-container">
          <div className="v41-section__intro"><p className="marketing-eyebrow">Tres recorridos habituales</p><h2 className="marketing-title">Empieza por el resultado, no por el menú.</h2></div>
          <div>
            {journeys.map(([title, flow, slugs], index) => (
              <article key={title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h3>{title}</h3>
                <p>{flow}</p>
                <div>{slugs.map((slug) => { const item = marketingProductCatalog.find((module) => module.slug === slug)!; return <Link key={slug} href={`/producto/${slug}`}>{item.name}</Link>; })}</div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="marketing-container product-portals">
        <div>
          <p className="marketing-eyebrow">Portales auténticos</p>
          <h2 className="marketing-title">La responsabilidad cambia navegación, prioridad y acción.</h2>
          <ul>{["Navegación priorizada", "Acción principal propia", "Economía solo donde corresponde"].map((item) => <li key={item}><Check size={17} />{item}</li>)}</ul>
        </div>
        <RolePortalStudio />
      </section>

      <section className="product-mobile">
        <div className="marketing-container">
          <div><Smartphone /><p className="marketing-eyebrow">Continuidad móvil</p><h2 className="marketing-title">El trabajo cotidiano cabe en una acción clara.</h2><p>Tareas, agenda, avance y evidencia se diseñan para la mano y actualizan el mismo contexto.</p></div>
          <div className="product-mobile__steps">{["Abrir tarea", "Consultar instrucciones", "Registrar avance", "Sincronizar escritorio"].map((step, index) => <span key={step}><i>{index + 1}</i><strong>{step}</strong></span>)}</div>
        </div>
      </section>

      <section className="v4-final">
        <div className="marketing-container">
          <Sparkles />
          <p className="marketing-eyebrow">Datos sintéticos</p>
          <h2>Elige sector, perfil y objetivo. Recorre el producto sin registrarte.</h2>
          <p>La demostración pública no realiza llamadas de IA ni escrituras empresariales.</p>
          <div><Link href="/demo" className="marketing-button marketing-button--light">Abrir demo <ArrowRight size={18} /></Link></div>
        </div>
      </section>
    </MarketingPage>
  );
}
