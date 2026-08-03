import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { documentCategoryLabel } from "@/lib/documents";
import { deriveInvoiceStatus, statusLabel } from "@/lib/status";
import { requireCompanyContext } from "@/lib/auth/session";
import { resolveAuthorization, resolveScopedEntityIds } from "@/lib/commercial/authorization";
import { buildPortalManifest } from "@/lib/commercial/portal-manifest";

export type SearchResult = { type: string; title: string; detail: string; href: string };
export type SearchGroups = Record<string, SearchResult[]>;
export type SearchOptions = { takePerGroup?: number };

const TAKE_PER_GROUP = 8;
const currencyFormatter = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

export async function globalSearch(query: string, options: SearchOptions = {}) {
  const context = await requireCompanyContext();
  const { companyId } = context;
  const raw = query.trim();
  if (!raw) return grouped([]);
  const take = Math.min(TAKE_PER_GROUP, Math.max(1, options.takePerGroup ?? TAKE_PER_GROUP));

  const [clientAllowed, workAllowed, budgetAllowed, pricingAllowed, invoiceAllowed, treasuryAllowed, expenseAllowed, agendaAllowed, documentAllowed, manifest] = await Promise.all([
    resolveAuthorization(context, "clients.view"),
    resolveAuthorization(context, "work.view"),
    resolveAuthorization(context, "sales.budgets.view"),
    resolveAuthorization(context, "sales.pricing.view"),
    resolveAuthorization(context, "sales.invoices.view"),
    resolveAuthorization(context, "treasury.view"),
    resolveAuthorization(context, "purchase_cost.view"),
    resolveAuthorization(context, "agenda.view"),
    resolveAuthorization(context, "documents.view"),
    buildPortalManifest(context)
  ]);
  const [pricingWorkIds, pricingClientIds] = await Promise.all([
    pricingAllowed.allowed ? resolveScopedEntityIds(context, "sales.pricing.view", "Work") : Promise.resolve([]),
    pricingAllowed.allowed ? resolveScopedEntityIds(context, "sales.pricing.view", "Client") : Promise.resolve([])
  ]);

  const [clientScope, workScope, budgetScope, invoiceScope, treasuryScope, expenseScope, agendaScope, documentScope] = await Promise.all([
    entityScope(context, "clients.view", "Client", clientAllowed.allowed),
    entityScope(context, "work.view", "Work", workAllowed.allowed),
    relatedScope(context, "sales.budgets.view", budgetAllowed.allowed),
    relatedScope(context, "sales.invoices.view", invoiceAllowed.allowed),
    relatedScope(context, "treasury.view", treasuryAllowed.allowed),
    relatedScope(context, "purchase_cost.view", expenseAllowed.allowed),
    relatedScope(context, "agenda.view", agendaAllowed.allowed),
    documentRelationScope(context, "documents.view", documentAllowed.allowed)
  ]);

  const [clients, contacts, works, budgets, invoices, payments, expenses, agendaEvents, documents] = await Promise.all([
    clientAllowed.allowed ? prisma.client.findMany({
      where: { companyId, ...clientScope, OR: [contains("nombre", raw), contains("nombreComercial", raw), contains("razonSocial", raw), contains("nifCif", raw), contains("email", raw), contains("telefono", raw), contains("direccion", raw), contains("direccionFiscal", raw), contains("contactoPrincipalNombre", raw), contains("contactoPrincipalEmail", raw), contains("contactoPrincipalTelefono", raw)] },
      take, orderBy: { nombre: "asc" }
    }) : Promise.resolve([]),
    clientAllowed.allowed ? prisma.contact.findMany({
      where: { client: { companyId, ...clientScope }, archivedAt: null, OR: [contains("nombre", raw), contains("apellidos", raw), contains("cargo", raw), contains("telefono", raw), contains("email", raw), contains("notes", raw)] },
      take, include: { client: true }, orderBy: { nombre: "asc" }
    }) : Promise.resolve([]),
    workAllowed.allowed ? prisma.work.findMany({
      where: { companyId, ...workScope, OR: [contains("titulo", raw), contains("codigo", raw), contains("numeroInterno", raw), contains("direccion", raw), contains("tipoTrabajo", raw), contains("descripcion", raw), contains("contactoPrincipal", raw), { client: { OR: [contains("nombre", raw), contains("razonSocial", raw), contains("nifCif", raw)] } }] },
      take, include: { client: true }, orderBy: { updatedAt: "desc" }
    }) : Promise.resolve([]),
    budgetAllowed.allowed ? prisma.budget.findMany({
      where: { companyId, ...budgetScope, OR: [contains("numero", raw), contains("titulo", raw), contains("partidas", raw), contains("observaciones", raw), { client: { OR: [contains("nombre", raw), contains("nifCif", raw)] } }] },
      take, include: { client: true, work: true }, orderBy: { fechaCreacion: "desc" }
    }) : Promise.resolve([]),
    invoiceAllowed.allowed ? prisma.invoice.findMany({
      where: { companyId, ...invoiceScope, OR: [contains("numero", raw), contains("concepto", raw), contains("observaciones", raw), { client: { OR: [contains("nombre", raw), contains("nifCif", raw)] } }] },
      take, include: { client: true, work: true }, orderBy: { fechaEmision: "desc" }
    }) : Promise.resolve([]),
    treasuryAllowed.allowed ? prisma.payment.findMany({
      where: { companyId, ...treasuryScope, OR: [contains("metodo", raw), contains("notas", raw), { client: { OR: [contains("nombre", raw), contains("nifCif", raw)] } }, { invoice: contains("numero", raw) }] },
      take, include: { client: true, invoice: true }, orderBy: { fecha: "desc" }
    }) : Promise.resolve([]),
    expenseAllowed.allowed ? prisma.expense.findMany({
      where: { companyId, ...expenseScope, OR: [contains("proveedor", raw), contains("concepto", raw), contains("notas", raw), { work: { OR: [contains("titulo", raw), contains("codigo", raw)] } }] },
      take, include: { work: { include: { client: true } } }, orderBy: { fecha: "desc" }
    }) : Promise.resolve([]),
    agendaAllowed.allowed ? prisma.eventoAgenda.findMany({
      where: { companyId, ...agendaScope, OR: [contains("titulo", raw), contains("descripcion", raw), contains("direccion", raw), contains("notas", raw), { client: { OR: [contains("nombre", raw), contains("nifCif", raw)] } }, { work: { OR: [contains("titulo", raw), contains("codigo", raw)] } }, { contact: { OR: [contains("nombre", raw), contains("email", raw), contains("telefono", raw)] } }] },
      take, include: { client: true, work: true, contact: true }, orderBy: { fechaInicio: "desc" }
    }) : Promise.resolve([]),
    documentAllowed.allowed ? prisma.document.findMany({
      where: { companyId, ...documentScope, archivedAt: null, classification: { in: manifest.documentClasses }, OR: [contains("name", raw), contains("originalName", raw), contains("mimeType", raw), { client: { OR: [contains("nombre", raw), contains("nifCif", raw)] } }, { work: { OR: [contains("titulo", raw), contains("codigo", raw)] } }] },
      take, include: { client: true, work: true }, orderBy: { createdAt: "desc" }
    }) : Promise.resolve([])
  ]);

  const results: SearchResult[] = [];
  clients.forEach((client) => results.push({ type: "Clientes", title: client.nombre, detail: `${statusLabel(client.estado)} · ${client.telefono} · ${client.nifCif ?? "sin NIF/CIF"}`, href: `/clientes/${client.id}` }));
  contacts.forEach((contact) => results.push({ type: "Contactos", title: `${contact.nombre}${contact.apellidos ? ` ${contact.apellidos}` : ""}`, detail: `${contact.client.nombre} · ${contact.cargo ?? "Contacto"} · ${contact.telefono ?? contact.email ?? "sin contacto"}`, href: `/clientes/${contact.clientId}?tab=contactos` }));
  works.forEach((work) => results.push({ type: "Trabajo", title: work.titulo, detail: `${work.client.nombre} · ${statusLabel(work.estado)} · ${work.codigo ?? work.direccion}`, href: `/obras/${work.id}` }));
  budgets.forEach((budget) => results.push({ type: "Presupuestos", title: `${budget.numero} · ${budget.titulo}`, detail: `${budget.client.nombre} · ${statusLabel(budget.estado)}${pricingAllowed.allowed && relationAllowed(pricingAllowed.scope, pricingWorkIds, pricingClientIds, budget.obraId, budget.clienteId) ? ` · ${formatCurrency(budget.total)}` : ""}`, href: `/presupuestos/${budget.id}` }));
  invoices.forEach((invoice) => { const liveStatus = deriveInvoiceStatus(invoice.total, invoice.pendiente, invoice.fechaVencimiento); results.push({ type: "Facturas", title: `${invoice.numero} · ${invoice.client.nombre}`, detail: `${invoice.concepto} · ${statusLabel(liveStatus)} · pendiente ${formatCurrency(invoice.pendiente)}`, href: `/dinero/${invoice.id}` }); });
  payments.forEach((payment) => results.push({ type: "Pagos", title: `${payment.client.nombre} · ${formatCurrency(payment.importe)}`, detail: `${payment.invoice.numero} · ${payment.metodo} · ${statusLabel(payment.tipo)}`, href: `/dinero/${payment.facturaId}` }));
  expenses.forEach((expense) => results.push({ type: "Gastos", title: expense.concepto, detail: `${expense.proveedor} · ${expense.work?.titulo ?? "Gasto general"} · ${formatCurrency(expense.importe)}`, href: `/gastos-materiales?buscar=${encodeURIComponent(raw)}` }));
  agendaEvents.forEach((event) => results.push({ type: "Agenda", title: event.titulo, detail: `${statusLabel(event.tipo)} · ${event.client?.nombre ?? event.work?.titulo ?? event.contact?.nombre ?? "sin entidad"}`, href: `/agenda?vista=lista&buscar=${encodeURIComponent(raw)}` }));
  documents.forEach((document) => results.push({ type: "Documentos", title: document.name, detail: `${documentCategoryLabel(document.category)} · ${document.work?.titulo ?? document.client?.nombre ?? "sin entidad"}`, href: `/documentos?documento=${encodeURIComponent(document.id)}` }));
  return grouped(results);
}

