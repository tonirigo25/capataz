import type {
  BudgetStatus,
  ClientStatus,
  Prisma,
  ReminderStatus,
  WorkStatus,
} from "@prisma/client";
import { NextResponse } from "next/server";
import {
  getClientList,
  type ClientListItem,
  type ClientListQuery,
} from "@/lib/client-crm";
import {
  requireCapability,
  resolveAuthorization,
  resolveScopedEntityIds,
} from "@/lib/commercial/authorization";
import { publicRequestContext } from "@/lib/platform/request-boundary";
import { prisma } from "@/lib/prisma";
import {
  ACTIVE_WORK_STATUSES,
  OPEN_REMINDER_STATUSES,
  PENDING_BUDGET_STATUSES,
  startOfDay,
} from "@/lib/client-crm-calculations";

export const dynamic = "force-dynamic";

const actionStatuses = [
  "nuevo",
  "pendiente_datos",
  "visita_pendiente",
  "presupuesto_pendiente",
  "presupuesto_enviado",
  "seguimiento_pendiente",
  "pendiente_cobro",
] as const satisfies readonly ClientStatus[];

const clientStatuses = [
  ...actionStatuses,
  "aceptado",
  "rechazado",
  "obra_activa",
  "finalizado",
] as const satisfies readonly ClientStatus[];

const economicCapabilities = [
  "reports.view",
  "work.view",
  "sales.budgets.view",
  "sales.invoices.view",
  "treasury.view",
  "banking.view",
  "purchases.received_invoices.view",
  "purchase_cost.view",
  "internal_cost.view",
  "margin_percent.view",
  "margin_amount.view",
  "profitability.view",
] as const;

type RestrictedClientRow = {
  id: string;
  nombre: string;
  nombreComercial: string | null;
  razonSocial: string | null;
  nifCif: string | null;
  telefono: string;
  email: string | null;
  tipo: string;
  estado: ClientStatus;
  contactoPrincipalNombre: string | null;
  contactoPrincipalEmail: string | null;
  contactoPrincipalTelefono: string | null;
  ultimaInteraccion: Date | null;
};

export async function GET(request: Request) {
  return publicRequestContext("GET /clientes/export", request, async () => {
    const auth = await requireCapability("clients.export");
    const clientView = await resolveAuthorization(auth, "clients.view");
    if (!clientView.allowed) {
      return NextResponse.json(
        { error: "No tienes acceso a los clientes solicitados." },
        { status: 403, headers: privateHeaders() },
      );
    }

    const scopedClientIds = await resolveScopedEntityIds(
      auth,
      "clients.view",
      "Client",
    );
    const query = normalizeQuery(new URL(request.url).searchParams);
    const economicDecisions = await Promise.all(
      economicCapabilities.map((capability) =>
        resolveAuthorization(auth, capability),
      ),
    );
    const economicAllowed = economicDecisions.every(
      (decision) => decision.allowed && decision.scope === "COMPANY",
    );

    const csv = economicAllowed
      ? buildFullCsv(
          await getAllClientListItems(query, auth.companyId, scopedClientIds),
        )
      : buildRestrictedCsv(
          await getRestrictedClients(query, auth.companyId, scopedClientIds),
        );

    return new Response(`\uFEFF${csv}`, {
      headers: {
        ...privateHeaders(),
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="orqena-clientes.csv"',
      },
    });
  });
}

async function getAllClientListItems(
  query: ClientListQuery,
  companyId: string,
  scopedClientIds: string[] | null,
) {
  const first = await getClientList(
    { ...query, pagina: "1" },
    companyId,
    scopedClientIds,
  );
  const items = [...first.items];
  for (let page = 2; page <= first.totalPages; page += 1) {
    const result = await getClientList(
      { ...query, pagina: String(page) },
      companyId,
      scopedClientIds,
    );
    items.push(...result.items);
  }
  return items;
}

