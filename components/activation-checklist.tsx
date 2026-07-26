import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import type { ActivationStatus } from "@/lib/product/activation";

export function ActivationChecklist({ status }: { status: ActivationStatus }) {
  const completed = status.milestones.filter((item) => item.completedAt).length;
  if (completed === status.milestones.length) return null;
  return <section className="section-shell mb-8" aria-labelledby="activation-checklist">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="type-label">Primer valor en 7 días</p><h2 id="activation-checklist" className="type-section-title mt-1 text-content">Activa tu espacio sin ayuda externa</h2><p className="type-secondary mt-1">{completed} de {status.milestones.length} pasos · plazo de referencia {status.deadlineAt.toLocaleDateString("es-ES")}.</p></div>
      <span className="status-badge">{Math.round((completed / status.milestones.length) * 100)}%</span>
    </div>
    <ol className="mt-4 grid gap-3 sm:grid-cols-2">
      {status.milestones.map((item) => <li key={item.key} className="rounded-xl border border-border p-4">
        <div className="flex items-start gap-3">{item.completedAt ? <CheckCircle2 className="mt-0.5 shrink-0 text-success" size={20} aria-hidden="true"/> : <Circle className="mt-0.5 shrink-0 text-content-secondary" size={20} aria-hidden="true"/>}<div><h3 className="type-object-title text-content">{item.label}</h3><p className="type-secondary mt-1">{item.description}</p>{item.completedAt ? <p className="type-meta mt-2">Completado</p> : <Link href={item.href} className="mt-2 inline-block text-sm font-semibold text-brand-strong">Continuar</Link>}</div></div>
      </li>)}
    </ol>
  </section>;
}
