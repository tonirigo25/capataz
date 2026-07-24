import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader, EmptyState } from "@/components/ui-primitives";
import {
  publishAutomationAction,
  newAutomationVersionAction,
  toggleAutomationAction,
  disableAutomationAction,
  duplicateAutomationAction,
  archiveAutomationAction,
  runAutomationAction,
  saveDraftVersionAction,
  saveAutomationScheduleAction,
  retryRunNowAction,
  cancelRunAction,
  confirmStepAction,
} from "../actions";
import { parseRetryPolicy } from "@/lib/automations/automation-retries";
import { requireCapability } from "@/lib/commercial/authorization";
export const dynamic = "force-dynamic";
export default async function AutomationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const auth = await requireCapability("company.update");
  const item = await prisma.automationDefinition.findFirst({
    where: { id, companyId: auth.companyId },
    include: {
      versions: {
        include: {
          triggers: true,
          conditions: { orderBy: { order: "asc" } },
          actions: { orderBy: { order: "asc" } },
        },
        orderBy: { version: "desc" },
      },
      schedule: true,
      runs: {
        include: {
          steps: { include: { action: true }, orderBy: { order: "asc" } },
          confirmations: true,
        },
        orderBy: { startedAt: "desc" },
        take: 30,
      },
    },
  });
  if (!item) notFound();
  const current = item.versions.find((v) => v.id === item.currentVersionId),
    draft = item.versions.find((v) => v.status === "draft"),
    latest = item.versions[0],
    policy = parseRetryPolicy((draft ?? current ?? latest)?.retryPolicy ?? {});
  return (
    <main className="screen space-y-5">
      <Link href="/automatizaciones" className="secondary-button">
        Volver a automatizaciones
      </Link>
      <PageHeader
        eyebrow={item.category}
        title={item.name}
        description={item.description ?? "Sin descripción"}
      />
      <section className="card grid gap-4 p-4 md:grid-cols-3">
        <Metric label="Estado" value={item.status} />
        <Metric
          label="Versión publicada"
          value={current ? `v${current.version}` : "Sin publicar"}
        />
        <Metric
          label="Próxima ejecución"
          value={format(item.schedule?.nextRunAt)}
        />
        <Metric
          label="Última ejecución"
          value={format(item.runs[0]?.startedAt)}
        />
        <Metric
          label="Éxitos"
          value={String(
            item.runs.filter((r) => r.status === "completed").length,
          )}
        />
        <Metric
          label="Fallos / retries"
          value={`${item.runs.filter((r) => r.status === "failed").length} / ${item.runs.filter((r) => r.nextRetryAt).length}`}
        />
      </section>
      <section className="card p-4">
        <h2 className="font-black">Acciones de automatización</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {draft ? (
            <form action={publishAutomationAction}>
              <input type="hidden" name="versionId" value={draft.id} />
              <button className="primary-button">
                Publicar v{draft.version}
              </button>
            </form>
          ) : (
            <form action={newAutomationVersionAction}>
              <input type="hidden" name="id" value={item.id} />
              <button className="secondary-button">Crear nueva versión</button>
            </form>
          )}
          <form action={toggleAutomationAction}>
            <input type="hidden" name="id" value={item.id} />
            <input type="hidden" name="active" value={String(!item.active)} />
            <button className="secondary-button">
              {item.active ? "Pausar" : "Reanudar"}
            </button>
          </form>
          <form action={disableAutomationAction}>
            <input type="hidden" name="id" value={item.id} />
            <button className="secondary-button">Deshabilitar</button>
          </form>
          <form action={duplicateAutomationAction}>
            <input type="hidden" name="id" value={item.id} />
            <button className="secondary-button">Duplicar</button>
          </form>
          <form action={runAutomationAction}>
            <input type="hidden" name="id" value={item.id} />
            <input type="hidden" name="dryRun" value="true" />
            <button className="secondary-button">Dry run</button>
          </form>
          {item.active ? (
            <form action={runAutomationAction}>
              <input type="hidden" name="id" value={item.id} />
              <button className="primary-button">Ejecutar ahora</button>
            </form>
          ) : null}
          <form action={archiveAutomationAction}>
            <input type="hidden" name="id" value={item.id} />
            <button className="danger-button">Archivar</button>
          </form>
        </div>
      </section>
      {draft ? (
        <section className="card p-4">
          <h2 className="font-black">Editor de borrador v{draft.version}</h2>
          <p className="mt-1 text-sm text-slate-500">
            Una versión publicada es inmutable. Este formulario reemplaza la
            configuración del borrador.
          </p>
          <form
            action={saveDraftVersionAction}
            className="mt-4 grid gap-4 md:grid-cols-2"
          >
            <input type="hidden" name="versionId" value={draft.id} />
            <fieldset className="rounded-lg border p-3">
              <legend className="px-2 font-black">Trigger</legend>
              <label className="text-sm font-bold">
                Tipo
                <select
                  className="field mt-1"
                  name="triggerType"
                  defaultValue={draft.triggers[0]?.type ?? "manual"}
                >
                  <option value="manual">Manual</option>
                  <option value="entity_event">Evento de entidad</option>
                  <option value="time_based">Temporal</option>
                  <option value="periodic_evaluation">
                    Evaluación periódica
                  </option>
                </select>
              </label>
              <label className="mt-3 block text-sm font-bold">
                Evento
                <input
                  className="field mt-1"
                  name="eventType"
                  defaultValue={draft.triggers[0]?.eventType ?? ""}
                />
              </label>
              <label className="mt-3 block text-sm font-bold">
                Entidad
                <input
                  className="field mt-1"
                  name="entityType"
                  defaultValue={draft.triggers[0]?.entityType ?? ""}
                />
              </label>
            </fieldset>
            <fieldset className="rounded-lg border p-3">
              <legend className="px-2 font-black">Condición</legend>
              <label className="text-sm font-bold">
                Grupo
                <select
                  className="field mt-1"
                  name="operator"
                  defaultValue={draft.conditions[0]?.operator ?? "and"}
                >
                  <option value="and">Todas (AND)</option>
                  <option value="or">Alguna (OR)</option>
                </select>
              </label>
              <label className="mt-3 block text-sm font-bold">
                Campo permitido
                <input
                  className="field mt-1"
                  name="field"
                  defaultValue={draft.conditions[0]?.field ?? ""}
                />
              </label>
              <label className="mt-3 block text-sm font-bold">
                Comparador
                <select
                  className="field mt-1"
                  name="comparator"
                  defaultValue={draft.conditions[0]?.comparator ?? "equals"}
                >
                  <option value="equals">Igual</option>
                  <option value="not_equals">Distinto</option>
                  <option value="greater_or_equal">Mayor o igual</option>
                  <option value="less_or_equal">Menor o igual</option>
                  <option value="is_empty">Vacío</option>
                  <option value="days_overdue">Días vencido</option>
                </select>
              </label>
              <label className="mt-3 block text-sm font-bold">
                Valor
                <input
                  className="field mt-1"
                  name="value"
                  defaultValue={String(draft.conditions[0]?.value ?? "")}
                />
              </label>
              <input type="hidden" name="valueType" value="string" />
            </fieldset>
            <fieldset className="rounded-lg border p-3">
              <legend className="px-2 font-black">Acción interna</legend>
              <label className="text-sm font-bold">
                Tipo
                <select
                  className="field mt-1"
                  name="actionType"
                  defaultValue={
                    draft.actions[0]?.actionType ?? "generate_internal_summary"
                  }
                >
                  <option value="generate_internal_summary">
                    Resumen interno
                  </option>
                  <option value="create_task">Crear tarea</option>
                  <option value="create_followup">Crear seguimiento</option>
                  <option value="create_reminder">Crear recordatorio</option>
                  <option value="create_alert">Crear alerta</option>
                  <option value="create_recommendation">
                    Crear recomendación
                  </option>
                </select>
              </label>
              <label className="mt-3 block text-sm font-bold">
                Título
                <input
                  className="field mt-1"
                  name="actionTitle"
                  defaultValue={item.name}
                />
              </label>
              <label className="mt-3 flex items-center gap-2 text-sm font-bold">
                <input
                  type="checkbox"
                  name="requiresConfirmation"
                  value="true"
                  defaultChecked={draft.actions[0]?.requiresConfirmation}
                />{" "}
                Requiere confirmación
              </label>
            </fieldset>
            <fieldset className="rounded-lg border p-3">
              <legend className="px-2 font-black">Ejecución y retry</legend>
              <label className="text-sm font-bold">
                Timeout
                <input
                  className="field mt-1"
                  type="number"
                  name="timeoutSeconds"
                  min="1"
                  defaultValue={draft.timeoutSeconds}
                />
              </label>
              <label className="mt-3 block text-sm font-bold">
                Cooldown
                <input
                  className="field mt-1"
                  type="number"
                  name="cooldownSeconds"
                  min="0"
                  defaultValue={draft.cooldownSeconds ?? ""}
                />
              </label>
              <label className="mt-3 block text-sm font-bold">
                Máximo intentos
                <input
                  className="field mt-1"
                  type="number"
                  name="maxAttempts"
                  min="1"
                  defaultValue={policy.maxAttempts}
                />
              </label>
              <label className="mt-3 block text-sm font-bold">
                Estrategia
                <select
                  className="field mt-1"
                  name="backoffType"
                  defaultValue={policy.backoffType}
                >
                  <option value="fixed">Fija</option>
                  <option value="linear">Lineal</option>
                  <option value="exponential">Exponencial</option>
                </select>
              </label>
              <input
                type="hidden"
                name="initialDelaySeconds"
                value={policy.initialDelaySeconds}
              />
              <input
                type="hidden"
                name="maxDelaySeconds"
                value={policy.maxDelaySeconds}
              />
            </fieldset>
            <button className="primary-button md:col-span-2">
              Guardar borrador
            </button>
          </form>
        </section>
      ) : null}
      <section className="card p-4">
        <h2 className="font-black">Programación</h2>
        <form
          action={saveAutomationScheduleAction}
          className="mt-3 grid gap-3 md:grid-cols-2"
        >
          <input type="hidden" name="id" value={item.id} />
          <label className="flex items-center gap-2 text-sm font-bold">
            <input
              type="checkbox"
              name="active"
              value="true"
              defaultChecked={item.schedule?.active}
            />{" "}
            Programación activa
          </label>
          <label className="text-sm font-bold">
            Zona horaria
            <input
              className="field mt-1"
              name="timezone"
              defaultValue={item.schedule?.timezone ?? "Europe/Madrid"}
            />
          </label>
          <label className="text-sm font-bold">
            RRULE
            <input
              className="field mt-1"
              name="rrule"
              defaultValue={item.schedule?.rrule ?? ""}
            />
          </label>
          <label className="text-sm font-bold">
            Cron
            <input
              className="field mt-1"
              name="cronExpression"
              defaultValue={item.schedule?.cronExpression ?? ""}
            />
          </label>
          <label className="text-sm font-bold">
            Próxima ejecución
            <input
              className="field mt-1"
              type="datetime-local"
              name="nextRunAt"
              defaultValue={inputDate(item.schedule?.nextRunAt)}
            />
          </label>
          <button className="primary-button self-end">
            Guardar programación
          </button>
        </form>
      </section>
      <section className="card p-4">
        <h2 className="font-black">Versiones</h2>
        <ol className="mt-3 space-y-2 text-sm">
          {item.versions.map((version) => (
            <li key={version.id}>
              v{version.version} · {version.status} ·{" "}
              {version.triggers.map((t) => t.type).join(", ") || "sin trigger"}{" "}
              ·{" "}
              {version.actions.map((a) => a.actionType).join(", ") ||
                "sin acciones"}
            </li>
          ))}
        </ol>
      </section>
      <section className="card p-4">
        <h2 className="font-black">Runs e historial</h2>
        {item.runs.length ? (
          <div className="mt-3 space-y-4">
            {item.runs.map((run) => (
              <article className="rounded-lg border p-3" key={run.id}>
                <div className="flex flex-wrap justify-between gap-2">
                  <strong>
                    {run.status} · v
                    {item.versions.find((v) => v.id === run.automationVersionId)
                      ?.version ?? "?"}
                  </strong>
                  <span className="text-sm text-slate-500">
                    {format(run.startedAt)} · {run.durationMs ?? 0} ms ·{" "}
                    {run.dryRun ? "dry run" : "real"}
                  </span>
                </div>
                <p className="mt-2 text-sm">
                  Origen: {run.triggeredBy} · Trigger: {run.triggerType} ·
                  Intento {run.attemptCount}
                  {run.nextRetryAt
                    ? ` · próximo ${format(run.nextRetryAt)}`
                    : ""}
                </p>
                {run.lastErrorSummary || run.errorSummary ? (
                  <p className="mt-2 text-sm text-red-700">
                    {run.lastErrorSummary ?? run.errorSummary}
                  </p>
                ) : null}
                <ol className="mt-3 space-y-1 text-sm">
                  {run.steps.map((step) => (
                    <li key={step.id} className="flex flex-wrap items-center gap-2">
                      {step.order}. {step.action.actionType} · {step.status} ·
                      intento {step.attempt}
                      {step.errorSummary ? ` · ${step.errorSummary}` : ""}
                      {step.status === "waiting_confirmation" ? (
                        <form action={confirmStepAction}>
                          <input type="hidden" name="stepId" value={step.id} />
                          <input type="hidden" name="definitionId" value={item.id} />
                          <button className="secondary-button">Confirmar acción interna</button>
                        </form>
                      ) : null}
                    </li>
                  ))}
                </ol>
                <p className="mt-2 text-xs text-slate-500">
                  Correlación registrada y payload sanitizado.{" "}
                  {run.confirmations.length} confirmaciones.
                </p>
                <div className="mt-3 flex gap-2">
                  {run.nextRetryAt ? (
                    <form action={retryRunNowAction}>
                      <input type="hidden" name="runId" value={run.id} />
                      <input
                        type="hidden"
                        name="definitionId"
                        value={item.id}
                      />
                      <button className="secondary-button">
                        Reintentar ahora
                      </button>
                    </form>
                  ) : null}
                  {["queued", "waiting_confirmation"].includes(run.status) ? (
                    <form action={cancelRunAction}>
                      <input type="hidden" name="runId" value={run.id} />
                      <input
                        type="hidden"
                        name="definitionId"
                        value={item.id}
                      />
                      <button className="danger-button">Cancelar</button>
                    </form>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Sin ejecuciones"
            description="Ejecuta un dry run para inspeccionar pasos sin mutaciones."
          />
        )}
      </section>
    </main>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <p className="mt-1 font-black">{value}</p>
    </div>
  );
}
const format = (date: Date | null | undefined) =>
  date ? date.toLocaleString("es-ES") : "Sin fecha";
const inputDate = (date: Date | null | undefined) =>
  date
    ? new Date(date.getTime() - date.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
    : "";
