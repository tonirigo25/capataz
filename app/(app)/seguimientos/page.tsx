import type { FollowUpStatus, Prisma } from "@prisma/client";
import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Grid2X2,
  List,
  Mail,
  MoreHorizontal,
  Phone,
  Plus,
  SlidersHorizontal,
  UserRound,
  UsersRound,
} from "lucide-react";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import {
  requireCapability,
  resolveAuthorization,
  resolveScopedEntityIds,
} from "@/lib/commercial/authorization";
import { formatCurrency } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { statusLabel } from "@/lib/status";
import { completeFollowUpAction, createFollowUpAction } from "./actions";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type SearchQuery = {
  estado?: string;
  responsable?: string;
  oportunidad?: string;
  cliente?: string;
  trabajo?: string;
  tipo?: string;
  avanzado?: string;
  vista?: string;
  seleccion?: string;
  nuevo?: string;
  filtro?: string;
};

type FollowUpRecord = Prisma.FollowUpGetPayload<{
  include: {
    attempts: true;
    outcomes: true;
  };
}>;

const pipelineStages: Array<{
  id: string;
  label: string;
  statuses: FollowUpStatus[];
  tone: "slate" | "blue" | "orange" | "violet" | "green" | "dark";
}> = [
  { id: "pending", label: "Pendiente", statuses: ["planned", "due"], tone: "slate" },
  { id: "in_progress", label: "En curso", statuses: ["in_progress"], tone: "blue" },
  { id: "waiting", label: "Esperando respuesta", statuses: ["waiting_response"], tone: "orange" },
  { id: "promised", label: "Compromiso", statuses: ["promised"], tone: "violet" },
  { id: "completed", label: "Completado", statuses: ["completed"], tone: "green" },
  { id: "closed", label: "Cierre", statuses: ["unsuccessful", "cancelled"], tone: "dark" },
];

