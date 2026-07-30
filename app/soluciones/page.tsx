import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, FileCheck2, TrendingUp, Users, WalletCards, Wrench } from "lucide-react";
import { MarketingPage } from "@/components/marketing/marketing-shell";
import { PublicCTA, PublicComparison, PublicFeatureGrid, PublicPageHero, PublicProductPreview, PublicSection } from "@/components/marketing/public-ui";
import { brand } from "@/lib/brand";

export const metadata: Metadata = { title: "Soluciones", description: `Recorridos conectados de ${brand.productName} para vender, ejecutar y controlar.`, alternates: { canonical: "/soluciones" } };

const solutions = [
  { title: "Vender y presupuestar", text: "Convierte una necesidad en una propuesta revisable y con margen visible.", icon: Users, meta: "Comercial" },
  { title: "Ejecutar trabajos", text: "Coordina hitos, agenda, equipo e incidencias sin perder contexto.", icon: BriefcaseBusiness, meta: "Operación" },
  { title: "Controlar costes", text: "Relaciona compras, facturas y desviaciones con el trabajo correcto.", icon: TrendingUp, meta: "Control" },
  { title: "Facturar y cobrar", text: "Prepara facturas y vencimientos desde lo realmente ejecutado.", icon: WalletCards, meta: "Dinero" },
  { title: "Ordenar documentos", text: "Extrae y revisa datos antes de confirmar cualquier registro.", icon: FileCheck2, meta: "Documentos" },
  { title: "Coordinar el equipo", text: "Cada persona ve lo que necesita para avanzar con responsabilidad.", icon: Wrench, meta: "Equipo" },
] as const;

export default function SolutionsPage() {
  return <MarketingPage>
    <PublicPageHero eyebrow="Soluciones" title="Empieza por el problema que quieres dejar de reconstruir." description="Seis recorridos prácticos, conectados y con confirmación humana." actions={<><Link href="/demo">Ver recorridos <ArrowRight size={16} /></Link><Link href="/contacto?motivo=soluciones">Hablar con Orqena</Link></>} visual={<PublicProductPreview title="Trabajo · Costa Norte" state="78 % completado" metrics={[["Hitos", "3 / 5"], ["Equipo", "4"], ["Incidencias", "2"]]} />} />
    <PublicSection eyebrow="Recorridos" title="Menos módulos. Más continuidad."><PublicFeatureGrid items={solutions} /></PublicSection>
    <PublicSection tone="soft" eyebrow="Comparación honesta" title="Elige según el problema, no según la promesa."><PublicComparison columns={["Excel y chat", "ERP horizontal", "Capataz"]} rows={[{label:"Contexto",values:["Manual","Configurable","Conectado"]},{label:"Trazabilidad",values:["Depende del método","Según implantación","Visible por diseño"]},{label:"Confirmación",values:["Manual","Según proceso","Humana y explícita"]}]} /></PublicSection>
    <PublicCTA />
  </MarketingPage>;
}
