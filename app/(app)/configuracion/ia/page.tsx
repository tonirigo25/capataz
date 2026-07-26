import Link from "next/link";
import { requireCompanyRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { aiUsageSummary } from "@/lib/ai/governance-service";
import { changeAiKillSwitch, reviewAiResult } from "./actions";

export const dynamic = "force-dynamic";

export default async function AiGovernancePage() {
  const actor = await requireCompanyRole(["OWNER", "ADMIN"]);
  const since = new Date();
  since.setUTCDate(1);
  since.setUTCHours(0, 0, 0, 0);
  const [policy, summary] = await Promise.all([
    prisma.companyAiPolicy.findUnique({ where: { companyId: actor.companyId } }),
    aiUsageSummary(prisma, { companyId: actor.companyId, since }),
  ]);
  return <main className="screen">
    <Link href="/configuracion" className="text-sm text-muted">← Configuración</Link>
    <h1 className="type-page-title mt-2">IA, revisión y consumo</h1>
    <p className="type-secondary mt-2">La IA propone; no ejecuta acciones sensibles sin confirmación. Este panel no conserva prompts, documentos ni respuestas.</p>
    <div className="mt-5 grid gap-3 sm:grid-cols-4">
      <Metric label="Llamadas del mes" value={summary.callCount} />
      <Metric label="Tokens agregados" value={summary.inputTokens + summary.outputTokens} />
      <Metric label="Coste agregado" value={`${summary.aggregateCostEur.toFixed(6)} EUR`} />
      <Metric label="Revisadas" value={Object.values(summary.reviewOutcomes).reduce((sum, value) => sum + value, 0)} />
    </div>
    <section className="card mt-6 p-5">
      <h2 className="type-section-title">Estado y límites</h2>
      {!policy ? <p className="type-secondary mt-2">La IA está desactivada: no existe una política aprobada para esta empresa.</p> : <>
        <p className="type-secondary mt-2">Estado: {policy.enabled && !policy.killSwitch ? "habilitada por política" : "desactivada"}. Revisión humana: {policy.humanReviewRequired ? "obligatoria" : "según operación"}.</p>
        <p className="type-meta mt-2">Presupuesto empresa {Number(policy.companyMonthlyBudget).toFixed(2)} EUR/mes · usuario {Number(policy.userMonthlyBudget).toFixed(2)} EUR/mes · operación {Number(policy.operationBudget).toFixed(2)} EUR.</p>
        {actor.role === "OWNER" ? <form action={changeAiKillSwitch} className="mt-4">
          <input type="hidden" name="killSwitch" value={policy.killSwitch ? "false" : "true"} />
          <button className={policy.killSwitch ? "secondary-button" : "primary-button"}>{policy.killSwitch ? "Solicitar reactivación por política" : "Desactivar IA ahora"}</button>
          <p className="type-meta mt-2">El interruptor de empresa no configura credenciales ni activa IA live global.</p>
        </form> : null}
      </>}
    </section>
    <section className="mt-6 grid gap-3">
      <h2 className="type-section-title">Uso reciente y revisión</h2>
      {summary.calls.map((call) => <article key={call.id} className="card p-4">
        <div className="flex flex-wrap justify-between gap-3"><div><p className="font-semibold">{call.purpose} · {call.lane}</p><p className="type-meta">{call.createdAt.toLocaleString("es-ES")} · {call.modelSnapshot ?? "modelo sin snapshot"}</p></div><span className="status-badge">{call.outcome}</span></div>
        <p className="type-meta mt-2">Tokens {(call.inputTokens ?? 0) + (call.outputTokens ?? 0)} · coste {Number(call.costAmount ?? 0).toFixed(6)} EUR · latencia {call.latencyMs ?? 0} ms{call.estimatedUsage ? " · estimación sintética/no conciliada" : ""}</p>
        {!call.humanReviewed ? <form action={reviewAiResult} className="mt-3 flex flex-wrap gap-2">
          <input type="hidden" name="usageEventId" value={call.id} />
          <select className="field max-w-44" name="outcome" defaultValue="ACCEPTED"><option value="ACCEPTED">Aceptada</option><option value="CORRECTED">Corregida</option><option value="REJECTED">Rechazada</option></select>
          <input className="field max-w-56" name="correctionKinds" placeholder="Tipos de corrección" />
          <input className="field max-w-48" name="reasonCode" placeholder="Motivo sin datos personales" />
          <button className="secondary-button">Registrar revisión</button>
        </form> : <p className="type-meta mt-2">Revisión humana registrada.</p>}
      </article>)}
      {!summary.calls.length ? <div className="rounded-xl border border-dashed border-border p-8 text-center">No hay uso de IA registrado este mes.</div> : null}
    </section>
  </main>;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="card p-4"><p className="type-meta">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div>;
}
