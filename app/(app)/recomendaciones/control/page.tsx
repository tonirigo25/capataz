import Link from "next/link";
import { Activity, AlertTriangle, BarChart3, Clock3, History, LockKeyhole, Play, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { runProactiveEvaluationAction } from "@/app/(app)/recomendaciones/control/actions";
import { EmptyState, Notice, PageHeader } from "@/components/ui-primitives";
import { formatDate } from "@/lib/format";
import { formatProactiveSummaryLine, getProactiveControlData } from "@/lib/proactive-evaluation";
import { requireCapability } from "@/lib/commercial/authorization";

export const dynamic = "force-dynamic";

type ControlSearchParams = {
  resultado?: string;
  run?: string;
};

export default async function ProactiveControlPage({
  searchParams
}: {
  searchParams: Promise<ControlSearchParams>;
}) {
  const query = await searchParams;
  const auth = await requireCapability("reports.view");
  const data = await getProactiveControlData(new Date(), auth.companyId);
  const latest = data.latestRun;

  return (
    <main className="screen">
      <PageHeader
        eyebrow="Sistema proactivo"
        title="Centro de control"
        description="Reevaluación, locks, auditoría y métricas internas del asistente. Las acciones externas siguen bloqueadas sin confirmación explícita."
        badge={<span className="rounded-full bg-obra-yellow px-3 py-1 text-xs font-black text-obra-ink">{data.metrics.recommendationsActive} activas</span>}
        secondaryActions={<Link href="/recomendaciones" className="secondary-button"><Activity size={18} /> Volver</Link>}
      >
        <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-xs font-black uppercase text-slate-500">Última evaluación</p>
            {latest ? (
              <p className="mt-1 text-sm font-bold text-obra-ink">
                {latest.status} · {formatDate(latest.startedAt)} · {latest.durationMs ?? 0} ms · {latest.triggeredBy}
              </p>
            ) : (
              <p className="mt-1 text-sm font-bold text-slate-600">El sistema proactivo todavía no se ha evaluado.</p>
            )}
          </div>
          <form action={runProactiveEvaluationAction}>
            <button className="primary-button min-h-11" type="submit">
              <Play size={18} />
              Evaluar ahora
            </button>
          </form>
        </div>
      </PageHeader>

      {query.resultado ? (
        <div aria-live="polite">
          <Notice
            tone={query.resultado === "locked" ? "warning" : query.resultado === "failed" ? "danger" : "success"}
            title={query.resultado === "locked" ? "Evaluación ya en curso" : query.resultado === "failed" ? "Evaluación fallida" : "Evaluación ejecutada"}
            description={query.run ? `Run ${query.run}. Revisa el histórico inferior para el resumen.` : "El resultado queda registrado en auditoría interna."}
          />
        </div>
      ) : null}

      <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Metric label="Señales activas" value={data.metrics.signalsActive} icon={AlertTriangle} />
        <Metric label="Recomendaciones" value={data.metrics.recommendationsActive} icon={Activity} />
        <Metric label="Críticas" value={data.metrics.criticalSignals} icon={ShieldCheck} />
        <Metric label="Aceptación" value={`${data.metrics.acceptanceRate}%`} icon={BarChart3} />
        <Metric label="Finalización" value={`${data.metrics.completionRate}%`} icon={BarChart3} />
        <Metric label="Errores" value={data.metrics.failedRuns + data.metrics.failedActions} icon={Clock3} />
      </section>

      <section className="mt-5 grid gap-4 xl:grid-cols-[1fr_1fr]">
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-soft">
          <p className="flex items-center gap-2 text-sm font-black uppercase text-slate-500"><SlidersHorizontal size={17} /> Preferencias</p>
          {data.settings ? (
            <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
              <Mini label="General" value={`${data.settings.evaluationFrequencyMinutes} min`} />
              <Mini label="Urgente" value={`${data.settings.urgentEvaluationFrequencyMinutes} min`} />
              <Mini label="Mantenimiento" value={`${data.settings.maintenanceFrequencyMinutes} min`} />
              <Mini label="Hoy" value={`${data.settings.todayRecommendationLimit} recomendaciones`} />
              <Mini label="Horas silenciosas" value={`${data.settings.quietHoursStart ?? "No"} - ${data.settings.quietHoursEnd ?? "No"}`} />
              <Mini label="Prioridad mínima" value={data.settings.minimumPriority} />
            </div>
          ) : (
            <EmptyState title="Sin preferencias" description="No hay preferencias proactivas persistidas todavía." icon={SlidersHorizontal} />
          )}
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-soft">
          <p className="flex items-center gap-2 text-sm font-black uppercase text-slate-500"><History size={17} /> Resúmenes internos</p>
          <div className="mt-3 grid gap-3 text-sm leading-6 text-slate-700">
            <div>
              <p className="font-black text-obra-ink">{data.dailySummary.title}</p>
              <ul className="mt-1 grid gap-1">
                {data.dailySummary.lines.length ? data.dailySummary.lines.map((line) => <li key={line}>- {line}</li>) : <li>- Sin recomendaciones prioritarias.</li>}
              </ul>
            </div>
            <div>
              <p className="font-black text-obra-ink">{data.weeklySummary.title}</p>
              <ul className="mt-1 grid gap-1">
                {data.weeklySummary.lines.map((line) => <li key={line}>- {line}</li>)}
              </ul>
            </div>
          </div>
        </article>
      </section>

      <section className="mt-5 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-soft">
          <p className="flex items-center gap-2 text-sm font-black uppercase text-slate-500"><LockKeyhole size={17} /> Ejecuciones</p>
          {data.runs.length ? (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-2 pr-3">Inicio</th>
                    <th className="py-2 pr-3">Estado</th>
                    <th className="py-2 pr-3">Trigger</th>
                    <th className="py-2 pr-3">Resumen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.runs.map((run) => (
                    <tr key={run.id}>
                      <td className="py-2 pr-3 font-bold text-obra-ink">{formatDate(run.startedAt)}</td>
                      <td className="py-2 pr-3">{run.status}</td>
                      <td className="py-2 pr-3">{run.triggeredBy}</td>
                      <td className="py-2 pr-3 text-slate-600">
                        {formatProactiveSummaryLine({
                          processedSignals: run.processedSignals,
                          createdSignals: run.createdSignals,
                          updatedSignals: run.updatedSignals,
                          resolvedSignals: run.resolvedSignals,
                          reactivatedSignals: run.reactivatedSignals,
                          expiredSignals: run.expiredSignals,
                          processedRecommendations: run.processedRecommendations,
                          createdRecommendations: run.createdRecommendations,
                          updatedRecommendations: run.updatedRecommendations,
                          resolvedRecommendations: run.resolvedRecommendations,
                          obsoleteRecommendations: run.obsoleteRecommendations,
                          reactivatedRecommendations: run.reactivatedRecommendations,
                          durationMs: run.durationMs ?? 0,
                          errors: run.status === "failed" ? 1 : 0
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="Sin ejecuciones" description="El sistema proactivo todavía no se ha evaluado." icon={Clock3} />
          )}
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-soft">
          <p className="flex items-center gap-2 text-sm font-black uppercase text-slate-500"><AlertTriangle size={17} /> Ruido</p>
          {data.noisyRules.length ? (
            <div className="mt-3 grid gap-3">
              {data.noisyRules.map((rule) => (
                <div key={rule.ruleId} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                  <p className="font-black">{rule.ruleId}</p>
                  <p className="mt-1">{rule.warning}</p>
                  <p className="mt-1 text-xs font-bold">Total {rule.total} · descartadas {rule.dismissed} · activas {rule.active}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="Sin ruido destacado" description="No hay reglas con alto descarte o exceso de recomendaciones activas." icon={ShieldCheck} />
          )}
        </article>
      </section>

      <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4 shadow-soft">
        <p className="flex items-center gap-2 text-sm font-black uppercase text-slate-500"><History size={17} /> Auditoría reciente</p>
        {data.auditEvents.length ? (
          <div className="mt-3 grid gap-2">
            {data.auditEvents.map((event) => (
              <div key={event.id} className="rounded-lg bg-slate-50 p-3 text-sm">
                <p className="font-black text-obra-ink">{event.eventType} · {formatDate(event.createdAt)}</p>
                <p className="mt-1 text-slate-600">
                  {event.previousStatus ? `${event.previousStatus} -> ${event.nextStatus ?? "sin cambio"}. ` : ""}
                  {event.reason ?? event.result ?? "Evento registrado."}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="Aún no hay actividad del sistema proactivo" description="Las transiciones y ejecuciones aparecerán aquí." icon={History} />
        )}
      </section>
    </main>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof Activity }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-soft">
      <Icon size={19} className="text-obra-yellowDark" />
      <p className="mt-2 text-sm font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black tabular-nums text-obra-ink">{value}</p>
    </article>
  );
}

function Mini({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-[11px] font-black uppercase text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-obra-ink">{value ?? "Sin configurar"}</p>
    </div>
  );
}
