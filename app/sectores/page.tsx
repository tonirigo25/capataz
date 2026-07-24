import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MarketingPage, SectionIntro } from "@/components/marketing/marketing-shell";
import { marketingSectorCatalog } from "@/lib/marketing/catalog";

export const metadata: Metadata = {
  title: "Sectores",
  description: "Trece perfiles sectoriales que adaptan el lenguaje y las prioridades de Orqena.",
  alternates: { canonical: "/sectores" },
};

export default function SectorsPage() {
  return (
    <MarketingPage>
      <section className="marketing-container v4-section">
        <SectionIntro
          eyebrow="Sectores"
          title="Una base común. Un lenguaje que encaja en tu actividad."
          description="Orqena conserva clientes, trabajo, agenda, documentos y control como sistema compartido. Cada perfil adapta términos, ejemplos y prioridades."
        />
        <div className="sectors-complete-grid">
          {marketingSectorCatalog.map((sector, index) => (
            <Link key={sector.slug} href={`/sectores/${sector.slug}`}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h2>{sector.name}</h2>
              <p>{sector.lead}</p>
              <dl>
                <div><dt>Trabajo</dt><dd>{sector.terminology.workSingular}</dd></div>
                <div><dt>Responsable</dt><dd>{sector.terminology.owner}</dd></div>
              </dl>
              <i>Explorar el perfil <ArrowRight size={16} /></i>
            </Link>
          ))}
        </div>
      </section>
      <section className="v4-control">
        <div className="marketing-container v4-section">
          <p className="marketing-eyebrow">Sin encasillarte</p>
          <h2 className="marketing-title">El perfil Otros conserva un lenguaje neutral para actividades con un flujo propio.</h2>
          <p className="marketing-lede">La configuración cambia la experiencia visible. No modifica el aislamiento, los permisos ni la confirmación humana.</p>
        </div>
      </section>
    </MarketingPage>
  );
}
