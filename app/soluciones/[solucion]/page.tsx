import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, ShieldCheck, UsersRound } from "lucide-react";
import { notFound } from "next/navigation";
import { MarketingPage } from "@/components/marketing/marketing-shell";
import { Process, R4CTA, R4FAQ, R4Hero, R4Section, SolutionInterface, getR4Styles } from "@/components/marketing/r4-pages";
import { brand } from "@/lib/brand";
import { getMarketingSolution, marketingSolutions } from "@/lib/marketing/solutions";

export function generateStaticParams() { return marketingSolutions.map((solution) => ({ solucion: solution.slug })); }

export async function generateMetadata({ params }: { params: Promise<{ solucion: string }> }): Promise<Metadata> {
  const { solucion } = await params; const item = getMarketingSolution(solucion); if (!item) return {};
  return { title: item.title, description: item.outcome, alternates: { canonical: `/soluciones/${item.slug}` }, openGraph: { title: `${item.title} con Orqena`, description: item.outcome, images: [brand.socialImage] } };
}

const styles = getR4Styles();

export default async function SolutionPage({ params }: { params: Promise<{ solucion: string }> }) {
  const { solucion } = await params; const item = getMarketingSolution(solucion); if (!item) notFound();
  const related = item.related.map((slug) => getMarketingSolution(slug)).filter((solution): solution is NonNullable<typeof solution> => Boolean(solution));
  return <MarketingPage>
    <R4Hero current={item.title} parent={["Soluciones", "/soluciones"]} eyebrow={item.eyebrow} title={item.title} description={item.outcome} actions={<><Link href="/contacto?motivo=demo">Solicitar demo<ArrowRight aria-hidden="true" /></Link><Link href="/demo">Ver demo guiada</Link></>} visual={<SolutionInterface solution={item} />} />
    <R4Section eyebrow="EL PROBLEMA" title="El contexto se rompe antes de la decisión." description={item.problem}><div className={styles.editorialGrid}><h3>Orqena convierte información dispersa en un recorrido revisable.</h3><div><article><h4>Resultado visible</h4><p>{item.outcome}</p></article><article><h4>Evidencia en la interfaz</h4><p>{item.proof}</p></article></div></div></R4Section>
    <R4Section tone="soft" eyebrow="FLUJO COMPLETO" title="Cinco estados con responsable y siguiente paso." description="Cada etapa conserva su origen. No hay saltos automáticos sobre decisiones sensibles."><Process steps={item.steps} /></R4Section>
    <R4Section eyebrow="INTERFAZ" title="Información útil, no una ilustración vacía." description="Los datos son sintéticos y muestran la densidad, jerarquía y comportamiento del producto."><SolutionInterface solution={item} /></R4Section>
    <R4Section tone="dark" eyebrow="PERFILES" title="Cada responsabilidad recibe el contexto necesario." description="Los permisos del servidor siguen siendo la autoridad aunque cambie la composición visual."><div className={styles.roleGrid}>{item.roles.map((role, index) => <article key={role}><UsersRound aria-hidden="true" /><span>{String(index + 1).padStart(2, "0")}</span><h3>{role}</h3><p>{index === 0 ? "Visión, prioridades y decisiones pendientes." : index === 1 ? "Trabajo asignado, excepciones y confirmaciones." : "Acciones necesarias dentro de su alcance."}</p></article>)}</div></R4Section>
    <R4Section tone="soft" eyebrow="CONTROL" title="La asistencia no sustituye la responsabilidad." description="Orqena prepara el contexto y mantiene la persona en el centro de la decisión."><div className={styles.roleGrid}><article><CheckCircle2 aria-hidden="true" /><h3>Origen visible</h3><p>Documento, actividad o registro relacionado junto a la propuesta.</p></article><article><ShieldCheck aria-hidden="true" /><h3>Efecto previsto</h3><p>Qué cambiará y qué permanecerá igual antes de confirmar.</p></article><article><CheckCircle2 aria-hidden="true" /><h3>Decisión trazable</h3><p>Editar, confirmar o descartar sin esconder el resultado.</p></article></div></R4Section>
    <R4Section eyebrow="PREGUNTAS FRECUENTES" title={`Antes de explorar ${item.title.toLocaleLowerCase("es-ES")}.`}><R4FAQ items={item.faq} /></R4Section>
    <R4Section tone="soft" eyebrow="TAMBIÉN PUEDE INTERESARTE" title="Continúa el recorrido."><div className={styles.cardGrid}>{related.map((solution) => <Link className={styles.card} href={`/soluciones/${solution.slug}`} key={solution.slug}><span>{solution.eyebrow}</span><h3>{solution.title}</h3><p>{solution.outcome}</p><strong>Ver solución<ArrowRight aria-hidden="true" /></strong></Link>)}</div></R4Section>
    <R4CTA title={`Comprueba ${item.title.toLocaleLowerCase("es-ES")} con un caso parecido al tuyo.`} text="La demo utiliza datos aislados y permite recorrer el flujo completo sin alterar información empresarial." />
  </MarketingPage>;
}