async function getRestrictedClients(
  query: ClientListQuery,
  companyId: string,
  scopedClientIds: string[] | null,
) {
  const where: Prisma.ClientWhereInput = {
    companyId,
    ...(scopedClientIds === null ? {} : { id: { in: scopedClientIds } }),
    archivadoAt:
      query.archivo === "archivados"
        ? { not: null }
        : query.archivo === "todos"
          ? undefined
          : null,
  };
  if (query.buscar) {
    where.OR = [
      { nombre: { contains: query.buscar, mode: "insensitive" } },
      { nombreComercial: { contains: query.buscar, mode: "insensitive" } },
      { razonSocial: { contains: query.buscar, mode: "insensitive" } },
      { email: { contains: query.buscar, mode: "insensitive" } },
      { telefono: { contains: query.buscar, mode: "insensitive" } },
    ];
  }
  if (query.estado && query.estado !== "todos" && isClientStatus(query.estado)) {
    where.estado = query.estado;
  } else if (query.vista === "accion") {
    where.estado = { in: [...actionStatuses] };
  } else {
    where.AND = [restrictedViewWhere(query.vista)];
  }
  if (query.tipo && query.tipo !== "todos") {
    where.tipo = { equals: query.tipo, mode: "insensitive" };
  }
  const additionalPredicates = Array.isArray(where.AND)
    ? [...where.AND]
    : where.AND
      ? [where.AND]
      : [];
  for (const filter of (query.filtros ?? "").split(",").filter(Boolean)) {
    const predicate = restrictedFilterWhere(filter);
    if (predicate) additionalPredicates.push(predicate);
  }
  if (additionalPredicates.length) where.AND = additionalPredicates;
  const orderBy: Prisma.ClientOrderByWithRelationInput =
    query.ordenar === "nombre_desc"
      ? { nombre: "desc" }
      : query.ordenar === "ultimaActividad_asc"
        ? { ultimaInteraccion: "asc" }
        : query.ordenar === "ultimaActividad_desc"
          ? { ultimaInteraccion: "desc" }
          : { nombre: "asc" };

  return prisma.client.findMany({
    where,
    orderBy,
    select: {
      id: true,
      nombre: true,
      nombreComercial: true,
      razonSocial: true,
      nifCif: true,
      telefono: true,
      email: true,
      tipo: true,
      estado: true,
      contactoPrincipalNombre: true,
      contactoPrincipalEmail: true,
      contactoPrincipalTelefono: true,
      ultimaInteraccion: true,
    },
  });
}

function buildFullCsv(items: ClientListItem[]) {
  const headers = [
    "ID",
    "Cliente",
    "Razón social",
    "NIF/CIF",
    "Tipo",
    "Estado",
    "Contacto principal",
    "Teléfono",
    "Email",
    "Última actividad",
    "Próxima acción",
    "Trabajos activos",
    "Trabajos totales",
    "Presupuestado",
    "Facturado",
    "Cobrado",
    "Saldo pendiente",
    "Facturas pendientes",
    "Facturas vencidas",
    "Presupuestos pendientes",
  ];
  const rows = items.map((client) => [
    client.id,
    client.displayName,
    client.fiscalName,
    client.fiscalId,
    client.typeLabel,
    client.status,
    client.primaryContact,
    client.phone,
    client.email,
    isoDate(client.lastActivityAt),
    client.nextAction,
    client.activeWorksCount,
    client.totalWorksCount,
    client.budgetedTotal,
    client.billedTotal,
    client.paidTotal,
    client.pendingTotal,
    client.pendingInvoicesCount,
    client.overdueInvoicesCount,
    client.pendingBudgetsCount,
  ]);
  return encodeCsv(headers, rows);
}

function buildRestrictedCsv(items: RestrictedClientRow[]) {
  const headers = [
    "ID",
    "Cliente",
    "Razón social",
    "NIF/CIF",
    "Tipo",
    "Estado",
    "Contacto principal",
    "Teléfono",
    "Email",
    "Última actividad",
    "Próxima acción",
  ];
  const rows = items.map((client) => [
    client.id,
    client.nombreComercial ?? client.razonSocial ?? client.nombre,
    client.razonSocial,
    client.nifCif,
    client.tipo,
    client.estado,
    client.contactoPrincipalNombre ?? "",
    client.contactoPrincipalTelefono ?? client.telefono,
    client.contactoPrincipalEmail ?? client.email,
    isoDate(client.ultimaInteraccion),
    restrictedNextAction(client.estado),
  ]);
  return encodeCsv(headers, rows);
}

