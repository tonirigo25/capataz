import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, Bot, CheckSquare, FileText, Landmark, Truck } from "lucide-react";
import { MarketingPage } from "@/components/marketing/marketing-shell";
import { ResourceCalculators } from "@/components/marketing/r4-pages-interactive";
import { R4CTA, R4FAQ, R4Hero, R4Section, getR4Styles } from "@/components/marketing/r4-pages";
import { PublicStructuredData, breadcrumbList, faqPage, publicPage, structuredGraph } from "@/components/marketing/public-structured-data";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Recursos para controlar obras, costes y caja",
  description: "Calculadoras, simuladores, checklist y guías prácticas para presupuestar, controlar costes y cobrar a tiempo.",
  alternates: { canonical: "/recursos" },
  openGraph: { title: "Recursos prácticos de Orqena", description: "Herramientas interactivas y guías para revisar margen, caja, facturas, presupuestos y proveedores.", images: [brand.socialImage] },
};

const styles = getR4Styles();
const faq = [
  ["¿Las calculadoras guardan mis datos?", "No. Los cálculos se realizan en tu navegador y esta página no necesita guardar los importes introducidos."],
  ["¿Los resultados son una previsión?", "No. Son escenarios aritméticos basados únicamente en los valores que introduces."],
  ["¿La checklist sustituye una revisión fiscal?", "No. Ayuda a ordenar comprobaciones operativas, pero no determina autenticidad, deducibilidad ni tratamiento fiscal."],
  ["¿Puedo ver estas herramientas dentro de Orqena?", "La demo muestra cómo margen, documentos y caja se conectan con clientes y trabajos usando datos sintéticos."],
] as const;

export default function ResourcesPage() {
  return <MarketingPage>
    <PublicStructuredData data={structuredGraph(
      publicPage("CollectionPage", "/recursos", "Recursos prácticos de Orqena", "Calculadoras, checklist y guías para presupuestar, controlar costes y cobrar a tiempo."),
      breadcrumbList([["Inicio", ""], ["Recursos", "/recursos"]]),
      faqPage(faq),
    )} />
    <R4Hero current="Recursos" eyebrow="HERRAMIENTAS PRÁCTICAS" title="Recursos prácticos para presupuestar mejor, controlar costes y cobrar a tiempo." description="Calcula escenarios, revisa documentos y recorre métodos concretos sin entregar tus datos. Cada resultado explica sus límites." actions={<><Link href="#herramientas">Usar herramientas<ArrowRight aria-hidden="true" /></Link><Link href="#guias">Explorar guías</Link></>} visual={<ResourcesVisual />} />
    <R4Section id="herramientas" eyebrow="CALCULADORAS" title="Prueba escenarios con tus propias hipótesis." description="Los resultados cambian al editar cada campo y nunca se presentan como datos reales ni como predicción."><ResourceCalculators /></R4Section>
    <R4Section tone="soft" eyebrow="REVISIÓN OPERATIVA" title="Comprueba antes de registrar o pagar." description="La checklist es interactiva, descargable e imprimible; conserva la decisión en tus manos."><div className={styles.cardGrid}><Link className={styles.card} href="/recursos/checklist-factura-recibida"><CheckSquare aria-hidden="true" /><h3>Checklist de factura recibida</h3><p>Ocho comprobaciones sobre proveedor, importes, documento, obra y vencimiento.</p><strong>Abrir checklist<ArrowRight aria-hidden="true" /></strong></Link><Link className={styles.card} href="/recursos/calculadora-margen-obra"><Landmark aria-hidden="true" /><h3>Calculadora de margen completa</h3><p>Añade horas, coste interno y contingencia a la revisión de una obra.</p><strong>Abrir calculadora<ArrowRight aria-hidden="true" /></strong></Link><article className={styles.card}><FileText aria-hidden="true" /><span>Plantillas</span><h3>Próximas plantillas editables</h3><p>Publicaremos plantillas sólo cuando puedan descargarse, verificarse y mantenerse. No hay una descarga ficticia.</p></article></div></R4Section>
    <R4Section id="guias" eyebrow="GUÍAS Y RECORRIDOS" title="Métodos breves para decisiones frecuentes." description="Abre cada guía en esta misma página o continúa hacia la solución relacionada."><div className={styles.guideGrid}><details open><summary>Guía de presupuesto de obra</summary><p>1. Delimita alcance y exclusiones. 2. Separa materiales, horas y subcontratas. 3. Añade contingencia razonada. 4. Revisa margen y calendario. 5. Confirma versión antes de compartir.</p><Link href="/soluciones/clientes-y-presupuestos">Ver el flujo en Orqena</Link></details><details><summary>Proveedores y subcontratas</summary><p>Relaciona pedido, entrega, documento, trabajo y vencimiento. Comprueba cambios bancarios por un canal independiente y conserva quién confirmó cada paso.</p><Link href="/soluciones/proveedores-y-subcontratas">Explorar la solución</Link></details><details><summary>Recorrido de Orqena IA</summary><p>Plantea el objetivo, revisa las fuentes permitidas, corrige dudas, comprueba el efecto y confirma o descarta. Una sugerencia no cambia datos por sí sola.</p><Link href="/soluciones/ia-operativa">Ver IA operativa</Link></details></div></R4Section>
    <R4Section tone="dark" eyebrow="ARTÍCULOS PRÁCTICOS" title="Lee por el problema que quieres resolver." description="Tres lecturas completas y compactas, sin enlaces a contenidos inexistentes."><div className={styles.roleGrid}><article><BookOpen aria-hidden="true" /><span>MARGEN</span><h3>Separar coste confirmado y previsto</h3><p>Evita mezclar compras ya registradas con hipótesis. La comparación gana valor cuando cada cifra conserva origen y fecha.</p></article><article><Truck aria-hidden="true" /><span>COMPRAS</span><h3>Qué revisar antes de aceptar una desviación</h3><p>Comprueba alcance, proveedor, unidad, cantidad, trabajo relacionado y responsable antes de actualizar el coste esperado.</p></article><article><Bot aria-hidden="true" /><span>ORQENA IA</span><h3>Cuándo una sugerencia es revisable</h3><p>Debe mostrar contexto, incertidumbres, efecto propuesto y una decisión explícita. Si falta alguno, no está lista para confirmar.</p></article></div></R4Section>
    <R4Section tone="soft" eyebrow="PREGUNTAS FRECUENTES" title="Usa los recursos con sus límites claros."><R4FAQ items={faq} /></R4Section>
    <R4CTA title="Lleva estos controles a un recorrido conectado." text="En la demo verás cómo presupuesto, trabajo, coste, documento, factura y cobro comparten el mismo contexto." />
  </MarketingPage>;
}

function ResourcesVisual() { return <div className={styles.solutionUi}><header><div><span>ORQENA RECURSOS</span><strong>Escenario de margen</strong></div><em>No guarda datos</em></header><div className={styles.metricGrid}><article><small>Ingreso</small><strong>30.000 €</strong></article><article><small>Coste</small><strong>21.000 €</strong></article><article><small>Margen</small><strong>30 %</strong></article></div><div className={styles.solutionBody}><div className={styles.activity}><span>Revisión sugerida</span><p><i>1</i>Separar materiales y horas</p><p><i>2</i>Incluir contingencia</p><p><i>3</i>Contrastar con documentos</p></div><aside><span>Límite</span><strong>Escenario aritmético</strong><p>No es una previsión ni un resultado de cliente.</p></aside></div></div>; }
