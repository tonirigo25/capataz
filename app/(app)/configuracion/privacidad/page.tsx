import Link from "next/link";
import { completePrivacyRequest, createPrivacyRequest, exportPrivacyRequest, preparePrivacyCatalog, verifyPrivacyRequest } from "./actions";
import { requireCompanyRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { privacyDeadlineAlerts } from "@/lib/privacy/governance";

const labels: Record<string, string> = { ACCESS: "Acceso", RECTIFICATION: "Rectificación", ERASURE: "Supresión", OBJECTION: "Oposición", RESTRICTION: "Limitación", PORTABILITY: "Portabilidad" };

export default async function PrivacyCenterPage() {
  const actor = await requireCompanyRole(["OWNER", "ADMIN"]);
  const [requests, alerts, activityCount, retentionCount, exportCount] = await Promise.all([
    prisma.privacyRequest.findMany({ where: { companyId: actor.companyId }, orderBy: { createdAt: "desc" }, take: 30 }),
    privacyDeadlineAlerts(prisma, { companyId: actor.companyId }),
    prisma.processingActivity.count({ where: { companyId: actor.companyId, active: true } }),
    prisma.retentionPolicy.count({ where: { companyId: actor.companyId, enabled: true } }),
    prisma.companyDataExport.count({ where: { companyId: actor.companyId, status: "COMPLETED" } }),
  ]);
  const alertIds = new Set(alerts.map((request) => request.id));
  return <main className="screen">
    <Link href="/configuracion" className="text-sm text-muted">← Configuración</Link>
    <h1 className="type-page-title mt-2">Centro de privacidad</h1>
    <p className="type-secondary mt-2">Registra solicitudes, verifica identidad y conserva la evidencia de cada respuesta. Las supresiones requieren un plan previo y confirmación humana.</p>
    <div className="mt-5 grid gap-3 sm:grid-cols-3"><Metric label="Tratamientos activos" value={activityCount} /><Metric label="Políticas de retención activas" value={retentionCount} /><Metric label="Exportaciones trazadas" value={exportCount} /></div>
    {!activityCount ? <form action={preparePrivacyCatalog} className="mt-4"><button className="secondary-button">Preparar catálogo versionado</button><p className="type-meta mt-2">Crea RAT, políticas desactivadas e inventario de proveedores; no activa borrados ni proveedores.</p></form> : null}

    <section className="card mt-6 p-5">
      <h2 className="type-section-title">Nueva solicitud</h2>
      <form action={createPrivacyRequest} className="mt-4 grid gap-3 md:grid-cols-[1fr_1.4fr_auto]">
        <select aria-label="Tipo de solicitud" className="field" name="requestType" required>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <input aria-label="Referencia verificada del interesado" className="field" name="subjectReference" placeholder="Referencia verificada del interesado" required />
        <button className="primary-button">Registrar</button>
      </form>
    </section>

    <section className="mt-6 grid gap-3">
      <h2 className="type-section-title">Solicitudes y plazos</h2>
      {requests.map((request) => <article key={request.id} className="card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{labels[request.requestType] ?? request.requestType}</p><p className="type-meta mt-1">Estado {request.status} · vence {request.dueAt.toLocaleDateString("es-ES")}{alertIds.has(request.id) ? " · requiere atención" : ""}</p></div><span className={alertIds.has(request.id) ? "status-badge status-danger" : "status-badge"}>{request.status}</span></div>
        <div className="mt-4 flex flex-wrap gap-2">
          {!request.identityVerifiedAt ? <form action={verifyPrivacyRequest}><input type="hidden" name="requestId" value={request.id} /><button className="secondary-button">Marcar identidad verificada</button></form> : null}
          {request.identityVerifiedAt && !request.completedAt ? <form action={exportPrivacyRequest}><input type="hidden" name="requestId" value={request.id} /><button className="secondary-button">Crear exportación minimizada</button></form> : null}
          {request.identityVerifiedAt && !request.completedAt ? <form action={completePrivacyRequest} className="flex flex-wrap gap-2"><input type="hidden" name="requestId" value={request.id} /><input className="field max-w-52" name="communicationRef" placeholder="Referencia de comunicación" required /><input className="field max-w-64" name="resolution" placeholder="Resolución" required /><button className="primary-button">Cerrar con evidencia</button></form> : null}
        </div>
      </article>)}
      {!requests.length ? <div className="rounded-xl border border-dashed border-border p-8 text-center">No hay solicitudes registradas.</div> : null}
    </section>
  </main>;
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="card p-4"><p className="type-meta">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div>; }
