import Link from "next/link";
import type { Prisma } from "@prisma/client";
import {
  AlertTriangle,
  ArrowRight,
  BadgeEuro,
  Banknote,
  Bell,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Euro,
  FileText,
  Filter,
  Grid2X2,
  Hammer,
  LayoutGrid,
  List,
  MapPin,
  Package,
  Plus,
  Receipt,
  Search,
  Table2,
  UserRound,
  WalletCards
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { updateWorkStatus } from "@/app/(app)/obras/actions";
import { CompactFilterBar, CompactSearch, EmptyState, PageHeader, ResultCount, Toolbar } from "@/components/ui-primitives";
import { formatCurrency, formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireCapability, resolveAuthorization } from "@/lib/commercial/authorization";
import { getOperationalContextsForWorks } from "@/lib/operational-intelligence/queries";
import { statusClass } from "@/lib/status";
import {
  calculateWorkFinancials,
  getWorkNextAction,
  isActiveWorkStatus,
  isBlockedWorkStatus,
  workPriorityMeta,
  workStatusMeta,
  WORK_STATUS_META
} from "@/lib/works";

export const dynamic = "force-dynamic";

const viewOptions = [
  ["tarjetas", "Tarjetas", LayoutGrid],
  ["tabla", "Tabla", Table2],
  ["compacta", "Compacta", List],
  ["kanban", "Kanban", Grid2X2]
] as const;

const sortOptions = [
  ["riesgo", "Riesgo"],
  ["rentabilidad", "Rentabilidad"],
  ["fecha", "Fecha"],
  ["importe", "Importe"],
  ["cliente", "Cliente"]
];
const workListInclude = { client: true, budgets: true, invoices: { include: { payments: true } }, expenses: true, materials: true, reminders: true, agendaEvents: { orderBy: { fechaInicio: "asc" as const } }, documents: true, photos: true } satisfies Prisma.WorkInclude;
type WorkListRecord = Prisma.WorkGetPayload<{ include: typeof workListInclude }>;

type WorksQuery = {
  estado?: string;
  prioridad?: string;
  responsable?: string;
  cliente?: string;
  buscar?: string;
  orden?: string;
  vista?: string;
};

export default async function WorksPage({ searchParams }: { searchParams: Promise<WorksQuery> }) {
  const query = await searchParams;
  const auth = await requireCapability("work.view");
  const { companyId } = auth;
  const economicAllowed = (await resolveAuthorization(auth, "reports.view")).allowed;
  if (!economicAllowed) {
    const operationalWorks = await prisma.work.findMany({ where: { companyId, ...(query.buscar ? { titulo: { contains: query.buscar, mode: "insensitive" } } : {}) }, select: { id: true, titulo: true, estado: true, prioridad: true, fechaInicio: true, fechaFinPrevista: true, client: { select: { nombre: true } } }, orderBy: [{ prioridad: "desc" }, { fechaFinPrevista: "asc" }], take: 100 });
    return <main className="screen"><PageHeader eyebrow="Trabajos" title="Trabajos" description="Planificación autorizada, sin información económica." /><ResultCount shown={operationalWorks.length} total={operationalWorks.length} noun="trabajos" /><div className="mt-4 grid gap-3 md:grid-cols-2">{operationalWorks.map((work) => <Link key={work.id} href={`/obras/${work.id}`} className="card p-4"><h2 className="font-black text-obra-ink">{work.titulo}</h2><p className="mt-1 text-sm text-slate-600">{work.client.nombre}</p><p className="mt-2 text-xs font-bold uppercase text-slate-500">{workStatusMeta(work.estado).label}</p></Link>)}</div></main>;
  }
  const works = await prisma.work.findMany({
    where: { companyId },
    orderBy: [{ prioridad: "desc" }, { fechaFinPrevista: "asc" }],
    include: workListInclude
  });
  const operationalContexts = await getOperationalContextsForWorks(works.map((work) => work.id));

  const enriched = works.map((work) => {
    const financial = calculateWorkFinancials(work);
    const fallbackNextAction = getWorkNextAction(work);
    const principal = operationalContexts.get(work.id)?.principal;
    const nextAction: ReturnType<typeof getWorkNextAction> = principal ? { label: principal.nextStep, tone: principal.level === "urgente" ? "danger" : principal.level === "atencion" ? "warning" : "info", href: principal.entity.href } : fallbackNextAction;
    const status = workStatusMeta(work.estado);
    const priority = workPriorityMeta(work.prioridad);
    const pendingMaterials = work.materials.filter((material) => ["pendiente", "falta"].includes(material.estado));
    const pendingDocs = work.budgets.length + work.invoices.length + work.documents.length;
    return {
      work,
      financial,
      nextAction,
      status,
      priority,
      pendingMaterials,
      pendingDocs,
      hasRisk: isBlockedWorkStatus(work.estado) || financial.marginPercent < 15 || financial.pending > 0
    };
  });

  const clients = [...new Map(works.map((work) => [work.client.id, work.client.nombre])).entries()].sort((a, b) => a[1].localeCompare(b[1], "es"));
  const responsibles = [...new Set(works.map((work) => work.responsable).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, "es"));
  const visibleWorks = sortWorks(filterWorks(enriched, query), query.orden ?? "riesgo");
  const totals = enriched.reduce((acc, item) => {
    acc.active += isActiveWorkStatus(item.work.estado) ? 1 : 0;
    acc.blocked += isBlockedWorkStatus(item.work.estado) ? 1 : 0;
    acc.invoiced += item.financial.invoiced;
    acc.pending += item.financial.pending;
    acc.cost += item.financial.realCost;
    acc.benefit += item.financial.benefit;
    return acc;
  }, { active: 0, blocked: 0, invoiced: 0, pending: 0, cost: 0, benefit: 0 });
  const avgMargin = totals.invoiced ? Math.round((totals.benefit / totals.invoiced) * 1000) / 10 : 0;
  const view = viewOptions.some(([id]) => id === query.vista) ? query.vista! : "tabla";

  return (
    <main className="screen">
      <PageHeader
        eyebrow="Centro operativo"
        title="Trabajos"
        description="Control diario de producción, cobros, costes, documentos, visitas, materiales y riesgos de cada trabajo."
        action={<Link href="/gestion?tipo=obra&returnTo=/obras" className="primary-button"><Plus size={18} /> Nuevo trabajo</Link>}
        secondaryActions={<Link href="/capataz" className="secondary-button">Abrir Orqena</Link>}
      >
        <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-5">
          <ExecutiveMetric icon={BriefcaseBusiness} label="Activas" value={String(totals.active)} detail={`${totals.blocked} bloqueadas`} tone={totals.blocked ? "warning" : "neutral"} />
          <ExecutiveMetric icon={Receipt} label="Facturado" value={formatCurrency(totals.invoiced)} detail={`${formatCurrency(totals.pending)} pendiente`} />
          <ExecutiveMetric icon={Banknote} label="Coste real" value={formatCurrency(totals.cost)} detail="Gastos imputados" />
          <ExecutiveMetric icon={BadgeEuro} label="Beneficio" value={formatCurrency(totals.benefit)} detail={`${avgMargin}% margen medio`} tone={avgMargin < 15 && totals.invoiced ? "danger" : "success"} />
          <ExecutiveMetric icon={AlertTriangle} label="Con riesgo" value={String(enriched.filter((item) => item.hasRisk).length)} detail="Margen, cobro o bloqueo" tone="warning" />
        </div>
      </PageHeader>

      <CompactFilterBar className="mb-4">
      <form action="/obras">
        <input type="hidden" name="vista" value={view} />
        <div className="grid gap-3 lg:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_0.8fr_0.7fr_auto]">
          <label className="min-w-0">
            <span className="label mb-1 flex items-center gap-1"><Search size={14} /> Buscar</span>
            <CompactSearch name="buscar" defaultValue={query.buscar ?? ""} placeholder="Trabajo, cliente, código o dirección…" />
          </label>
          <FilterSelect name="estado" label="Estado" value={query.estado ?? "todas"} options={[["todas", "Todos"], ...Object.entries(WORK_STATUS_META).map(([id, meta]) => [id, meta.label] as [string, string])]} />
          <FilterSelect name="prioridad" label="Prioridad" value={query.prioridad ?? "todas"} options={[["todas", "Todas"], ["urgente", "Urgente"], ["alta", "Alta"], ["media", "Media"], ["baja", "Baja"]]} />
          <FilterSelect name="cliente" label="Cliente" value={query.cliente ?? "todos"} options={[["todos", "Todos"], ...clients]} />
          <FilterSelect name="responsable" label="Responsable" value={query.responsable ?? "todos"} options={[["todos", "Todos"], ...responsibles.map((name) => [name, name] as [string, string])]} />
          <FilterSelect name="orden" label="Orden" value={query.orden ?? "riesgo"} options={sortOptions as Array<[string, string]>} />
          <button className="primary-button min-h-12 self-end" type="submit"><Filter size={18} /> Aplicar</button>
        </div>
      </form>
      </CompactFilterBar>

      <Toolbar className="mb-4 justify-between">
        <div className="flex flex-wrap gap-2">
          {viewOptions.map(([id, label, Icon]) => (
            <Link key={id} href={hrefWith(query, { vista: id })} className={`secondary-button min-h-10 ${view === id ? "border-obra-ink bg-obra-ink text-white hover:bg-obra-ink" : ""}`}>
              <Icon size={17} />
              {label}
            </Link>
          ))}
        </div>
        <ResultCount shown={visibleWorks.length} total={works.length} noun="trabajos" />
      </Toolbar>

      {!visibleWorks.length ? (
        <EmptyState
          title={works.length ? "No hay trabajos para estos filtros" : "Todavía no hay trabajos"}
          description={works.length ? "Cambia la búsqueda o limpia los filtros activos." : "Crea el primer trabajo y vincúlalo a un cliente para organizar su ejecución."}
          icon={BriefcaseBusiness}
          action={<Link href="/gestion?tipo=obra&returnTo=/obras" className="primary-button">Crear trabajo</Link>}
        />
      ) : view === "tabla" ? (
        <WorkTable items={visibleWorks} />
      ) : view === "compacta" ? (
        <CompactList items={visibleWorks} />
      ) : view === "kanban" ? (
        <KanbanView items={visibleWorks} />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {visibleWorks.map((item) => <WorkCard key={item.work.id} item={item} />)}
        </div>
      )}
    </main>
  );
}

function WorkCard({ item }: { item: WorkItem }) {
  const { work, financial, status, priority, nextAction, pendingMaterials } = item;
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-soft transition hover:border-obra-yellowDark">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={work.estado} iconLabel={status.icon} />
            <span className={`rounded-full px-2.5 py-1 text-xs font-black ${priority.tone === "danger" ? "bg-red-50 text-red-700" : priority.tone === "warning" ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-600"}`}>
              {priority.label}
            </span>
          </div>
          <Link href={`/obras/${work.id}`} className="mt-3 block text-xl font-black leading-tight text-obra-ink hover:underline">
            {work.codigo ? `${work.codigo} · ` : ""}{work.titulo}
          </Link>
          <p className="mt-1 text-sm leading-6 text-slate-600">{work.client.nombre} · {work.tipoTrabajo}</p>
          <p className="mt-1 flex items-center gap-1 text-sm text-slate-500"><MapPin size={15} /> {work.direccion}</p>
        </div>
        <Link href={`/obras/${work.id}`} className="secondary-button shrink-0">Abrir <ArrowRight size={17} /></Link>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        <Mini label="Presupuestado" value={formatCurrency(financial.budgeted)} />
        <Mini label="Facturado" value={formatCurrency(financial.invoiced)} />
        <Mini label="Pendiente" value={formatCurrency(financial.pending)} tone={financial.pending ? "warning" : "neutral"} />
        <Mini label="Margen" value={`${financial.marginPercent}%`} tone={financial.marginPercent < 15 && financial.budgeted ? "danger" : "success"} />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_0.85fr]">
        <div className={`rounded-lg border p-3 ${nextAction.tone === "danger" ? "border-red-200 bg-red-50" : nextAction.tone === "warning" ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50"}`}>
          <p className="text-xs font-black uppercase text-slate-500">Próxima acción</p>
          <p className="mt-1 text-sm font-black text-obra-ink">{nextAction.label}</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Counter icon={Package} label="Mat." value={pendingMaterials.length} />
          <Counter icon={FileText} label="Docs" value={item.pendingDocs} />
          <Counter icon={Bell} label="Rec." value={work.reminders.length} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={`/gestion?tipo=presupuesto&clienteId=${work.clienteId}&obraId=${work.id}&returnTo=/obras/${work.id}`} className="secondary-button"><FileText size={17} /> Presupuesto</Link>
        <Link href={`/gestion?tipo=factura&clienteId=${work.clienteId}&obraId=${work.id}&returnTo=/obras/${work.id}`} className="secondary-button"><Receipt size={17} /> Factura</Link>
        <Link href={`/gestion?tipo=gasto&obraId=${work.id}&returnTo=/obras/${work.id}`} className="secondary-button"><Euro size={17} /> Gasto</Link>
        <WorkStatusButton id={work.id} estado="en_curso" label="En curso" />
        <WorkStatusButton id={work.id} estado="finalizada" label="Finalizar" />
      </div>
    </article>
  );
}

