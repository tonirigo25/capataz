import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MarketingPage } from "@/components/marketing/marketing-shell";
import { SectorMiniScene } from "@/components/marketing/sector-scenes";
import { brand } from "@/lib/brand";
import { marketingSectorCatalog } from "@/lib/marketing/catalog";

export const metadata: Metadata = {
  title: "Sectores",
  description: "Trece perfiles sectoriales que adaptan lenguaje, prioridades y recorridos de Orqena.",
  alternates: { canonical: "/sectores" },
  openGraph: { title: "Sectores Orqena", description: "Una base común con un lenguaje que encaja en cada actividad.", images: [brand.socialImage] },
};

export default function SectorsPage() {
  return (
    <MarketingPage>
      <section className="sectors-hub">
        <div className="marketing-container">
          <div><p className="marketing-eyebrow">Trece perfiles sectoriales</p><h1>Una base común. Una operación que habla tu idioma.</h1><p>El sector adapta terminología, prioridades y ejemplos. El aislamiento, los permisos y la confirmación humana permanecen.</p></div>
          <div className="sectors-hub__legend"><span>Relación</span><span>Trabajo</span><span>Responsable</span><span>Resultado</span></div>
        </div>
      </section>
      <section className="marketing-container sector-mosaic" aria-label="Perfiles sectoriales">
        {marketingSectorCatalog.map((sector, index) => (
          <Link key={sector.slug} href={`/sectores/${sector.slug}`} className={`sector-mosaic__item tone-${index % 4}`}>
            <SectorMiniScene index={index} work={sector.terminology.workSingular} owner={sector.terminology.owner} />
            <div><span>{String(index + 1).padStart(2, "0")}</span><h2>{sector.name}</h2><p>{sector.lead}</p></div>
            <dl><div><dt>Flujo</dt><dd>{sector.terminology.workPlural}</dd></div><div><dt>Perfil</dt><dd>{sector.terminology.owner}</dd></div></dl>
            <i>Explorar perfil <ArrowRight size={16} /></i>
          </Link>
        ))}
      </section>
      <section className="sector-neutral">
        <div className="marketing-container"><p className="marketing-eyebrow">Sin encasillarte</p><h2 className="marketing-title">“Otros” conserva un lenguaje neutral para actividades con un flujo propio.</h2><p>La configuración visible cambia; la base de seguridad no.</p><Link href="/sectores/otros" className="marketing-button">Explorar un perfil neutral <ArrowRight size={17} /></Link></div>
      </section>
    </MarketingPage>
  );
}
