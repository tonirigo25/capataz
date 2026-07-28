import Link from "next/link";
import { Plus } from "lucide-react";
import {
  CompactFilterBar,
  PageHeader,
  EmptyState,
  ResultCount,
} from "@/components/ui-primitives";
import { prisma } from "@/lib/prisma";
import { createFollowUpAction } from "./actions";
import {
  requireCapability,
  resolveAuthorization,
  resolveScopedEntityIds,
} from "@/lib/commercial/authorization";
import { ListWorkspace } from "@/components/workspaces";
import { statusLabel } from "@/lib/status";
export const dynamic = "force-dynamic";
export default async function FollowUpsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const query = await searchParams,
    filter = query.filtro ?? "pending",
    now = new Date();
  const auth = await requireCapability("followups.view");
  const manageDecision = await resolveAuthorization(auth, "followups.manage");
  const canManage = manageDecision.allowed;
  const [workIds, clientIds, manageWorkIds, manageClientIds] =
    await Promise.all([
      resolveScopedEntityIds(auth, "followups.view", "Work"),
      resolveScopedEntityIds(auth, "followups.view", "Client"),
      canManage
        ? resolveScopedEntityIds(auth, "followups.manage", "Work")
        : Promise.resolve([]),
      canManage
        ? resolveScopedEntityIds(auth, "followups.manage", "Client")
        : Promise.resolve([]),
    ]);
  const [manageableWorks, manageableClients] = canManage
    ? await Promise.all([
        manageDecision.scope === "SELECTED_CLIENTS"
          ? Promise.resolve([])
          : prisma.work.findMany({
              where: {
                companyId: auth.companyId,
                archivada: false,
                ...(manageWorkIds === null
                  ? {}
                  : { id: { in: manageWorkIds } }),
              },
              select: { id: true, titulo: true },
              orderBy: { titulo: "asc" },
              take: 100,
            }),
        manageDecision.scope === "SELECTED_WORKS"
          ? Promise.resolve([])
          : prisma.client.findMany({
              where: {
                companyId: auth.companyId,
                archivadoAt: null,
                ...(manageClientIds === null
                  ? {}
                  : { id: { in: manageClientIds } }),
              },
              select: { id: true, nombre: true, nombreComercial: true },
              orderBy: { nombre: "asc" },
              take: 100,
            }),
      ])
    : [[], []];
  const scopeWhere =
    workIds === null || clientIds === null
      ? {}
      : { OR: [{ workId: { in: workIds } }, { clientId: { in: clientIds } }] };
  const items = await prisma.followUp.findMany({
    where: {
      companyId: auth.companyId,
      ...scopeWhere,
      archivedAt: null,
      ...(filter === "overdue"
        ? {
            nextActionAt: { lt: now },
            status: { notIn: ["completed", "cancelled", "archived"] },
          }
        : filter === "waiting"
          ? { status: "waiting_response" }
          : filter === "promised"
            ? { status: "promised" }
            : filter === "completed"
              ? { status: "completed" }
              : { status: { notIn: ["completed", "cancelled", "archived"] } }),
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(query.workId ? { workId: query.workId } : {}),
      ...(query.invoiceId ? { invoiceId: query.invoiceId } : {}),
      ...(query.budgetId ? { budgetId: query.budgetId } : {}),
    },
    include: {
      attempts: { orderBy: { attemptedAt: "desc" }, take: 1 },
      outcomes: { orderBy: { recordedAt: "desc" }, take: 1 },
    },
    orderBy: { nextActionAt: "asc" },
    take: 200,
  });
  return (
    <ListWorkspace className="space-y-6">
      <PageHeader
        eyebrow="Relaciones"
        title="Seguimientos"
        description="Cola de trabajo con promesas, último intento, canal, resultado y siguiente acción."
        action={canManage ? (
          <Link className="primary-button" href={`/seguimientos?filtro=${filter}&nuevo=1`}>
            <Plus size={18} />
            Nuevo seguimiento
          </Link>
        ) : undefined}
      />
      <CompactFilterBar>
        <nav
          className="flex gap-2 overflow-x-auto pb-2"
          aria-label="Filtros de seguimientos"
        >
          {[
            ["pending", "Pendientes"],
            ["overdue", "Vencidos"],
            ["waiting", "Esperando"],
            ["promised", "Promesas"],
            ["completed", "Completados"],
          ].map(([id, label]) => (
            <Link
              key={id}
              href={`/seguimientos?filtro=${id}`}
              aria-current={filter === id ? "page" : undefined}
              className={`shrink-0 rounded-lg px-3 py-2 text-sm font-black ${
                filter === id
                  ? "bg-obra-ink text-white"
                  : "border border-slate-200 bg-white text-obra-ink"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </CompactFilterBar>
      <ResultCount
        shown={items.length}
        total={items.length}
        noun="seguimientos"
      />
      {canManage && query.nuevo === "1" ? (
        <form
          action={createFollowUpAction}
          className="card grid gap-3 p-4 md:grid-cols-3"
          aria-label="Nuevo seguimiento"
        >
          <label className="text-sm font-bold">
            Título
            <input className="field mt-1" name="title" required />
          </label>
          <label className="text-sm font-bold">
            Tipo
            <select className="field mt-1" name="type">
              <option value="general">General</option>
              <option value="budget_followup">Presupuesto</option>
              <option value="collection_followup">Cobro</option>
              <option value="client_contact">Cliente</option>
            </select>
          </label>
          <label className="text-sm font-bold">
            Próxima acción
            <input
              className="field mt-1"
              type="datetime-local"
              name="nextActionAt"
            />
          </label>
          {manageableWorks.length ? (
            <label className="text-sm font-bold">
              Trabajo
              <select className="field mt-1" name="workId">
                <option value="">Sin trabajo</option>
                {manageableWorks.map((work) => (
                  <option key={work.id} value={work.id}>
                    {work.titulo}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {manageableClients.length ? (
            <label className="text-sm font-bold">
              Cliente
              <select className="field mt-1" name="clientId">
                <option value="">Sin cliente</option>
                {manageableClients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.nombreComercial ?? client.nombre}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="flex flex-wrap gap-2 md:col-span-3">
            <button className="primary-button">Crear seguimiento</button>
            <Link className="secondary-button" href={`/seguimientos?filtro=${filter}`}>Cancelar</Link>
          </div>
        </form>
      ) : null}
      {items.length ? (
        <section className="grid gap-3" aria-live="polite">
          {items.map((item) => (
            <article className="card p-4" key={item.id} data-follow-up-queue-item>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    className="text-lg font-black hover:underline"
                    href={`/seguimientos/${item.id}`}
                  >
                    {item.title}
                  </Link>
                  <p className="text-sm text-slate-500">{item.type} · {statusLabel(item.status)} · prioridad {statusLabel(item.priority)}</p>
                </div>
                <Link
                  className="secondary-button"
                  href={`/seguimientos/${item.id}`}
                >
                  Abrir
                </Link>
              </div>
              <dl className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <QueueField label="Fecha" value={item.nextActionAt ? formatDate(item.nextActionAt) : "Sin fecha"} />
                <QueueField label="Promesa" value={item.expectedOutcome ?? (item.status === "promised" ? "Promesa registrada" : "Sin promesa")} />
                <QueueField label="Último intento" value={item.attempts[0]?.attemptedAt ? formatDate(item.attempts[0].attemptedAt) : "Sin intentos"} />
                <QueueField label="Canal" value={item.attempts[0]?.channel ? statusLabel(item.attempts[0].channel) : "Pendiente de elegir"} />
                <QueueField label="Resultado" value={item.outcomes[0]?.summary ?? item.attempts[0]?.response ?? (item.outcomes[0]?.type ? statusLabel(item.outcomes[0].type) : "Sin resultado")} />
                <QueueField label="Siguiente acción" value={item.nextActionAt ? item.title : "Definir siguiente acción"} />
              </dl>
            </article>
          ))}
        </section>
      ) : (
        <EmptyState
          title="Sin seguimientos"
          description="No hay seguimientos para este filtro."
        />
      )}
    </ListWorkspace>
  );
}

function QueueField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 font-semibold text-obra-ink">{value}</dd>
    </div>
  );
}

const formatDate = (date: Date) =>
  date.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
