import Link from "next/link";
import { Search } from "lucide-react";
import {
  ClientFilterBar,
  type ClientFilterQuery,
} from "@/components/clients/client-filter-bar";
import {
  type ClientWorkspaceItem,
} from "@/components/clients/client-split-view";
import { ClientPortfolio, type ClientPortfolioPagination } from "@/components/portal/modules-a/client-portfolio";
import { EmptyState } from "@/components/ui-primitives";
import {
  getClientList,
  type ClientListItem,
  type ClientListQuery,
  type ClientSmartViewCounts,
} from "@/lib/client-crm";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  requireCapability,
  resolveAuthorization,
  resolveScopedEntityIds,
} from "@/lib/commercial/authorization";
import { getOperationalContextsForClients } from "@/lib/operational-intelligence/queries";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RawSearchParams = Record<string, string | string[] | undefined>;

const statusOptions = [
  ["todos", "Todos"],
  ["nuevo", "Nuevo"],
  ["pendiente_datos", "Pendiente datos"],
  ["visita_pendiente", "Visita pendiente"],
  ["presupuesto_pendiente", "Presupuesto pendiente"],
  ["presupuesto_enviado", "Presupuesto enviado"],
  ["seguimiento_pendiente", "Seguimiento pendiente"],
  ["aceptado", "Aceptado"],
  ["rechazado", "Rechazado"],
  ["obra_activa", "Obra activa"],
  ["pendiente_cobro", "Pendiente cobro"],
  ["finalizado", "Finalizado"],
] as const;

const filterOptions = [
  ["obras_activas", "Con obras activas"],
  ["facturas_pendientes", "Con facturas pendientes"],
  ["facturas_vencidas", "Con facturas vencidas"],
  ["presupuestos_pendientes", "Con presupuestos pendientes"],
  ["datos_incompletos", "Con datos incompletos"],
  ["seguimiento_pendiente", "Con seguimiento pendiente"],
  ["sin_actividad_reciente", "Sin actividad reciente"],
] as const;

const orderOptions = [
  ["ultimaActividad_desc", "Última actividad primero"],
  ["ultimaActividad_asc", "Última actividad antigua"],
  ["nombre_asc", "Nombre A-Z"],
  ["nombre_desc", "Nombre Z-A"],
  ["saldo_desc", "Mayor saldo pendiente"],
  ["facturacion_desc", "Mayor facturación"],
  ["obras_desc", "Más obras activas"],
] as const;

