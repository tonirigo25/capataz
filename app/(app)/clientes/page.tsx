import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { AlertTriangle, Archive, ArrowLeft, ArrowRight, BriefcaseBusiness, CircleDollarSign, Eraser, Eye, FileClock, Search, SlidersHorizontal, UserPlus } from "lucide-react";
import { DemoLimitButton } from "@/components/demo-limit-button";
import { StatusPill } from "@/components/status-pill";
import { CompactFilterBar, CompactSearch, EmptyState, PageHeader, ResultCount, TableShell } from "@/components/ui-primitives";
import { getClientList, type ClientListItem, type ClientListQuery } from "@/lib/client-crm";
import { formatCurrency, formatDate } from "@/lib/format";
import { requireCapability, resolveAuthorization } from "@/lib/commercial/authorization";
import { prisma } from "@/lib/prisma";
import { getOperationalContextsForClients } from "@/lib/operational-intelligence/queries";

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
  ["finalizado", "Finalizado"]
];

const filterOptions = [
  ["obras_activas", "Con obras activas"],
  ["facturas_pendientes", "Con facturas pendientes"],
  ["facturas_vencidas", "Con facturas vencidas"],
  ["presupuestos_pendientes", "Con presupuestos pendientes"],
  ["datos_incompletos", "Con datos incompletos"],
  ["seguimiento_pendiente", "Con seguimiento pendiente"],
  ["sin_actividad_reciente", "Sin actividad reciente"]
];

const orderOptions = [
  ["ultimaActividad_desc", "Última actividad primero"],
  ["ultimaActividad_asc", "Última actividad antigua"],
  ["nombre_asc", "Nombre A-Z"],
  ["nombre_desc", "Nombre Z-A"],
  ["saldo_desc", "Mayor saldo pendiente"],
  ["facturacion_desc", "Mayor facturación"],
  ["obras_desc", "Más obras activas"]
];

