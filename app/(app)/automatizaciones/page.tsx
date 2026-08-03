import Link from "next/link";
import type { ReactNode } from "react";
import type { Prisma } from "@prisma/client";
import {
  BarChart3,
  CalendarDays,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  Filter,
  GitBranch,
  History,
  LayoutGrid,
  List,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Rocket,
  Settings2,
  ShieldCheck,
  Sparkles,
  TestTube2,
  UserRound,
  Workflow,
  Zap,
} from "lucide-react";
import { InternalBreadcrumbs } from "@/components/internal-breadcrumbs";
import { EmptyState } from "@/components/ui-primitives";
import { requireCapability } from "@/lib/commercial/authorization";
import { prisma } from "@/lib/prisma";
import {
  createAutomationAction,
  publishAutomationAction,
  runAutomationAction,
  toggleAutomationAction,
} from "./actions";
import styles from "./automation-workspace.module.css";

export const dynamic = "force-dynamic";

type SearchState = {
  estado?: string;
  area?: string;
  trigger?: string;
  responsable?: string;
  seleccionado?: string;
  panel?: string;
  vista?: string;
  nuevo?: string;
  pagina?: string;
};

const panelTabs = [
  ["flujo", "Flujo"],
  ["configuracion", "Configuración"],
  ["ejecuciones", "Ejecuciones"],
  ["historial", "Historial"],
  ["auditoria", "Auditoría"],
] as const;

const viewTabs = [
  ["lista", "Lista", List],
  ["tablero", "Tablero", LayoutGrid],
  ["calendario", "Calendario", CalendarDays],
] as const;

const automationInclude = {
  currentVersion: {
    include: {
      triggers: true,
      conditions: { orderBy: { order: "asc" as const } },
      actions: { orderBy: { order: "asc" as const } },
    },
  },
  versions: {
    include: {
      triggers: true,
      conditions: { orderBy: { order: "asc" as const } },
      actions: { orderBy: { order: "asc" as const } },
    },
    orderBy: { version: "desc" as const },
    take: 8,
  },
  schedule: true,
  runs: {
    include: {
      confirmations: true,
      steps: { include: { action: true }, orderBy: { order: "asc" as const } },
    },
    orderBy: { startedAt: "desc" as const },
    take: 30,
  },
} satisfies Prisma.AutomationDefinitionInclude;

type AutomationItem = Prisma.AutomationDefinitionGetPayload<{ include: typeof automationInclude }>;

