import { ArrowRight, Check, ChevronRight, ShieldCheck, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { MarketingFooter } from "@/app/marketing-v2/_components/landing-sections";
export {
  PublicPageHero,
  PublicHeroActions,
  PublicHeroCopy,
  PublicHeroMedia,
  PublicHeroMetrics,
  PublicHeroTrust,
  PublicHeroVisual,
} from "./public-page-hero";
import styles from "./public-ui.module.css";

export function PublicSection({ eyebrow, title, description, children, tone = "paper", id }: { eyebrow?: string; title?: string; description?: string; children: ReactNode; tone?: "paper" | "soft" | "dark"; id?: string }) {
  return <section id={id} className={styles.section} data-tone={tone}><div className={styles.sectionInner}>{title ? <header><span>{eyebrow}</span><h2>{title}</h2>{description ? <p>{description}</p> : null}</header> : null}{children}</div></section>;
}

export function PublicFeatureGrid({ items }: { items: readonly { title: string; text: string; icon: LucideIcon; meta?: string }[] }) {
  return <div className={styles.featureGrid}>{items.map(({ title, text, icon: Icon, meta }, index) => <article key={title}><div><span>{String(index + 1).padStart(2, "0")}</span><Icon /></div>{meta ? <small>{meta}</small> : null}<h3>{title}</h3><p>{text}</p><strong><Check /> Conectado al contexto real</strong></article>)}</div>;
}

export function PublicProductPreview({ title, state, metrics, children }: { title: string; state: string; metrics: readonly (readonly [string, string])[]; children?: ReactNode }) {
  return <div className={styles.productPreview}><header><span>{title}</span><em>{state}</em></header><div className={styles.previewMetrics}>{metrics.map(([label, value]) => <span key={label}><small>{label}</small><strong>{value}</strong></span>)}</div>{children ?? <div className={styles.previewChart}>{[46, 66, 58, 82, 72, 91].map((value, index) => <i key={index}><b style={{ height: `${value}%` }} /></i>)}</div>}</div>;
}

export function PublicCTA({ title = "Comprueba cómo encaja en tu operación.", text = "Demo privada, datos sintéticos y acompañamiento personal.", primary = ["Solicitar demo", "/contacto?motivo=demo"], secondary = ["Ver demo guiada", "/demo"] }: { title?: string; text?: string; primary?: readonly [string, string]; secondary?: readonly [string, string] }) {
  return <section className={styles.cta}><div><span>Orqena · por Orqena Tech</span><h2>{title}</h2><p>{text}</p></div><div><Link href={primary[1]}>{primary[0]} <ArrowRight /></Link><Link href={secondary[1]}>{secondary[0]}</Link><small><ShieldCheck /> Sin tarjeta · acceso controlado</small></div></section>;
}

export function PublicFooter() { return <MarketingFooter />; }

export function PublicBreadcrumb({ items }: { items: readonly (readonly [string, string])[] }) {
  return <nav className={styles.breadcrumb} aria-label="Migas de pan">{items.map(([label, href], index) => <span key={`${label}-${href}`}>{index ? <ChevronRight /> : null}{href === "#" ? <strong aria-current="page">{label}</strong> : <Link href={href}>{label}</Link>}</span>)}</nav>;
}

export function PublicComparison({ rows, columns }: { columns: readonly string[]; rows: readonly { label: string; values: readonly string[] }[] }) {
  return <div className={styles.comparison} role="region" aria-label="Comparación" tabIndex={0}><table><thead><tr><th>Control</th>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.label}><th>{row.label}</th>{row.values.map((value, index) => <td key={`${row.label}-${index}`}>{value}</td>)}</tr>)}</tbody></table></div>;
}

export function PublicFAQ({ items }: { items: readonly (readonly [string, string])[] }) {
  return <div className={styles.faq}>{items.map(([question, answer], index) => <details key={question} open={index === 0}><summary>{question}<span>+</span></summary><p>{answer}</p></details>)}</div>;
}
