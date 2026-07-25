import { ArrowLeft, ArrowRight, ExternalLink, Eye } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { clsx } from "clsx";

export function ListWorkspace({
  children,
  className,
  contextualPanel,
}: {
  children: ReactNode;
  className?: string;
  contextualPanel?: ReactNode;
}) {
  return (
    <div className={clsx("screen list-workspace", className)} data-workspace-family="list">
      <div className={contextualPanel ? "list-workspace__layout" : undefined}>
        <div className="min-w-0">{children}</div>
        {contextualPanel ? <aside className="list-workspace__context" aria-label="Contexto de la selección">{contextualPanel}</aside> : null}
      </div>
    </div>
  );
}

export function RecordWorkspace({
  children,
  className,
  context,
}: {
  children: ReactNode;
  className?: string;
  context?: ReactNode;
}) {
  return (
    <div className={clsx("screen record-workspace", className)} data-workspace-family="record">
      <div className={context ? "record-workspace__layout" : undefined}>
        <div className="min-w-0">{children}</div>
        {context ? <aside className="record-workspace__context" aria-label="Contexto del registro">{context}</aside> : null}
      </div>
    </div>
  );
}

export function RecordPeek({
  title,
  description,
  href,
  meta,
  previousHref,
  nextHref,
}: {
  title: string;
  description?: string;
  href: string;
  meta?: ReactNode;
  previousHref?: string;
  nextHref?: string;
}) {
  return (
    <details className="record-peek">
      <summary aria-label={`Vista rápida de ${title}`}><Eye size={14} />Vista rápida</summary>
      <div className="record-peek__panel">
        <div className="record-peek__bar">
          <span>Vista rápida</span>
          <nav aria-label="Registro anterior y siguiente">
            {previousHref ? <Link href={previousHref} aria-label="Registro anterior"><ArrowLeft size={15} /></Link> : <span aria-hidden="true" />}
            {nextHref ? <Link href={nextHref} aria-label="Registro siguiente"><ArrowRight size={15} /></Link> : <span aria-hidden="true" />}
          </nav>
        </div>
        <h3>{title}</h3>
        {description ? <p>{description}</p> : null}
        {meta ? <div className="record-peek__meta">{meta}</div> : null}
        <Link href={href} className="record-peek__open">Abrir ficha completa <ExternalLink size={15} /></Link>
      </div>
    </details>
  );
}
