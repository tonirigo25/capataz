import Link from "next/link";
import { Search, UserPlus } from "lucide-react";
import { DemoLimitButton } from "@/components/demo-limit-button";
import {
  ClientFilterBar,
  type ClientFilterQuery,
} from "@/components/clients/client-filter-bar";
import {
  type ClientWorkspaceItem,
} from "@/components/clients/client-split-view";
import { ClientPortfolio } from "@/components/portal/modules-a/client-portfolio";
import {
  EmptyState,
  PageHeader,
  ResultCount,
} from "@/components/ui-primitives";
import {
  getClientList,
  type ClientListItem,
  type ClientListQuery,
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
  ] as const;
  const aggregateDecisions = await Promise.all(
    aggregateCapabilities.map((capability) =>
      resolveAuthorization(auth, capability),
    ),
  );
  const economicAllowed = aggregateDecisions.every(
    (decision) => decision.allowed && decision.scope === "COMPANY",
  );
  const canCreateClient = aggregateDecisions[1]?.allowed === true;

  if (!economicAllowed) {
    return (
      <ScopedClientsPage
        companyId={companyId}
        scopedClientIds={scopedClientIds}
        query={query}
        canCreateClient={canCreateClient}
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
    <main className="screen" data-workspace-family="list">
      <PageHeader
        eyebrow="Relaciones"
        title="Clientes"
        description="Empieza por quien necesita atención y abre su contexto sin perder el listado."
        action={
          canCreateClient ? (
            <DemoLimitButton
              href="/gestion?tipo=cliente&returnTo=/clientes"
              currentCount={result.total}
              limit={3}
            >
              <UserPlus size={18} />
              Añadir cliente
            </DemoLimitButton>
          ) : undefined
        }
      >
        <ClientFilterBar
          query={query}
          typeOptions={result.typeOptions}
          statusOptions={statusOptions}
          filterOptions={filterOptions}
          orderOptions={orderOptions}
          activeFilterLabels={result.activeFilters.map(({ label }) => label)}
        />
      </PageHeader>

      <ResultCount
        shown={result.items.length}
        total={result.total}
        noun="clientes"
        context={
          query.archivo === "archivados"
            ? "Mostrando archivados"
            : `Página ${result.page} de ${result.totalPages}`
        }
      />

      <div className="mt-4">
        {items.length ? (
          <ClientPortfolio items={items} />
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
                <DemoLimitButton
                  href="/gestion?tipo=cliente&returnTo=/clientes"
                  currentCount={result.total}
                  limit={3}
                >
                  <UserPlus size={18} />
                  Añadir cliente
                </DemoLimitButton>
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

      <Pagination
        query={query}
        page={result.page}
        totalPages={result.totalPages}
      />
    </main>
  );
}

async function ScopedClientsPage({
  companyId,
  scopedClientIds,
  query,
  canCreateClient,
}: {
  companyId: string;
  scopedClientIds: string[] | null;
  query: ClientListQuery;
  canCreateClient: boolean;
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
        : query.vista === "accion" || !query.vista
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
    take: 100,
  });
  const items: ClientWorkspaceItem[] = clients.map((client) => ({
    id: client.id,
    displayName:
      client.nombreComercial ?? client.razonSocial ?? client.nombre,
    typeLabel: client.tipo,
    status: client.estado,
    nextAction: scopedNextAction(client.estado),
    risk: scopedRisk(client.estado),
    activeWork: "Según tu alcance",
    pendingBalance: null,
    lastContact: formatDate(client.ultimaInteraccion),
    primaryContact: client.telefono ?? client.email ?? "Sin contacto directo",
    phone: client.telefono || null,
    email: client.email,
    actionHref: `/clientes/${client.id}`,
    actionLabel: "Abrir ficha",
    visitHref: null,
  }));
  const typeOptions = [
    ...new Set(clients.map(({ tipo }) => tipo).filter(Boolean)),
  ].sort();

  return (
    <main className="screen" data-workspace-family="list">
      <PageHeader
        eyebrow="Relaciones"
        title="Clientes"
        description="Contactos y próximos pasos dentro de tu alcance. Los importes restringidos no se muestran."
        action={
          canCreateClient ? (
            <Link
              href="/gestion?tipo=cliente&returnTo=/clientes"
              className="primary-button"
            >
              <UserPlus size={18} />
              Añadir cliente
            </Link>
          ) : undefined
        }
      >
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
        />
      </PageHeader>
      <ResultCount shown={items.length} total={items.length} noun="clientes" />
      <div className="mt-4">
        {items.length ? (
          <ClientPortfolio items={items} />
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
    pendingBalance: formatCurrency(client.pendingTotal),
    lastContact: formatDate(client.lastContactAt ?? client.lastActivityAt),
    primaryContact: client.primaryContact,
    phone: client.phone || null,
    email: client.email,
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

function Pagination({
  query,
  page,
  totalPages,
}: {
  query: ClientListQuery;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav
      className="mt-4 flex items-center justify-between gap-3"
      aria-label="Paginación de clientes"
    >
      {page > 1 ? (
        <Link
          href={hrefWith(query, { pagina: String(page - 1) })}
          className="secondary-button"
        >
          Anterior
        </Link>
      ) : (
        <span />
      )}
      <span className="text-sm font-semibold text-content-secondary">
        {page} / {totalPages}
      </span>
      {page < totalPages ? (
        <Link
          href={hrefWith(query, { pagina: String(page + 1) })}
          className="secondary-button"
        >
          Siguiente
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

function normalizeQuery(raw: RawSearchParams): ClientListQuery {
  const filters = arrayValue(raw.filtro);
  const view = stringValue(raw.vista) ?? "accion";
  return {
    buscar: stringValue(raw.buscar),
    vista: view,
    estado: stringValue(raw.estado),
    tipo: stringValue(raw.tipo),
    archivo:
      stringValue(raw.archivo) ?? (view === "todos" ? "todos" : "activos"),
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
