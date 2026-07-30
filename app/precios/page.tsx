import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Bot, Check, Users } from "lucide-react";
import { MarketingPage } from "@/components/marketing/marketing-shell";
import { PriceComparison, PricingExplorer } from "@/components/marketing/r4-pages-interactive";
import { R4CTA, R4FAQ, R4Hero, R4Section, getR4Styles } from "@/components/marketing/r4-pages";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Planes y precios",
  description: "Compara Starter, Professional y Business de Orqena por usuarios, coordinación y operaciones de IA.",
  alternates: { canonical: "/precios" },
  openGraph: { title: "Planes y precios de Orqena", description: "Elige el nivel de control que necesita tu empresa.", images: [brand.socialImage] },
};

const styles = getR4Styles();
const faq = [
  ["¿Qué cuenta como una operación de IA?", "Una preparación, análisis o acción asistida solicitada a Orqena IA. Consultar una pantalla o trabajar sin IA no consume operaciones de IA."],
  ["¿Puedo cambiar de plan?", "Sí. Antes de cualquier cambio se explica el alcance, la fecha y el efecto para que puedas decidir."],
  ["¿Los precios incluyen IVA?", "No. Los importes mostrados son netos y se añade el IVA que corresponda."],
  ["¿Qué ocurre al alcanzar el límite de IA?", "Orqena avisa antes de llegar al límite. Al completarlo se detienen nuevas operaciones de IA, pero la lectura y el resto del trabajo permitido continúan."],
  ["¿Puedo probar Orqena antes de decidir?", "Sí. Puedes solicitar una demo privada con datos sintéticos y recorrer el producto sin tarjeta."],
] as const;

export default function PricingPage() {
  return <MarketingPage>
    <R4Hero current="Planes y precios" eyebrow="PLANES PARA CADA ETAPA" title="Elige el nivel de control que necesita tu empresa." description="Empieza con lo esencial y amplía cuando crezcan tu equipo, tus obras o el uso de IA. Todos los planes comparten la misma base: datos aislados, control humano y acceso web y móvil." actions={<><Link href="#planes">Comparar planes<ArrowRight aria-hidden="true" /></Link><Link href="/contacto?motivo=acceso">Solicitar acceso</Link></>} visual={<PricingVisual />} />
    <R4Section id="planes" eyebrow="MENSUAL O ANUAL" title="Tres planes. Una misma base operativa." description="Selecciona la periodicidad para ver el importe aprobado. La solicitud de acceso no inicia una compra."><PricingExplorer /></R4Section>
    <R4Section tone="soft" eyebrow="COMPARACIÓN" title="Lo esencial, lado a lado." description="Los límites de usuarios y operaciones de IA siguen el catálogo aprobado."><PriceComparison /></R4Section>
    <R4Section eyebrow="OPERACIONES DE IA" title="Un límite visible y comprensible." description="El consumo de Orqena IA se cuenta cuando solicitas una preparación, análisis o acción asistida; nunca por leer tus datos."><div className={styles.roleGrid}><article><Bot aria-hidden="true" /><span>CUENTA</span><h3>Preparar o analizar</h3><p>Resumir contexto, redactar un borrador o preparar una acción asistida.</p></article><article><Check aria-hidden="true" /><span>NO CUENTA</span><h3>Leer y revisar</h3><p>Consultar pantallas, abrir documentos o revisar una propuesta ya preparada.</p></article><article><Users aria-hidden="true" /><span>CONTROL</span><h3>Aviso y bloqueo claro</h3><p>Aviso al 80 % y bloqueo de nuevas operaciones al 100 %, sin cargos automáticos.</p></article></div></R4Section>
    <R4Section tone="soft" eyebrow="PREGUNTAS FRECUENTES" title="Condiciones claras antes de solicitar acceso."><R4FAQ items={faq} /></R4Section>
    <R4CTA primary={["Solicitar acceso", "/contacto?motivo=acceso"]} />
  </MarketingPage>;
}

function PricingVisual() { return <div className={styles.solutionUi}><header><div><span>ORQENA</span><strong>Plan recomendado</strong></div><em>Orientativo</em></header><div className={styles.metricGrid}><article><small>Equipo</small><strong>5 usuarios</strong></article><article><small>IA al mes</small><strong>500</strong></article><article><small>Periodicidad</small><strong>Flexible</strong></article></div><div className={styles.solutionBody}><div className={styles.activity}><span>Professional</span><p><i>1</i>Clientes, trabajo y documentos conectados</p><p><i>2</i>Coordinación y automatizaciones</p><p><i>3</i>Orqena IA con control humano</p></div><aside><span>Desde</span><strong>79 € + IVA</strong><p>al mes. Solicita acceso sin iniciar una compra.</p></aside></div></div>; }
