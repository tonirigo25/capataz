import Link from "next/link";
import { requirePlatformAccount } from "@/lib/commercial/platform";
import { prisma } from "@/lib/prisma";
import { operationalMetricCatalog, severityPolicy } from "@/lib/observability/operations";

export default async function OperationsDashboardPage() {
  await requirePlatformAccount("PLATFORM_SUPPORT");
  const [metrics, heartbeats, incidents, synthetics] = await Promise.all([
    prisma.operationalMetric.findMany({ orderBy: { measuredAt: "desc" }, take: 40 }),
    prisma.jobHeartbeat.findMany({ orderBy: { updatedAt: "desc" }, take: 40 }),
    prisma.incident.findMany({ orderBy: { detectedAt: "desc" }, include: { timeline: true, actions: true }, take: 30 }),
    prisma.syntheticCheckRun.findMany({ orderBy: { startedAt: "desc" }, take: 30 }),
  ]);
  return <main className="screen">
    <Link href="/plataforma" className="text-sm text-muted">← Plataforma interna</Link>
    <h1 className="type-page-title mt-2">Operaciones e incidentes</h1>
    <p className="type-secondary mt-2">Vista protegida de métricas, workers, comprobaciones sintéticas y postmortems. No muestra payloads ni datos personales.</p>
    <div className="mt-5 grid gap-3 sm:grid-cols-4"><Metric label="Métricas recientes" value={metrics.length} /><Metric label="Workers" value={heartbeats.length} /><Metric label="Incidentes abiertos" value={incidents.filter((item) => item.status !== "CLOSED").length} /><Metric label="Synthetics" value={synthetics.length} /></div>
    <section className="mt-7"><h2 className="type-section-title">Umbrales</h2><div className="mt-3 grid gap-2 md:grid-cols-2">{Object.entries(operationalMetricCatalog).map(([key, value]) => <div className="card p-4" key={key}><strong>{key}</strong><p className="type-meta mt-1">Aviso {value.warning} · crítico {value.critical} {value.unit}</p></div>)}</div></section>
    <section className="mt-7"><h2 className="type-section-title">Workers y colas</h2><div className="mt-3 grid gap-2">{heartbeats.map((heartbeat) => <article className="card p-4" key={heartbeat.id}><div className="flex justify-between gap-3"><strong>{heartbeat.jobKey}</strong><span className="status-chip">{heartbeat.status}</span></div><p className="type-meta mt-1">{heartbeat.environment} · dead letters {heartbeat.deadLetterCount} · última señal {heartbeat.updatedAt.toLocaleString("es-ES")}</p></article>)}{!heartbeats.length ? <p className="empty-state">Sin heartbeats registrados todavía.</p> : null}</div></section>
    <section className="mt-7"><h2 className="type-section-title">Incidentes</h2><div className="mt-3 grid gap-2">{incidents.map((incident) => <article className="card p-4" key={incident.id}><div className="flex justify-between gap-3"><div><strong>{incident.severity} · {incident.title}</strong><p className="type-secondary mt-1">{incident.summary}</p></div><span className="status-chip">{incident.status}</span></div><p className="type-meta mt-2">SLA interno: reconocer en {severityPolicy[incident.severity as keyof typeof severityPolicy]?.acknowledgeMinutes ?? "—"} min · {incident.timeline.length} hitos · {incident.actions.length} acciones</p></article>)}{!incidents.length ? <p className="empty-state">Sin incidentes registrados.</p> : null}</div></section>
  </main>;
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="card p-4"><p className="type-meta">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div>; }
