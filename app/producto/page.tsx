import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Bot, BriefcaseBusiness, FileCheck2, TrendingUp, Users } from "lucide-react";
import { MarketingPage } from "@/components/marketing/marketing-shell";
import { PublicCTA, PublicFeatureGrid, PublicPageHero, PublicProductPreview, PublicSection } from "@/components/marketing/public-ui";
import { brand } from "@/lib/brand";

export const metadata: Metadata = { title: "Producto", description: `Descubre cómo ${brand.productName} conecta clientes, trabajo, documentos y dinero.`, alternates: { canonical: "/producto" } };

const areas = [
  { title: "Clientes y ventas", text: "Seguimientos, oportunidades y presupuestos conservan la misma historia.", icon: Users, meta: "Comercial" },
  { title: "Trabajo y obra", text: "Hitos, equipo, tareas e incidencias se leen dentro del trabajo correcto.", icon: BriefcaseBusiness, meta: "Operación" },
  { title: "Documentos y costes", text: "Cada documento termina relacionado, revisable y listo para confirmar.", icon: FileCheck2, meta: "Control" },
  { title: "Dinero", text: "Cobros, pagos, margen y vencimientos parten de registros existentes.", icon: TrendingUp, meta: "Finanzas" },
  { title: "Capataz IA", text: "Recomienda y prepara borradores; una persona conserva la decisión final.", icon: Bot, meta: "Asistencia" },
] as const;

export default function ProductPage() {
  return <MarketingPage>
    <PublicPageHero eyebrow="Producto conectado" title="Una operación. Todo conectado." description="Capataz reúne clientes, trabajo, documentos y dinero en una interfaz operativa clara." actions={<><Link href="/demo">Explorar demo <ArrowRight size={16} /></Link><Link href="/contacto?motivo=demo">Solicitar acceso</Link></>} visual={<PublicProductPreview title="Hoy · Costa Norte" state="En control" metrics={[["Ingresos", "48.200 €"], ["Margen", "28,4 %"], ["Pendientes", "7"]]} />} />
    <PublicSection eyebrow="Áreas clave" title="Cinco vistas. Un mismo contexto." description="La navegación cambia la prioridad; no rompe la historia del negocio."><PublicFeatureGrid items={areas} /></PublicSection>
    <PublicSection tone="soft" eyebrow="Continuidad" title="Del primer contacto al cobro." description="Cada etapa conserva origen, responsable y próxima decisión.">
      <div className="launch-story-grid">{[["01","Contacto","Necesidad y siguiente visita."],["02","Propuesta","Partidas, margen y dudas."],["03","Trabajo","Hitos, equipo e incidencias."],["04","Cobro","Factura y vencimiento."]].map(([number,title,text]) => <article key={title}><span>{number}</span><h2>{title}</h2><p>{text}</p></article>)}</div>
    </PublicSection>
    <PublicCTA />
  </MarketingPage>;
}
