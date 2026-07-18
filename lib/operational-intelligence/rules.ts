import { invoiceBalance, isBillableInvoiceStatus, calculateWorkProfitability } from "@/lib/business-metrics";
import type { OperationalContext, OperationalSignal, OperationalSignalCategory, OperationalSignalLevel } from "@/lib/operational-intelligence/types";

export const OPERATIONAL_THRESHOLDS = {
  dueSoonDays: 7,
  documentAttentionDays: 30,
  documentUrgentDays: 7,
  budgetFollowUpDays: 7,
  workInactiveAttentionDays: 14,
  workInactiveUrgentDays: 30
} as const;

const activeWorkStatuses = new Set(["pendiente_inicio", "planificada", "preparacion", "en_curso", "pausada", "parada", "pendiente_material", "pendiente_cliente", "pendiente_remates", "parcialmente_terminada", "facturada_parcialmente", "pendiente_cobro"]);
const pendingBudgetStatuses = new Set(["pendiente_revision", "enviado", "visto", "pendiente_respuesta"]);
const inactiveTaskStatuses = new Set(["completed", "cancelled", "archived"]);
const inactiveFollowUpStatuses = new Set(["completed", "cancelled", "archived"]);

export type OperationalRulesInput = {
  tasks?: Array<{ id: string; title: string; status: string; dueAt: Date | null; clientId: string | null; workId: string | null }>;
  followUps?: Array<{ id: string; title: string; status: string; nextActionAt: Date | null; clientId: string | null; workId: string | null }>;
  agenda?: Array<{ id: string; title: string; status: string; type: string; startsAt: Date; clientId: string | null; workId: string | null }>;
  invoices?: Array<{ id: string; numero: string; estado: string; total: number; pagado: number; fechaVencimiento: Date; client: { id: string; nombre: string }; work: { id: string; titulo: string } | null; payments?: Array<{ id: string; importe: number }> }>;
  budgets?: Array<{ id: string; numero: string; titulo: string; estado: string; fechaCreacion: Date; fechaEnvio: Date | null; fechaSeguimiento: Date | null; client: { id: string; nombre: string }; work: { id: string; titulo: string } | null }>;
  works?: Array<{ id: string; titulo: string; estado: string; updatedAt: Date; presupuestoAprobado: number; costePrevisto: number; gastoReal: number; client: { id: string; nombre: string }; invoices?: Array<{ id: string; estado: string; total: number; pagado: number; payments?: Array<{ id: string; importe: number }> }>; expenses?: Array<{ importe: number }>; budgets?: Array<{ total: number; estado: string }>; activityDates?: Array<Date | null> }>;
  purchaseInvoices?: Array<{ id: string; invoiceNumber: string; status: string; dueDate: Date; pendingAmount: number; voidedAt: Date | null; businessPartner: { id: string; commercialName: string }; work: { id: string; titulo: string } | null }>;
  partners?: Array<{ id: string; commercialName: string; documentStatus: string; documentExpiresAt: Date | null }>;
};

