import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader, EmptyState } from "@/components/ui-primitives";
import {
  editFollowUpAction,
  changeFollowUpStatusAction,
  registerAttemptAction,
  recordOutcomeAction,
  archiveFollowUpAction,
} from "../actions";
export const dynamic = "force-dynamic";
export default async function FollowUpDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = await prisma.followUp.findUnique({
    where: { id },
    include: {
      attempts: { orderBy: { attemptedAt: "desc" } },
      outcomes: { orderBy: { recordedAt: "desc" } },
      automationRun: { include: { definition: true } },
    },
  });
  if (!item) notFound();
  const [client, contact, work, budget, invoice] = await Promise.all([
    item.clientId
      ? prisma.client.findUnique({
          where: { id: item.clientId },
          select: { nombre: true },
        })
      : null,
    item.contactId
      ? prisma.contact.findUnique({
          where: { id: item.contactId },
          select: { nombre: true },
        })
      : null,
    item.workId
      ? prisma.work.findUnique({
          where: { id: item.workId },
          select: { titulo: true },
        })
      : null,
    item.budgetId
      ? prisma.budget.findUnique({
          where: { id: item.budgetId },
          select: { numero: true, titulo: true },
        })
      : null,
    item.invoiceId
      ? prisma.invoice.findUnique({
          where: { id: item.invoiceId },
          select: { numero: true, concepto: true },
        })
      : null,
  ]);
  return (
    <main className="screen space-y-5">
      <Link className="secondary-button" href="/seguimientos">
        Volver a seguimientos
      </Link>
      <PageHeader
        eyebrow={item.origin}
        title={item.title}
        description={`${item.type} · ${item.status}`}
      />
      <section className="card grid gap-4 p-4 md:grid-cols-2">
        <div>
          <h2 className="font-black">Seguimiento</h2>
          <dl className="mt-3 grid gap-2 text-sm">
            <Row label="Estado" value={item.status} />
            <Row label="Prioridad" value={item.priority} />
            <Row
              label="Responsable"
              value={
                item.responsibleId ? "Responsable asignado" : "Sin asignar"
              }
            />
            <Row label="Próxima acción" value={format(item.nextActionAt)} />
            <Row label="Vencimiento" value={format(item.dueAt)} />
            <Row
              label="Resultado esperado"
              value={item.expectedOutcome ?? "Sin definir"}
            />
            <Row
              label="Resultado"
              value={item.resultSummary ?? "Sin resultado"}
            />
          </dl>
        </div>
        <div>
          <h2 className="font-black">Contexto</h2>
          <dl className="mt-3 grid gap-2 text-sm">
            <Row label="Cliente" value={client?.nombre ?? "Sin cliente"} />
            <Row label="Contacto" value={contact?.nombre ?? "Sin contacto"} />
            <Row label="Obra" value={work?.titulo ?? "Sin obra"} />
            <Row
              label="Presupuesto"
              value={
                budget
                  ? `${budget.numero} · ${budget.titulo}`
                  : "Sin presupuesto"
              }
            />
            <Row
              label="Factura"
              value={
                invoice
                  ? `${invoice.numero} · ${invoice.concepto}`
                  : "Sin factura"
              }
            />
            <Row
              label="Automatización"
              value={item.automationRun?.definition.name ?? "No automatizado"}
            />
          </dl>
        </div>
      </section>
      <section className="card p-4">
        <h2 className="font-black">Editar</h2>
        <form
          action={editFollowUpAction}
          className="mt-3 grid gap-3 md:grid-cols-2"
        >
          <input type="hidden" name="id" value={item.id} />
          <label className="text-sm font-bold">
            Título
            <input
              className="field mt-1"
              name="title"
              defaultValue={item.title}
              required
            />
          </label>
          <label className="text-sm font-bold">
            Tipo
            <select className="field mt-1" name="type" defaultValue={item.type}>
              <option value="general">General</option>
              <option value="budget_followup">Presupuesto</option>
              <option value="collection_followup">Cobro</option>
              <option value="client_contact">Cliente</option>
              <option value="work_followup">Obra</option>
            </select>
          </label>
          <label className="text-sm font-bold">
            Prioridad
            <select
              className="field mt-1"
              name="priority"
              defaultValue={item.priority}
            >
              <option value="low">Baja</option>
              <option value="medium">Media</option>
              <option value="high">Alta</option>
              <option value="urgent">Urgente</option>
            </select>
          </label>
          <label className="text-sm font-bold">
            Próxima acción
            <input
              className="field mt-1"
              type="datetime-local"
              name="nextActionAt"
              defaultValue={inputDate(item.nextActionAt)}
            />
          </label>
          <label className="text-sm font-bold md:col-span-2">
            Resultado esperado
            <input
              className="field mt-1"
              name="expectedOutcome"
              defaultValue={item.expectedOutcome ?? ""}
            />
          </label>
          <button className="primary-button md:col-span-2">
            Guardar cambios
          </button>
        </form>
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            ["in_progress", "Iniciar"],
            ["waiting_response", "Esperar respuesta"],
            ["promised", "Registrar promesa"],
            ["completed", "Completar"],
            ["unsuccessful", "Sin éxito"],
            ["cancelled", "Cancelar"],
          ].map(([status, label]) => (
            <form action={changeFollowUpStatusAction} key={status}>
              <input type="hidden" name="id" value={item.id} />
              <input type="hidden" name="status" value={status} />
              <button className="secondary-button">{label}</button>
            </form>
          ))}
          <form action={archiveFollowUpAction}>
            <input type="hidden" name="id" value={item.id} />
            <button className="danger-button">Archivar</button>
          </form>
        </div>
      </section>
      <section className="card p-4">
        <h2 className="font-black">Registrar intento manual</h2>
        <p className="mt-1 text-sm text-slate-500">
          Email y WhatsApp registran la interacción. Revisa el mensaje antes de enviarlo.
        </p>
        <form
          action={registerAttemptAction}
          className="mt-3 grid gap-3 md:grid-cols-2"
        >
          <input type="hidden" name="followUpId" value={item.id} />
          <label className="text-sm font-bold">
            Canal
            <select className="field mt-1" name="channel">
              <option value="internal">Interno</option>
              <option value="phone">Teléfono</option>
              <option value="email_manual">Email manual</option>
              <option value="whatsapp_manual">WhatsApp manual</option>
              <option value="in_person">Presencial</option>
            </select>
          </label>
          <label className="text-sm font-bold">
            Resultado
            <select className="field mt-1" name="response">
              <option value="responded">Respondió</option>
              <option value="no_response">No respondió</option>
              <option value="requested_information">Pidió información</option>
              <option value="promised_payment">Prometió pago</option>
              <option value="rescheduled">Reprogramado</option>
            </select>
          </label>
          <label className="text-sm font-bold md:col-span-2">
            Notas
            <textarea className="field mt-1" name="summary" rows={3} />
          </label>
          <label className="text-sm font-bold">
            Próxima acción
            <input
              className="field mt-1"
              type="datetime-local"
              name="nextActionAt"
            />
          </label>
          <label className="flex items-center gap-2 self-end text-sm font-bold">
            <input type="checkbox" name="createReminder" value="true" /> Crear
            recordatorio interno
          </label>
          <button className="primary-button md:col-span-2">
            Registrar intento
          </button>
        </form>
      </section>
      <section className="card p-4">
        <h2 className="font-black">Registrar resultado estructurado</h2>
        <form
          action={recordOutcomeAction}
          className="mt-3 grid gap-3 md:grid-cols-2"
        >
          <input type="hidden" name="followUpId" value={item.id} />
          <label className="text-sm font-bold">
            Resultado
            <select className="field mt-1" name="type">
              <option value="responded">Respondió</option>
              <option value="no_response">No respondió</option>
              <option value="requested_information">Pidió información</option>
              <option value="promised_payment">Prometió pago</option>
              <option value="payment_reported_external">
                Pago registrado externamente
              </option>
              <option value="budget_accepted_reported">
                Presupuesto aceptado comunicado
              </option>
              <option value="budget_rejected_reported">
                Presupuesto rechazado comunicado
              </option>
              <option value="resolved">Resuelto</option>
              <option value="unresolved">No resuelto</option>
            </select>
          </label>
          <label className="text-sm font-bold">
            Estado
            <select className="field mt-1" name="status">
              <option value="completed">Completado</option>
              <option value="promised">Promesa</option>
              <option value="waiting_response">Esperando</option>
              <option value="unsuccessful">Sin éxito</option>
            </select>
          </label>
          <label className="text-sm font-bold md:col-span-2">
            Resumen
            <textarea className="field mt-1" name="summary" rows={3} />
          </label>
          <p className="text-sm text-amber-700 md:col-span-2">
            Registrar este resultado no marca facturas pagadas ni cambia
            presupuestos automáticamente.
          </p>
          <button className="primary-button md:col-span-2">
            Guardar resultado
          </button>
        </form>
      </section>
      <section className="grid gap-5 lg:grid-cols-2">
        <div className="card p-4">
          <h2 className="font-black">Intentos · {item.attempts.length}</h2>
          {item.attempts.length ? (
            <ol className="mt-3 space-y-3 text-sm">
              {item.attempts.map((attempt) => (
                <li className="border-t pt-3" key={attempt.id}>
                  <strong>{attempt.channel}</strong> ·{" "}
                  {format(attempt.attemptedAt)}
                  <p>{attempt.summary ?? "Sin notas"}</p>
                  {attempt.response ? (
                    <p className="text-slate-500">
                      Resultado: {attempt.response}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState
              title="Sin intentos"
              description="Registra la primera interacción manual."
            />
          )}
        </div>
        <div className="card p-4">
          <h2 className="font-black">Resultados</h2>
          {item.outcomes.length ? (
            <ol className="mt-3 space-y-3 text-sm">
              {item.outcomes.map((outcome) => (
                <li className="border-t pt-3" key={outcome.id}>
                  <strong>{outcome.type}</strong> · {format(outcome.recordedAt)}
                  <p>{outcome.summary ?? "Sin resumen"}</p>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState
              title="Sin resultados"
              description="El historial se conserva aunque se archive el seguimiento."
            />
          )}
        </div>
      </section>
    </main>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="font-bold">{label}</dt>
      <dd className="text-right text-slate-600">{value}</dd>
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
