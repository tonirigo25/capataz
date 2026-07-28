import Link from "next/link";
import { Plus } from "lucide-react";
import { CompactFilterBar, PageHeader, EmptyState, ResultCount } from "@/components/ui-primitives";
import { prisma } from "@/lib/prisma";
import { AUTOMATION_TEMPLATES } from "@/lib/automations/automation-templates";
import {
  createAutomationAction,
  publishAutomationAction,
  runAutomationAction,
  toggleAutomationAction,
} from "./actions";
import { requireCapability } from "@/lib/commercial/authorization";
export const dynamic = "force-dynamic";
export default async function AutomationsPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; nuevo?: string }>;
}) {
  const { estado = "all", nuevo } = await searchParams;
  const auth = await requireCapability("company.update");
  const items = await prisma.automationDefinition.findMany({
    where: {
      companyId: auth.companyId,
      archivedAt: null,
      ...(estado === "all" ? {} : { status: estado as never }),
    },
    include: {
      versions: {
        include: { triggers: true, conditions: true, actions: true },
        orderBy: { version: "desc" },
        take: 1,
      },
      schedule: true,
      runs: { orderBy: { startedAt: "desc" }, take: 20 },
    },
    orderBy: { updatedAt: "desc" },
  });
  return (
    <main className="screen space-y-6">
      <PageHeader
        eyebrow="Motor seguro"
        title="Automatizaciones"
        description="Estado, trigger, próxima ejecución y fallos visibles; ninguna acción sensible se ejecuta sin confirmación."
        action={
          <Link className="primary-button" href={`/automatizaciones?estado=${estado}&nuevo=1`}>
            <Plus size={18} />
            Crear automatización
          </Link>
        }
      />
      <CompactFilterBar><nav
        className="flex gap-2 overflow-x-auto pb-2"
        aria-label="Filtros de automatizaciones"
      >
        {[
          ["all", "Todas"],
          ["active", "Activas"],
          ["paused", "Pausadas"],
          ["draft", "Borradores"],
          ["disabled", "Deshabilitadas"],
        ].map(([id, label]) => (
          <Link
            key={id}
            href={`/automatizaciones?estado=${id}`}
            aria-current={estado === id ? "page" : undefined}
            className={`shrink-0 rounded-lg px-3 py-2 text-sm font-black ${
              estado === id
                ? "bg-obra-ink text-white"
                : "border border-slate-200 bg-white text-obra-ink"
            }`}
          >
            {label}
          </Link>
        ))}
      </nav></CompactFilterBar>
      <ResultCount shown={items.length} total={items.length} noun="automatizaciones" />
      {nuevo === "1" ? <form
        action={createAutomationAction}
        className="card grid gap-3 p-4 md:grid-cols-2"
        aria-label="Crear automatización"
      >
        <label className="text-sm font-bold">
          Nombre
          <input className="field mt-1" name="name" required />
        </label>
        <label className="text-sm font-bold">
          Descripción
          <input className="field mt-1" name="description" />
        </label>
        <div className="flex flex-wrap gap-2 md:col-span-2">
          <button className="primary-button">Crear borrador manual</button>
          <Link className="secondary-button" href={`/automatizaciones?estado=${estado}`}>Cancelar</Link>
        </div>
      </form> : null}
      {items.length ? (
        <section className="grid gap-3">
          {items.map((item) => {
            const version = item.versions[0],
              last = item.runs[0],
              success = item.runs.filter(
                (r) => r.status === "completed",
              ).length,
              failed = item.runs.filter((r) => r.status === "failed").length,
              retries = item.runs.filter((r) => r.nextRetryAt).length;
            return (
              <article className="card p-4" key={item.id} data-automation-state={item.status}>
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <Link
                      className="text-lg font-black hover:underline"
                      href={`/automatizaciones/${item.id}`}
                    >
                      {item.name}
                    </Link>
                    <p className="text-sm text-slate-500">
                      {item.category} · {item.status} · prioridad{" "}
                      {item.priority} · v{version?.version ?? "-"}{" "}
                      {version?.status ?? ""}
                    </p>
                    <p className="mt-1 text-sm">
                      Trigger:{" "}
                      {version?.triggers.map((t) => t.type).join(", ") ||
                        "sin trigger"}{" "}
                      · Acción:{" "}
                      {version?.actions.map((a) => a.actionType).join(", ") ||
                        "sin acción"}
                    </p>
                    <p className="mt-1 text-sm">
                      Última:{" "}
                      {last
                        ? `${last.status} · ${last.startedAt.toLocaleString("es-ES")}`
                        : "sin runs"}{" "}
                      · Próxima:{" "}
                      {item.schedule?.nextRunAt?.toLocaleString("es-ES") ??
                        "sin programar"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Éxitos {success} · fallos {failed} · retries {retries}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      className="secondary-button"
                      href={`/automatizaciones/${item.id}`}
                    >
                      Abrir detalle
                    </Link>
                    {version?.status === "draft" ? (
                      <form action={publishAutomationAction}>
                        <input
                          type="hidden"
                          name="versionId"
                          value={version.id}
                        />
                        <button className="secondary-button">Publicar</button>
                      </form>
                    ) : null}
                    <form action={runAutomationAction}>
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="dryRun" value="true" />
                      <button className="secondary-button">Dry run</button>
                    </form>
                    <form action={toggleAutomationAction}>
                      <input type="hidden" name="id" value={item.id} />
                      <input
                        type="hidden"
                        name="active"
                        value={String(!item.active)}
                      />
                      <button className="secondary-button">
                        {item.active ? "Pausar" : "Reanudar"}
                      </button>
                    </form>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <EmptyState
          title="Sin automatizaciones"
          description="No hay definiciones para este filtro."
        />
      )}
      <section className="card p-4">
        <h2 className="font-black">Plantillas disponibles · desactivadas</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {AUTOMATION_TEMPLATES.map((template) => (
            <article className="rounded-lg border p-3" key={template.id}>
              <h3 className="font-bold">{template.name}</h3>
              <p className="text-sm text-slate-500">
                {template.trigger} · {template.action}
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