export function buildOperationalSignals(input: OperationalRulesInput, now = new Date()): OperationalSignal[] {
  const today = startOfDay(now);
  const signals: OperationalSignal[] = [];
  const clients = new Map<string, string>();
  const works = new Map<string, string>();
  input.invoices?.forEach((item) => { clients.set(item.client.id, item.client.nombre); if (item.work) works.set(item.work.id, item.work.titulo); });
  input.budgets?.forEach((item) => { clients.set(item.client.id, item.client.nombre); if (item.work) works.set(item.work.id, item.work.titulo); });
  input.works?.forEach((item) => { clients.set(item.client.id, item.client.nombre); works.set(item.id, item.titulo); });

  for (const task of input.tasks ?? []) {
    if (!task.dueAt || inactiveTaskStatuses.has(task.status) || startOfDay(task.dueAt) >= today) continue;
    const days = daysBetween(task.dueAt, today);
    signals.push(signal("tarea_vencida", "planificacion", task.status === "blocked" || days >= 7 ? "urgente" : "atencion", `Tarea vencida: ${task.title}`, `Venció hace ${days} ${days === 1 ? "día" : "días"} y continúa ${label(task.status)}.`, "Revisar y reprogramar o completar la tarea.", task.dueAt, entityFor("tarea", task.id, task.title, "/tareas", task.clientId, task.workId), { days }));
  }
  for (const followUp of input.followUps ?? []) {
    if (!followUp.nextActionAt || inactiveFollowUpStatuses.has(followUp.status) || startOfDay(followUp.nextActionAt) >= today) continue;
    const days = daysBetween(followUp.nextActionAt, today);
    signals.push(signal("seguimiento_vencido", "ventas", days >= 7 ? "urgente" : "atencion", `Seguimiento pendiente: ${followUp.title}`, `La siguiente acción venció hace ${days} ${days === 1 ? "día" : "días"}.`, "Contactar y registrar el resultado del seguimiento.", followUp.nextActionAt, entityFor("seguimiento", followUp.id, followUp.title, "/seguimientos", followUp.clientId, followUp.workId), { days }));
  }
  for (const item of input.agenda ?? []) {
    if (["cancelado", "completado"].includes(item.status)) continue;
    const day = startOfDay(item.startsAt);
    if (day < today) {
      const days = daysBetween(item.startsAt, today);
      signals.push(signal("agenda_vencida", "planificacion", days >= 2 ? "urgente" : "atencion", `Agenda pendiente: ${item.title}`, `La cita estaba prevista hace ${days} ${days === 1 ? "día" : "días"}.`, "Confirmar el resultado o reprogramar la cita.", item.startsAt, entityFor("agenda", item.id, item.title, "/agenda", item.clientId, item.workId), { days }));
    } else if (day.getTime() === today.getTime()) {
      signals.push(signal("agenda_hoy", "planificacion", "informacion", `${label(item.type)} hoy: ${item.title}`, `Está prevista para hoy a las ${formatTime(item.startsAt)}.`, "Abrir la cita y preparar el contexto necesario.", item.startsAt, entityFor("agenda", item.id, item.title, "/agenda", item.clientId, item.workId)));
    }
  }
  for (const invoice of input.invoices ?? []) {
    if (!isBillableInvoiceStatus(invoice.estado)) continue;
    const pending = invoiceBalance(invoice).pending;
    if (pending <= 0) continue;
    const due = startOfDay(invoice.fechaVencimiento);
    const delta = daysBetween(today, due);
    const overdueDays = daysBetween(due, today);
    if (due < today) {
      signals.push(signal("factura_emitida_vencida", "cobros", overdueDays >= 15 ? "urgente" : "atencion", `Cobro vencido: ${invoice.numero}`, `${invoice.client.nombre} tiene ${money(pending)} pendientes desde hace ${overdueDays} ${overdueDays === 1 ? "día" : "días"}.`, "Revisar el cobro y contactar al cliente.", invoice.fechaVencimiento, entityFor("factura", invoice.id, invoice.numero, `/dinero/${invoice.id}`, invoice.client.id, invoice.work?.id), { amount: pending, days: overdueDays }));
    } else if (delta <= OPERATIONAL_THRESHOLDS.dueSoonDays) {
      signals.push(signal("factura_emitida_proxima", "cobros", "informacion", `Cobro próximo: ${invoice.numero}`, `${money(pending)} vencen ${delta === 0 ? "hoy" : `en ${delta} días`} para ${invoice.client.nombre}.`, "Comprobar que el cliente dispone de la factura.", invoice.fechaVencimiento, entityFor("factura", invoice.id, invoice.numero, `/dinero/${invoice.id}`, invoice.client.id, invoice.work?.id), { amount: pending, days: delta }));
    }
  }
  for (const budget of input.budgets ?? []) {
    if (!pendingBudgetStatuses.has(budget.estado)) continue;
    const reference = budget.fechaSeguimiento ?? budget.fechaEnvio ?? budget.fechaCreacion;
    const days = daysBetween(reference, now);
    if (days < OPERATIONAL_THRESHOLDS.budgetFollowUpDays) continue;
    signals.push(signal("presupuesto_seguimiento", "ventas", days >= 14 ? "urgente" : "atencion", `Presupuesto sin respuesta: ${budget.numero}`, `${budget.client.nombre} lleva ${days} días en estado ${label(budget.estado)}.`, "Contactar al cliente y registrar el resultado.", reference, entityFor("presupuesto", budget.id, budget.numero, `/presupuestos/${budget.id}`, budget.client.id, budget.work?.id), { days }));
  }
  for (const work of input.works ?? []) {
    if (!activeWorkStatuses.has(work.estado)) continue;
    const lastActivity = latest([work.updatedAt, ...(work.activityDates ?? [])]);
    const days = daysBetween(lastActivity, now);
    if (days >= OPERATIONAL_THRESHOLDS.workInactiveAttentionDays) {
      const level = days >= OPERATIONAL_THRESHOLDS.workInactiveUrgentDays ? "urgente" : "atencion";
      signals.push(signal("obra_sin_actividad", "actividad", level, `Obra sin actividad reciente: ${work.titulo}`, `No consta actividad objetiva desde hace ${days} días.`, "Revisar el estado de la obra y registrar el siguiente avance.", lastActivity, entityFor("obra", work.id, work.titulo, `/obras/${work.id}`, work.client.id, work.id), { days }));
    }
    const profitability = calculateWorkProfitability(work);
    if (profitability.hasEnoughData && profitability.invoiced > 0 && profitability.profitOnInvoiced < 0) {
      signals.push(signal("obra_margen_negativo", "economia_obra", "urgente", `Margen negativo: ${work.titulo}`, `El resultado sobre facturación es ${money(profitability.profitOnInvoiced)} con ${money(profitability.expenses)} de coste real.`, "Abrir la obra y revisar facturación y costes registrados.", now, entityFor("obra", work.id, work.titulo, `/obras/${work.id}?vista=dinero`, work.client.id, work.id), { amount: profitability.profitOnInvoiced }));
    } else if (profitability.hasEnoughData && profitability.forecastCost > 0 && profitability.deviation > 0) {
      signals.push(signal("obra_coste_desviado", "economia_obra", "atencion", `Coste por encima de lo previsto: ${work.titulo}`, `El coste real supera en ${money(profitability.deviation)} el coste previsto registrado.`, "Revisar los costes y actualizar la planificación económica.", now, entityFor("obra", work.id, work.titulo, `/obras/${work.id}?vista=dinero`, work.client.id, work.id), { amount: profitability.deviation }));
    }
  }
  for (const invoice of input.purchaseInvoices ?? []) {
    if (invoice.voidedAt || invoice.status === "VOID" || invoice.status === "PAID" || invoice.pendingAmount <= 0) continue;
    const due = startOfDay(invoice.dueDate);
    const overdueDays = daysBetween(due, today);
    const remainingDays = daysBetween(today, due);
    const href = invoice.work ? `/obras/${invoice.work.id}?vista=dinero` : `/facturas-proveedor/${invoice.id}`;
    if (due < today) signals.push(signal("factura_recibida_vencida", "compras_documentacion", overdueDays >= 15 ? "urgente" : "atencion", `Pago a proveedor vencido: ${invoice.invoiceNumber}`, `${money(invoice.pendingAmount)} pendientes con ${invoice.businessPartner.commercialName} desde hace ${overdueDays} días.`, "Revisar la factura recibida y planificar el pago.", invoice.dueDate, entityFor("factura_recibida", invoice.id, invoice.invoiceNumber, href, null, invoice.work?.id), { amount: invoice.pendingAmount, days: overdueDays }));
    else if (remainingDays <= OPERATIONAL_THRESHOLDS.dueSoonDays) signals.push(signal("factura_recibida_proxima", "compras_documentacion", "informacion", `Pago a proveedor próximo: ${invoice.invoiceNumber}`, `${money(invoice.pendingAmount)} vencen ${remainingDays === 0 ? "hoy" : `en ${remainingDays} días`} con ${invoice.businessPartner.commercialName}.`, "Confirmar la previsión de pago.", invoice.dueDate, entityFor("factura_recibida", invoice.id, invoice.invoiceNumber, href, null, invoice.work?.id), { amount: invoice.pendingAmount, days: remainingDays }));
  }
  for (const partner of input.partners ?? []) {
    if (partner.documentStatus === "NOT_REQUIRED") continue;
    const href = `/proveedores/${partner.id}`;
    if (partner.documentStatus === "INCOMPLETE") signals.push(signal("documentacion_incompleta", "compras_documentacion", "atencion", `Documentación incompleta: ${partner.commercialName}`, "La ficha indica documentación obligatoria incompleta.", "Abrir el proveedor y completar la documentación.", null, entityFor("proveedor", partner.id, partner.commercialName, href)));
    if (!partner.documentExpiresAt) continue;
    const days = daysBetween(today, startOfDay(partner.documentExpiresAt));
    if (days < 0 || partner.documentStatus === "EXPIRED") signals.push(signal("documentacion_caducada", "compras_documentacion", "urgente", `Documentación caducada: ${partner.commercialName}`, `La documentación caducó hace ${Math.abs(days)} días.`, "Solicitar y registrar documentación vigente.", partner.documentExpiresAt, entityFor("proveedor", partner.id, partner.commercialName, href), { days: Math.abs(days) }));
    else if (days <= OPERATIONAL_THRESHOLDS.documentAttentionDays) signals.push(signal("documentacion_proxima", "compras_documentacion", days <= OPERATIONAL_THRESHOLDS.documentUrgentDays ? "urgente" : "atencion", `Documentación próxima a caducar: ${partner.commercialName}`, `Caduca en ${days} días.`, "Solicitar la renovación antes del vencimiento.", partner.documentExpiresAt, entityFor("proveedor", partner.id, partner.commercialName, href), { days }));
  }
  return sortSignals(dedupe(signals));
}

