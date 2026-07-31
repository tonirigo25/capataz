import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Bot, BriefcaseBusiness, FileCheck2, ShieldCheck, Users, WalletCards } from "lucide-react";
import { MarketingPage } from "@/components/marketing/marketing-shell";
import { ProductTour } from "@/components/marketing/r4-pages-interactive";
import { R4CTA, R4Hero, R4Section, getR4Styles } from "@/components/marketing/r4-pages";
import { PublicStructuredData, breadcrumbList, softwareApplication, structuredGraph } from "@/components/marketing/public-structured-data";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Producto ${brand.productName}`,
  description: `Tour completo de ${brand.productName}: clientes, trabajo, dinero, documentos, equipo y Orqena IA conectados bajo control humano.`,
  alternates: { canonical: "/producto" },
  openGraph: { title: "Orqena, una operación conectada", description: "Descubre cómo Orqena mantiene el mismo contexto desde el primer contacto hasta el cobro.", images: [brand.socialImage] },
};

const styles = getR4Styles();
const foundations = [
  { title: "Clientes y presupuestos", text: "La relación comercial conserva visita, propuesta y seguimiento.", icon: Users, href: "/soluciones/clientes-y-presupuestos" },
  { title: "Obras y trabajo", text: "Hitos, equipo, agenda e incidencias comparten el mismo trabajo.", icon: BriefcaseBusiness, href: "/soluciones/obras-y-trabajo" },
  { title: "Dinero y margen", text: "Costes, facturas y cobros parten de registros relacionados.", icon: WalletCards, href: "/soluciones/control-costes-y-margen" },
  { title: "Documentos", text: "Cada archivo mantiene origen, revisión y relación operativa.", icon: FileCheck2, href: "/soluciones/documentos-y-ocr" },
  { title: "Orqena IA", text: "Prepara, explica y espera una confirmación humana.", icon: Bot, href: "/soluciones/ia-operativa" },
  { title: "Seguridad", text: "Aislamiento por empresa, permisos y trazabilidad desde el servidor.", icon: ShieldCheck, href: "/seguridad" },
] as const;

export default function ProductPage() {
  return <MarketingPage>
    <PublicStructuredData data={structuredGraph(
      softwareApplication("/producto", brand.productName, `Clientes, trabajo, dinero, documentos, equipo y ${brand.assistantName} conectados bajo control humano.`),
      breadcrumbList([["Inicio", ""], ["Producto", "/producto"]]),
    )} />
    <R4Hero current="Producto" eyebrow="UNA OPERACIÓN, UN MISMO CONTEXTO" title="Orqena conecta el trabajo que hoy reconstruyes a mano." description="Clientes, presupuestos, obras, costes, documentos, facturas, cobros e IA avanzan en una interfaz común. Orqena prepara; tú revisas y confirmas." actions={<><Link href="/demo">Ver demo guiada<ArrowRight aria-hidden="true" /></Link><Link href="/contacto?motivo=demo">Solicitar una demo</Link></>} visual={<ProductHeroVisual />} />
    <R4Section id="tour" eyebrow="TOUR INTERACTIVO" title="La prioridad cambia. El contexto permanece." description="Recorre las áreas principales. Cada pestaña transforma la interfaz, los datos y las acciones mostradas."><ProductTour /></R4Section>
    <R4Section tone="soft" eyebrow="ÁREAS CONECTADAS" title="No son módulos aislados." description="Cada área conserva relaciones, responsables y una siguiente decisión clara."><div className={styles.cardGrid}>{foundations.map(({ title, text, icon: Icon, href }) => <Link className={styles.card} href={href} key={title}><Icon aria-hidden="true" /><h3>{title}</h3><p>{text}</p><strong>Explorar solución<ArrowRight aria-hidden="true" /></strong></Link>)}</div></R4Section>
    <R4Section tone="dark" eyebrow="CONTROL HUMANO" title="Orqena prepara. Una persona decide." description="Las acciones sensibles enseñan su origen, el efecto previsto y la persona responsable antes de confirmarse."><div className={styles.roleGrid}><article><span>01</span><h3>Contexto permitido</h3><p>La empresa activa y los permisos delimitan la información disponible.</p></article><article><span>02</span><h3>Propuesta explicada</h3><p>El borrador muestra fuentes, dudas y cambios previstos.</p></article><article><span>03</span><h3>Confirmación trazable</h3><p>Una persona autorizada edita, confirma o descarta.</p></article></div></R4Section>
    <R4CTA />
  </MarketingPage>;
}

function ProductHeroVisual() {
  return <div className={styles.solutionUi}><header><div><span>ORQENA</span><strong>Hoy · Reformas Horizonte Demo</strong></div><em>Datos sintéticos</em></header><div className={styles.metricGrid}><article><small>Trabajo activo</small><strong>8</strong></article><article><small>Margen previsto</small><strong>27,6 %</strong></article><article><small>Por revisar</small><strong>6</strong></article></div><div className={styles.solutionBody}><div className={styles.activity}><span>Prioridades</span><p><i>1</i>Revisar presupuesto de Oficina Centro</p><p><i>2</i>Confirmar factura de proveedor</p><p><i>3</i>Preparar seguimiento de cobro</p></div><aside><span>Orqena IA</span><strong>Borrador preparado</strong><p>Esperando tu revisión; no se ha cambiado ningún dato.</p></aside></div></div>;
}