export default async function AutomationsPage({ searchParams }: { searchParams: Promise<SearchState> }) {
  const query = await searchParams;
  const auth = await requireCapability("company.update");
  const status = safeValue(query.estado, "all");
  const category = safeValue(query.area, "all");
  const trigger = safeValue(query.trigger, "all");
  const responsible = safeValue(query.responsable, "all");
  const panel = panelTabs.some(([id]) => id === query.panel) ? query.panel! : "flujo";
  const view = viewTabs.some(([id]) => id === query.vista) ? query.vista! : "lista";

  const allItems = await prisma.automationDefinition.findMany({
    where: { companyId: auth.companyId, archivedAt: null },
    include: automationInclude,
    orderBy: [{ active: "desc" }, { updatedAt: "desc" }],
  });

  const filteredItems = allItems.filter((item) => {
    const version = item.currentVersion ?? item.versions[0];
    if (status !== "all" && item.status !== status) return false;
    if (category !== "all" && item.category !== category) return false;
    if (trigger !== "all" && !version?.triggers.some((entry) => entry.type === trigger)) return false;
    if (responsible === "assigned" && !item.responsibleId) return false;
    if (responsible === "unassigned" && item.responsibleId) return false;
    return true;
  });

  const pageSize = 6;
  const requestedPage = Math.max(1, Number.parseInt(query.pagina ?? "1", 10) || 1);
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const pageNumber = Math.min(requestedPage, totalPages);
  const items = filteredItems.slice((pageNumber - 1) * pageSize, pageNumber * pageSize);

  const selected = items.find((item) => item.id === query.seleccionado) ?? items[0] ?? null;
  const categories = unique(allItems.map((item) => item.category));
  const triggerTypes = unique(allItems.flatMap((item) => (item.currentVersion ?? item.versions[0])?.triggers.map((entry) => entry.type) ?? []));
  const allRuns = allItems.flatMap((item) => item.runs);
  const completed = allRuns.filter((run) => run.status === "completed");
  const failures = allRuns.filter((run) => run.status === "failed");
  const pendingConfirmations = allRuns.filter((run) => run.status === "waiting_confirmation").length;
  const successRate = allRuns.length ? Math.round((completed.length / allRuns.length) * 100) : null;

  const href = (changes: Partial<SearchState>) => automationHref({ ...query, ...changes });

  return (
    <main className={styles.screen} data-automation-workspace>
      <InternalBreadcrumbs items={[{ label: "Orqena IA", href: "/orqena-ia" }, { label: "Automatizaciones" }]} />
      <header className={styles.pageHeader}>
        <div>
          <h1>Automatizaciones</h1>
          <p>Orquesta procesos repetitivos con control humano, aislamiento por empresa y trazabilidad completa.</p>
        </div>
        <Link className={styles.primaryAction} href={href({ nuevo: "1" })}>
          <Plus size={16} aria-hidden="true" /> Nueva automatización
        </Link>
      </header>

      {query.nuevo === "1" ? (
        <section className={styles.createPanel} aria-labelledby="new-automation-title">
          <div>
            <p className={styles.kicker}>Nuevo borrador controlado</p>
            <h2 id="new-automation-title">Crear automatización</h2>
            <p>Se crea desactivada. Define, prueba y publica una versión antes de habilitarla.</p>
          </div>
          <form action={createAutomationAction} className={styles.createForm}>
            <label>Nombre<input name="name" required maxLength={120} /></label>
            <label>Descripción<input name="description" maxLength={300} /></label>
            <button className={styles.primaryAction}>Crear borrador</button>
            <Link className={styles.secondaryAction} href={href({ nuevo: undefined })}>Cancelar</Link>
          </form>
        </section>
      ) : null}

      <div className={styles.toolbarRow}>
        <form className={styles.filters} method="get" action="/automatizaciones">
          <Filter size={15} aria-hidden="true" />
          <label><span>Estado</span><select name="estado" defaultValue={status}><option value="all">Todos</option><option value="active">Activas</option><option value="paused">Pausadas</option><option value="draft">Borradores</option><option value="disabled">Deshabilitadas</option></select></label>
          <label><span>Área</span><select name="area" defaultValue={category}><option value="all">Todas</option>{categories.map((value) => <option key={value} value={value}>{humanize(value)}</option>)}</select></label>
          <label><span>Trigger</span><select name="trigger" defaultValue={trigger}><option value="all">Todos</option>{triggerTypes.map((value) => <option key={value} value={value}>{humanize(value)}</option>)}</select></label>
          <label><span>Responsable</span><select name="responsable" defaultValue={responsible}><option value="all">Todos</option><option value="assigned">Asignado</option><option value="unassigned">Sin asignar</option></select></label>
          <input type="hidden" name="vista" value={view} />
          <button type="submit" className={styles.filterSubmit}>Aplicar</button>
        </form>
        <Link className={styles.templateAction} href={href({ nuevo: "1" })}><Sparkles size={15} aria-hidden="true" /> Plantillas</Link>
        <nav className={styles.viewSwitch} aria-label="Vista de automatizaciones">
          {viewTabs.map(([id, label, Icon]) => <Link key={id} href={href({ vista: id })} aria-current={view === id ? "page" : undefined}><Icon size={14} aria-hidden="true" />{label}</Link>)}
        </nav>
      </div>

      <section className={styles.workspace}>
        <div className={styles.collection}>
          {items.length ? view === "lista" ? (
            <AutomationTable items={items} selectedId={selected?.id} total={filteredItems.length} page={pageNumber} totalPages={totalPages} href={href} />
          ) : view === "tablero" ? (
            <AutomationBoard items={items} selectedId={selected?.id} href={href} />
          ) : (
            <AutomationCalendar items={items} selectedId={selected?.id} href={href} />
          ) : (
            <EmptyState title="Sin automatizaciones" description="No hay definiciones dentro de estos filtros. Ajusta los filtros o crea un borrador controlado." />
          )}
        </div>
        {selected ? <AutomationInspector item={selected} panel={panel} href={href} /> : <section className={styles.inspectorEmpty}><Workflow size={28} aria-hidden="true" /><h2>Selecciona una automatización</h2><p>El flujo, la configuración y el historial se muestran aquí sin abandonar el listado.</p></section>}
      </section>

      <section className={styles.metrics} aria-label="Indicadores reales de automatización">
        <MetricCard icon={Workflow} tone="green" label="Automatizaciones activas" value={String(allItems.filter((item) => item.active).length)} note={`${allItems.length} configuradas`} />
        <MetricCard icon={Check} tone="violet" label="Ejecuciones completadas" value={String(completed.length)} note="En las 30 últimas por automatización" />
        <MetricCard icon={CircleAlert} tone="orange" label="Fallos registrados" value={String(failures.length)} note={successRate === null ? "Sin ejecuciones evaluables" : `${successRate}% de éxito observado`} />
        <MetricCard icon={ShieldCheck} tone="blue" label="Pendientes de aprobación" value={String(pendingConfirmations)} note="Sin ejecutar acciones sensibles" />
      </section>
    </main>
  );
}

