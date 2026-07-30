import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Layers3 } from "lucide-react";
import { MarketingPage } from "@/components/marketing/marketing-shell";
import { Process, R4CTA, R4Hero, R4Section, SolutionInterface, getR4Styles } from "@/components/marketing/r4-pages";
import { brand } from "@/lib/brand";
import { marketingSolutions } from "@/lib/marketing/solutions";

export const metadata: Metadata = {
  title: "Soluciones",
  description: "Soluciones de Orqena para clientes, obras, costes, facturación, proveedores, documentos, equipo e IA operativa.",
  alternates: { canonical: "/soluciones" },
  openGraph: { title: "Soluciones conectadas de Orqena", description: "Empieza por el problema operativo que quieres resolver sin perder el contexto del resto de la empresa.", images: [brand.socialImage] },
};

const styles = getR4Styles();

export default function SolutionsPage() {
  const featured = marketingSolutions[1];
  return <MarketingPage>
    <R4Hero current="Soluciones" eyebrow="RESULTADOS POR NECESIDAD" title="Empieza por el problema. Mantén conectada la empresa." description="Ocho recorridos completos para vender, ejecutar, controlar y cobrar con responsables, datos de origen y revisión humana." actions={<><Link href="#soluciones">Explorar soluciones<ArrowRight aria-hidden="true" /></Link><Link href="/contacto?motivo=soluciones">Contarnos tu caso</Link></>} visual={<SolutionInterface solution={featured} />} />
    <R4Section id="soluciones" eyebrow="OCHO RECORRIDOS" title="Elige el resultado que necesitas ahora." description="Cada solución explica el problema, el flujo, la interfaz y el límite de lo que Orqena puede preparar."><div className={styles.cardGrid}>{marketingSolutions.map((solution, index) => <Link className={styles.card} href={`/soluciones/${solution.slug}`} key={solution.slug}><span>{String(index + 1).padStart(2, "0")} · {solution.eyebrow}</span><h3>{solution.title}</h3><p>{solution.outcome}</p><strong>Ver solución<ArrowRight aria-hidden="true" /></strong></Link>)}</div></R4Section>
    <R4Section tone="soft" eyebrow="UNA MISMA OPERACIÓN" title="Del contacto al cobro sin reconstruir la historia." description="Los recorridos comparten clientes, trabajo, documentos, responsables y estados."><Process steps={["Contacto", "Presupuesto", "Trabajo", "Coste", "Factura"]} /></R4Section>
    <R4Section tone="dark" eyebrow="LÍMITES CLAROS" title="Lo que ve la demo es demostrable." description="Datos sintéticos, cálculos explicados y acciones sin efecto real permiten evaluar el producto sin confundir una muestra con un resultado de cliente."><div className={styles.roleGrid}><article><Check aria-hidden="true" /><h3>Datos sintéticos</h3><p>Nombres, obras, documentos e importes creados para demostración.</p></article><article><Check aria-hidden="true" /><h3>Acciones seguras</h3><p>Los controles públicos muestran comportamiento sin alterar datos empresariales.</p></article><article><Layers3 aria-hidden="true" /><h3>Contexto conectado</h3><p>Cada solución enlaza con los recorridos que completan el proceso.</p></article></div></R4Section>
    <R4CTA title="Explora la solución que más se parece a tu operación." text="Te preparamos una demostración con un caso sintético de tu sector y revisamos juntos dónde encaja Orqena." />
  </MarketingPage>;
}