async function entityScope(context: Awaited<ReturnType<typeof requireCompanyContext>>, capability: Parameters<typeof resolveScopedEntityIds>[1], entityType: "Client" | "Work", allowed: boolean) {
  if (!allowed) return { id: { in: [] as string[] } };
  const ids = await resolveScopedEntityIds(context, capability, entityType);
  return ids === null ? {} : { id: { in: ids } };
}

async function relatedScope(context: Awaited<ReturnType<typeof requireCompanyContext>>, capability: Parameters<typeof resolveScopedEntityIds>[1], allowed: boolean) {
  if (!allowed) return { id: { in: [] as string[] } };
  const [workIds, clientIds] = await Promise.all([resolveScopedEntityIds(context, capability, "Work"), resolveScopedEntityIds(context, capability, "Client")]);
  if (workIds === null && clientIds === null) return {};
  const OR: Array<Record<string, unknown>> = [];
  if (workIds === null) OR.push({ obraId: { not: null } }); else if (workIds.length) OR.push({ obraId: { in: workIds } });
  if (clientIds === null) OR.push({ clienteId: { not: null } }); else if (clientIds.length) OR.push({ clienteId: { in: clientIds }, obraId: null });
  return OR.length ? { OR } : { id: { in: [] as string[] } };
}

async function documentRelationScope(context: Awaited<ReturnType<typeof requireCompanyContext>>, capability: Parameters<typeof resolveScopedEntityIds>[1], allowed: boolean) {
  if (!allowed) return { id: { in: [] as string[] } };
  const [workIds, clientIds, documentIds] = await Promise.all([resolveScopedEntityIds(context, capability, "Work"), resolveScopedEntityIds(context, capability, "Client"), resolveScopedEntityIds(context, capability, "Document")]);
  if (workIds === null && clientIds === null && documentIds === null) return {};
  const OR: Array<Record<string, unknown>> = [];
  if (documentIds === null) OR.push({ id: { not: "" } }); else if (documentIds.length) OR.push({ id: { in: documentIds } });
  if (workIds === null) OR.push({ workId: { not: null } }); else if (workIds.length) OR.push({ workId: { in: workIds } });
  if (clientIds === null) OR.push({ clientId: { not: null } }); else if (clientIds.length) OR.push({ clientId: { in: clientIds }, workId: null });
  return OR.length ? { OR } : { id: { in: [] as string[] } };
}

function grouped(results: SearchResult[]) { return results.reduce<SearchGroups>((groups, result) => { groups[result.type] = groups[result.type] ?? []; groups[result.type].push(result); return groups; }, {}); }
function contains(field: string, value: string): Record<string, Prisma.StringFilter> { return { [field]: { contains: value, mode: "insensitive" } }; }
function relationAllowed(scope: string, workIds: string[] | null, clientIds: string[] | null, workId: string | null, clientId: string) { if (scope === "COMPANY") return true; if (scope === "SELECTED_WORKS") return Boolean(workId && workIds?.includes(workId)); if (scope === "SELECTED_CLIENTS") return Boolean(clientIds?.includes(clientId)); return workId ? Boolean(workIds?.includes(workId)) : Boolean(clientIds?.includes(clientId)); }
function formatCurrency(value: { toString(): string } | number) { const amount = Number(value.toString()); return Number.isFinite(amount) ? currencyFormatter.format(amount) : "Importe no disponible"; }