function AutomationTable({ items, selectedId, total, page, totalPages, href }: { items: AutomationItem[]; selectedId?: string; total: number; page: number; totalPages: number; href: (changes: Partial<SearchState>) => string }) {
  return <div className={styles.tableShell} data-automation-list-view>
    <div className={styles.tableHeader}><span>Automatización</span><span>Trigger</span><span>Condición</span><span>Acción siguiente</span><span>Responsable</span><span>Última ejecución</span><span>Estado</span><span>Rendimiento</span><span /></div>
    {items.map((item) => <AutomationRow key={item.id} item={item} selected={selectedId === item.id} href={href} />)}
    <footer className={styles.collectionFooter}><span>Mostrando {items.length} de {total} automatizaciones</span><nav aria-label="Páginas de automatizaciones">{page > 1 ? <Link href={href({ pagina: String(page - 1), seleccionado: undefined })}>Anterior</Link> : <span aria-disabled="true">Anterior</span>}<strong>{page} / {totalPages}</strong>{page < totalPages ? <Link href={href({ pagina: String(page + 1), seleccionado: undefined })}>Siguiente</Link> : <span aria-disabled="true">Siguiente</span>}</nav></footer>
  </div>;
}

function AutomationRow({ item, selected, href }: { item: AutomationItem; selected: boolean; href: (changes: Partial<SearchState>) => string }) {
  const version = item.currentVersion ?? item.versions[0];
  const last = item.runs[0];
  const observed = item.runs.length;
  const completed = item.runs.filter((run) => run.status === "completed").length;
  const rate = observed ? Math.round((completed / observed) * 100) : null;
  return <article className={styles.automationRow} data-selected={selected ? "true" : undefined} data-automation-state={item.status}>
    <Link className={styles.rowMainLink} href={href({ seleccionado: item.id, panel: "flujo" })} aria-label={`Abrir ${item.name}`} />
    <span className={styles.nameCell}><span className={styles.automationIcon}><Workflow size={16} aria-hidden="true" /></span><span><strong>{item.name}</strong><small>{item.id.slice(-8).toUpperCase()}</small></span></span>
    <Cell label="Trigger">{version?.triggers.map((entry) => humanize(entry.type)).join(", ") || "Sin trigger"}</Cell>
    <Cell label="Condición">{version?.conditions[0] ? conditionLabel(version.conditions[0]) : "Sin condición"}</Cell>
    <Cell label="Acción siguiente">{version?.actions.map((entry) => humanize(entry.actionType)).join(", ") || "Sin acción"}</Cell>
    <Cell label="Responsable"><span className={styles.person}><UserRound size={14} aria-hidden="true" />{item.responsibleId ? "Asignado" : "Sin asignar"}</span></Cell>
    <Cell label="Última ejecución">{last ? <><span>{formatRelative(last.startedAt)}</span><small className={styles.runState} data-status={last.status}>{humanize(last.status)}</small></> : "Sin ejecuciones"}</Cell>
    <span className={styles.statusCell} data-status={item.status}>{humanize(item.status)}</span>
    <Cell label="Rendimiento"><strong>{rate === null ? "—" : `${rate}%`}</strong><small>{rate === null ? "sin muestra" : `${completed}/${observed} runs`}</small></Cell>
    <span className={styles.rowActions}>
      <form action={runAutomationAction}><input type="hidden" name="id" value={item.id} /><input type="hidden" name="dryRun" value="true" /><button type="submit" title="Ejecutar prueba sin mutaciones"><TestTube2 size={14} aria-hidden="true" /><span className={styles.srOnly}>Dry run</span></button></form>
      <form action={toggleAutomationAction}><input type="hidden" name="id" value={item.id} /><input type="hidden" name="active" value={String(!item.active)} /><button type="submit" title={item.active ? "Pausar" : "Reanudar"}>{item.active ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}<span className={styles.srOnly}>{item.active ? "Pausar" : "Reanudar"}</span></button></form>
      <Link href={`/automatizaciones/${item.id}`} title="Abrir configuración completa"><MoreHorizontal size={15} aria-hidden="true" /><span className={styles.srOnly}>Abrir detalle</span></Link>
      <ChevronRight size={14} aria-hidden="true" />
    </span>
  </article>;
}

