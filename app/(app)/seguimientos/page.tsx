import Link from "next/link";
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
        description="Próximas acciones, intentos manuales y resultados estructurados."
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
              className={
                filter === id
                  ? "primary-button shrink-0"
                  : "secondary-button shrink-0"
              }
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
      {canManage ? (
        <form
          action={createFollowUpAction}
          className="card grid gap-3 p-4 md:grid-cols-3"
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
          <button className="primary-button md:col-span-3">
            Crear seguimiento
          </button>
        </form>
      ) : null}
      {items.length ? (
        <section className="grid gap-3" aria-live="polite">
          {items.map((item) => (
            <article className="card p-4" key={item.id}>
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <Link
                    className="text-lg font-black hover:underline"
                    href={`/seguimientos/${item.id}`}
                  >
                    {item.title}
                  </Link>
                  <p className="text-sm text-slate-500">
                    {item.type} · {item.status} · {item.priority}
                    {item.nextActionAt
                      ? ` · ${item.nextActionAt.toLocaleString("es-ES")}`
                      : ""}
                  </p>
                  <p className="mt-1 text-sm">
                    {item.attempts.length
                      ? `Último intento ${item.attempts[0].attemptedAt.toLocaleString("es-ES")}`
                      : "Sin intentos"}{" "}
                    · {item.outcomes[0]?.type ?? "sin resultado"}
                  </p>
                </div>
                <Link
                  className="secondary-button"
                  href={`/seguimientos/${item.id}`}
                >
                  Abrir
                </Link>
              </div>
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