export default async function ClientsPage({
  searchParams
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const raw = await searchParams;
  const query = normalizeQuery(raw);
  const auth = await requireCapability("clients.view");
  const { companyId } = auth;
  const economicAllowed = (await resolveAuthorization(auth, "reports.view")).allowed;
  if (!economicAllowed) {
    const clients = await prisma.client.findMany({ where: { companyId, archivadoAt: query.archivo === "archivados" ? { not: null } : null, ...(query.buscar ? { nombre: { contains: query.buscar, mode: "insensitive" } } : {}) }, select: { id: true, nombre: true, telefono: true, email: true, estado: true }, orderBy: { nombre: "asc" }, take: 100 });
    return <main className="screen"><PageHeader eyebrow="CRM" title="Clientes" description="Contactos autorizados, sin información económica." /><ResultCount shown={clients.length} total={clients.length} noun="clientes" /><div className="mt-4 grid gap-3 md:grid-cols-2">{clients.map((client) => <Link key={client.id} href={`/clientes/${client.id}`} className="card p-4"><h2 className="font-black text-obra-ink">{client.nombre}</h2><p className="mt-1 text-sm text-slate-600">{client.telefono ?? client.email ?? "Sin contacto"}</p><StatusPill status={client.estado} /></Link>)}</div></main>;
  }
  const result = await getClientList(query, companyId);
  const operationalContexts = await getOperationalContextsForClients(result.items.map((client) => client.id));
  const activeFilterSet = new Set((query.filtros ?? "").split(",").filter(Boolean));
  const hasCriteria = Boolean(query.buscar || (query.estado && query.estado !== "todos") || (query.tipo && query.tipo !== "todos") || result.activeFilters.length);

  return (
    <main className="screen">
      <PageHeader
        eyebrow="CRM"
        title="Clientes"
        description="Contactos, trabajos y próxima acción de cada cliente."
        action={
          <DemoLimitButton href="/gestion?tipo=cliente&returnTo=/clientes" currentCount={result.total} limit={3}>
            <UserPlus size={18} />
            Añadir cliente
          </DemoLimitButton>
        }
      >
        <CompactFilterBar>
        <form action="/clientes" className="grid gap-3" aria-label="Buscar y filtrar clientes">
          <div className="grid gap-2 lg:grid-cols-[minmax(12rem,1fr)_13rem_13rem_13rem_13rem_auto]">
            <label>
              <span className="label mb-1 block">Buscar</span>
              <span className="flex gap-2">
                <CompactSearch name="buscar" defaultValue={query.buscar ?? ""} placeholder="Nombre, CIF/NIF, email, teléfono…" />
                <button className="icon-button lg:hidden" type="submit" aria-label="Buscar clientes">
                  <Search size={19} />
                </button>
              </span>
            </label>

            <Select name="tipo" label="Tipo" value={query.tipo ?? "todos"} options={[["todos", "Todos"], ...result.typeOptions.map((type) => [type, type])]} />
            <Select name="estado" label="Estado" value={query.estado ?? "todos"} options={statusOptions} />
            <Select name="archivo" label="Archivo" value={query.archivo ?? "activos"} options={[["activos", "Activos"], ["archivados", "Archivados"], ["todos", "Todos"]]} />
            <Select name="ordenar" label="Orden" value={query.ordenar ?? "ultimaActividad_desc"} options={orderOptions} />

            <button type="submit" className="primary-button hidden self-end lg:inline-flex">
              <Search size={18} />
              Aplicar
            </button>
          </div>

          <fieldset className="rounded-xl border border-slate-200 bg-slate-50 p-2 sm:p-3">
            <legend className="mb-2 flex items-center gap-2 text-sm font-black text-obra-ink">
              <SlidersHorizontal size={17} />
              Filtros operativos
            </legend>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {filterOptions.map(([id, label]) => (
                <label key={id} className="flex min-h-11 items-center gap-2 rounded-lg bg-white px-2 py-1.5 text-sm font-semibold text-slate-700">
                  <input className="mt-1" type="checkbox" name="filtro" value={id} defaultChecked={activeFilterSet.has(id)} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {result.activeFilters.length ? (
            <div className="flex flex-wrap items-center gap-2">
              {result.activeFilters.map((filter) => (
                <span key={filter.id} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-600">
                  {filter.label}
                </span>
              ))}
              <Link href="/clientes" className="secondary-button min-h-9 px-3 py-1 text-xs">
                <Eraser size={15} />
                Limpiar
              </Link>
            </div>
          ) : null}
        </form>
        </CompactFilterBar>
      </PageHeader>

      <ResultCount shown={result.items.length} total={result.total} noun="clientes" context={<>{query.archivo === "archivados" ? (
          <span className="inline-flex items-center gap-2">
            <Archive size={16} />
            Mostrando clientes archivados
          </span>
        ) : `Página ${result.page} de ${result.totalPages}`}</>} />

      {result.items.length ? (
        <>
          <div className="hidden lg:block">
            <TableShell label="Clientes">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs font-black uppercase text-slate-500">
                  <tr>
                    <th scope="col" className="px-4 py-3">Cliente</th>
                    <th scope="col" className="px-4 py-3">Tipo</th>
                    <th scope="col" className="px-4 py-3">Contacto principal</th>
                    <th scope="col" className="px-4 py-3">Obras</th>
                    <th scope="col" className="px-4 py-3">Saldo</th>
                    <th scope="col" className="px-4 py-3">Próxima acción</th>
                    <th scope="col" className="px-4 py-3">Estado</th>
                    <th scope="col" className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {result.items.map((client) => (
                    <tr key={client.id} className="align-top">
                      <td className="px-4 py-4">
                        <ClientName client={client} />
                      </td>
                      <td className="px-4 py-4 font-bold text-slate-700">{client.typeLabel}</td>
                      <td className="px-4 py-4">
                        <p className="font-bold text-obra-ink">{client.primaryContact}</p>
                        <p className="mt-1 text-xs text-slate-500">{(client.email ?? client.phone) || "Sin contacto directo"}</p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-black text-obra-ink">{client.activeWorksCount}</p>
                        <p className="text-xs text-slate-500">{client.totalWorksCount} totales</p>
                      </td>
                      <td className="px-4 py-4">
                        <p className={`font-black ${client.pendingTotal > 0 ? "text-obra-red" : "text-obra-green"}`}>{formatCurrency(client.pendingTotal)}</p>
                        <p className="text-xs text-slate-500">{formatCurrency(client.billedTotal)} facturado</p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-bold text-slate-700">{operationalContexts.get(client.id)?.nextStep ?? client.nextAction}</p>
                        <p className="text-xs text-slate-500">Actividad: {formatDate(client.lastActivityAt)}</p>
                      </td>
                      <td className="px-4 py-4">
                        <StatusPill status={client.status} />
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <Link href={`/clientes/${client.id}`} className="secondary-button min-h-10 px-3" aria-label={`Ver ficha de ${client.displayName}`}>
                            <Eye size={17} />
                            Ver
                          </Link>
                          <Link href={`/gestion?tipo=eventoAgenda&clienteId=${client.id}&tipoEvento=seguimiento_presupuesto&titulo=Seguimiento%20${encodeURIComponent(client.displayName)}&returnTo=/clientes`} className="icon-button" aria-label={`Crear seguimiento para ${client.displayName}`}>
                            <FileClock size={17} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableShell>
          </div>

          <div className="grid gap-3 lg:hidden">
            {result.items.map((client) => (
              <article key={client.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <ClientName client={client} />
                  <StatusPill status={client.status} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <Mini icon={BriefcaseBusiness} label="Obras activas" value={String(client.activeWorksCount)} />
                  <Mini icon={CircleDollarSign} label="Pendiente" value={formatCurrency(client.pendingTotal)} danger={client.pendingTotal > 0} />
                  <Mini icon={FileClock} label="Última actividad" value={formatDate(client.lastActivityAt)} />
                  <Mini icon={AlertTriangle} label="Datos pendientes" value={String(client.pendingFields.length)} danger={client.pendingFields.length > 0} />
                </div>
                <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                  <p><strong className="text-obra-ink">Contacto:</strong> {(client.email ?? client.phone) || "Sin contacto directo"}</p>
                  <p className="mt-1"><strong className="text-obra-ink">Siguiente:</strong> {operationalContexts.get(client.id)?.nextStep ?? client.nextAction}</p>
                </div>
                <div className="mt-3 flex gap-2">
                  <Link href={`/clientes/${client.id}`} className="primary-button flex-1">
                    <Eye size={18} />
                    Ver ficha
                  </Link>
                  <Link href={`/gestion?tipo=cliente&id=${client.id}&returnTo=/clientes`} className="secondary-button">
                    Editar
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </>
      ) : (
        <EmptyState
          title={hasCriteria ? "No hay clientes para estos filtros" : "Todavía no hay clientes"}
          description={hasCriteria ? "Cambia la búsqueda o limpia los filtros activos." : "Crea el primer cliente para empezar a relacionar obras, presupuestos y facturas."}
          icon={Search}
          action={
            <DemoLimitButton href="/gestion?tipo=cliente&returnTo=/clientes" currentCount={result.total} limit={3}>
              <UserPlus size={18} />
              Añadir cliente
            </DemoLimitButton>
          }
          secondaryAction={<Link href="/clientes" className="secondary-button">Limpiar filtros</Link>}
        />
      )}

      <Pagination query={query} page={result.page} totalPages={result.totalPages} />
    </main>
  );
}

function ClientName({ client }: { client: ClientListItem }) {
  return (
    <div className="min-w-0">
      <Link href={`/clientes/${client.id}`} className="text-base font-black text-obra-ink hover:underline">
        {client.displayName}
      </Link>
      <p className="mt-1 text-xs font-semibold text-slate-500">{client.fiscalName}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {client.fiscalId ? <Badge>{client.fiscalId}</Badge> : null}
        {client.pendingFields.length ? <Badge tone="warning">{client.pendingFields.length} pendientes</Badge> : null}
        {client.overdueInvoicesCount ? <Badge tone="danger">{client.overdueInvoicesCount} vencidas</Badge> : null}
      </div>
    </div>
  );
}

function Mini({
  icon: Icon,
  label,
  value,
  danger = false
}: {
  icon: ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="rounded-lg bg-slate-50 p-2">
      <p className="flex items-center gap-1 text-xs font-bold uppercase text-slate-500">
        <Icon size={14} />
        {label}
      </p>
      <p className={`mt-1 truncate font-black ${danger ? "text-obra-red" : "text-obra-ink"}`}>{value}</p>
    </div>
  );
}

function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "warning" | "danger" }) {
  const className = {
    neutral: "bg-slate-100 text-slate-600",
    warning: "bg-amber-100 text-amber-900",
    danger: "bg-red-50 text-obra-red"
  }[tone];
  return <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${className}`}>{children}</span>;
}

function Select({
  name,
  label,
  value,
  options
}: {
  name: string;
  label: string;
  value: string;
  options: string[][];
}) {
  return (
    <label>
      <span className="label mb-1 block">{label}</span>
      <select className="field" name={name} defaultValue={value}>
        {options.map(([id, optionLabel]) => (
          <option key={id} value={id}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function Pagination({ query, page, totalPages }: { query: ClientListQuery; page: number; totalPages: number }) {
  if (totalPages <= 1) return null;
  return (
    <nav className="mt-4 flex items-center justify-between gap-3" aria-label="Paginación de clientes">
      {page > 1 ? (
        <Link href={hrefWith(query, { pagina: String(page - 1) })} className="secondary-button">
          <ArrowLeft size={18} />
          Anterior
        </Link>
      ) : (
        <span />
      )}
      <span className="text-sm font-bold text-slate-600">
        {page} / {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={hrefWith(query, { pagina: String(page + 1) })} className="secondary-button">
          Siguiente
          <ArrowRight size={18} />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

function normalizeQuery(raw: RawSearchParams): ClientListQuery {
  const filters = arrayValue(raw.filtro);
  return {
    buscar: stringValue(raw.buscar),
    estado: stringValue(raw.estado),
    tipo: stringValue(raw.tipo),
    archivo: stringValue(raw.archivo),
    ordenar: stringValue(raw.ordenar),
    pagina: stringValue(raw.pagina),
    filtros: filters.length ? filters.join(",") : stringValue(raw.filtros)
  };
}

function hrefWith(query: ClientListQuery, changes: Partial<ClientListQuery>) {
  const next = { ...query, ...changes };
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(next)) {
    if (!value || value === "todos" || value === "activos") continue;
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
