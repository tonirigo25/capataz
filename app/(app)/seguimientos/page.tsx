import Link from "next/link";
import { CompactFilterBar, PageHeader, EmptyState, ResultCount } from "@/components/ui-primitives";
import { prisma } from "@/lib/prisma";
import { createFollowUpAction } from "./actions";
export const dynamic = "force-dynamic";
export default async function FollowUpsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const query = await searchParams,
    filter = query.filtro ?? "pending",
    now = new Date();
  const items = await prisma.followUp.findMany({
    where: {
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
    <main className="screen space-y-6">
      <PageHeader
        eyebrow="Relaciones"
        title="Seguimientos"
        description="Próximas acciones, intentos manuales y resultados estructurados."
      />
      <CompactFilterBar><nav
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
      </nav></CompactFilterBar>
      <ResultCount shown={items.length} total={items.length} noun="seguimientos" />
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
        <button className="primary-button md:col-span-3">
          Crear seguimiento
        </button>
      </form>
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
    </main>
  );
}