function AutomationBoard({ items, selectedId, href }: { items: AutomationItem[]; selectedId?: string; href: (changes: Partial<SearchState>) => string }) {
  const groups = ["active", "paused", "draft", "disabled"];
  return <div className={styles.board} data-automation-board-view>{groups.map((status) => <section key={status}><header><h2>{humanize(status)}</h2><span>{items.filter((item) => item.status === status).length}</span></header><div>{items.filter((item) => item.status === status).map((item) => <Link key={item.id} data-selected={item.id === selectedId ? "true" : undefined} href={href({ seleccionado: item.id, panel: "flujo" })}><Workflow size={16} aria-hidden="true" /><span><strong>{item.name}</strong><small>{item.category} · {formatRelative(item.updatedAt)}</small></span><ChevronRight size={14} aria-hidden="true" /></Link>)}</div></section>)}</div>;
}

function AutomationCalendar({ items, selectedId, href }: { items: AutomationItem[]; selectedId?: string; href: (changes: Partial<SearchState>) => string }) {
  const scheduled = [...items].sort((a, b) => (a.schedule?.nextRunAt?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.schedule?.nextRunAt?.getTime() ?? Number.MAX_SAFE_INTEGER));
  return <div className={styles.calendarList} data-automation-calendar-view><header><CalendarDays size={17} aria-hidden="true" /><div><h2>Próximas ejecuciones</h2><p>Programaciones guardadas en la zona horaria de cada regla.</p></div></header>{scheduled.map((item) => <Link key={item.id} data-selected={item.id === selectedId ? "true" : undefined} href={href({ seleccionado: item.id, panel: "configuracion" })}><span className={styles.calendarDate}>{item.schedule?.nextRunAt ? item.schedule.nextRunAt.toLocaleDateString("es-ES", { day: "2-digit", month: "short" }) : "—"}</span><span><strong>{item.name}</strong><small>{item.schedule?.nextRunAt ? item.schedule.nextRunAt.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : "Sin próxima ejecución"} · {item.schedule?.timezone ?? "Europe/Madrid"}</small></span><span className={styles.statusCell} data-status={item.status}>{humanize(item.status)}</span></Link>)}</div>;
}

function AutomationInspector({ item, panel, href }: { item: AutomationItem; panel: string; href: (changes: Partial<SearchState>) => string }) {
  const version = item.currentVersion ?? item.versions[0];
  const draft = item.versions.find((entry) => entry.status === "draft");
  return <aside className={styles.inspector} data-automation-inspector>
    <header className={styles.inspectorHeader}><div><span className={styles.inspectorTitleIcon}><Workflow size={15} aria-hidden="true" /></span><h2>{item.name}</h2></div><span className={styles.statusCell} data-status={item.status}>{humanize(item.status)}</span><Link href={`/automatizaciones/${item.id}`} title="Configuración completa"><MoreHorizontal size={16} aria-hidden="true" /><span className={styles.srOnly}>Configuración completa</span></Link></header>
    <nav className={styles.inspectorTabs} aria-label="Detalle de automatización">{panelTabs.map(([id, label]) => <Link key={id} href={href({ seleccionado: item.id, panel: id })} aria-current={panel === id ? "page" : undefined}>{label}</Link>)}</nav>
    <div className={styles.inspectorBody}>
      {panel === "flujo" ? <FlowPanel item={item} version={version} /> : null}
      {panel === "configuracion" ? <ConfigurationPanel item={item} version={version} /> : null}
      {panel === "ejecuciones" ? <RunsPanel item={item} /> : null}
      {panel === "historial" ? <HistoryPanel item={item} /> : null}
      {panel === "auditoria" ? <AuditPanel item={item} /> : null}
    </div>
    <footer className={styles.inspectorActions}>
      {draft ? <form action={publishAutomationAction}><input type="hidden" name="versionId" value={draft.id} /><button className={styles.primaryAction}><Rocket size={14} aria-hidden="true" /> Publicar v{draft.version}</button></form> : null}
      <form action={runAutomationAction}><input type="hidden" name="id" value={item.id} /><input type="hidden" name="dryRun" value="true" /><button className={styles.secondaryAction}><TestTube2 size={14} aria-hidden="true" /> Probar flujo</button></form>
      <Link className={styles.secondaryAction} href={`/automatizaciones/${item.id}`}><Settings2 size={14} aria-hidden="true" /> Editar</Link>
    </footer>
  </aside>;
}

