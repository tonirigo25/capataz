import Link from "next/link";
import { Bot, CheckCircle2 } from "lucide-react";
import { EmptyState, Status } from "@/components/ui-primitives";
import type { OperationalContext, OperationalSignal, OperationalSignalCategory } from "@/lib/operational-intelligence/types";

export const operationalCategoryLabels: Record<OperationalSignalCategory, string> = {
  planificacion: "Planificación",
  actividad: "Actividad",
  ventas: "Ventas",
  cobros: "Cobros",
  compras_documentacion: "Compras y documentación",
  economia_obra: "Economía de obra"
};

export function OperationalSignalList({ signals, emptyDescription = "No hay señales pendientes con los datos actuales." }: { signals: OperationalSignal[]; emptyDescription?: string }) {
  if (!signals.length) return <EmptyState title="Sin señales operativas pendientes" description={emptyDescription} icon={CheckCircle2} />;
  return <div className="divide-y divide-border">{signals.map((signal) => <OperationalSignalRow key={signal.id} signal={signal} />)}</div>;
}

export function OperationalSignalRow({ signal }: { signal: OperationalSignal }) {
  return (
    <Link href={signal.entity.href} className="grid min-h-20 gap-2 py-3 hover:bg-subtle sm:grid-cols-[auto_1fr_auto] sm:items-start">
      <Status tone={signal.level === "urgente" ? "risk" : signal.level === "atencion" ? "attention" : "neutral"}>{levelLabel(signal.level)}</Status>
      <span className="min-w-0"><span className="type-object-title block text-content">{signal.title}</span><span className="type-secondary mt-1 block">{signal.explanation}</span><span className="type-meta mt-1 block">Siguiente: {signal.nextStep}</span></span>
      <span className="text-sm font-semibold text-brand-strong">Abrir</span>
    </Link>
  );
}

export function OperationalContextSummary({ context, entityType, entityId }: { context: OperationalContext; entityType: "cliente" | "obra"; entityId: string }) {
  const href = entityType === "cliente" ? `/capataz?clienteId=${entityId}` : `/capataz?obraId=${entityId}`;
  return (
    <section className="mt-4 rounded-xl border border-border bg-surface p-4" aria-labelledby={`contexto-${entityType}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div><p id={`contexto-${entityType}`} className="type-label">Contexto operativo</p><p className="type-object-title mt-1 text-content">{context.principal?.title ?? "Sin señales pendientes"}</p><p className="type-secondary mt-1">{context.phrase}</p><p className="type-meta mt-2">Siguiente paso: {context.nextStep}</p></div><Link href={href} className="secondary-button shrink-0"><Bot size={17} /> Preguntar a Orqena</Link></div>
      {context.signals.length > 1 ? <div className="mt-3 border-t border-border pt-3"><OperationalSignalList signals={context.signals.slice(1, 3)} /></div> : null}
    </section>
  );
}

export function levelLabel(level: OperationalSignal["level"]) { return level === "urgente" ? "Urgente" : level === "atencion" ? "Atención" : "Información"; }
