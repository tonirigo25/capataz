import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MarketingPage } from "@/components/marketing/marketing-shell";
import { SectorMiniScene } from "@/components/marketing/sector-scenes";
import { brand } from "@/lib/brand";
import { marketingSectorCatalog } from "@/lib/marketing/catalog";

export const metadata: Metadata = {
  title: "Sectores",
  description: `${brand.productName} para empresas de construcción, reformas e instalaciones de 1 a 20 personas.`,
  alternates: { canonical: "/sectores" },
  openGraph: { title: `Sectores ${brand.productName}`, description: "Una base común con un lenguaje que encaja en cada actividad.", images: [brand.socialImage] },
};

export default function SectorsPage() {
  return (
    <MarketingPage>
      <section className="sectors-hub">
        <div className="marketing-container">
          <div><p className="marketing-eyebrow">Un único ICP público</p><h1>Construcción, reformas e instalaciones. De 1 a 20 personas.</h1><p>Los ejemplos públicos se concentran en este tipo de empresa. El aislamiento, los permisos y la confirmación humana permanecen.</p></div>
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
        <div className="marketing-container"><p className="marketing-eyebrow">Alcance deliberado</p><h2 className="marketing-title">No prometemos encaje universal.</h2><p>El producto conserva perfiles internos, pero la propuesta pública y los pilotos se validan primero en obra, reformas e instalaciones.</p><Link href="/contacto" className="marketing-button">Contar mi caso <ArrowRight size={17} /></Link></div>
      </section>
    </MarketingPage>
  );
}