export function buildOperationalContext(signals: OperationalSignal[]): OperationalContext {
  const sorted = sortSignals(signals);
  const principal = sorted[0] ?? null;
  const counts = { informacion: 0, atencion: 0, urgente: 0 };
  sorted.forEach((item) => { counts[item.level] += 1; });
  return { signals: sorted, principal, counts, phrase: principal ? principal.explanation : "No hay señales operativas pendientes con los datos actuales.", nextStep: principal?.nextStep ?? "Mantener la información al día." };
}

export function selectDiverseSignals(signals: OperationalSignal[], limit = 5) {
  const sorted = sortSignals(signals); const selected: OperationalSignal[] = []; const used = new Set<OperationalSignalCategory>();
  for (const item of sorted) if (!used.has(item.category) && selected.length < limit) { selected.push(item); used.add(item.category); }
  for (const item of sorted) if (!selected.includes(item) && selected.length < limit) selected.push(item);
  return selected;
}

function signal(rule: string, category: OperationalSignalCategory, level: OperationalSignalLevel, title: string, explanation: string, nextStep: string, referenceDate: Date | null, entity: OperationalSignal["entity"], extra: Pick<OperationalSignal, "amount" | "days"> = {}): OperationalSignal { return { id: `${rule}:${entity.id}`, rule, category, level, title, explanation, nextStep, referenceDate, entity, ...extra }; }
function entityFor(type: OperationalSignal["entity"]["type"], id: string, labelValue: string, href: string, clientId: string | null = null, workId: string | null = null) { return { type, id, label: labelValue, href, clientId, workId }; }
function dedupe(items: OperationalSignal[]) { return [...new Map(items.map((item) => [item.id, item])).values()]; }
function sortSignals(items: OperationalSignal[]) { const rank = { urgente: 0, atencion: 1, informacion: 2 }; return [...items].sort((a, b) => rank[a.level] - rank[b.level] || (a.referenceDate?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.referenceDate?.getTime() ?? Number.MAX_SAFE_INTEGER) || a.id.localeCompare(b.id)); }
function startOfDay(value: Date) { return new Date(value.getFullYear(), value.getMonth(), value.getDate()); }
function daysBetween(from: Date, to: Date) { return Math.floor((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000); }
function latest(values: Array<Date | null | undefined>) { return values.filter((value): value is Date => Boolean(value)).sort((a, b) => b.getTime() - a.getTime())[0] ?? new Date(0); }
function label(value: string) { return value.replaceAll("_", " "); }
function money(value: number) { return value.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }); }
function formatTime(value: Date) { return new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit" }).format(value); }
