import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { MarketingPage } from "@/components/marketing/marketing-shell";
import { brand } from "@/lib/brand";
import { getMarketingSolution, marketingSolutions } from "@/lib/marketing/solutions";

export function generateStaticParams() {
  return marketingSolutions.map((solution) => ({ solucion: solution.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ solucion: string }> }): Promise<Metadata> {
  const { solucion } = await params;
  const item = getMarketingSolution(solucion);
  if (!item) return {};
  return {
    title: item.title,
    description: item.outcome,
    alternates: { canonical: `/soluciones/${item.slug}` },
    openGraph: { title: `${item.title} con ${brand.productName}`, description: item.outcome, images: [brand.socialImage] },
  };
}

export default async function SolutionPage({ params }: { params: Promise<{ solucion: string }> }) {
  const { solucion } = await params;
  const item = getMarketingSolution(solucion);
  if (!item) notFound();

  return (
    <MarketingPage>
      <section className="marketing-container grid gap-10 py-16 lg:grid-cols-[1.1fr_.9fr] lg:py-24">
        <div>
          <p className="marketing-eyebrow">Soluciones / {item.eyebrow}</p>
          <h1 className="marketing-display mt-4">{item.title}</h1>
          <p className="marketing-lede mt-5">{item.outcome}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link className="marketing-button" href="/demo#quick-demo">Ver demo rápida <ArrowRight size={17} /></Link>
            <Link className="marketing-outline-button" href="/contacto">Solicitar demo</Link>
          </div>
        </div>
        <aside className="card p-6">
          <span className="marketing-eyebrow">Problema</span>
          <p className="mt-4 text-lg font-bold leading-7">{item.problem}</p>
          <div className="mt-6 border-t border-border pt-5">
            <span className="marketing-eyebrow">Límite de evidencia</span>
            <p className="mt-3 text-sm leading-6 text-content-secondary">{item.proofBoundary}</p>
          </div>
        </aside>
      </section>

      <section className="border-y border-border bg-surface-raised py-16">
        <div className="marketing-container">
          <p className="marketing-eyebrow">Recorrido</p>
          <h2 className="marketing-title mt-3">Cinco pasos con estado y decisión.</h2>
          <ol className="mt-8 grid gap-3 md:grid-cols-5">
            {item.steps.map((step, index) => (
              <li className="card p-5" key={step}>
                <span className="marketing-eyebrow">{String(index + 1).padStart(2, "0")}</span>
                <strong className="mt-3 block">{step}</strong>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="marketing-container grid gap-6 py-16 lg:grid-cols-2">
        <article className="card p-6">
          <CheckCircle2 aria-hidden="true" />
          <h2 className="mt-5 text-2xl font-black">Resultado visible</h2>
          <p className="mt-3 leading-7 text-content-secondary">{item.outcome}</p>
        </article>
        <article className="card p-6">
          <ShieldCheck aria-hidden="true" />
          <h2 className="mt-5 text-2xl font-black">Revisión humana</h2>
          <p className="mt-3 leading-7 text-content-secondary">
            Las acciones sensibles muestran su efecto y esperan confirmación. La
            interfaz no sustituye las comprobaciones del servidor.
          </p>
        </article>
      </section>
    </MarketingPage>
  );
}
