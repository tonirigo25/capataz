import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, MessageSquareText, Sheet } from "lucide-react";
import { MarketingPage } from "@/components/marketing/marketing-shell";
import { brand } from "@/lib/brand";
import { marketingSolutions } from "@/lib/marketing/solutions";

export const metadata: Metadata = {
  title: "Soluciones para obra, reformas e instalaciones",
  description: `Recorridos de ${brand.productName} para presupuestos, costes, proveedores, partes, facturación y asistencia revisable.`,
  alternates: { canonical: "/soluciones" },
  openGraph: {
    title: `Soluciones ${brand.productName}`,
    description: "Seis problemas operativos explicados sin promesas de resultados no medidos.",
    images: [brand.socialImage],
  },
};

export default function SolutionsPage() {
  return (
    <MarketingPage>
      <section className="marketing-container py-16 lg:py-24">
        <p className="marketing-eyebrow">Construcción, reformas e instalaciones · 1–20 personas</p>
        <h1 className="marketing-display mt-4 max-w-5xl">Empieza por el problema que quieres dejar de reconstruir.</h1>
        <p className="marketing-lede mt-5 max-w-3xl">
          Cada recorrido conecta registros que ya existen en el producto y mantiene
          revisión humana. Las cifras públicas son ejemplos, no resultados de clientes.
        </p>
        <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {marketingSolutions.map((solution, index) => (
            <Link className="card group grid min-h-72 gap-4 p-6" href={`/soluciones/${solution.slug}`} key={solution.slug}>
              <span className="marketing-eyebrow">{String(index + 1).padStart(2, "0")} · {solution.eyebrow}</span>
              <h2 className="text-2xl font-black tracking-tight">{solution.title}</h2>
              <p className="text-sm leading-6 text-content-secondary">{solution.problem}</p>
              <span className="mt-auto inline-flex items-center gap-2 font-bold text-brand-strong">
                Explorar recorrido <ArrowRight className="transition-transform group-hover:translate-x-1" size={17} />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-surface-raised py-16">
        <div className="marketing-container">
          <p className="marketing-eyebrow">Comparación honesta</p>
          <h2 className="marketing-title mt-3 max-w-3xl">La herramienta adecuada depende del problema.</h2>
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            <Comparison icon={Sheet} title="Excel y mensajería" copy="Flexibles y conocidos. El contexto, los permisos y la trazabilidad dependen del método que establezca el equipo." />
            <Comparison icon={CheckCircle2} title="ERP horizontal" copy="Puede cubrir procesos amplios. La implantación, profundidad sectorial y experiencia diaria varían por producto y configuración." />
            <Comparison icon={MessageSquareText} title="Software de presupuestos" copy="Puede ser más profundo en mediciones o bancos de precios. Orqena prioriza el recorrido conectado hasta trabajo, coste y cobro." />
          </div>
          <p className="mt-6 max-w-3xl text-sm leading-6 text-content-secondary">
            No se declara superioridad universal. La elección debe comprobarse con
            datos propios, requisitos fiscales y una prueba controlada.
          </p>
        </div>
      </section>
    </MarketingPage>
  );
}

function Comparison({ icon: Icon, title, copy }: { icon: typeof Sheet; title: string; copy: string }) {
  return (
    <article className="card p-6">
      <Icon aria-hidden="true" />
      <h3 className="mt-5 text-xl font-black">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-content-secondary">{copy}</p>
    </article>
  );
}