function FlowPanel({ item, version }: { item: AutomationItem; version: AutomationItem["currentVersion"] | AutomationItem["versions"][number] | null | undefined }) {
  if (!version) return <EmptyState title="Sin versión" description="Crea una versión para definir el flujo." />;
  return <section className={styles.flowPanel}><p className={styles.panelDescription}>{item.description || "Flujo sin descripción. Abre la configuración para documentar su objetivo."}</p><div className={styles.flowLine}>
    {version.triggers.length ? version.triggers.map((trigger) => <FlowStep key={trigger.id} icon={Zap} tone="green" type="Trigger" title={humanize(trigger.type)} detail={[trigger.eventType, trigger.entityType].filter(Boolean).map(humanize).join(" · ") || "Inicio controlado"} />) : <FlowStep icon={Zap} tone="muted" type="Trigger" title="Sin trigger" detail="Configura el origen del flujo" />}
    {version.conditions.length ? version.conditions.map((condition) => <FlowStep key={condition.id} icon={Filter} tone="orange" type="Condición" title={conditionLabel(condition)} detail={`Grupo ${condition.group + 1} · ${humanize(condition.operator)}`} />) : <FlowStep icon={Filter} tone="muted" type="Condición" title="Sin condición" detail="El trigger pasa directamente a la acción" />}
    {version.actions.map((action) => <FlowStep key={action.id} icon={Rocket} tone="blue" type="Acción" title={humanize(action.actionType)} detail={action.requiresConfirmation || version.requiresConfirmation ? "Confirmación humana obligatoria" : "Ejecución idempotente"} />)}
  </div>{version.actions.some((action) => action.requiresConfirmation) || version.requiresConfirmation ? <div className={styles.humanGate}><ShieldCheck size={17} aria-hidden="true" /><span><strong>Puerta de confirmación humana</strong><small>La acción queda en espera hasta una aprobación autorizada y auditada.</small></span></div> : <div className={styles.humanGate} data-passive="true"><GitBranch size={17} aria-hidden="true" /><span><strong>Sin confirmación por acción</strong><small>Los límites, el aislamiento de empresa y la idempotencia siguen activos.</small></span></div>}</section>;
}

function FlowStep({ icon: Icon, tone, type, title, detail }: { icon: typeof Zap; tone: string; type: string; title: string; detail: string }) {
  return <article className={styles.flowStep} data-tone={tone}><span><Icon size={17} aria-hidden="true" /></span><div><small>{type}</small><strong>{title}</strong><p>{detail}</p></div><span className={styles.flowState}>Configurado</span></article>;
}

function ConfigurationPanel({ item, version }: { item: AutomationItem; version: AutomationItem["currentVersion"] | AutomationItem["versions"][number] | null | undefined }) {
  const retry = jsonRecord(version?.retryPolicy);
  return <section className={styles.detailGrid}><Detail label="Versión" value={version ? `v${version.version} · ${humanize(version.status)}` : "Sin versión"} /><Detail label="Prioridad" value={String(item.priority)} /><Detail label="Timeout" value={version ? `${version.timeoutSeconds} s` : "—"} /><Detail label="Cooldown" value={version?.cooldownSeconds ? `${version.cooldownSeconds} s` : "Sin espera"} /><Detail label="Reintentos" value={retry.maxAttempts ? String(retry.maxAttempts) : "Política predeterminada"} /><Detail label="Confirmación" value={version?.requiresConfirmation ? "Obligatoria" : "Por acción"} /><Detail label="Deduplicación" value={version ? humanize(version.deduplicationStrategy) : "—"} /><Detail label="Próxima ejecución" value={formatDate(item.schedule?.nextRunAt)} /><Detail label="Zona horaria" value={item.schedule?.timezone ?? "Europe/Madrid"} /><Detail label="Programación" value={item.schedule?.active ? "Activa" : "Desactivada"} /></section>;
}

