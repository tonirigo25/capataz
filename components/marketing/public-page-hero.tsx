import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import styles from "./public-page-hero.module.css";

export type PublicHeroVariant = "centered" | "split" | "wide-editorial";
export type PublicHeroTone = "dark" | "paper" | "soft";
export type PublicHeroCrumb = Readonly<{ label: string; href?: string }>;

type PublicPageHeroProps = {
  id?: string;
  variant?: PublicHeroVariant;
  tone?: PublicHeroTone;
  compact?: boolean;
  level?: 1 | 2;
  breadcrumbs?: readonly PublicHeroCrumb[];
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  visual?: ReactNode;
  trust?: ReactNode;
  metrics?: ReactNode;
  media?: ReactNode;
  children?: ReactNode;
};

export function PublicPageHero({
  id = "public-page-hero",
  variant = "split",
  tone = "dark",
  compact = false,
  level = 1,
  breadcrumbs,
  eyebrow,
  title,
  description,
  actions,
  visual,
  trust,
  metrics,
  media,
  children,
}: PublicPageHeroProps) {
  return (
    <section
      aria-labelledby={`${id}-title`}
      className={styles.root}
      data-compact={compact || undefined}
      data-public-hero-layout={variant}
      data-public-layout="hero"
      data-tone={tone}
    >
      <div className={styles.inner}>
        <PublicHeroCopy
          actions={actions}
          breadcrumbs={breadcrumbs}
          description={description}
          eyebrow={eyebrow}
          id={id}
          level={level}
          title={title}
        />
        {visual ? <PublicHeroVisual>{visual}</PublicHeroVisual> : null}
        {metrics ? <PublicHeroMetrics>{metrics}</PublicHeroMetrics> : null}
        {media ? <PublicHeroMedia>{media}</PublicHeroMedia> : null}
        {trust ? <PublicHeroTrust>{trust}</PublicHeroTrust> : null}
        {children ? <div className={styles.footer}>{children}</div> : null}
      </div>
    </section>
  );
}

export function PublicHeroCopy({
  id,
  level,
  breadcrumbs,
  eyebrow,
  title,
  description,
  actions,
}: {
  id: string;
  level: 1 | 2;
  breadcrumbs?: readonly PublicHeroCrumb[];
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  const Heading = level === 1 ? "h1" : "h2";
  return (
    <div className={styles.copy}>
      {breadcrumbs?.length ? <PublicHeroBreadcrumb items={breadcrumbs} /> : null}
      {eyebrow ? <div className={styles.eyebrow}>{eyebrow}</div> : null}
      <Heading id={`${id}-title`}>{title}</Heading>
      {description ? <div className={styles.description}>{description}</div> : null}
      {actions ? <PublicHeroActions>{actions}</PublicHeroActions> : null}
    </div>
  );
}

export function PublicHeroVisual({ children }: { children: ReactNode }) {
  return <div className={styles.visual}>{children}</div>;
}

export function PublicHeroActions({ children }: { children: ReactNode }) {
  return <div className={styles.actions}>{children}</div>;
}

export function PublicHeroTrust({ children }: { children: ReactNode }) {
  return <div className={styles.trust}>{children}</div>;
}

export function PublicHeroMetrics({ children }: { children: ReactNode }) {
  return <div className={styles.metrics}>{children}</div>;
}

export function PublicHeroMedia({ children }: { children: ReactNode }) {
  return <div className={styles.media}>{children}</div>;
}

function PublicHeroBreadcrumb({ items }: { items: readonly PublicHeroCrumb[] }) {
  return (
    <nav aria-label="Migas de pan" className={styles.breadcrumb}>
      {items.map((item, index) => (
        <span key={`${item.label}-${item.href ?? "current"}`}>
          {index > 0 ? <ChevronRight aria-hidden="true" /> : null}
          {item.href ? <Link href={item.href}>{item.label}</Link> : <strong aria-current="page">{item.label}</strong>}
        </span>
      ))}
    </nav>
  );
}