function WorkTable({ items }: { items: WorkItem[] }) {
  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <article key={item.work.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-soft">
          <div className="grid gap-3 lg:grid-cols-[1.35fr_0.75fr_0.8fr_0.8fr_0.75fr_auto] lg:items-center">
            <div className="min-w-0">
              <StatusBadge status={item.work.estado} iconLabel={item.status.icon} />
              <Link href={`/obras/${item.work.id}`} className="mt-2 block font-black text-obra-ink hover:underline">{item.work.titulo}</Link>
              <p className="text-sm text-slate-500">{item.work.client.nombre}</p>
            </div>
            <MetricLine label="Última actualización" value={formatDate(item.work.updatedAt)} />
            <MetricLine label="Próxima fecha" value={formatDate(item.work.fechaFinPrevista ?? item.work.fechaInicioPrevista ?? item.work.fechaInicio)} />
            <MetricLine label="Próxima acción" value={item.nextAction.label} />
            <MetricLine label={item.hasRisk ? "Riesgo · margen" : "Margen"} value={`${item.financial.marginPercent}%`} />
            <Link href={`/obras/${item.work.id}`} className="secondary-button justify-center">Abrir</Link>
          </div>
        </article>
      ))}
    </div>
  );
}

function CompactList({ items }: { items: WorkItem[] }) {
  return (
    <div className="grid gap-2">
      {items.map((item) => (
        <Link key={item.work.id} href={`/obras/${item.work.id}`} className="rounded-xl border border-slate-200 bg-white p-3 shadow-soft transition hover:border-obra-yellowDark">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-black text-obra-ink">{item.work.titulo}</p>
              <p className="text-sm text-slate-500">{item.work.client.nombre} · {item.nextAction.label}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={item.work.estado} iconLabel={item.status.icon} />
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">{formatCurrency(item.financial.pending)} pendiente</span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">{item.financial.marginPercent}% margen</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function KanbanView({ items }: { items: WorkItem[] }) {
  const phases = [
    ["entrada", "Entrada"],
    ["planificacion", "Planificación"],
    ["ejecucion", "Ejecución"],
    ["bloqueo", "Bloqueos"],
    ["cierre", "Cierre"]
  ] as const;
  return (
    <div className="grid gap-4 xl:grid-cols-5">
      {phases.map(([phase, label]) => {
        const phaseItems = items.filter((item) => item.status.phase === phase);
        return (
          <section key={phase} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-black text-obra-ink">{label}</h2>
              <span className="rounded-full bg-white px-2 py-1 text-xs font-black text-slate-500">{phaseItems.length}</span>
            </div>
            <div className="grid gap-2">
              {phaseItems.map((item) => (
                <Link key={item.work.id} href={`/obras/${item.work.id}`} className="rounded-lg border border-slate-200 bg-white p-3 shadow-soft">
                  <p className="text-sm font-black text-obra-ink">{item.work.titulo}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.work.client.nombre}</p>
                  <p className="mt-2 text-xs font-bold text-slate-600">{item.nextAction.label}</p>
                </Link>
              ))}
              {!phaseItems.length ? <p className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500">Sin trabajos en esta fase.</p> : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function WorkStatusButton({ id, estado, label }: { id: string; estado: string; label: string }) {
  return (
    <form action={updateWorkStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="estado" value={estado} />
      <button type="submit" className="secondary-button">{label}</button>
    </form>
  );
}

function ExecutiveMetric({ icon: Icon, label, value, detail, tone = "neutral" }: { icon: LucideIcon; label: string; value: string; detail: string; tone?: "neutral" | "warning" | "danger" | "success" }) {
  const toneClass = tone === "danger" ? "bg-red-50 text-red-700" : tone === "warning" ? "bg-amber-50 text-amber-800" : tone === "success" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600";
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-500">{label}</p>
          <p className="mt-1 break-words text-2xl font-black tabular-nums text-obra-ink">{value}</p>
        </div>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${toneClass}`}><Icon size={20} /></span>
      </div>
      <p className="mt-2 text-sm text-slate-500">{detail}</p>
    </article>
  );
}

function StatusBadge({ status, iconLabel }: { status: string; iconLabel: string }) {
  const Icon = iconFor(iconLabel);
  const meta = workStatusMeta(status);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black ${statusClass(status)}`}>
      <Icon size={14} />
      {meta.label}
    </span>
  );
}

function Mini({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "warning" | "danger" | "success" }) {
  const toneClass = tone === "danger" ? "bg-red-50 text-red-700" : tone === "warning" ? "bg-amber-50 text-amber-800" : tone === "success" ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-obra-ink";
  return (
    <div className={`rounded-lg p-2 ${toneClass}`}>
      <p className="text-xs font-bold uppercase opacity-75">{label}</p>
      <p className="mt-1 truncate font-black tabular-nums">{value}</p>
    </div>
  );
}

function Counter({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2 text-center">
      <Icon size={17} className="mx-auto text-slate-500" />
      <p className="mt-1 text-xs font-bold text-slate-500">{label}</p>
      <p className="font-black text-obra-ink">{value}</p>
    </div>
  );
}

function MetricLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <p className="mt-1 font-black text-obra-ink">{value}</p>
    </div>
  );
}

function FilterSelect({ name, label, value, options }: { name: string; label: string; value: string; options: Array<[string, string]> }) {
  return (
    <label>
      <span className="label mb-1 block">{label}</span>
      <select name={name} className="field" defaultValue={value}>
        {options.map(([id, text]) => <option key={id} value={id}>{text}</option>)}
      </select>
    </label>
  );
}

function filterWorks(items: WorkItem[], query: WorksQuery) {
  const search = normalize(query.buscar ?? "");
  return items.filter((item) => {
    const work = item.work;
    if (query.estado && query.estado !== "todas" && work.estado !== query.estado) return false;
    if (query.prioridad && query.prioridad !== "todas" && work.prioridad !== query.prioridad) return false;
    if (query.cliente && query.cliente !== "todos" && work.clienteId !== query.cliente) return false;
    if (query.responsable && query.responsable !== "todos" && work.responsable !== query.responsable) return false;
    if (!search) return true;
    const haystack = normalize(`${work.titulo} ${work.codigo ?? ""} ${work.numeroInterno ?? ""} ${work.client.nombre} ${work.direccion} ${work.tipoTrabajo} ${work.responsable ?? ""} ${work.jefeObra ?? ""}`);
    return haystack.includes(search);
  });
}

function sortWorks(items: WorkItem[], order: string) {
  return [...items].sort((a, b) => {
    if (order === "rentabilidad") return a.financial.marginPercent - b.financial.marginPercent;
    if (order === "fecha") return timeValue(a.work.fechaFinPrevista ?? a.work.fechaInicioPrevista ?? a.work.fechaInicio) - timeValue(b.work.fechaFinPrevista ?? b.work.fechaInicioPrevista ?? b.work.fechaInicio);
    if (order === "importe") return b.financial.budgeted - a.financial.budgeted;
    if (order === "cliente") return a.work.client.nombre.localeCompare(b.work.client.nombre, "es");
    const riskA = (a.hasRisk ? 10 : 0) + workPriorityMeta(a.work.prioridad).rank + (isBlockedWorkStatus(a.work.estado) ? 10 : 0);
    const riskB = (b.hasRisk ? 10 : 0) + workPriorityMeta(b.work.prioridad).rank + (isBlockedWorkStatus(b.work.estado) ? 10 : 0);
    return riskB - riskA || timeValue(a.work.fechaFinPrevista) - timeValue(b.work.fechaFinPrevista);
  });
}

function hrefWith(query: WorksQuery, next: Record<string, string>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...query, ...next })) {
    if (value && !["todas", "todos"].includes(value)) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `/obras?${qs}` : "/obras";
}

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function timeValue(value: Date | string | null | undefined) {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function iconFor(name: string): LucideIcon {
  const icons: Record<string, LucideIcon> = {
    BadgeEuro,
    BriefcaseBusiness,
    CalendarClock,
    CheckCircle2,
    ClipboardList,
    FileText,
    Hammer,
    PackageSearch: Package,
    Receipt,
    WalletCards,
    UserRoundCheck: UserRound
  };
  return icons[name] ?? BriefcaseBusiness;
}

type WorkItem = {
  work: WorkListRecord;
  financial: ReturnType<typeof calculateWorkFinancials>;
  nextAction: ReturnType<typeof getWorkNextAction>;
  status: ReturnType<typeof workStatusMeta>;
  priority: ReturnType<typeof workPriorityMeta>;
  pendingMaterials: WorkListRecord["materials"];
  pendingDocs: number;
  hasRisk: boolean;
};
