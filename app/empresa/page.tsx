import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Eye, Layers3, LockKeyhole, Scale, ShieldCheck, UsersRound } from "lucide-react";
import { MarketingPage } from "@/components/marketing/marketing-shell";
import { R4CTA, R4Hero, R4Section, getR4Styles } from "@/components/marketing/r4-pages";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Empresa",
  description: "Orqena Tech construye Orqena para que pequeñas empresas de construcción y servicios trabajen con más contexto y control.",
  alternates: { canonical: "/empresa" },
  openGraph: { title: "Orqena Tech", description: "Tecnología para que una pequeña empresa trabaje con el control de una grande.", images: [brand.socialImage] },
};

const styles = getR4Styles();
const principles = [
  { title: "Contexto antes que ruido", text: "La información útil aparece junto al cliente, trabajo o decisión que la necesita.", icon: Layers3 },
  { title: "Control humano", text: "Orqena prepara y explica. Una persona revisa, corrige y confirma las acciones sensibles.", icon: Eye },
  { title: "Datos aislados", text: "La empresa activa, el rol y el alcance autorizado delimitan cada operación.", icon: LockKeyhole },
  { title: "Resultados explicables", text: "Importes, estados y recomendaciones conservan origen, fecha y límites.", icon: Scale },
  { title: "Seguridad práctica", text: "Permisos, trazabilidad y minimización forman parte del producto, no de una capa decorativa.", icon: ShieldCheck },
  { title: "Trabajo conectado", text: "Oficina, responsables y equipo de campo comparten el mismo hilo sin recibir la misma pantalla.", icon: UsersRound },
] as const;

export default function CompanyPage() {
  return <MarketingPage>
    <R4Hero current="Empresa" eyebrow="ORQENA TECH" title="Tecnología para que una pequeña empresa trabaje con el control de una grande." description="Construimos Orqena para conectar el trabajo comercial, operativo y económico de empresas de construcción y servicios sin quitar la decisión a las personas." actions={<><Link href="/producto">Conocer Orqena<ArrowRight aria-hidden="true" /></Link><Link href="/contacto">Contactar</Link></>} visual={<CompanyVisual />} />
    <R4Section eyebrow="QUÉ ES ORQENA TECH" title="Una empresa de producto centrada en la operación real." description="Orqena Tech desarrolla Orqena, un software web para mantener conectados clientes, presupuestos, trabajos, costes, documentos, facturación, cobros e IA."><div className={styles.editorialGrid}><h3>La tecnología debe reducir reconstrucciones, no añadir otra capa de trabajo.</h3><div><article><h4>Por qué construimos Orqena</h4><p>Porque una empresa pequeña puede tener información suficiente y, aun así, perder tiempo al reunirla antes de cada decisión. Orqena mantiene el hilo entre áreas.</p></article><article><h4>Para quién</h4><p>Autónomos y equipos de construcción, reformas, instalaciones y servicios que coordinan clientes, trabajo, documentos y dinero.</p></article></div></div></R4Section>
    <R4Section tone="soft" eyebrow="PRINCIPIOS" title="Claridad, responsabilidad y continuidad." description="Estos principios guían la experiencia pública y el comportamiento del producto."><div className={styles.cardGrid}>{principles.map(({ title, text, icon: Icon }, index) => <article className={styles.card} key={title}><Icon aria-hidden="true" /><span>{String(index + 1).padStart(2, "0")}</span><h3>{title}</h3><p>{text}</p></article>)}</div></R4Section>
    <R4Section tone="dark" eyebrow="FORMA DE TRABAJAR" title="Avanzar con evidencia y límites claros." description="No presentamos promesas como resultados. Cada capacidad debe poder recorrerse, comprobarse y explicarse."><div className={styles.roleGrid}><article><span>01</span><h3>Entender el recorrido</h3><p>Partimos del problema, las personas y la decisión que necesita contexto.</p></article><article><span>02</span><h3>Construir de extremo a extremo</h3><p>Conectamos interfaz, permisos, trazabilidad y respuesta del servidor.</p></article><article><span>03</span><h3>Validar antes de ampliar</h3><p>Probamos con datos sintéticos y conservamos los controles externos apagados hasta su autorización.</p></article></div></R4Section>
    <R4Section eyebrow="SEGURIDAD Y CONTROL" title="La confianza necesita comportamiento verificable." description="Orqena separa empresas, comprueba permisos en servidor, registra las operaciones relevantes y mantiene la confirmación humana."><div className={styles.editorialGrid}><h3>Una interfaz clara no sustituye una regla de seguridad.</h3><div><article><h4>Aislamiento por empresa</h4><p>El contexto activo delimita consultas y cambios. Un enlace o un identificador del navegador no concede acceso.</p></article><article><h4>IA bajo control</h4><p>Orqena IA minimiza el contexto, evita registrar contenido sensible y espera confirmación antes de una acción.</p></article><article><h4>Divulgación coordinada</h4><p>La política y el canal privado de seguridad están disponibles para comunicar hallazgos de forma responsable.</p><Link href="/seguridad">Consultar seguridad</Link></article></div></div></R4Section>
    <R4Section tone="soft" eyebrow="CONTACTO" title="Cuéntanos cómo trabaja tu empresa." description="El formulario principal está en Contacto. Allí puedes solicitar información, una demo o plantear una necesidad concreta."><div className={styles.pillLinks}><Link href="/contacto">Ir a Contacto<ArrowRight aria-hidden="true" /></Link><Link href="/demo">Ver primero la demo</Link></div></R4Section>
    <R4CTA title="Conoce Orqena con un caso parecido a tu operación." text="Preparamos una demo privada con datos sintéticos para recorrer el producto de principio a fin." />
  </MarketingPage>;
}

function CompanyVisual() { return <div className={styles.solutionUi}><header><div><span>ORQENA TECH</span><strong>Producto con propósito operativo</strong></div><em>Orqena</em></header><div className={styles.metricGrid}><article><small>Contexto</small><strong>Conectado</strong></article><article><small>Decisión</small><strong>Humana</strong></article><article><small>Datos</small><strong>Aislados</strong></article></div><div className={styles.solutionBody}><div className={styles.activity}><span>Forma de trabajar</span><p><i>1</i>Entender el recorrido real</p><p><i>2</i>Construir de extremo a extremo</p><p><i>3</i>Validar antes de ampliar</p></div><aside><span>Producto</span><strong>Orqena</strong><p>Gestión inteligente para construcción y servicios.</p></aside></div></div>; }