function encodeCsv(
  headers: string[],
  rows: Array<Array<string | number | null>>,
) {
  return [headers, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
}

function csvCell(value: string | number | null) {
  let text = value === null ? "" : String(value);
  if (
    typeof value === "string" &&
    (/^[\t\r\n]/.test(text) || /^[=+\-@]/.test(text.trimStart()))
  ) {
    text = `'${text}`;
  }
  return `"${text.replaceAll('"', '""')}"`;
}

function normalizeQuery(searchParams: URLSearchParams): ClientListQuery {
  const view = searchParams.get("vista") ?? "todos";
  const repeatedFilters = searchParams.getAll("filtro").filter(Boolean);
  return {
    buscar: cleanParam(searchParams.get("buscar")),
    vista: view,
    estado: cleanParam(searchParams.get("estado")),
    tipo: cleanParam(searchParams.get("tipo")),
    archivo: searchParams.get("archivo") ?? "activos",
    ordenar: cleanParam(searchParams.get("ordenar")),
    filtros: repeatedFilters.length
      ? repeatedFilters.join(",")
      : cleanParam(searchParams.get("filtros")),
  };
}

function restrictedViewWhere(view?: string): Prisma.ClientWhereInput {
  switch (view) {
    case "accion":
      return { estado: { in: [...actionStatuses] } };
    case "seguimiento":
      return {
        OR: [
          { estado: "seguimiento_pendiente" },
          { reminders: { some: { estado: { in: [...OPEN_REMINDER_STATUSES] as ReminderStatus[] } } } },
          { agendaEvents: { some: { tipo: { in: ["seguimiento_presupuesto", "seguimiento_cobro"] }, estado: { not: "cancelado" } } } },
        ],
      };
    case "presupuesto":
      return { budgets: { some: { estado: { in: [...PENDING_BUDGET_STATUSES] as BudgetStatus[] } } } };
    case "trabajo":
    case "activos":
      return { works: { some: { estado: { in: [...ACTIVE_WORK_STATUSES] as WorkStatus[] } } } };
    case "cobro":
      return { invoices: { some: { pendiente: { gt: 0 }, estado: { not: "borrador" } } } };
    case "riesgo":
      return {
        OR: [
          { estado: { in: [...actionStatuses] } },
          { invoices: { some: { pendiente: { gt: 0 }, fechaVencimiento: { lt: startOfDay(new Date()) }, estado: { not: "borrador" } } } },
        ],
      };
    case "todos":
    default:
      return {};
  }
}

function restrictedFilterWhere(filter: string): Prisma.ClientWhereInput | null {
  if (filter === "obras_activas") return restrictedViewWhere("trabajo");
  if (filter === "facturas_pendientes") return restrictedViewWhere("cobro");
  if (filter === "facturas_vencidas") {
    return { invoices: { some: { pendiente: { gt: 0 }, fechaVencimiento: { lt: startOfDay(new Date()) }, estado: { not: "borrador" } } } };
  }
  if (filter === "presupuestos_pendientes") return restrictedViewWhere("presupuesto");
  if (filter === "seguimiento_pendiente") return restrictedViewWhere("seguimiento");
  if (filter === "datos_incompletos") return { estado: "pendiente_datos" };
  if (filter === "sin_actividad_reciente") {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - 30);
    return { OR: [{ ultimaInteraccion: null }, { ultimaInteraccion: { lt: threshold } }] };
  }
  return null;
}

function cleanParam(value: string | null) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function isClientStatus(value: string): value is ClientStatus {
  return (clientStatuses as readonly string[]).includes(value);
}

function restrictedNextAction(status: ClientStatus) {
  if (status === "pendiente_datos") return "Completar datos autorizados";
  if (status === "visita_pendiente") return "Revisar próxima visita";
  if (status === "seguimiento_pendiente") return "Abrir seguimiento";
  if (status === "pendiente_cobro") return "Abrir ficha";
  if (status === "nuevo") return "Registrar próxima acción";
  return "Abrir ficha";
}

function isoDate(value: Date | null) {
  return value?.toISOString() ?? "";
}

function privateHeaders() {
  return {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
}