const actionStatuses = [
  "nuevo",
  "pendiente_datos",
  "visita_pendiente",
  "presupuesto_pendiente",
  "presupuesto_enviado",
  "seguimiento_pendiente",
  "pendiente_cobro",
] as const;

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const raw = await searchParams;
  const query = normalizeQuery(raw);
  const auth = await requireCapability("clients.view");
  const { companyId } = auth;
  const scopedClientIds = await resolveScopedEntityIds(
    auth,
    "clients.view",
    "Client",
  );
  const aggregateCapabilities = [
    "reports.view",
    "clients.create",
    "clients.update",
    "clients.export",
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
    "agenda.view",
    "followups.view",
    "documents.view",
    "orqena.use",
  ] as const;
  const aggregateDecisions = await Promise.all(
    aggregateCapabilities.map((capability) =>
      resolveAuthorization(auth, capability),
    ),
  );
  const decisionFor = (capability: (typeof aggregateCapabilities)[number]) =>
    aggregateDecisions[aggregateCapabilities.indexOf(capability)];
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
  const economicAllowed = economicCapabilities.every((capability) => {
    const decision = decisionFor(capability);
    return decision?.allowed === true && decision.scope === "COMPANY";
  });
  const canCreateClient = decisionFor("clients.create")?.allowed === true;
  const canUpdateClient = decisionFor("clients.update")?.allowed === true;
  const canExportClient = decisionFor("clients.export")?.allowed === true;
  const canUseAi = decisionFor("orqena.use")?.allowed === true;

  if (!economicAllowed) {
    return (
      <ScopedClientsPage
        companyId={companyId}
        scopedClientIds={scopedClientIds}
        query={query}
        canCreateClient={canCreateClient}
        canUpdateClient={canUpdateClient}
        canExportClient={canExportClient}
        canUseAi={canUseAi}
      />
    );
  }

  const result = await getClientList(query, companyId, scopedClientIds);
  const operationalContexts = await getOperationalContextsForClients(
    result.items.map((client) => client.id),
  );
  const items = result.items.map((client) =>
    toWorkspaceItem(
      client,
      operationalContexts.get(client.id)?.nextStep ?? client.nextAction,
    ),
  );
  const hasCriteria = Boolean(
    query.buscar ||
    (query.estado && query.estado !== "todos") ||
    (query.tipo && query.tipo !== "todos") ||
    result.activeFilters.length,
  );

  return (
    <main className="clients-page" data-workspace-family="list">
      <header className="clients-page-header">
        <h1>Clientes</h1>
        <p>Gestiona y da seguimiento comercial y operativo a tu cartera de clientes.</p>
        <ClientFilterBar
          query={query}
          typeOptions={result.typeOptions}
          statusOptions={statusOptions}
          filterOptions={filterOptions}
          orderOptions={orderOptions}
          activeFilterLabels={result.activeFilters.map(({ label }) => label)}
          smartViewCounts={result.smartViewCounts}
          canCreate={canCreateClient}
          canExport={canExportClient}
        />
      </header>

      <div className="clients-page-content">
        {items.length ? (
          <ClientPortfolio
            items={items}
            pagination={buildPortfolioPagination(query, result)}
            canUpdate={canUpdateClient}
            canUseAi={canUseAi}
          />
        ) : (
          <EmptyState
            title={
              hasCriteria
                ? "No hay clientes para esta vista"
                : "Todavía no hay clientes"
            }
            description={
              hasCriteria
                ? "Cambia la búsqueda, la vista inteligente o los filtros."
                : "Crea el primer cliente para empezar a relacionar contactos y trabajo."
            }
            icon={Search}
            action={
              canCreateClient ? (
                <Link href="/gestion?tipo=cliente&returnTo=/clientes" className="primary-button">Nuevo cliente</Link>
              ) : undefined
            }
            secondaryAction={
              <Link href="/clientes?vista=activos" className="secondary-button">
                Ver clientes activos
              </Link>
            }
          />
        )}
      </div>

    </main>
  );
}

