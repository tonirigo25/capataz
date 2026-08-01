import type { BudgetStatus, Prisma } from "@prisma/client";
import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  Clock3,
  FilePenLine,
  Search,
  Send,
  Trophy,
  XCircle,
} from "lucide-react";
import { InternalBreadcrumbs } from "@/components/internal-breadcrumbs";
import {
  requireCapability,
  resolveAuthorization,
  resolveScopedEntityIds,
} from "@/lib/commercial/authorization";
import { formatCurrency, formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type SearchQuery = {
  q?: string;
  etapa?: string;
  cliente?: string;
  pagina?: string;
};

type BudgetRow = Prisma.BudgetGetPayload<{
  include: { client: { select: { id: true; nombre: true } }; work: { select: { id: true; titulo: true } } };
}>;

const PAGE_SIZE = 20;

const stages = [
  {
    id: "preparacion",
    label: "Preparación",
    description: "Borradores y propuestas en revisión",
    statuses: ["borrador", "pendiente_revision"] as BudgetStatus[],
    icon: FilePenLine,
    tone: "slate",
  },
  {
    id: "enviados",
    label: "Enviados",
    description: "Propuestas remitidas al cliente",
    statuses: ["enviado"] as BudgetStatus[],
    icon: Send,
    tone: "blue",
  },
  {
    id: "seguimiento",
    label: "Seguimiento",
    description: "Vistos o pendientes de respuesta",
    statuses: ["visto", "pendiente_respuesta"] as BudgetStatus[],
    icon: Clock3,
    tone: "orange",
  },
  {
    id: "ganados",
    label: "Ganados",
    description: "Presupuestos aceptados",
    statuses: ["aceptado"] as BudgetStatus[],
    icon: Trophy,
    tone: "green",
  },
  {
    id: "rechazados",
    label: "Rechazados",
    description: "Propuestas no aceptadas",
    statuses: ["rechazado"] as BudgetStatus[],
    icon: XCircle,
    tone: "red",
  },
  {
    id: "caducados",
    label: "Caducados",
    description: "Propuestas fuera de vigencia",
    statuses: ["caducado"] as BudgetStatus[],
    icon: CalendarClock,
    tone: "violet",
  },
] as const;

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<SearchQuery>;
}) {
  const query = await searchParams;
  const auth = await requireCapability("sales.budgets.view");
  const [workIds, clientIds, createDecision, pricingDecision] = await Promise.all([
    resolveScopedEntityIds(auth, "sales.budgets.view", "Work"),
    resolveScopedEntityIds(auth, "sales.budgets.view", "Client"),
    resolveAuthorization(auth, "sales.budgets.create"),
    resolveAuthorization(auth, "sales.pricing.view"),
  ]);
  const scopeWhere = relationScope(auth.scope, workIds, clientIds);
  const budgets = await prisma.budget.findMany({
    where: { companyId: auth.companyId, ...scopeWhere },
    orderBy: [{ fechaSeguimiento: "asc" }, { fechaCreacion: "desc" }],
    include: {
      client: { select: { id: true, nombre: true } },
      work: { select: { id: true, titulo: true } },
    },
  });

  const search = normalize(query.q ?? "");
  const validStage = stages.find((stage) => stage.id === query.etapa);
  const clientOptions = uniqueClients(budgets);
  const clientFilter = clientOptions.some((client) => client.id === query.cliente)
    ? query.cliente
    : undefined;
  const baseFiltered = budgets.filter((budget) => {
    const searchable = normalize(
      `${budget.numero} ${budget.titulo} ${budget.client.nombre} ${budget.work?.titulo ?? ""}`,
    );
    return (!search || searchable.includes(search)) &&
      (!clientFilter || budget.clienteId === clientFilter);
  });
  const filtered = validStage
    ? baseFiltered.filter((budget) => validStage.statuses.includes(budget.estado))
    : baseFiltered;
  const requestedPage = Math.max(1, Number.parseInt(query.pagina ?? "1", 10) || 1);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const accepted = budgets.filter((budget) => budget.estado === "aceptado");
  const followUp = budgets.filter((budget) =>
    ["visto", "pendiente_respuesta"].includes(budget.estado),
  );
  const awaitingDecision = budgets.filter((budget) =>
    ["enviado", "visto", "pendiente_respuesta"].includes(budget.estado),
  );
  const visibleValue = budgets.reduce((sum, budget) => sum + budget.total, 0);
  const canSeePricing = pricingDecision.allowed;
  const canCreate = createDecision.allowed && canSeePricing;

  return (
    <main className={`screen ${styles.workspace}`}>
      <InternalBreadcrumbs
        items={[{ label: "Inicio", href: "/hoy" }, { label: "Oportunidades" }]}
      />

      <header className={styles.pageHeader}>
        <div className={styles.headerCopy}>
          <span className={styles.eyebrow}>Comercial global</span>
          <h1>Oportunidades y pipeline</h1>
          <p>
            Seguimiento comercial basado en presupuestos reales. Cada etapa refleja
            su estado registrado, sin probabilidades estimadas.
          </p>
        </div>
        <div className={styles.headerActions}>
          <Link className={styles.secondaryButton} href="/presupuestos">
            Ver presupuestos
          </Link>
          {canCreate ? (
            <Link
              className={styles.primaryButton}
              href="/gestion?tipo=presupuesto&returnTo=/oportunidades"
            >
              <span aria-hidden="true">+</span> Nuevo presupuesto
            </Link>
          ) : null}
        </div>
      </header>

      <section className={styles.metrics} aria-label="Resumen comercial">
        <MetricCard
          label="Presupuestos visibles"
          value={String(budgets.length)}
          detail="Según tu ámbito de acceso"
          icon={BriefcaseBusiness}
          href={hrefFor(query, { etapa: null, pagina: null })}
          tone="green"
        />
        <MetricCard
          label="Valor total visible"
          value={canSeePricing ? formatCurrency(visibleValue) : "Restringido"}
          detail={canSeePricing ? "Importe registrado, sin ponderar" : "Sin permiso de precios"}
          icon={CircleDashed}
          tone="blue"
        />
        <MetricCard
          label="En seguimiento"
          value={String(followUp.length)}
          detail="Vistos o pendientes de respuesta"
          icon={Clock3}
          href={hrefFor(query, { etapa: "seguimiento", pagina: null })}
          tone="orange"
        />
        <MetricCard
          label="Aceptados"
          value={String(accepted.length)}
          detail="Presupuestos ganados"
          icon={CheckCircle2}
          href={hrefFor(query, { etapa: "ganados", pagina: null })}
          tone="green"
        />
        <MetricCard
          label="Pendientes de decisión"
          value={String(awaitingDecision.length)}
          detail="Enviados, vistos o sin respuesta"
          icon={Send}
          tone="violet"
        />
      </section>

      <section className={styles.pipelineSection} aria-labelledby="pipeline-title">
        <div className={styles.sectionHeading}>
          <div>
            <h2 id="pipeline-title">Pipeline por estado del presupuesto</h2>
            <p>Las columnas son estados verificables del sistema, no fases inferidas.</p>
          </div>
          <span className={styles.resultCount}>{baseFiltered.length} registros</span>
        </div>
        <div className={styles.pipeline}>
          {stages.map((stage) => {
            const Icon = stage.icon;
            const rows = baseFiltered.filter((budget) => stage.statuses.includes(budget.estado));
            const stageValue = rows.reduce((sum, budget) => sum + budget.total, 0);
            return (
              <article className={styles.pipelineColumn} key={stage.id}>
                <header className={styles.columnHeader}>
                  <span className={`${styles.stageIcon} ${styles[stage.tone]}`}>
                    <Icon size={16} />
                  </span>
                  <div>
                    <h3>{stage.label}</h3>
                    <p>{stage.description}</p>
                  </div>
                  <strong>{rows.length}</strong>
                </header>
                <div className={styles.stageValue}>
                  <span>Valor registrado</span>
                  <b>{canSeePricing ? formatCurrency(stageValue) : "Restringido"}</b>
                </div>
                <div className={styles.opportunityCards}>
                  {rows.slice(0, 3).map((budget) => (
                    <OpportunityCard
                      key={budget.id}
                      budget={budget}
                      canSeePricing={canSeePricing}
                    />
                  ))}
                  {!rows.length ? (
                    <div className={styles.emptyStage}>
                      <CircleDashed size={18} />
                      <span>Sin presupuestos en esta etapa</span>
                    </div>
                  ) : null}
                </div>
                <Link
                  className={styles.stageLink}
                  href={hrefFor(query, { etapa: stage.id, pagina: null })}
                >
                  Ver etapa completa <ArrowRight size={14} />
                </Link>
              </article>
            );
          })}
        </div>
      </section>

      <section className={styles.listSection} aria-labelledby="opportunity-list-title">
        <div className={styles.sectionHeading}>
          <div>
            <h2 id="opportunity-list-title">Detalle comercial</h2>
            <p>Consulta los registros que componen el pipeline y abre su presupuesto.</p>
          </div>
          <span className={styles.resultCount}>{filtered.length} resultados</span>
        </div>

        <form className={styles.filters} method="get" action="/oportunidades">
          <label className={styles.searchField}>
            <Search size={17} aria-hidden="true" />
            <span className="sr-only">Buscar oportunidades</span>
            <input
              name="q"
              defaultValue={query.q ?? ""}
              placeholder="Buscar por presupuesto, cliente u obra"
            />
          </label>
          <label>
            <span className="sr-only">Filtrar por etapa</span>
            <select name="etapa" defaultValue={validStage?.id ?? ""}>
              <option value="">Todas las etapas</option>
              {stages.map((stage) => (
                <option key={stage.id} value={stage.id}>{stage.label}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Filtrar por cliente</span>
            <select name="cliente" defaultValue={clientFilter ?? ""}>
              <option value="">Todos los clientes</option>
              {clientOptions.map((client) => (
                <option key={client.id} value={client.id}>{client.nombre}</option>
              ))}
            </select>
          </label>
          <button className={styles.filterButton} type="submit">Aplicar</button>
          {(query.q || validStage || clientFilter) ? (
            <Link className={styles.clearLink} href="/oportunidades">Limpiar</Link>
          ) : null}
        </form>

        {pageRows.length ? (
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Presupuesto</th>
                  <th>Cliente</th>
                  <th>Obra</th>
                  <th>Etapa</th>
                  <th>Importe</th>
                  <th>Próxima fecha registrada</th>
                  <th>Última actividad</th>
                  <th><span className="sr-only">Acción</span></th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((budget) => {
                  const stage = stageFor(budget.estado);
                  return (
                    <tr key={budget.id}>
                      <td>
                        <Link className={styles.primaryCell} href={`/presupuestos/${budget.id}`}>
                          {budget.numero}
                        </Link>
                        <small>{budget.titulo}</small>
                      </td>
                      <td>{budget.client.nombre}</td>
                      <td>{budget.work?.titulo ?? "Sin obra vinculada"}</td>
                      <td><StagePill stage={stage} /></td>
                      <td className={styles.amountCell}>
                        {canSeePricing ? formatCurrency(budget.total) : "Restringido"}
                      </td>
                      <td>
                        {budget.fechaSeguimiento
                          ? `Seguimiento · ${formatDate(budget.fechaSeguimiento)}`
                          : `Validez · ${formatDate(budget.fechaValidez)}`}
                      </td>
                      <td>{formatDate(budget.fechaEnvio ?? budget.fechaCreacion)}</td>
                      <td>
                        <Link className={styles.rowAction} href={`/presupuestos/${budget.id}`}>
                          Abrir <ArrowRight size={14} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.emptyList}>
            <Search size={24} />
            <h3>No hay resultados con estos filtros</h3>
            <p>Prueba otra búsqueda o vuelve a mostrar todas las etapas.</p>
            <Link href="/oportunidades">Limpiar filtros</Link>
          </div>
        )}

        {totalPages > 1 ? (
          <nav className={styles.pagination} aria-label="Paginación de oportunidades">
            {page > 1 ? (
              <Link href={hrefFor(query, { pagina: String(page - 1) })}>Anterior</Link>
            ) : <span aria-disabled="true">Anterior</span>}
            <b>Página {page} de {totalPages}</b>
            {page < totalPages ? (
              <Link href={hrefFor(query, { pagina: String(page + 1) })}>Siguiente</Link>
            ) : <span aria-disabled="true">Siguiente</span>}
          </nav>
        ) : null}
      </section>
    </main>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  href,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof BriefcaseBusiness;
  href?: string;
  tone: "green" | "blue" | "orange" | "violet";
}) {
  const content = (
    <>
      <span className={`${styles.metricIcon} ${styles[tone]}`}><Icon size={19} /></span>
      <div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>
      {href ? <ArrowRight className={styles.metricArrow} size={15} /> : null}
    </>
  );
  return href ? <Link className={styles.metricCard} href={href}>{content}</Link> : <div className={styles.metricCard}>{content}</div>;
}

function OpportunityCard({ budget, canSeePricing }: { budget: BudgetRow; canSeePricing: boolean }) {
  return (
    <Link className={styles.opportunityCard} href={`/presupuestos/${budget.id}`}>
      <div className={styles.cardTopline}>
        <span>{budget.numero}</span>
        <ArrowRight size={13} />
      </div>
      <strong>{budget.titulo}</strong>
      <p>{budget.client.nombre}</p>
      <dl>
        <div><dt>Obra</dt><dd>{budget.work?.titulo ?? "Sin vincular"}</dd></div>
        <div><dt>Importe</dt><dd>{canSeePricing ? formatCurrency(budget.total) : "Restringido"}</dd></div>
        <div><dt>Seguimiento</dt><dd>{formatDate(budget.fechaSeguimiento)}</dd></div>
      </dl>
    </Link>
  );
}

function StagePill({ stage }: { stage: (typeof stages)[number] }) {
  const Icon = stage.icon;
  return <span className={`${styles.stagePill} ${styles[stage.tone]}`}><Icon size={13} />{stage.label}</span>;
}

function uniqueClients(budgets: BudgetRow[]) {
  const clients = new Map<string, string>();
  for (const budget of budgets) clients.set(budget.client.id, budget.client.nombre);
  return [...clients.entries()]
    .map(([id, nombre]) => ({ id, nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

function stageFor(status: BudgetStatus) {
  return stages.find((stage) => stage.statuses.includes(status)) ?? stages[0];
}

function relationScope(scope: string, workIds: string[] | null, clientIds: string[] | null) {
  if (scope === "COMPANY") return {};
  if (scope === "SELECTED_WORKS") return { obraId: { in: workIds ?? [] } };
  if (scope === "SELECTED_CLIENTS") return { clienteId: { in: clientIds ?? [] } };
  const OR: Array<Record<string, unknown>> = [];
  if (workIds?.length) OR.push({ obraId: { in: workIds } });
  if (clientIds?.length) OR.push({ clienteId: { in: clientIds }, obraId: null });
  return OR.length ? { OR } : { id: { in: [] as string[] } };
}

function hrefFor(query: SearchQuery, changes: Partial<Record<keyof SearchQuery, string | null>>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value) params.set(key, value);
  for (const [key, value] of Object.entries(changes)) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
  const search = params.toString();
  return `/oportunidades${search ? `?${search}` : ""}`;
}

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