export default async function FollowUpsPage({
  searchParams,
}: {
  searchParams: Promise<SearchQuery>;
}) {
  const query = await searchParams;
  const now = new Date();
  const auth = await requireCapability("followups.view");
  const [manageDecision, pricingDecision, workIds, clientIds] = await Promise.all([
    resolveAuthorization(auth, "followups.manage"),
    resolveAuthorization(auth, "sales.pricing.view"),
    resolveScopedEntityIds(auth, "followups.view", "Work"),
    resolveScopedEntityIds(auth, "followups.view", "Client"),
  ]);
  const canManage = manageDecision.allowed;
  const canSeePricing = pricingDecision.allowed;
  const scopeWhere = relationScope(auth.scope, workIds, clientIds);

  const allItems = await prisma.followUp.findMany({
    where: {
      companyId: auth.companyId,
      archivedAt: null,
      ...scopeWhere,
    },
    include: {
      attempts: { orderBy: { attemptedAt: "desc" }, take: 8 },
      outcomes: { orderBy: { recordedAt: "desc" }, take: 8 },
    },
    orderBy: [{ nextActionAt: "asc" }, { updatedAt: "desc" }],
    take: 200,
  });

  const relationIds = collectRelationIds(allItems);
  const responsibleIds = [...new Set(allItems.flatMap((item) => item.responsibleId ? [item.responsibleId] : []))];
  const [clients, works, budgets, responsibleUsers, responsibleMemberships, manageableWorks, manageableClients] = await Promise.all([
    relationIds.clientIds.length
      ? prisma.client.findMany({
          where: { companyId: auth.companyId, id: { in: relationIds.clientIds } },
          select: { id: true, nombre: true, nombreComercial: true },
        })
      : Promise.resolve([]),
    relationIds.workIds.length
      ? prisma.work.findMany({
          where: { companyId: auth.companyId, id: { in: relationIds.workIds } },
          select: { id: true, titulo: true, codigo: true, numeroInterno: true, presupuestoAprobado: true },
        })
      : Promise.resolve([]),
    canSeePricing && relationIds.budgetIds.length
      ? prisma.budget.findMany({
          where: { companyId: auth.companyId, id: { in: relationIds.budgetIds } },
          select: { id: true, numero: true, titulo: true, total: true, estado: true },
        })
      : Promise.resolve([]),
    responsibleIds.length
      ? prisma.user.findMany({
          where: { id: { in: responsibleIds } },
          select: { id: true, displayName: true },
        })
      : Promise.resolve([]),
    responsibleIds.length
      ? prisma.companyMembership.findMany({
          where: {
            companyId: auth.companyId,
            OR: [{ id: { in: responsibleIds } }, { userId: { in: responsibleIds } }],
          },
          select: { id: true, userId: true, user: { select: { displayName: true } } },
        })
      : Promise.resolve([]),
    canManage
      ? loadManageableWorks(auth.companyId, manageDecision.scope, await resolveScopedEntityIds(auth, "followups.manage", "Work"))
      : Promise.resolve([]),
    canManage
      ? loadManageableClients(auth.companyId, manageDecision.scope, await resolveScopedEntityIds(auth, "followups.manage", "Client"))
      : Promise.resolve([]),
  ]);

  const clientMap = new Map(clients.map((item) => [item.id, item.nombreComercial ?? item.nombre]));
  const workMap = new Map(works.map((item) => [item.id, item]));
  const budgetMap = new Map(budgets.map((item) => [item.id, item]));
  const responsibleMap = new Map(responsibleUsers.map((item) => [item.id, item.displayName]));
  for (const membership of responsibleMemberships) {
    responsibleMap.set(membership.id, membership.user.displayName);
    responsibleMap.set(membership.userId, membership.user.displayName);
  }

  const stateFilter = normalizeStateFilter(query.estado ?? query.filtro);
  const baseItems = allItems.filter((item) =>
    (!query.responsable || item.responsibleId === query.responsable) &&
    (!query.oportunidad || item.budgetId === query.oportunidad) &&
    (!query.cliente || item.clientId === query.cliente) &&
    (!query.trabajo || item.workId === query.trabajo) &&
    (!query.tipo || item.type === query.tipo),
  );
  const filteredItems = baseItems.filter((item) => matchesStateFilter(item, stateFilter, now));
  const rankedItems = [...filteredItems].sort(compareFollowUps);
  const selected = rankedItems.find((item) => item.id === query.seleccion) ?? rankedItems[0] ?? null;
  const selectedClient = selected?.clientId ? clientMap.get(selected.clientId) : null;
  const selectedWork = selected?.workId ? workMap.get(selected.workId) : null;
  const selectedBudget = selected?.budgetId ? budgetMap.get(selected.budgetId) : null;
  const selectedResponsible = selected?.responsibleId ? responsibleMap.get(selected.responsibleId) : null;
  const view = query.vista === "lista" ? "lista" : "panel";
  const advancedOpen = query.avanzado === "1";
  const statusOptions = pipelineStages.map((stage) => ({ id: stage.id, label: stage.label }));
  const responsibleOptions = uniqueOptions(allItems, (item) => item.responsibleId, (id) => responsibleMap.get(id) ?? "Responsable asignado");
  const budgetOptions = uniqueOptions(allItems, (item) => item.budgetId, (id) => budgetMap.get(id)?.titulo ?? "Presupuesto vinculado");
  const clientOptions = uniqueOptions(allItems, (item) => item.clientId, (id) => clientMap.get(id) ?? "Cliente vinculado");
  const workOptions = uniqueOptions(allItems, (item) => item.workId, (id) => workMap.get(id)?.titulo ?? "Trabajo vinculado");
  const typeOptions = uniqueOptions(allItems, (item) => item.type, (id) => statusLabel(id));

  return (
    <main className={`screen ${styles.page}`}>
      <header className={styles.pageHeader}>
        <div>
          <h1>Seguimientos</h1>
          <p>Gestiona el seguimiento comercial y las interacciones con tus clientes.</p>
        </div>
      </header>

      <form className={styles.filters} method="get" aria-label="Filtros de seguimientos">
        <label className={styles.srLabel}>
          Estado
          <select name="estado" defaultValue={stateFilter}>
            <option value="all">Todos los estados</option>
            <option value="active">Todos los activos</option>
            <option value="overdue">Vencidos</option>
            {statusOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        </label>
        <label className={styles.srLabel}>
          Responsable
          <select name="responsable" defaultValue={query.responsable ?? ""}>
            <option value="">Todos los responsables</option>
            {responsibleOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        </label>
        <label className={styles.srLabel}>
          Oportunidad
          <select name="oportunidad" defaultValue={query.oportunidad ?? ""}>
            <option value="">Todas las oportunidades</option>
            {budgetOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        </label>
        <input type="hidden" name="vista" value={view} />
        {advancedOpen ? <input type="hidden" name="avanzado" value="1" /> : null}
        <button className={styles.filterSubmit} type="submit">Aplicar</button>
        <Link
          className={styles.moreFilters}
          href={hrefFor(query, { avanzado: advancedOpen ? null : "1" })}
          aria-expanded={advancedOpen}
        >
          <SlidersHorizontal size={15} aria-hidden="true" /> Más filtros
        </Link>
        <div className={styles.viewToggle} aria-label="Cambiar vista">
          <span>Vista</span>
          <Link href={hrefFor(query, { vista: "panel" })} aria-current={view === "panel" ? "page" : undefined} aria-label="Vista de panel"><Grid2X2 size={15} /></Link>
          <Link href={hrefFor(query, { vista: "lista" })} aria-current={view === "lista" ? "page" : undefined} aria-label="Vista de lista"><List size={16} /></Link>
        </div>
        {canManage ? (
          <Link className={styles.newButton} href={hrefFor(query, { nuevo: "1" })}>
            <Plus size={15} aria-hidden="true" /> Nuevo seguimiento <span aria-hidden="true">⌄</span>
          </Link>
        ) : null}
      </form>

      {advancedOpen ? (
        <form className={styles.advancedFilters} method="get" aria-label="Filtros avanzados">
          <input type="hidden" name="estado" value={stateFilter} />
          <input type="hidden" name="responsable" value={query.responsable ?? ""} />
          <input type="hidden" name="oportunidad" value={query.oportunidad ?? ""} />
          <input type="hidden" name="vista" value={view} />
          <input type="hidden" name="avanzado" value="1" />
          <label>Cliente<select name="cliente" defaultValue={query.cliente ?? ""}><option value="">Todos</option>{clientOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
          <label>Trabajo<select name="trabajo" defaultValue={query.trabajo ?? ""}><option value="">Todos</option>{workOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
          <label>Tipo<select name="tipo" defaultValue={query.tipo ?? ""}><option value="">Todos</option>{typeOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
          <button type="submit">Actualizar</button>
          <Link href="/seguimientos">Limpiar</Link>
        </form>
      ) : null}

      {canManage && query.nuevo === "1" ? (
        <section className={styles.creationPanel} aria-labelledby="new-followup-title">
          <div><h2 id="new-followup-title">Nuevo seguimiento</h2><p>Vincula la acción a un cliente o trabajo visible para mantener el contexto y el aislamiento.</p></div>
          <form action={createFollowUpAction}>
            <label>Título<input name="title" required /></label>
            <label>Tipo<select name="type" defaultValue="general"><option value="general">General</option><option value="budget_followup">Presupuesto</option><option value="collection_followup">Cobro</option><option value="client_contact">Cliente</option><option value="commercial">Comercial</option></select></label>
            <label>Próxima acción<input type="datetime-local" name="nextActionAt" /></label>
            {manageableClients.length ? <label>Cliente<select name="clientId" defaultValue=""><option value="">Sin cliente</option>{manageableClients.map((item) => <option key={item.id} value={item.id}>{item.nombreComercial ?? item.nombre}</option>)}</select></label> : null}
            {manageableWorks.length ? <label>Trabajo<select name="workId" defaultValue=""><option value="">Sin trabajo</option>{manageableWorks.map((item) => <option key={item.id} value={item.id}>{item.titulo}</option>)}</select></label> : null}
            <div className={styles.creationActions}><button type="submit">Crear seguimiento</button><Link href={hrefFor(query, { nuevo: null })}>Cancelar</Link></div>
          </form>
        </section>
      ) : null}

      <section className={styles.pipeline} aria-labelledby="pipeline-title">
        <h2 id="pipeline-title">Pipeline de seguimientos</h2>
        <div className={styles.pipelineCards}>
          {pipelineStages.map((stage) => {
            const count = baseItems.filter((item) => stage.statuses.includes(item.status)).length;
            const percentage = baseItems.length ? Math.round((count / baseItems.length) * 100) : 0;
            return (
              <Link
                key={stage.id}
                href={hrefFor(query, { estado: stage.id, filtro: null, seleccion: null })}
                className={`${styles.pipelineCard} ${styles[stage.tone]}`}
                aria-current={stateFilter === stage.id ? "page" : undefined}
              >
                <span>{stage.label}</span><strong>{count}</strong><small>{percentage}%</small>
              </Link>
            );
          })}
        </div>
        <div className={styles.pipelineBar} aria-hidden="true">
          {pipelineStages.map((stage) => <span key={stage.id} className={styles[stage.tone]} style={{ flexGrow: Math.max(1, baseItems.filter((item) => stage.statuses.includes(item.status)).length) }} />)}
        </div>
        <p>{baseItems.length} seguimientos visibles</p>
      </section>

      {baseItems.map((item) => (
        <FollowUpRailMetadata item={item} key={`rail-${item.id}`} />
      ))}

      {view === "lista" ? (
        <FollowUpList
          items={rankedItems}
          query={query}
          clientMap={clientMap}
          workMap={workMap}
          responsibleMap={responsibleMap}
        />
      ) : selected ? (
        <section className={styles.workspace} data-view={view}>
          <article className={styles.featured}>
            <header><h2>Seguimiento destacado</h2><PriorityPill priority={selected.priority} /></header>
            <div className={styles.featuredTop}>
              <ContextIcon label={selectedClient ?? selectedWork?.titulo ?? selected.title} />
              <Field label="Cliente" value={selectedClient ?? "Sin cliente vinculado"} />
              <Field label="Oportunidad" value={selectedBudget?.titulo ?? selectedWork?.titulo ?? statusLabel(selected.type)} />
              <Field label="Valor registrado" value={selectedBudget ? formatCurrency(selectedBudget.total) : canSeePricing ? "Sin importe vinculado" : "Restringido"} strong />
              <Field label="Estado" value={statusLabel(selected.status)} pill />
            </div>
            <div className={styles.featuredBottom}>
              <CalendarDays size={17} aria-hidden="true" />
              <Field label="Próxima acción" value={selected.nextActionAt ? selected.title : "Definir próxima acción"} secondary={formatDateTime(selected.nextActionAt)} />
              <UserRound size={17} aria-hidden="true" />
              <Field label="Responsable" value={selectedResponsible ?? "Sin asignar"} secondary="Responsable registrado" />
              <Field label="Prioridad" value={statusLabel(selected.priority)} pill />
            </div>
          </article>

          <article className={styles.nextActions}>
            <header><h2>Próximas acciones</h2></header>
            <ul>
              {rankedItems.filter((item) => item.nextActionAt && !["completed", "cancelled", "unsuccessful"].includes(item.status)).slice(0, 3).map((item) => (
                <li key={item.id}>
                  <span className={styles.actionIcon}>{iconForType(item.type)}</span>
                  <Link href={hrefFor(query, { seleccion: item.id })}><strong>{item.title}</strong><small>{item.clientId ? clientMap.get(item.clientId) ?? "Cliente vinculado" : item.workId ? workMap.get(item.workId)?.titulo ?? "Trabajo vinculado" : statusLabel(item.type)}</small></Link>
                  <time>{formatShortDateTime(item.nextActionAt)}</time>
                  <PriorityPill priority={item.priority} compact />
                </li>
              ))}
            </ul>
            <Link className={styles.panelFooter} href="/agenda">Ver agenda completa</Link>
          </article>

          <article className={styles.history}>
            <header><h2>Historial de interacciones</h2></header>
            <InteractionHistory item={selected} responsibleMap={responsibleMap} />
            <Link className={styles.panelFooter} href={`/seguimientos/${selected.id}`}>Ver todo el historial</Link>
          </article>

          <article className={styles.details}>
            <header><h2>Detalles del seguimiento</h2></header>
            <dl>
              <FieldRow label="Código" value={shortCode(selected.id)} />
              <FieldRow label="Creado" value={formatDate(selected.createdAt)} />
              <FieldRow label="Cliente" value={selectedClient ?? "Sin cliente vinculado"} href={selected.clientId ? `/clientes/${selected.clientId}` : undefined} />
              <FieldRow label="Oportunidad" value={selectedBudget?.titulo ?? selectedWork?.titulo ?? statusLabel(selected.type)} href={selected.budgetId ? `/presupuestos/${selected.budgetId}` : selected.workId ? `/obras/${selected.workId}` : undefined} />
              <FieldRow label="Responsable" value={selectedResponsible ?? "Sin asignar"} />
              <FieldRow label="Estado" value={statusLabel(selected.status)} pill />
              <FieldRow label="Prioridad" value={statusLabel(selected.priority)} />
              <FieldRow label="Fuente" value={statusLabel(selected.origin)} />
              <FieldRow label="Última actividad" value={formatDateTime(latestActivity(selected))} />
            </dl>
          </article>

          <FollowUpActions item={selected} canManage={canManage} />
        </section>
      ) : (
        <section className={styles.emptyState}>
          <UsersRound size={26} aria-hidden="true" />
          <h2>No hay seguimientos con estos filtros</h2>
          <p>La cola conserva los datos registrados; cambia los filtros para consultar otros estados.</p>
          <Link href="/seguimientos">Limpiar filtros</Link>
        </section>
      )}
    </main>
  );
}

function FollowUpActions({ item, canManage }: { item: FollowUpRecord; canManage: boolean }) {
  return (
    <nav className={styles.actionBar} aria-label="Acciones del seguimiento seleccionado">
      <Link href={`/seguimientos/${item.id}#registrar-intento`}><Phone size={16} />Registrar llamada</Link>
      <Link href={`/seguimientos/${item.id}#registrar-intento`}><CalendarDays size={16} />Programar reunión</Link>
      <Link href={`/seguimientos/${item.id}#registrar-intento`}><Mail size={16} />Enviar correo</Link>
      {canManage ? (
        <form action={completeFollowUpAction}>
          <input type="hidden" name="id" value={item.id} />
          <ConfirmSubmitButton className={styles.completeButton} message="Se registrará este seguimiento como completado, conservando su historial de intentos y resultados.">
            <CheckCircle2 size={16} /> Marcar completado
          </ConfirmSubmitButton>
        </form>
      ) : <Link href={`/seguimientos/${item.id}`}><CheckCircle2 size={16} />Ver estado</Link>}
      <details>
        <summary><MoreHorizontal size={16} />Más acciones</summary>
        <div><Link href={`/seguimientos/${item.id}`}>Abrir detalle completo</Link>{item.clientId ? <Link href={`/clientes/${item.clientId}`}>Abrir cliente</Link> : null}{item.workId ? <Link href={`/obras/${item.workId}`}>Abrir trabajo</Link> : null}{item.budgetId ? <Link href={`/presupuestos/${item.budgetId}`}>Abrir presupuesto</Link> : null}</div>
      </details>
    </nav>
  );
}

function FollowUpList({
  items,
  query,
  clientMap,
  workMap,
  responsibleMap,
}: {
  items: FollowUpRecord[];
  query: SearchQuery;
  clientMap: Map<string, string>;
  workMap: Map<string, { titulo: string }>;
  responsibleMap: Map<string, string>;
}) {
  return (
    <section className={styles.listView} aria-label="Lista de seguimientos">
      <header><h2>Seguimientos visibles</h2><span>{items.length}</span></header>
      {items.length ? <div className={styles.listRows}>{items.map((item) => (
        <Link key={item.id} href={hrefFor(query, { vista: "panel", seleccion: item.id })}>
          <span className={styles.listIcon}>{iconForType(item.type)}</span>
          <span><strong>{item.title}</strong><small>{item.clientId ? clientMap.get(item.clientId) : item.workId ? workMap.get(item.workId)?.titulo : statusLabel(item.type)}</small></span>
          <span>{responsibleMap.get(item.responsibleId ?? "") ?? "Sin asignar"}</span>
          <time>{formatShortDateTime(item.nextActionAt)}</time>
          <span className={styles.statusPill}>{statusLabel(item.status)}</span>
          <ArrowRight size={15} />
        </Link>
      ))}</div> : <p className={styles.listEmpty}>No hay resultados con estos filtros.</p>}
    </section>
  );
}

function InteractionHistory({ item, responsibleMap }: { item: FollowUpRecord; responsibleMap: Map<string, string> }) {
  const rows = [
    ...item.attempts.map((attempt) => ({ id: `a-${attempt.id}`, at: attempt.attemptedAt, title: labelAttempt(attempt.channel), description: attempt.summary ?? attempt.response ?? "Intento registrado", responsible: responsibleMap.get(attempt.responsibleId ?? "") ?? "Equipo", tone: attempt.response ? "positive" : "recorded" })),
    ...item.outcomes.map((outcome) => ({ id: `o-${outcome.id}`, at: outcome.recordedAt, title: statusLabel(outcome.type), description: outcome.summary ?? "Resultado registrado", responsible: responsibleMap.get(outcome.recordedById ?? "") ?? "Equipo", tone: "completed" })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 4);
  return rows.length ? <ol>{rows.map((row) => <li key={row.id}><span className={styles.historyIcon}>{iconForHistory(row.title)}</span><div><strong>{row.title}</strong><small>{row.description}</small></div><div><span>{row.responsible}</span><time>{formatShortDateTime(row.at)}</time></div><span className={styles.historyPill}>{statusLabel(row.tone)}</span></li>)}</ol> : <div className={styles.emptyHistory}><p>Sin interacciones registradas.</p><Link href={`/seguimientos/${item.id}#registrar-intento`}>Registrar primera interacción</Link></div>;
}

function FollowUpRailMetadata({ item }: { item: FollowUpRecord }) {
  return (
    <div hidden data-follow-up-queue-item>
      <div><Link href={`/seguimientos/${item.id}`}>{item.title}</Link><p>{item.type} · {statusLabel(item.status)} · prioridad {statusLabel(item.priority)}</p></div>
      <dl>
        <div><dt>Fecha</dt><dd>{item.nextActionAt ? formatDateTime(item.nextActionAt) : "Sin fecha"}</dd></div>
        <div><dt>Promesa</dt><dd>{item.expectedOutcome ?? (item.status === "promised" ? "Promesa registrada" : "Sin promesa")}</dd></div>
        <div><dt>Último intento</dt><dd>{item.attempts[0]?.attemptedAt ? formatDateTime(item.attempts[0].attemptedAt) : "Sin intentos"}</dd></div>
        <div><dt>Canal</dt><dd>{item.attempts[0]?.channel ? statusLabel(item.attempts[0].channel) : "Pendiente de elegir"}</dd></div>
        <div><dt>Resultado</dt><dd>{item.outcomes[0]?.summary ?? item.attempts[0]?.response ?? "Sin resultado"}</dd></div>
        <div><dt>Siguiente acción</dt><dd>{item.nextActionAt ? item.title : "Definir siguiente acción"}</dd></div>
      </dl>
    </div>
  );
}

function Field({ label, value, secondary, strong, pill }: { label: string; value: string; secondary?: string; strong?: boolean; pill?: boolean }) {
  return <div className={styles.field}><span>{label}</span><b className={strong ? styles.strongValue : pill ? styles.inlinePill : undefined}>{value}</b>{secondary ? <small>{secondary}</small> : null}</div>;
}

function FieldRow({ label, value, href, pill }: { label: string; value: string; href?: string; pill?: boolean }) {
  return <div><dt>{label}</dt><dd className={pill ? styles.inlinePill : undefined}>{href ? <Link href={href}>{value} ↗</Link> : value}</dd></div>;
}

function ContextIcon({ label }: { label: string }) {
  const initials = label.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return <span className={styles.contextIcon} aria-hidden="true">{initials || "S"}</span>;
}

function PriorityPill({ priority, compact = false }: { priority: string; compact?: boolean }) {
  return <span className={`${styles.priorityPill} ${styles[`priority_${priority}`]} ${compact ? styles.compactPill : ""}`}>{statusLabel(priority)}</span>;
}

function relationScope(scope: string, workIds: string[] | null, clientIds: string[] | null): Prisma.FollowUpWhereInput {
  if (scope === "COMPANY") return {};
  if (scope === "SELECTED_WORKS") return { workId: { in: workIds ?? [] } };
  if (scope === "SELECTED_CLIENTS") return { clientId: { in: clientIds ?? [] } };
  const OR: Prisma.FollowUpWhereInput[] = [];
  if (workIds?.length) OR.push({ workId: { in: workIds } });
  if (clientIds?.length) OR.push({ clientId: { in: clientIds }, workId: null });
  return OR.length ? { OR } : { id: { in: [] } };
}

async function loadManageableWorks(companyId: string, scope: string, ids: string[] | null) {
  if (scope === "SELECTED_CLIENTS") return [];
  return prisma.work.findMany({ where: { companyId, archivada: false, ...(ids === null ? {} : { id: { in: ids } }) }, select: { id: true, titulo: true }, orderBy: { titulo: "asc" }, take: 100 });
}

async function loadManageableClients(companyId: string, scope: string, ids: string[] | null) {
  if (scope === "SELECTED_WORKS") return [];
  return prisma.client.findMany({ where: { companyId, archivadoAt: null, ...(ids === null ? {} : { id: { in: ids } }) }, select: { id: true, nombre: true, nombreComercial: true }, orderBy: { nombre: "asc" }, take: 100 });
}

function collectRelationIds(items: FollowUpRecord[]) {
  return {
    clientIds: [...new Set(items.flatMap((item) => item.clientId ? [item.clientId] : []))],
    workIds: [...new Set(items.flatMap((item) => item.workId ? [item.workId] : []))],
    budgetIds: [...new Set(items.flatMap((item) => item.budgetId ? [item.budgetId] : []))],
  };
}

function uniqueOptions(items: FollowUpRecord[], getId: (item: FollowUpRecord) => string | null, getLabel: (id: string) => string) {
  return [...new Set(items.flatMap((item) => { const id = getId(item); return id ? [id] : []; }))].map((id) => ({ id, label: getLabel(id) })).sort((a, b) => a.label.localeCompare(b.label, "es"));
}

function normalizeStateFilter(value?: string) {
  if (!value) return "all";
  if (value === "waiting") return "waiting";
  if (value === "pending") return "active";
  return ["all", "active", "overdue", ...pipelineStages.map((stage) => stage.id)].includes(value) ? value : "all";
}

function matchesStateFilter(item: FollowUpRecord, filter: string, now: Date) {
  if (filter === "all") return true;
  if (filter === "active") return ["planned", "due", "in_progress", "waiting_response", "promised"].includes(item.status);
  if (filter === "overdue") return Boolean(item.nextActionAt && item.nextActionAt < now && !["completed", "cancelled", "archived"].includes(item.status));
  const stage = pipelineStages.find((candidate) => candidate.id === filter);
  return stage ? stage.statuses.includes(item.status) : true;
}

function compareFollowUps(a: FollowUpRecord, b: FollowUpRecord) {
  const priority = priorityWeight(b.priority) - priorityWeight(a.priority);
  if (priority) return priority;
  return (a.nextActionAt?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.nextActionAt?.getTime() ?? Number.MAX_SAFE_INTEGER);
}

function priorityWeight(value: string) {
  return { low: 0, medium: 1, high: 2, urgent: 3 }[value as "low" | "medium" | "high" | "urgent"] ?? 0;
}

function latestActivity(item: FollowUpRecord) {
  return [item.updatedAt, item.attempts[0]?.attemptedAt, item.outcomes[0]?.recordedAt].filter((value): value is Date => Boolean(value)).sort((a, b) => b.getTime() - a.getTime())[0] ?? item.createdAt;
}

function shortCode(id: string) {
  return `SEG-${id.slice(-8).toUpperCase()}`;
}

function formatDate(value: Date) {
  return value.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(value: Date | null | undefined) {
  return value ? value.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" }) : "Sin fecha";
}

function formatShortDateTime(value: Date | null | undefined) {
  return value ? value.toLocaleString("es-ES", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Sin fecha";
}

function labelAttempt(channel: string) {
  if (channel.includes("phone")) return "Llamada registrada";
  if (channel.includes("email")) return "Correo registrado";
  if (channel.includes("person")) return "Reunión registrada";
  if (channel.includes("whatsapp")) return "WhatsApp registrado";
  return "Interacción registrada";
}

function iconForType(type: string) {
  if (type.includes("budget")) return <BriefcaseBusiness size={15} />;
  if (type.includes("contact")) return <UsersRound size={15} />;
  if (type.includes("collection")) return <Clock3 size={15} />;
  return <CalendarDays size={15} />;
}

function iconForHistory(label: string) {
  if (/llamada/i.test(label)) return <Phone size={15} />;
  if (/correo/i.test(label)) return <Mail size={15} />;
  if (/reuni/i.test(label)) return <UsersRound size={15} />;
  return <CheckCircle2 size={15} />;
}

function hrefFor(query: SearchQuery, changes: Partial<Record<keyof SearchQuery, string | null>>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value) params.set(key, value);
  for (const [key, value] of Object.entries(changes)) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
  params.delete("filtro");
  const search = params.toString();
  return `/seguimientos${search ? `?${search}` : ""}`;
}
