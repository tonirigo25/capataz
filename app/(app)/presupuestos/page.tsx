import Link from "next/link";
import { CheckCircle2, Copy, Download, Eye, MessageCircle, Pencil, Plus, XCircle } from "lucide-react";
import { convertBudgetToInvoice, convertBudgetToWork, duplicateBudget, updateBudgetStatus } from "@/app/(app)/presupuestos/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { DemoLimitButton } from "@/components/demo-limit-button";
import { SectionHeader } from "@/components/section-header";
import { StatusPill } from "@/components/status-pill";
import { formatCurrency, formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const groups = [
  { title: "Borradores", statuses: ["borrador"] },
  { title: "Pendientes de revisión", statuses: ["pendiente_revision"] },
  { title: "Enviados", statuses: ["enviado", "visto"] },
  { title: "Pendientes de respuesta", statuses: ["pendiente_respuesta"] },
  { title: "Aceptados", statuses: ["aceptado"] },
  { title: "Rechazados", statuses: ["rechazado"] },
  { title: "Caducados", statuses: ["caducado"] }
];

export default async function BudgetsPage({
  searchParams
}: {
  searchParams: Promise<{ filtro?: string; buscar?: string }>;
}) {
  const query = await searchParams;
  const budgets = await prisma.budget.findMany({
    orderBy: { fechaCreacion: "desc" },
    include: { client: true, work: true }
  });
  const visibleBudgets = budgets.filter((budget) => {
    const filter = query.filtro ?? "todos";
    const filterMatch =
      filter === "todos" ||
      (filter === "pendientes" && ["borrador", "pendiente_revision", "pendiente_respuesta", "enviado", "visto"].includes(budget.estado)) ||
      budget.estado === filter;
    const search = normalize(query.buscar ?? "");
    const text = normalize(`${budget.numero} ${budget.titulo} ${budget.client.nombre} ${budget.condiciones ?? ""}`);
    return filterMatch && (!search || text.includes(search));
  });

  return (
    <main className="screen">
      <SectionHeader
        title="Presupuestos"
        description="Borradores, enviados, pendientes de respuesta y aceptados."
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/presupuestos/plantillas" className="secondary-button">
              <Plus size={18} />
              Plantilla
            </Link>
            <DemoLimitButton href="/gestion?tipo=presupuesto&returnTo=/presupuestos" currentCount={budgets.length} limit={2}>
              Añadir
            </DemoLimitButton>
          </div>
        }
      />

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {[
          ["todos", "Todos"],
          ["pendientes", "Pendientes"],
          ["borrador", "Borradores"],
          ["pendiente_revision", "Revisión"],
          ["enviado", "Enviados"],
          ["pendiente_respuesta", "Sin respuesta"],
          ["aceptado", "Aceptados"],
          ["rechazado", "Rechazados"],
          ["caducado", "Caducados"]
        ].map(([id, label]) => (
          <Link key={id} href={`/presupuestos?filtro=${id}`} className={`shrink-0 rounded-lg px-3 py-2 text-sm font-black ${((query.filtro ?? "todos") === id) ? "bg-obra-ink text-white" : "border border-slate-200 bg-white text-obra-ink"}`}>
            {label}
          </Link>
        ))}
      </div>

      <div className="grid gap-4">
        {groups.map((group) => {
          const items = visibleBudgets.filter((budget) => group.statuses.includes(budget.estado));
          return (
            <section key={group.title}>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-base font-black text-obra-ink">{group.title}</h2>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{items.length}</span>
              </div>
              <div className="grid gap-3">
                {items.map((budget) => (
                  <article key={budget.id} className="card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase text-slate-500">{budget.numero}</p>
                        <h3 className="mt-1 text-lg font-black text-obra-ink">{budget.titulo}</h3>
                        <p className="mt-1 text-sm text-slate-500">{budget.client.nombre}{budget.work ? ` · ${budget.work.titulo}` : ""}</p>
                      </div>
                      <StatusPill status={budget.estado} />
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-4">
                      <Mini label="Subtotal" value={formatCurrency(budget.subtotal)} />
                      <Mini label="IVA" value={formatCurrency(budget.iva)} />
                      <Mini label="Total" value={formatCurrency(budget.total)} />
                      <Mini label="Seguimiento" value={formatDate(budget.fechaSeguimiento)} />
                    </div>
                    <div className="mt-3 grid gap-1 text-sm text-slate-600">
                      <p><strong className="text-obra-ink">Creado:</strong> {formatDate(budget.fechaCreacion)}</p>
                      <p><strong className="text-obra-ink">Enviado:</strong> {formatDate(budget.fechaEnvio)}</p>
                      <p><strong className="text-obra-ink">Próxima acción:</strong> {nextBudgetAction(budget.estado)}</p>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link href={`/presupuestos/${budget.id}`} className="primary-button">
                        Abrir detalle
                      </Link>
                      <Link href={`/gestion?tipo=eventoAgenda&clienteId=${budget.clienteId}&obraId=${budget.obraId ?? ""}&presupuestoId=${budget.id}&tipoEvento=seguimiento_presupuesto&titulo=Seguimiento%20${encodeURIComponent(budget.numero)}&descripcion=${encodeURIComponent(budget.titulo)}&fechaInicio=${encodeURIComponent(dateTimeValue(budget.fechaSeguimiento ?? tomorrowAtTen()))}&returnTo=/presupuestos`} className="secondary-button">
                        <MessageCircle size={18} />
                        Preparar seguimiento
                      </Link>
                      <StatusForm id={budget.id} estado="enviado" label="Marcar enviado" icon="send" />
                      <StatusForm id={budget.id} estado="aceptado" label="Marcar aceptado" icon="check" />
                      <StatusForm id={budget.id} estado="rechazado" label="Marcar rechazado" icon="x" />
                      {budget.estado === "aceptado" ? (
                        <>
                          <form action={convertBudgetToWork}>
                            <input type="hidden" name="id" value={budget.id} />
                            <ConfirmSubmitButton message="¿Convertir este presupuesto aceptado en obra?">
                              Convertir en obra
                            </ConfirmSubmitButton>
                          </form>
                          <form action={convertBudgetToInvoice}>
                            <input type="hidden" name="id" value={budget.id} />
                            <ConfirmSubmitButton message="¿Crear una factura/anticipo desde este presupuesto?">
                              Crear anticipo
                            </ConfirmSubmitButton>
                          </form>
                        </>
                      ) : null}
                      <Link href={`/gestion?tipo=presupuesto&id=${budget.id}&returnTo=/presupuestos`} className="secondary-button">
                        <Pencil size={18} />
                        Editar
                      </Link>
                      <form action={duplicateBudget}>
                        <input type="hidden" name="id" value={budget.id} />
                        <ConfirmSubmitButton message="¿Duplicar este presupuesto como borrador editable?">
                          <Copy size={18} />
                          Duplicar
                        </ConfirmSubmitButton>
                      </form>
                      <Link href={`/presupuestos/${budget.id}/pdf?preview=1`} target="_blank" className="secondary-button">
                        <Eye size={18} />
                        Vista previa PDF
                      </Link>
                      <Link href={`/presupuestos/${budget.id}/pdf`} className="secondary-button">
                        <Download size={18} />
                        Descargar PDF
                      </Link>
                    </div>
                  </article>
                ))}
                {items.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">
                    No hay presupuestos en este estado.
                  </div>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-base font-black text-obra-ink">{value}</p>
    </div>
  );
}

function nextBudgetAction(status: string) {
  if (["borrador", "pendiente_revision"].includes(status)) return "Revisar y enviar";
  if (["enviado", "visto", "pendiente_respuesta"].includes(status)) return "Preparar seguimiento";
  if (status === "aceptado") return "Convertir en obra o factura";
  if (status === "caducado") return "Duplicar y actualizar validez";
  if (status === "rechazado") return "Archivar o duplicar si hay cambios";
  return "Revisar";
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function tomorrowAtTen() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(10, 0, 0, 0);
  return date;
}

function dateTimeValue(value: Date) {
  const pad = (part: number) => part.toString().padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

function StatusForm({ id, estado, label, icon }: { id: string; estado: string; label: string; icon: "check" | "x" | "send" }) {
  const Icon = icon === "check" ? CheckCircle2 : icon === "x" ? XCircle : MessageCircle;
  return (
    <form action={updateBudgetStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="estado" value={estado} />
      <ConfirmSubmitButton message={`¿Aplicar el estado "${label}" a este presupuesto?`}>
        <Icon size={18} />
        {label}
      </ConfirmSubmitButton>
    </form>
  );
}