async function ScopedClientsPage({
  companyId,
  scopedClientIds,
  query,
  canCreateClient,
  canUpdateClient,
  canExportClient,
  canUseAi,
}: {
  companyId: string;
  scopedClientIds: string[] | null;
  query: ClientListQuery;
  canCreateClient: boolean;
  canUpdateClient: boolean;
  canExportClient: boolean;
  canUseAi: boolean;
}) {
  const clients = await prisma.client.findMany({
    where: {
      companyId,
      ...(scopedClientIds === null ? {} : { id: { in: scopedClientIds } }),
      archivadoAt:
        query.archivo === "archivados"
          ? { not: null }
          : query.archivo === "todos"
            ? undefined
            : null,
      ...(query.buscar
        ? {
            OR: [
              { nombre: { contains: query.buscar, mode: "insensitive" } },
              { nombreComercial: { contains: query.buscar, mode: "insensitive" } },
              { razonSocial: { contains: query.buscar, mode: "insensitive" } },
              { email: { contains: query.buscar, mode: "insensitive" } },
              { telefono: { contains: query.buscar, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(query.estado && query.estado !== "todos"
        ? { estado: query.estado as (typeof actionStatuses)[number] }
        : query.vista === "accion"
          ? { estado: { in: [...actionStatuses] } }
          : {}),
      ...(query.tipo && query.tipo !== "todos"
        ? { tipo: { equals: query.tipo, mode: "insensitive" } }
        : {}),
    },
    select: {
      id: true,
      nombre: true,
      nombreComercial: true,
      razonSocial: true,
      telefono: true,
      email: true,
      tipo: true,
      estado: true,
      ultimaInteraccion: true,
    },
    orderBy:
      query.ordenar === "nombre_desc"
        ? { nombre: "desc" }
        : query.ordenar === "ultimaActividad_asc"
          ? { ultimaInteraccion: "asc" }
          : query.ordenar === "ultimaActividad_desc"
            ? { ultimaInteraccion: "desc" }
            : { nombre: "asc" },
    take: 500,
  });
  const smartViewCounts = restrictedSmartViewCounts(clients);
  const visibleClients = clients.filter((client) => restrictedSmartViewMatch(client, query.vista));
  const total = visibleClients.length;
  const totalPages = Math.max(1, Math.ceil(total / 10));
  const requestedPage = Number.parseInt(query.pagina ?? "1", 10);
  const page = Math.min(Math.max(Number.isFinite(requestedPage) ? requestedPage : 1, 1), totalPages);
  const pageClients = visibleClients.slice((page - 1) * 10, page * 10);
  const items: ClientWorkspaceItem[] = pageClients.map((client) => ({
    id: client.id,
    displayName:
      client.nombreComercial ?? client.razonSocial ?? client.nombre,
    typeLabel: client.tipo,
    status: client.estado,
    nextAction: scopedNextAction(client.estado),
    risk: scopedRisk(client.estado),
    activeWork: "Según tu alcance",
    activeWorkCount: 0,
    activeWorks: [],
    responsible: "Según tu alcance",
    budgetTotal: null,
    budget: null,
    pendingBalance: null,
    overdueBalance: null,
    upcomingBalance: null,
    lastContact: formatDate(client.ultimaInteraccion),
    lastActivityKind: "Actividad autorizada",
    primaryContact: client.telefono ?? client.email ?? "Sin contacto directo",
    primaryContactDetail: "Contacto visible para tu perfil",
    addressLabel: "",
    phone: client.telefono || null,
    email: client.email,
    nextActionAt: null,
    nextActionSource: "Alcance restringido",
    riskLevel: scopedRiskLevel(client.estado),
    latestNote: null,
    archived: false,
    actionHref: `/clientes/${client.id}`,
    actionLabel: "Abrir ficha",
    visitHref: null,
  }));
  const typeOptions = [
    ...new Set(clients.map(({ tipo }) => tipo).filter(Boolean)),
  ].sort();

  const result = { page, pageSize: 10, total, totalPages };

  return (
    <main className="clients-page" data-workspace-family="list">
      <header className="clients-page-header">
        <h1>Clientes</h1>
        <p>Gestiona tus clientes dentro del alcance autorizado. Los importes restringidos no se muestran.</p>
        <ClientFilterBar
          query={query}
          typeOptions={typeOptions}
          statusOptions={statusOptions}
          filterOptions={[]}
          orderOptions={orderOptions.slice(0, 4)}
          activeFilterLabels={[
            query.buscar ? `Búsqueda: ${query.buscar}` : "",
            query.estado && query.estado !== "todos"
              ? `Estado: ${query.estado.replaceAll("_", " ")}`
              : "",
            query.tipo && query.tipo !== "todos" ? `Tipo: ${query.tipo}` : "",
          ].filter(Boolean)}
          smartViewCounts={smartViewCounts}
          canCreate={canCreateClient}
          canExport={canExportClient}
        />
      </header>
      <div className="clients-page-content">
        {items.length ? (
          <ClientPortfolio
            items={items}
            pagination={buildPortfolioPagination(query, result)}
            canUpdate={canUpdateClient}
            canUseAi={canUseAi}
          />
        ) : (
          <EmptyState
            title="No hay clientes en esta vista"
            description="Cambia la búsqueda o abre la vista de clientes activos."
            icon={Search}
            secondaryAction={
              <Link href="/clientes?vista=activos" className="secondary-button">
                Ver activos
              </Link>
            }
          />
        )}
      </div>
    </main>
  );
}

function toWorkspaceItem(
  client: ClientListItem,
  nextAction: string,
): ClientWorkspaceItem {
  const action = contextualAction(client, nextAction);
  return {
    id: client.id,
    displayName: client.displayName,
    typeLabel: client.typeLabel,
    status: client.status,
    nextAction,
    risk: principalRisk(client),
    activeWork: client.activeWorksCount
      ? `${client.activeWorksCount} ${client.activeWorksCount === 1 ? "trabajo activo" : "trabajos activos"}`
      : "Sin trabajo activo",
    activeWorkCount: client.activeWorksCount,
    activeWorks: client.activeWorks,
    responsible: client.responsible ?? "Sin asignar",
    budgetTotal: client.latestBudget ? formatCurrency(client.latestBudget.total) : null,
    budget: client.latestBudget,
    pendingBalance: client.pendingTotal > 0 ? formatCurrency(client.pendingTotal) : null,
    overdueBalance: client.overdueTotal > 0 ? formatCurrency(client.overdueTotal) : null,
    upcomingBalance: client.upcomingTotal > 0 ? formatCurrency(client.upcomingTotal) : null,
    lastContact: formatDate(client.lastContactAt ?? client.lastActivityAt),
    lastActivityKind: client.lastActivityKind,
    primaryContact: client.primaryContact,
    primaryContactDetail: client.primaryContactDetail,
    addressLabel: client.addressLabel,
    phone: client.phone || null,
    email: client.email,
    nextActionAt: client.nextActionAt ? formatDate(client.nextActionAt) : null,
    nextActionSource: client.nextActionSource,
    riskLevel: client.riskLevel,
    latestNote: client.latestNote
      ? { content: client.latestNote.content, date: formatDate(client.latestNote.createdAt) }
      : null,
    archived: Boolean(client.archivedAt),
    actionHref: action.href,
    actionLabel: action.label,
    visitHref: `/gestion?tipo=eventoAgenda&clienteId=${client.id}&tipoEvento=visita&titulo=Visita%20con%20${encodeURIComponent(client.displayName)}&returnTo=/clientes`,
  };
}

function contextualAction(client: ClientListItem, nextAction: string) {
  const normalized = nextAction.toLocaleLowerCase("es");
  if (normalized.includes("completar")) {
    return {
      href: `/gestion?tipo=cliente&id=${client.id}&returnTo=/clientes`,
      label: "Completar datos",
    };
  }
  if (normalized.includes("cobro") || normalized.includes("pago")) {
    return {
      href: `/clientes/${client.id}?vista=dinero`,
      label: "Revisar dinero",
    };
  }
  if (normalized.includes("seguimiento")) {
    return {
      href: `/gestion?tipo=recordatorio&clienteId=${client.id}&tipoRecordatorio=seguimiento_presupuesto&returnTo=/clientes`,
      label: "Crear seguimiento",
    };
  }
  if (normalized.includes("obra") || normalized.includes("trabajo")) {
    return {
      href: `/clientes/${client.id}?vista=trabajos`,
      label: "Abrir trabajo",
    };
  }
  return { href: `/clientes/${client.id}`, label: "Abrir ficha" };
}

function principalRisk(client: ClientListItem) {
  if (client.overdueInvoicesCount) return "Cobro vencido";
  if (client.pendingFields.length) return "Datos incompletos";
  if (client.pendingTotal > 0) return "Saldo pendiente";
  if (client.pendingBudgetsCount) return "Seguimiento pendiente";
  return "Sin riesgo detectado";
}

function scopedNextAction(status: string) {
  if (status === "pendiente_datos") return "Completar datos autorizados";
  if (status === "visita_pendiente") return "Revisar próxima visita";
  if (status === "seguimiento_pendiente") return "Abrir seguimiento";
  if (status === "pendiente_cobro") return "Abrir ficha";
  if (status === "nuevo") return "Registrar próxima acción";
  return "Abrir ficha";
}

function scopedRisk(status: string) {
  if (status === "pendiente_datos") return "Datos incompletos";
  if (status === "pendiente_cobro") return "Revisión económica restringida";
  if (status.includes("pendiente")) return "Acción pendiente";
  return "Sin riesgo detectado";
}

function scopedRiskLevel(status: string): ClientWorkspaceItem["riskLevel"] {
  if (status === "pendiente_cobro") return "Alto";
  if (status === "pendiente_datos" || status.includes("pendiente")) return "Medio";
  return "Bajo";
}

function restrictedSmartViewMatch(
  client: { estado: string },
  view?: string,
) {
  switch (view) {
    case "seguimiento":
      return client.estado === "seguimiento_pendiente";
    case "presupuesto":
      return ["presupuesto_pendiente", "presupuesto_enviado"].includes(client.estado);
    case "trabajo":
    case "activos":
      return client.estado === "obra_activa";
    case "cobro":
      return client.estado === "pendiente_cobro";
    case "riesgo":
      return [
        "pendiente_datos",
        "visita_pendiente",
        "presupuesto_pendiente",
        "presupuesto_enviado",
        "seguimiento_pendiente",
        "pendiente_cobro",
      ].includes(client.estado);
    case "accion":
      return actionStatuses.includes(client.estado as (typeof actionStatuses)[number]);
    case "todos":
    default:
      return true;
  }
}

function restrictedSmartViewCounts(
  clients: Array<{ estado: string }>,
): ClientSmartViewCounts {
  return {
    todos: clients.length,
    seguimiento: clients.filter((client) => restrictedSmartViewMatch(client, "seguimiento")).length,
    presupuesto: clients.filter((client) => restrictedSmartViewMatch(client, "presupuesto")).length,
    trabajo: clients.filter((client) => restrictedSmartViewMatch(client, "trabajo")).length,
    cobro: clients.filter((client) => restrictedSmartViewMatch(client, "cobro")).length,
    riesgo: clients.filter((client) => restrictedSmartViewMatch(client, "riesgo")).length,
  };
}

function buildPortfolioPagination(
  query: ClientListQuery,
  result: { page: number; pageSize: number; total: number; totalPages: number },
): ClientPortfolioPagination {
  const windowStart = Math.max(1, Math.min(result.page - 2, result.totalPages - 4));
  const windowEnd = Math.min(result.totalPages, Math.max(5, result.page + 2));
  const pages = Array.from(
    { length: Math.max(0, windowEnd - windowStart + 1) },
    (_, index) => windowStart + index,
  ).map((page) => ({
    page,
    href: hrefWith(query, { pagina: String(page) }),
    current: page === result.page,
  }));

  return {
    ...result,
    previousHref:
      result.page > 1
        ? hrefWith(query, { pagina: String(result.page - 1) })
        : null,
    nextHref:
      result.page < result.totalPages
        ? hrefWith(query, { pagina: String(result.page + 1) })
        : null,
    pages,
  };
}

function normalizeQuery(raw: RawSearchParams): ClientListQuery {
  const filters = arrayValue(raw.filtro);
  const view = stringValue(raw.vista) ?? "todos";
  return {
    buscar: stringValue(raw.buscar),
    vista: view,
    estado: stringValue(raw.estado),
    tipo: stringValue(raw.tipo),
    archivo: stringValue(raw.archivo) ?? "activos",
    ordenar: stringValue(raw.ordenar),
    pagina: stringValue(raw.pagina),
    filtros: filters.length ? filters.join(",") : stringValue(raw.filtros),
  } satisfies ClientListQuery & ClientFilterQuery;
}

function hrefWith(query: ClientListQuery, changes: Partial<ClientListQuery>) {
  const next = { ...query, ...changes };
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(next)) {
    if (!value || (value === "activos" && key === "archivo")) continue;
    params.set(key, value);
  }
  const suffix = params.toString();
  return suffix ? `/clientes?${suffix}` : "/clientes";
}

function stringValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function arrayValue(value: string | string[] | undefined) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}
