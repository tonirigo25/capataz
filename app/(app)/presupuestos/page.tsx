import Link from "next/link";
import {
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Copy,
  Download,
  Eye,
  FileText,
  MessageCircle,
  Pencil,
  Plus,
  Search,
  Send,
  SlidersHorizontal,
} from "lucide-react";
import { duplicateBudget } from "@/app/(app)/presupuestos/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { DemoLimitButton } from "@/components/demo-limit-button";
import { BudgetRailContext } from "@/components/portal/budget-rail-context";
import { StatusPill } from "@/components/status-pill";
import {
  ActionMenu,
  EmptyState,
  MobileList,
  ResponsiveTable,
} from "@/components/ui-primitives";
import { parseBudgetLines } from "@/lib/budget-lines";
import {
  requireCapability,
  resolveAuthorization,
  resolveScopedEntityIds,
} from "@/lib/commercial/authorization";
import { formatCurrency, formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const filterOptions = [
  ["todos", "Todos los estados"],
  ["pendientes", "Abiertos"],
  ["borrador", "Borradores"],
  ["pendiente_revision", "En revisión"],
  ["enviado", "Enviados"],
  ["pendiente_respuesta", "Sin respuesta"],
  ["aceptado", "Aceptados"],
  ["rechazado", "Rechazados"],
  ["caducado", "Caducados"],
] as const;

type SearchQuery = {
  filtro?: string;
  estado?: string;
  buscar?: string;
  presupuesto?: string;
};

export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: Promise<SearchQuery>;
}) {
  const query = await searchParams;
  const requestedFilter = query.filtro ?? query.estado;
  const activeFilter = filterOptions.some(([id]) => id === requestedFilter)
    ? (requestedFilter ?? "todos")
    : "todos";
  const auth = await requireCapability("sales.budgets.view");
  const { companyId } = auth;
  const [workIds, clientIds] = await Promise.all([
    resolveScopedEntityIds(auth, "sales.budgets.view", "Work"),
    resolveScopedEntityIds(auth, "sales.budgets.view", "Client"),
  ]);
  const scopeWhere = relationScope(auth.scope, workIds, clientIds);
  const [
    createDecision,
    updateDecision,
    agendaDecision,
    pricingDecision,
    marginDecision,
  ] = await Promise.all([
    resolveAuthorization(auth, "sales.budgets.create"),
    resolveAuthorization(auth, "sales.budgets.update"),
    resolveAuthorization(auth, "agenda.manage"),
    resolveAuthorization(auth, "sales.pricing.view"),
    resolveAuthorization(auth, "margin_amount.view"),
  ]);
  const [
    createWorkIds,
    createClientIds,
    updateWorkIds,
    updateClientIds,
    agendaWorkIds,
    agendaClientIds,
    pricingWorkIds,
    pricingClientIds,
    marginWorkIds,
    marginClientIds,
  ] = await Promise.all([
    createDecision.allowed
      ? resolveScopedEntityIds(auth, "sales.budgets.create", "Work")
      : Promise.resolve([]),
    createDecision.allowed
      ? resolveScopedEntityIds(auth, "sales.budgets.create", "Client")
      : Promise.resolve([]),
    updateDecision.allowed
      ? resolveScopedEntityIds(auth, "sales.budgets.update", "Work")
      : Promise.resolve([]),
    updateDecision.allowed
      ? resolveScopedEntityIds(auth, "sales.budgets.update", "Client")
      : Promise.resolve([]),
    agendaDecision.allowed
      ? resolveScopedEntityIds(auth, "agenda.manage", "Work")
      : Promise.resolve([]),
    agendaDecision.allowed
      ? resolveScopedEntityIds(auth, "agenda.manage", "Client")
      : Promise.resolve([]),
    pricingDecision.allowed
      ? resolveScopedEntityIds(auth, "sales.pricing.view", "Work")
      : Promise.resolve([]),
    pricingDecision.allowed
      ? resolveScopedEntityIds(auth, "sales.pricing.view", "Client")
      : Promise.resolve([]),
    marginDecision.allowed
      ? resolveScopedEntityIds(auth, "margin_amount.view", "Work")
      : Promise.resolve([]),
    marginDecision.allowed
      ? resolveScopedEntityIds(auth, "margin_amount.view", "Client")
      : Promise.resolve([]),
  ]);

  const budgets = await prisma.budget.findMany({
    where: { companyId, ...scopeWhere },
    orderBy: { fechaCreacion: "desc" },
    include: { client: true, work: true },
  });
  const visibleBudgets = budgets.filter((budget) => {
    const filterMatch = matchesFilter(budget.estado, activeFilter);
    const search = normalize(query.buscar ?? "");
    const searchable = normalize(
      `${budget.numero} ${budget.titulo} ${budget.client.nombre} ${budget.work?.titulo ?? ""}`,
    );
    return filterMatch && (!search || searchable.includes(search));
  });
  const selectedBudget = query.presupuesto
    ? visibleBudgets.find((budget) => budget.id === query.presupuesto) ?? null
    : visibleBudgets.find((budget) => budget.estado === "pendiente_revision")
      ?? visibleBudgets[0]
      ?? null;

  const openBudgets = budgets.filter((budget) =>
    matchesFilter(budget.estado, "pendientes"),
  );
  const reviewBudgets = budgets.filter(
    (budget) => budget.estado === "pendiente_revision",
  );
  const acceptedBudgets = budgets.filter(
    (budget) => budget.estado === "aceptado",
  );
  const totalVisibleValue = budgets.reduce(
    (sum, budget) =>
      sum +
      (pricingDecision.allowed &&
      relationAllowed(
        pricingDecision.scope,
        pricingWorkIds,
        pricingClientIds,
        budget,
      )
        ? budget.total
        : 0),
    0,
  );
  const canSeeAnyPrice = pricingDecision.allowed;
  const canCreate = createDecision.allowed && pricingDecision.allowed;

  const permissions = (budget: BudgetRow) => ({
    update:
      updateDecision.allowed &&
      relationAllowed(
        updateDecision.scope,
        updateWorkIds,
        updateClientIds,
        budget,
      ) &&
      pricingDecision.allowed &&
      relationAllowed(
        pricingDecision.scope,
        pricingWorkIds,
        pricingClientIds,
        budget,
      ),
    duplicate:
      createDecision.allowed &&
      relationAllowed(
        createDecision.scope,
        createWorkIds,
        createClientIds,
        budget,
      ) &&
      pricingDecision.allowed &&
      relationAllowed(
        pricingDecision.scope,
        pricingWorkIds,
        pricingClientIds,
        budget,
      ),
    agenda:
      agendaDecision.allowed &&
      relationAllowed(
        agendaDecision.scope,
        agendaWorkIds,
        agendaClientIds,
        budget,
      ),
    pricing:
      pricingDecision.allowed &&
      relationAllowed(
        pricingDecision.scope,
        pricingWorkIds,
        pricingClientIds,
        budget,
      ),
    margin:
      marginDecision.allowed &&
      relationAllowed(
        marginDecision.scope,
        marginWorkIds,
        marginClientIds,
        budget,
      ),
  });

  return (
    <main className={`screen ${styles.workspace}`}>
      <BudgetRailContext
        context={selectedBudget ? {
          id: selectedBudget.id,
          numero: selectedBudget.numero,
          title: selectedBudget.work?.titulo ?? selectedBudget.titulo,
          client: selectedBudget.client.nombre,
          status: selectedBudget.estado,
          margin: permissions(selectedBudget).margin ? budgetMarginPercent(selectedBudget) : null,
          total: permissions(selectedBudget).pricing ? formatCurrency(selectedBudget.total) : null,
          lineCount: parseBudgetLines(selectedBudget.partidas).length,
          reviewHref: `/presupuestos/${selectedBudget.id}?returnTo=${encodeURIComponent(selectionHref(selectedBudget.id, activeFilter, query.buscar))}`,
          editHref: permissions(selectedBudget).update
            ? `/gestion?tipo=presupuesto&id=${selectedBudget.id}&returnTo=${encodeURIComponent(selectionHref(selectedBudget.id, activeFilter, query.buscar))}`
            : null,
        } : null}
      />
      <header className={styles.pageHeader}>
        <div>
          <h1>Presupuestos</h1>
          <p>
            Prepara, revisa y convierte presupuestos en oportunidades ganadas.
          </p>
        </div>
      </header>

      <section className={styles.kpiGrid} aria-label="Resumen de presupuestos">
        <KpiLink
          label="Abiertos"
          value={String(openBudgets.length)}
          detail="Propuestas en curso"
          icon={<FileText size={19} />}
          tone="green"
          href={filterHref("pendientes")}
        />
        <KpiLink
          label="Pendientes aprobación"
          value={String(reviewBudgets.length)}
          detail="Requieren revisión"
          icon={<Clock3 size={19} />}
          tone="orange"
          href={filterHref("pendiente_revision")}
        />
        <KpiLink
          label="Aceptados"
          value={String(acceptedBudgets.length)}
          detail={conversionLabel(budgets)}
          icon={<CheckCircle2 size={19} />}
          tone="green"
          href={filterHref("aceptado")}
        />
        <KpiLink
          label="Valor total"
          value={canSeeAnyPrice ? formatCurrency(totalVisibleValue) : "Restringido"}
          detail="Dentro de tu alcance"
          icon={<CircleDollarSign size={20} />}
          tone="purple"
          href="/presupuestos"
        />
      </section>

      <section className={styles.listPanel} aria-labelledby="budget-list-title">
        <div className={styles.panelHeader}>
          <div>
            <h2 id="budget-list-title">Listado de presupuestos</h2>
            <p>{visibleBudgets.length} de {budgets.length} visibles</p>
          </div>
          <div className={styles.panelControls}>
            <details className={styles.filterMenu}>
              <summary className={styles.filterButton}>
                <SlidersHorizontal size={15} aria-hidden="true" />
                Filtros
                <ChevronDown size={14} aria-hidden="true" />
              </summary>
              <form action="/presupuestos" className={styles.filters}>
                <label className={styles.searchField}>
                  <span>Buscar</span>
                  <span className={styles.inputShell}>
                    <Search size={15} aria-hidden="true" />
                    <input
                      name="buscar"
                      defaultValue={query.buscar ?? ""}
                      placeholder="Número, cliente, obra o título"
                    />
                  </span>
                </label>
                <label className={styles.selectField}>
                  <span>Estado</span>
                  <select name="filtro" defaultValue={activeFilter}>
                    {filterOptions.map(([id, label]) => (
                      <option key={id} value={id}>{label}</option>
                    ))}
                  </select>
                </label>
                <div className={styles.filterActions}>
                  {query.buscar || activeFilter !== "todos" ? (
                    <Link href="/presupuestos" className={styles.clearLink}>Limpiar</Link>
                  ) : <span />}
                  <button type="submit" className="primary-button">Aplicar filtros</button>
                </div>
              </form>
            </details>
            {canCreate ? (
              <details className={styles.newBudgetMenu}>
                <summary className={styles.newBudgetButton}>
                  <Plus size={16} aria-hidden="true" />
                  Nuevo presupuesto
                  <ChevronDown size={14} aria-hidden="true" />
                </summary>
                <div className={styles.newBudgetPanel}>
                  <DemoLimitButton
                    href="/gestion?tipo=presupuesto&returnTo=/presupuestos"
                    currentCount={budgets.length}
                    limit={2}
                  >
                    Crear desde cero
                  </DemoLimitButton>
                  <Link href="/presupuestos/plantillas" className="secondary-button">
                    <FileText size={16} /> Usar una plantilla
                  </Link>
                </div>
              </details>
            ) : (
              <Link href="/presupuestos/plantillas" className={styles.filterButton}>
                <FileText size={15} /> Plantillas
              </Link>
            )}
          </div>
        </div>

        {visibleBudgets.length ? (
          <>
            <ResponsiveTable label="Presupuestos" className={styles.tableWrap}>
              <table className={styles.table}>
                <colgroup>
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "15%" }} />
                  <col style={{ width: "13%" }} />
                  <col style={{ width: "11%" }} />
                  {marginDecision.allowed ? <col style={{ width: "8%" }} /> : null}
                  <col style={{ width: marginDecision.allowed ? "15%" : "19%" }} />
                  <col style={{ width: marginDecision.allowed ? "12%" : "16%" }} />
                  <col style={{ width: "4%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Número</th>
                    <th>Cliente</th>
                    <th>Obra</th>
                    <th>Estado</th>
                    <th className={styles.numeric}>Importe</th>
                    {marginDecision.allowed ? (
                      <th className={styles.numeric}>Margen</th>
                    ) : null}
                    <th>Próxima acción</th>
                    <th>Última actualización</th>
                    <th><span className="sr-only">Acciones</span></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleBudgets.map((budget) => {
                    const budgetPermissions = permissions(budget);
                    const selected = selectedBudget?.id === budget.id;
                    const selectionUrl = selectionHref(budget.id, activeFilter, query.buscar);
                    return (
                      <tr key={budget.id} className={selected ? styles.selectedRow : undefined}>
                        <td>
                          <Link
                            href={selectionUrl}
                            className={styles.budgetNumber}
                            aria-current={selected ? "true" : undefined}
                          >
                            {budget.numero}
                          </Link>
                        </td>
                        <td>{budget.client.nombre}</td>
                        <td>{budget.work?.titulo ?? "Sin obra vinculada"}</td>
                        <td className={styles.statusCell}><StatusPill status={budget.estado} /></td>
                        <td className={styles.numericStrong}>
                          {budgetPermissions.pricing
                            ? formatCurrency(budget.total)
                            : "Restringido"}
                        </td>
                        {marginDecision.allowed ? (
                          <td className={styles.numeric}>
                            {budgetPermissions.margin
                              ? budgetMarginPercent(budget)
                              : "Restringido"}
                          </td>
                        ) : null}
                        <td className={styles.contextCell}>
                          <strong>{nextBudgetAction(budget.estado)}</strong>
                          <small>{nextBudgetActionMeta(budget)}</small>
                        </td>
                        <td className={styles.contextCell}>
                          <strong>{formatDate(lastBudgetActivity(budget).date)}</strong>
                          <small>{lastBudgetActivity(budget).label}</small>
                        </td>
                        <td className={styles.actionCell}>
                          <BudgetActions budget={budget} permissions={budgetPermissions} returnTo={selectionUrl} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </ResponsiveTable>

            <MobileList>
              {visibleBudgets.map((budget) => (
                <BudgetMobileCard
                  key={budget.id}
                  budget={budget}
                  selected={selectedBudget?.id === budget.id}
                  selectionUrl={selectionHref(budget.id, activeFilter, query.buscar)}
                  permissions={permissions(budget)}
                />
              ))}
            </MobileList>
          </>
        ) : (
          <div className={styles.emptyList}>
            <EmptyState
              title="No hay presupuestos para estos filtros"
              description="Cambia la búsqueda o limpia los filtros para recuperar el listado."
              icon={Search}
              action={
                <Link href="/presupuestos" className="secondary-button">
                  Limpiar filtros
                </Link>
              }
            />
          </div>
        )}
      </section>

      <section className={styles.analysisGrid} aria-label="Conversión y detalle">
        <ConversionFunnel
          budgets={budgets}
          pricingDecision={pricingDecision}
          pricingWorkIds={pricingWorkIds}
          pricingClientIds={pricingClientIds}
        />
        <BudgetSelectionDetail
          budget={selectedBudget}
          permissions={selectedBudget ? permissions(selectedBudget) : null}
          returnTo={selectedBudget ? selectionHref(selectedBudget.id, activeFilter, query.buscar) : "/presupuestos"}
        />
      </section>
    </main>
  );
}

type BudgetRow = Awaited<ReturnType<typeof prisma.budget.findMany>>[number] & {
  client: { nombre: string };
  work: { titulo: string } | null;
};

type BudgetPermissions = {
  update: boolean;
  duplicate: boolean;
  agenda: boolean;
  pricing: boolean;
  margin: boolean;
};

function KpiLink({
  label,
  value,
  detail,
  icon,
  tone,
  href,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
  tone: "green" | "orange" | "purple";
  href: string;
}) {
  return (
    <Link href={href} className={styles.kpiCard}>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
      <i className={styles[`tone-${tone}`]}>{icon}</i>
    </Link>
  );
}

function BudgetActions({
  budget,
  permissions,
  returnTo,
}: {
  budget: BudgetRow;
  permissions: BudgetPermissions;
  returnTo: string;
}) {
  return (
    <ActionMenu className={styles.rowActionMenu}>
      <Link href={`/presupuestos/${budget.id}?returnTo=${encodeURIComponent(returnTo)}`}>
        <Eye size={16} /> Abrir presupuesto
      </Link>
      {permissions.update ? (
        <Link
          href={`/gestion?tipo=presupuesto&id=${budget.id}&returnTo=${encodeURIComponent(returnTo)}`}
        >
          <Pencil size={16} /> Editar
        </Link>
      ) : null}
      {permissions.agenda ? (
        <Link href={followUpHref(budget, returnTo)}>
          <MessageCircle size={16} /> Preparar seguimiento
        </Link>
      ) : null}
      {permissions.duplicate ? (
        <form action={duplicateBudget}>
          <input type="hidden" name="id" value={budget.id} />
          <ConfirmSubmitButton message="¿Duplicar este presupuesto como borrador editable?">
            <Copy size={16} /> Duplicar
          </ConfirmSubmitButton>
        </form>
      ) : null}
      {permissions.pricing ? (
        <Link href={`/presupuestos/${budget.id}/pdf?preview=1`} target="_blank">
          <Eye size={16} /> Vista PDF
        </Link>
      ) : null}
      {permissions.pricing ? (
        <Link href={`/presupuestos/${budget.id}/pdf`}>
          <Download size={16} /> Descargar PDF
        </Link>
      ) : null}
    </ActionMenu>
  );
}

function BudgetMobileCard({
  budget,
  selected,
  selectionUrl,
  permissions,
}: {
  budget: BudgetRow;
  selected: boolean;
  selectionUrl: string;
  permissions: BudgetPermissions;
}) {
  return (
    <article className={`${styles.mobileCard} ${selected ? styles.mobileCardSelected : ""}`}>
      <div className={styles.mobileCardTop}>
        <div>
          <Link href={selectionUrl}>{budget.numero}</Link>
          <h3>{budget.titulo}</h3>
          <p>{budget.client.nombre} · {budget.work?.titulo ?? "Sin obra"}</p>
        </div>
        <StatusPill status={budget.estado} />
      </div>
      <dl className={styles.mobileFacts}>
        <div><dt>Importe</dt><dd>{permissions.pricing ? formatCurrency(budget.total) : "Restringido"}</dd></div>
        <div><dt>Margen</dt><dd>{permissions.margin ? budgetMarginPercent(budget) : "Restringido"}</dd></div>
        <div><dt>Próximo paso</dt><dd>{nextBudgetAction(budget.estado)}</dd></div>
      </dl>
      <div className={styles.mobileActions}>
        <Link href={selectionUrl} className="secondary-button">Seleccionar</Link>
        <Link href={`/presupuestos/${budget.id}?returnTo=${encodeURIComponent(selectionUrl)}`} className="primary-button">Abrir</Link>
        <BudgetActions budget={budget} permissions={permissions} returnTo={selectionUrl} />
      </div>
    </article>
  );
}

function ConversionFunnel({
  budgets,
  pricingDecision,
  pricingWorkIds,
  pricingClientIds,
}: {
  budgets: BudgetRow[];
  pricingDecision: { allowed: boolean; scope: string };
  pricingWorkIds: string[] | null;
  pricingClientIds: string[] | null;
}) {
  const stages = [
    { label: "Borradores", filter: "borrador", statuses: ["borrador"], tone: "slate" },
    { label: "En revisión", filter: "pendiente_revision", statuses: ["pendiente_revision"], tone: "orange" },
    { label: "Enviados", filter: "enviado", statuses: ["enviado", "visto"], tone: "blue" },
    { label: "Sin respuesta", filter: "pendiente_respuesta", statuses: ["pendiente_respuesta"], tone: "yellow" },
    { label: "Aceptados", filter: "aceptado", statuses: ["aceptado"], tone: "green" },
  ] as const;
  const accepted = budgets.filter((budget) => budget.estado === "aceptado");
  const closed = budgets.filter((budget) => ["aceptado", "rechazado"].includes(budget.estado));
  const priceIsVisible = (budget: BudgetRow) =>
    pricingDecision.allowed &&
    relationAllowed(
      pricingDecision.scope,
      pricingWorkIds,
      pricingClientIds,
      budget,
    );
  const potentialValue = budgets
    .filter((budget) => matchesFilter(budget.estado, "pendientes"))
    .reduce((sum, budget) => sum + (priceIsVisible(budget) ? budget.total : 0), 0);
  const wonValue = accepted.reduce(
    (sum, budget) => sum + (priceIsVisible(budget) ? budget.total : 0),
    0,
  );

  return (
    <article className={styles.funnelPanel}>
      <h2>Embudo de conversión</h2>
      <div className={styles.funnelBody}>
        <div className={styles.funnelStages}>
          {stages.map((stage, index) => {
            const count = budgets.filter((budget) =>
              stage.statuses.includes(budget.estado as never),
            ).length;
            return (
              <div className={styles.funnelStageRow} key={stage.label}>
                <Link
                  href={filterHref(stage.filter)}
                  className={`${styles.funnelStage} ${styles[`funnel-${stage.tone}`]}`}
                  style={{ width: `${100 - index * 12}%` }}
                  aria-label={`${stage.label}: ${count}`}
                />
                <span><strong>{stage.label}</strong><small>{count} registros</small></span>
              </div>
            );
          })}
        </div>
        <dl className={styles.funnelMetrics}>
          <div><dt>Tasa de conversión</dt><dd>{closed.length ? Math.round((accepted.length / closed.length) * 100) : 0}%</dd></div>
          <div><dt>Valor potencial</dt><dd>{pricingDecision.allowed ? formatCurrency(potentialValue) : "Restringido"}</dd></div>
          <div><dt>Valor ganado</dt><dd>{pricingDecision.allowed ? formatCurrency(wonValue) : "Restringido"}</dd></div>
        </dl>
      </div>
    </article>
  );
}

function BudgetSelectionDetail({
  budget,
  permissions,
  returnTo,
}: {
  budget: BudgetRow | null;
  permissions: BudgetPermissions | null;
  returnTo: string;
}) {
  if (!budget || !permissions) {
    return (
      <article className={styles.detailPanel}>
        <div className={styles.detailEmpty}>
          <FileText size={28} />
          <h2>Selecciona un presupuesto</h2>
          <p>
            El detalle sólo aparece cuando eliges una propuesta del listado. No se selecciona ninguna automáticamente.
          </p>
        </div>
      </article>
    );
  }

  const lines = parseBudgetLines(budget.partidas);
  return (
    <article className={styles.detailPanel}>
      <header className={styles.detailHeader}>
        <div>
          <p><strong>{budget.numero}</strong> · {budget.work?.titulo ?? budget.titulo}</p>
          <span>{budget.client.nombre}</span>
        </div>
        <StatusPill status={budget.estado} />
      </header>
      <div className={styles.detailBody}>
        <dl className={styles.summaryGrid}>
          <div><dt>Cliente</dt><dd>{budget.client.nombre}</dd></div>
          <div><dt>Obra</dt><dd>{budget.work?.titulo ?? "Sin obra vinculada"}</dd></div>
          <div><dt>Fecha de creación</dt><dd>{formatDate(budget.fechaCreacion)}</dd></div>
          <div><dt>Validez</dt><dd>{formatDate(budget.fechaValidez)}</dd></div>
        </dl>
        {permissions.pricing ? (
          <dl className={styles.amountSummary}>
            <div><dt>Subtotal</dt><dd>{formatCurrency(budget.subtotal)}</dd></div>
            <div><dt>IVA</dt><dd>{formatCurrency(budget.iva)}</dd></div>
            {budget.descuento ? <div><dt>Descuento</dt><dd>{formatCurrency(budget.descuento)}</dd></div> : null}
            <div className={styles.totalLine}><dt>Importe total</dt><dd>{formatCurrency(budget.total)}</dd></div>
            {permissions.margin ? <div><dt>Margen</dt><dd>{budgetMarginPercent(budget)}</dd></div> : null}
          </dl>
        ) : (
          <p className={styles.restricted}>Importes restringidos por permisos.</p>
        )}
        <div className={styles.linesBlock}>
          <h3>Partidas principales</h3>
          {lines.length ? (
            <ul>
              {lines.slice(0, 4).map((line, index) => (
                <li key={`${line.descripcion}-${index}`}>
                  <span>{line.descripcion}<small>{line.cantidad} {line.unidad}</small></span>
                  <span className={styles.lineBar} aria-hidden="true"><i style={{ width: `${Math.max(12, Math.min(100, budget.total > 0 ? line.total / budget.total * 100 : 0))}%` }} /></span>
                  <strong>{permissions.pricing ? formatCurrency(line.total) : "Restringido"}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.noLines}>No hay partidas estructuradas en este presupuesto.</p>
          )}
        </div>
      </div>
      <footer className={styles.detailActions}>
        <Link href={`/presupuestos/${budget.id}?returnTo=${encodeURIComponent(returnTo)}`} className="secondary-button">Ver detalle completo</Link>
        {permissions.agenda ? <Link href={followUpHref(budget, returnTo)} className="secondary-button"><MessageCircle size={16} /> Preparar seguimiento</Link> : null}
        {permissions.update ? <Link href={`/gestion?tipo=presupuesto&id=${budget.id}&returnTo=${encodeURIComponent(returnTo)}`} className="primary-button"><Send size={16} /> Revisar presupuesto</Link> : null}
      </footer>
    </article>
  );
}

function matchesFilter(status: string, filter: string) {
  if (filter === "todos") return true;
  if (filter === "pendientes") {
    return [
      "borrador",
      "pendiente_revision",
      "enviado",
      "visto",
      "pendiente_respuesta",
    ].includes(status);
  }
  if (filter === "enviado") return ["enviado", "visto"].includes(status);
  return status === filter;
}

function filterHref(filter: string) {
  return filter === "todos" ? "/presupuestos" : `/presupuestos?filtro=${filter}`;
}

function selectionHref(id: string, filter: string, search?: string) {
  const params = new URLSearchParams();
  if (filter !== "todos") params.set("filtro", filter);
  if (search) params.set("buscar", search);
  params.set("presupuesto", id);
  return `/presupuestos?${params.toString()}`;
}

function followUpHref(budget: BudgetRow, returnTo: string) {
  return `/gestion?tipo=eventoAgenda&clienteId=${budget.clienteId}&obraId=${budget.obraId ?? ""}&presupuestoId=${budget.id}&tipoEvento=seguimiento_presupuesto&titulo=Seguimiento%20${encodeURIComponent(budget.numero)}&returnTo=${encodeURIComponent(returnTo)}`;
}

function conversionLabel(budgets: BudgetRow[]) {
  const accepted = budgets.filter((budget) => budget.estado === "aceptado").length;
  const closed = budgets.filter((budget) => ["aceptado", "rechazado"].includes(budget.estado)).length;
  return closed ? `${Math.round((accepted / closed) * 100)}% de cierres` : "Sin cierres suficientes";
}

function budgetMarginPercent(budget: { subtotal: number; margenEstimado: number }) {
  if (budget.subtotal <= 0) return "Sin base";
  return `${((budget.margenEstimado / budget.subtotal) * 100).toFixed(1)}%`;
}

function nextBudgetAction(status: string) {
  if (["borrador", "pendiente_revision"].includes(status)) return "Revisar presupuesto";
  if (["enviado", "visto", "pendiente_respuesta"].includes(status)) return "Preparar seguimiento";
  if (status === "aceptado") return "Convertir o ejecutar";
  if (status === "caducado") return "Actualizar validez";
  if (status === "rechazado") return "Revisar propuesta";
  return "Revisar";
}

function nextBudgetActionMeta(budget: BudgetRow) {
  if (budget.fechaSeguimiento) return formatDate(budget.fechaSeguimiento);
  if (budget.fechaValidez) return `Válido hasta ${formatDate(budget.fechaValidez)}`;
  return "Sin fecha programada";
}

function lastBudgetActivity(budget: BudgetRow) {
  if (budget.fechaSeguimiento) return { date: budget.fechaSeguimiento, label: "Seguimiento programado" };
  if (budget.fechaEnvio) return { date: budget.fechaEnvio, label: "Envío registrado" };
  return { date: budget.fechaCreacion, label: "Creación registrada" };
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function relationScope(
  scope: string,
  workIds: string[] | null,
  clientIds: string[] | null,
) {
  if (scope === "COMPANY") return {};
  if (scope === "SELECTED_WORKS") return { obraId: { in: workIds ?? [] } };
  if (scope === "SELECTED_CLIENTS") return { clienteId: { in: clientIds ?? [] } };
  const OR: Array<Record<string, unknown>> = [];
  if (workIds?.length) OR.push({ obraId: { in: workIds } });
  if (clientIds?.length) OR.push({ clienteId: { in: clientIds }, obraId: null });
  return OR.length ? { OR } : { id: { in: [] as string[] } };
}

function relationAllowed(
  scope: string,
  workIds: string[] | null,
  clientIds: string[] | null,
  entity: { obraId: string | null; clienteId: string },
) {
  if (scope === "COMPANY") return true;
  if (scope === "SELECTED_WORKS") return Boolean(entity.obraId && workIds?.includes(entity.obraId));
  if (scope === "SELECTED_CLIENTS") return Boolean(clientIds?.includes(entity.clienteId));
  return entity.obraId
    ? Boolean(workIds?.includes(entity.obraId))
    : Boolean(clientIds?.includes(entity.clienteId));
}