function RunsPanel({ item }: { item: AutomationItem }) {
  return item.runs.length ? <ol className={styles.eventList}>{item.runs.slice(0, 10).map((run) => <li key={run.id}><span className={styles.eventIcon} data-status={run.status}>{run.status === "completed" ? <Check size={13} aria-hidden="true" /> : run.status === "failed" ? <CircleAlert size={13} aria-hidden="true" /> : <Clock3 size={13} aria-hidden="true" />}</span><div><strong>{humanize(run.status)} · {run.dryRun ? "Prueba" : "Ejecución"}</strong><small>{formatDate(run.startedAt)} · intento {run.attemptCount}</small>{run.lastErrorSummary || run.errorSummary ? <p>{run.lastErrorSummary ?? run.errorSummary}</p> : null}</div><span>{run.durationMs === null ? "—" : `${run.durationMs} ms`}</span></li>)}</ol> : <EmptyState title="Sin ejecuciones" description="Usa Probar flujo para inspeccionar pasos sin mutaciones." />;
}

function HistoryPanel({ item }: { item: AutomationItem }) {
  return <ol className={styles.eventList}>{item.versions.map((version) => <li key={version.id}><span className={styles.eventIcon}><History size={13} aria-hidden="true" /></span><div><strong>Versión {version.version} · {humanize(version.status)}</strong><small>Creada {formatDate(version.createdAt)}{version.publishedAt ? ` · publicada ${formatDate(version.publishedAt)}` : ""}</small></div><span>{version.definitionHash.slice(0, 7)}</span></li>)}</ol>;
}

function AuditPanel({ item }: { item: AutomationItem }) {
  const events = item.runs.flatMap((run) => run.confirmations.map((confirmation) => ({ id: confirmation.id, title: "Confirmación registrada", detail: `${humanize(confirmation.actorType)} · ${confirmation.origin}`, date: confirmation.confirmedAt, correlation: confirmation.correlationId }))).sort((a, b) => b.date.getTime() - a.date.getTime());
  return <section><div className={styles.auditNotice}><ShieldCheck size={17} aria-hidden="true" /><p><strong>Aislamiento y trazabilidad</strong> Esta vista sólo incluye eventos vinculados a la empresa activa. No muestra payloads sensibles.</p></div>{events.length ? <ol className={styles.eventList}>{events.slice(0, 12).map((event) => <li key={event.id}><span className={styles.eventIcon}><Check size={13} aria-hidden="true" /></span><div><strong>{event.title}</strong><small>{event.detail} · {formatDate(event.date)}</small></div><span title={event.correlation}>ID {event.correlation.slice(-6)}</span></li>)}</ol> : <EmptyState title="Sin confirmaciones auditadas" description="Las aprobaciones humanas aparecerán aquí cuando existan." />}</section>;
}

function MetricCard({ icon: Icon, tone, label, value, note }: { icon: typeof Workflow; tone: string; label: string; value: string; note: string }) {
  return <article className={styles.metricCard} data-tone={tone}><span><Icon size={21} aria-hidden="true" /></span><div><p>{label}</p><strong>{value}</strong><small>{note}</small></div><BarChart3 size={38} aria-hidden="true" /></article>;
}

function Cell({ label, children }: { label: string; children: ReactNode }) { return <span className={styles.tableCell} data-label={label}>{children}</span>; }
function Detail({ label, value }: { label: string; value: string }) { return <article><span>{label}</span><strong>{value}</strong></article>; }

function safeValue(value: string | undefined, fallback: string) { return value?.slice(0, 80) || fallback; }
function unique(values: string[]) { return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "es")); }
function humanize(value: string | null | undefined) { return value ? value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toLocaleUpperCase("es")) : "—"; }
function conditionLabel(condition: { field: string; comparator: string; value: unknown }) { const value = typeof condition.value === "string" || typeof condition.value === "number" ? ` ${condition.value}` : ""; return `${humanize(condition.field)} · ${humanize(condition.comparator)}${value}`; }
function formatDate(value: Date | null | undefined) { return value ? value.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" }) : "Sin fecha"; }
function formatRelative(value: Date) { const minutes = Math.max(0, Math.round((Date.now() - value.getTime()) / 60_000)); if (minutes < 60) return `Hace ${minutes} min`; const hours = Math.round(minutes / 60); if (hours < 24) return `Hace ${hours} h`; return value.toLocaleDateString("es-ES", { day: "2-digit", month: "short" }); }
function jsonRecord(value: unknown): Record<string, string | number | boolean> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, string | number | boolean> : {}; }
function automationHref(state: SearchState) { const params = new URLSearchParams(); Object.entries(state).forEach(([key, value]) => { if (value && value !== "all") params.set(key, value); }); const query = params.toString(); return `/automatizaciones${query ? `?${query}` : ""}`; }
