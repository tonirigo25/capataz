import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Check, ChevronRight, ShieldCheck } from "lucide-react";
import type { MarketingSolution } from "@/lib/marketing/solutions";
import { PublicPageHero, type PublicHeroVariant } from "./public-page-hero";
import styles from "./r4-pages.module.css";

export function R4Breadcrumb({ current, parent }: { current: string; parent?: readonly [string, string] }) {
  return (
    <nav className={styles.breadcrumb} aria-label="Migas de pan">
      <Link href="/">Inicio</Link><ChevronRight aria-hidden="true" />
      {parent ? <><Link href={parent[1]}>{parent[0]}</Link><ChevronRight aria-hidden="true" /></> : null}
      <span aria-current="page">{current}</span>
    </nav>
  );
}

export function R4Hero({ eyebrow, title, description, visual, actions, current, parent, variant = "split" }: { eyebrow: string; title: string; description: string; visual?: ReactNode; actions?: ReactNode; current: string; parent?: readonly [string, string]; variant?: PublicHeroVariant }) {
  const breadcrumbs = [
    { label: "Inicio", href: "/" },
    ...(parent ? [{ label: parent[0], href: parent[1] }] : []),
    { label: current },
  ];
  return <PublicPageHero actions={actions} breadcrumbs={breadcrumbs} description={description} eyebrow={eyebrow} id={`hero-${current.toLocaleLowerCase("es-ES").replaceAll(" ", "-")}`} title={title} variant={variant} visual={visual} />;
}

export function R4Section({ eyebrow, title, description, children, tone = "paper", id }: { eyebrow: string; title: string; description?: string; children: ReactNode; tone?: "paper" | "soft" | "dark"; id?: string }) {
  return (
    <section className={styles.section} data-tone={tone} id={id}>
      <div className={styles.sectionInner}>
        <header className={styles.sectionHeader}><p className={styles.eyebrow}>{eyebrow}</p><h2>{title}</h2>{description ? <p>{description}</p> : null}</header>
        {children}
      </div>
    </section>
  );
}

export function R4CTA({ title = "Comprueba cómo encaja Orqena en tu forma de trabajar.", text = "Recorre un caso completo con datos sintéticos y comprueba cómo se conectan clientes, trabajo, costes, documentos y cobros.", primary = ["Solicitar acceso", "/contacto?motivo=acceso"], secondary = ["Ver demo guiada", "/demo"] }: { title?: string; text?: string; primary?: readonly [string, string]; secondary?: readonly [string, string] }) {
  return (
    <section className={styles.cta}>
      <div><p className={styles.eyebrow}>DEMO PRIVADA, CON DATOS AISLADOS</p><h2>{title}</h2><p>{text}</p></div>
      <div className={styles.ctaActions}><Link className={styles.primaryButton} href={primary[1]}>{primary[0]}<ArrowRight aria-hidden="true" /></Link><Link className={styles.secondaryButton} href={secondary[1]}>{secondary[0]}</Link><small><ShieldCheck aria-hidden="true" />Sin tarjeta ni cargos automáticos</small></div>
    </section>
  );
}

export function R4FAQ({ items }: { items: readonly (readonly [string, string])[] }) {
  return <div className={styles.faq}>{items.map(([question, answer], index) => <details key={question} open={index === 0}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div>;
}

export function SolutionInterface({ solution }: { solution: MarketingSolution }) {
  return (
    <div className={styles.solutionUi}>
      <header><div><span>ORQENA</span><strong>{solution.title}</strong></div><em>Datos de demostración</em></header>
      <div className={styles.metricGrid}>{solution.metrics.map(([label, value]) => <article key={label}><small>{label}</small><strong>{value}</strong></article>)}</div>
      <div className={styles.solutionBody}>
        <div className={styles.activity}><span>Actividad reciente</span>{solution.activity.map((item, index) => <p key={item}><i>{index + 1}</i>{item}</p>)}</div>
        <aside><span>Control humano</span><strong>2 cambios por revisar</strong><p>Nada se confirma sin una persona autorizada.</p></aside>
      </div>
    </div>
  );
}

export function Process({ steps }: { steps: readonly string[] }) {
  return <ol className={styles.process}>{steps.map((step, index) => <li key={step}><span>{String(index + 1).padStart(2, "0")}</span><strong>{step}</strong>{index < steps.length - 1 ? <ArrowRight aria-hidden="true" /> : <Check aria-hidden="true" />}</li>)}</ol>;
}

export function getR4Styles() { return styles; }
