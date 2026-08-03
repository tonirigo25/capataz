"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CircleDot,
  Clock3,
  Filter,
  GitBranch,
  ListTree,
  LockKeyhole,
  Minus,
  Network,
  Plus,
  Search,
  Table2,
  X,
} from "lucide-react";

export type PlanningNetworkMode = "dependencies" | "critical-path";

export type PlanningNetworkTask = {
  id: string;
  code?: string | null;
  title: string;
  status: string;
  phase?: string | null;
  startsAt?: string | null;
  dueAt?: string | null;
  durationDays?: number | null;
  progress?: number | null;
  assigneeName?: string | null;
};

export type PlanningNetworkEdge = {
  id: string;
  predecessorTaskId: string;
  successorTaskId: string;
  type: string;
  lagDays?: number | null;
};

export type WorkPlanningNetworkProps = {
  mode: PlanningNetworkMode;
  workId: string;
  clientId?: string | null;
  tasks: PlanningNetworkTask[];
  edges: PlanningNetworkEdge[];
  canManage?: boolean;
};

type NetworkBuild = {
  validEdges: PlanningNetworkEdge[];
  invalidEdges: PlanningNetworkEdge[];
  levels: string[][];
  cycleTaskIds: string[];
  connectedTaskIds: Set<string>;
};

type CriticalPathResult =
  | {
      calculable: false;
      reason: string;
      taskIds: string[];
      edgeIds: Set<string>;
      durationDays: null;
      slackByTask: Map<string, number>;
    }
  | {
      calculable: true;
      reason: string;
      taskIds: string[];
      edgeIds: Set<string>;
      durationDays: number;
      slackByTask: Map<string, number>;
    };

const terminalStatuses = new Set(["completed", "cancelled", "archived"]);
const statusOrder = ["blocked", "in_progress", "planned", "inbox", "waiting", "completed", "cancelled", "archived"];

function buildNetwork(tasks: PlanningNetworkTask[], edges: PlanningNetworkEdge[]): NetworkBuild {
  const taskIds = new Set(tasks.map((task) => task.id));
  const validEdges = edges.filter(
    (edge) =>
      edge.predecessorTaskId !== edge.successorTaskId &&
      taskIds.has(edge.predecessorTaskId) &&
      taskIds.has(edge.successorTaskId),
  );
  const validEdgeIds = new Set(validEdges.map((edge) => edge.id));
  const invalidEdges = edges.filter((edge) => !validEdgeIds.has(edge.id));
  const connectedTaskIds = new Set(validEdges.flatMap((edge) => [edge.predecessorTaskId, edge.successorTaskId]));
  const indegree = new Map([...connectedTaskIds].map((id) => [id, 0]));
  const outgoing = new Map<string, string[]>();

  for (const edge of validEdges) {
    indegree.set(edge.successorTaskId, (indegree.get(edge.successorTaskId) ?? 0) + 1);
    outgoing.set(edge.predecessorTaskId, [...(outgoing.get(edge.predecessorTaskId) ?? []), edge.successorTaskId]);
  }

  const remaining = new Set(connectedTaskIds);
  const levels: string[][] = [];
  while (remaining.size) {
    const level = [...remaining].filter((id) => (indegree.get(id) ?? 0) === 0);
    if (!level.length) break;
    levels.push(level);
    for (const id of level) {
      remaining.delete(id);
      for (const successorId of outgoing.get(id) ?? []) {
        indegree.set(successorId, (indegree.get(successorId) ?? 0) - 1);
      }
    }
  }

  return { validEdges, invalidEdges, levels, cycleTaskIds: [...remaining], connectedTaskIds };
}

function calculateCriticalPath(tasks: PlanningNetworkTask[], network: NetworkBuild): CriticalPathResult {
  const empty = (reason: string): CriticalPathResult => ({
    calculable: false,
    reason,
    taskIds: [],
    edgeIds: new Set(),
    durationDays: null,
    slackByTask: new Map(),
  });

  if (!network.validEdges.length) return empty("No hay dependencias persistidas suficientes para calcular una ruta crítica.");
  if (network.invalidEdges.length) return empty("Hay dependencias incompletas o autorreferentes. Deben corregirse antes de calcular la ruta.");
  if (network.cycleTaskIds.length) return empty("La red contiene un ciclo. Una ruta crítica requiere un grafo acíclico confirmado.");

  const byId = new Map(tasks.map((task) => [task.id, task]));
  const connectedTasks = [...network.connectedTaskIds].map((id) => byId.get(id)).filter((task): task is PlanningNetworkTask => Boolean(task));
  const missingDuration = connectedTasks.filter(
    (task) => task.durationDays == null || !Number.isFinite(task.durationDays) || task.durationDays < 0,
  );
  if (missingDuration.length) {
    return empty(`Falta una duración validada en ${missingDuration.length} ${missingDuration.length === 1 ? "tarea" : "tareas"}. No se infiere desde fechas de calendario.`);
  }

  const durationByTask = new Map(connectedTasks.map((task) => [task.id, task.durationDays ?? 0]));
  const outgoing = new Map<string, PlanningNetworkEdge[]>();
  const topoOrder = network.levels.flat();
  for (const edge of network.validEdges) {
    outgoing.set(edge.predecessorTaskId, [...(outgoing.get(edge.predecessorTaskId) ?? []), edge]);
  }

  const earliestStart = new Map(topoOrder.map((id) => [id, 0]));
  const earliestFinish = new Map<string, number>();
  const previous = new Map<string, { taskId: string; edgeId: string }>();
  for (const id of topoOrder) {
    const finish = (earliestStart.get(id) ?? 0) + (durationByTask.get(id) ?? 0);
    earliestFinish.set(id, finish);
    for (const edge of outgoing.get(id) ?? []) {
      const candidate = finish + (Number.isFinite(edge.lagDays) ? edge.lagDays ?? 0 : 0);
      if (candidate > (earliestStart.get(edge.successorTaskId) ?? 0)) {
        earliestStart.set(edge.successorTaskId, candidate);
        previous.set(edge.successorTaskId, { taskId: id, edgeId: edge.id });
      }
    }
  }

  const projectDuration = Math.max(...earliestFinish.values());
  const latestStart = new Map<string, number>();
  const latestFinish = new Map<string, number>();
  for (const id of [...topoOrder].reverse()) {
    const successors = outgoing.get(id) ?? [];
    const finish = successors.length
      ? Math.min(
          ...successors.map(
            (edge) =>
              (latestStart.get(edge.successorTaskId) ?? projectDuration) -
              (Number.isFinite(edge.lagDays) ? edge.lagDays ?? 0 : 0),
          ),
        )
      : projectDuration;
    latestFinish.set(id, finish);
    latestStart.set(id, finish - (durationByTask.get(id) ?? 0));
  }

  const slackByTask = new Map(
    topoOrder.map((id) => [id, Math.max(0, (latestStart.get(id) ?? 0) - (earliestStart.get(id) ?? 0))]),
  );
  const criticalEdgeIds = new Set(
    network.validEdges
      .filter((edge) => {
        const lag = Number.isFinite(edge.lagDays) ? edge.lagDays ?? 0 : 0;
        return (
          (slackByTask.get(edge.predecessorTaskId) ?? 1) === 0 &&
          (slackByTask.get(edge.successorTaskId) ?? 1) === 0 &&
          Math.abs((earliestFinish.get(edge.predecessorTaskId) ?? 0) + lag - (earliestStart.get(edge.successorTaskId) ?? 0)) < 0.001
        );
      })
      .map((edge) => edge.id),
  );

  let endTaskId = topoOrder.reduce((best, id) =>
    (earliestFinish.get(id) ?? 0) > (earliestFinish.get(best) ?? -1) ? id : best,
  );
  const path = [endTaskId];
  while (previous.has(endTaskId)) {
    endTaskId = previous.get(endTaskId)!.taskId;
    path.unshift(endTaskId);
  }

  return {
    calculable: true,
    reason: "Calculada exclusivamente con las duraciones y dependencias recibidas.",
    taskIds: path,
    edgeIds: criticalEdgeIds,
    durationDays: projectDuration,
    slackByTask,
  };
}

function displayDate(value?: string | null) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Fecha inválida"
    : new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    inbox: "Entrada",
    planned: "Planificada",
    in_progress: "En curso",
    blocked: "Bloqueada",
    waiting: "En espera",
    completed: "Completada",
    cancelled: "Cancelada",
    archived: "Archivada",
  };
  return labels[status] ?? status.replaceAll("_", " ");
}

function edgeTypeLabel(type: string) {
  const labels: Record<string, string> = {
    finish_to_start: "Fin → inicio",
    finish_to_finish: "Fin → fin",
    start_to_start: "Inicio → inicio",
    start_to_finish: "Inicio → fin",
  };
  return labels[type] ?? type.replaceAll("_", " ");
}

function statusClasses(status: string) {
  if (status === "blocked") return "border-danger/40 bg-danger/5 text-danger";
  if (status === "completed") return "border-success/40 bg-success/5 text-success";
  if (status === "in_progress") return "border-brand/40 bg-brand-soft/50 text-brand-strong";
  return "border-border bg-surface text-content-secondary";
}

function NetworkMetric({ label, value, detail, tone = "neutral" }: { label: string; value: string; detail: string; tone?: "neutral" | "success" | "danger" | "warning" }) {
  const valueClass = tone === "danger" ? "text-danger" : tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-content";
  return (
    <article className="min-w-0 rounded-xl border border-border bg-surface p-3.5">
      <span className="block text-[10px] font-semibold text-content-secondary">{label}</span>
      <strong className={`mt-2 block truncate text-xl font-black tabular-nums ${valueClass}`}>{value}</strong>
      <small className="mt-1 block text-[9px] leading-4 text-content-tertiary">{detail}</small>
    </article>
  );
}

export function WorkPlanningNetwork({ mode, workId, clientId, tasks, edges, canManage = false }: WorkPlanningNetworkProps) {
  const [view, setView] = useState<"graph" | "table">(mode === "critical-path" ? "table" : "graph");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [zoom, setZoom] = useState(1);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [criticalOnly, setCriticalOnly] = useState(mode === "critical-path");

  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const codeById = useMemo(
    () => new Map(tasks.map((task, index) => [task.id, task.code?.trim() || `T-${String(index + 1).padStart(3, "0")}`])),
    [tasks],
  );
  const network = useMemo(() => buildNetwork(tasks, edges), [tasks, edges]);
  const criticalPath = useMemo(() => calculateCriticalPath(tasks, network), [tasks, network]);

  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const taskMatches = (task: PlanningNetworkTask) => {
      const queryMatches = !normalizedQuery || `${codeById.get(task.id) ?? ""} ${task.title}`.toLowerCase().includes(normalizedQuery);
      const statusMatches = status === "all" || task.status === status;
      return queryMatches && statusMatches;
    };
    let visibleEdges = network.validEdges.filter((edge) => {
      const predecessor = taskById.get(edge.predecessorTaskId);
      const successor = taskById.get(edge.successorTaskId);
      return Boolean(predecessor && successor && (taskMatches(predecessor) || taskMatches(successor)));
    });
    if (criticalOnly && criticalPath.calculable) visibleEdges = visibleEdges.filter((edge) => criticalPath.edgeIds.has(edge.id));
    const edgeTaskIds = new Set(visibleEdges.flatMap((edge) => [edge.predecessorTaskId, edge.successorTaskId]));
    const visibleTasks = tasks.filter((task) => edgeTaskIds.has(task.id) || (!criticalOnly && taskMatches(task)));
    return { tasks: visibleTasks, edges: visibleEdges, network: buildNetwork(visibleTasks, visibleEdges) };
  }, [codeById, criticalOnly, criticalPath, network.validEdges, query, status, taskById, tasks]);

  const selectedTask = selectedTaskId ? taskById.get(selectedTaskId) ?? null : null;
  const selectedPredecessors = selectedTask
    ? network.validEdges.filter((edge) => edge.successorTaskId === selectedTask.id)
    : [];
  const selectedSuccessors = selectedTask
    ? network.validEdges.filter((edge) => edge.predecessorTaskId === selectedTask.id)
    : [];
  const connectedCount = network.connectedTaskIds.size;
  const blockedCount = tasks.filter((task) => task.status === "blocked").length;
  const criticalCount = criticalPath.calculable ? criticalPath.taskIds.length : 0;
  const graphColumns = visible.network.levels.length ? visible.network.levels : [visible.tasks.map((task) => task.id)];
  const nodeWidth = Math.round(184 * zoom);

  return (
    <div className="grid min-w-0 gap-3">
      <section className="grid grid-cols-2 gap-2 lg:grid-cols-5" aria-label="Indicadores de la red de planificación">
        <NetworkMetric label="Tareas totales" value={String(tasks.length)} detail="Vinculadas a esta obra" />
        <NetworkMetric label="Con dependencias" value={String(connectedCount)} detail={`${network.validEdges.length} relaciones persistidas`} />
        <NetworkMetric
          label="Ruta crítica"
          value={criticalPath.calculable ? `${criticalCount} tareas` : "—"}
          detail={criticalPath.calculable ? `${criticalPath.durationDays} días validados` : "No calculable todavía"}
          tone={criticalPath.calculable ? "danger" : "neutral"}
        />
        <NetworkMetric label="Bloqueadas" value={String(blockedCount)} detail="Estado real de tareas" tone={blockedCount ? "warning" : "success"} />
        <NetworkMetric
          label="Red válida"
          value={network.cycleTaskIds.length || network.invalidEdges.length ? "No" : "Sí"}
          detail={network.cycleTaskIds.length ? "Ciclo detectado" : network.invalidEdges.length ? "Relaciones incompletas" : "Sin aristas ficticias"}
          tone={network.cycleTaskIds.length || network.invalidEdges.length ? "danger" : "success"}
        />
      </section>

      {mode === "critical-path" || !criticalPath.calculable ? (
        <section className={`flex items-start gap-3 rounded-xl border p-3.5 ${criticalPath.calculable ? "border-success/30 bg-success/5" : "border-warning/35 bg-warning/5"}`}>
          {criticalPath.calculable ? <CheckCircle2 className="mt-0.5 shrink-0 text-success" size={18} aria-hidden="true" /> : <AlertTriangle className="mt-0.5 shrink-0 text-warning" size={18} aria-hidden="true" />}
          <div className="min-w-0">
            <strong className="block text-xs text-content">{criticalPath.calculable ? "Ruta crítica calculable con los datos actuales" : "Ruta crítica no calculable de forma fiable"}</strong>
            <p className="mt-1 text-[10px] leading-5 text-content-secondary">{criticalPath.reason}</p>
          </div>
        </section>
      ) : null}

      {criticalPath.calculable && mode === "critical-path" ? (
        <section className="overflow-x-auto rounded-xl border border-border bg-surface p-3" tabIndex={0} aria-label="Cadena crítica principal">
          <div className="flex min-w-max items-center gap-2">
            {criticalPath.taskIds.map((taskId, index) => {
              const task = taskById.get(taskId);
              if (!task) return null;
              return (
                <div key={taskId} className="contents">
                  {index ? <ArrowRight size={15} className="shrink-0 text-danger" aria-hidden="true" /> : null}
                  <button type="button" onClick={() => setSelectedTaskId(taskId)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-danger/30 bg-danger/5 px-3 text-left text-[10px] font-bold text-content hover:border-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger">
                    <span className="text-danger">{codeById.get(taskId)}</span>
                    <span>{task.title}</span>
                  </button>
                </div>
              );
            })}
            <span className="ml-2 rounded-full bg-danger/10 px-3 py-2 text-[10px] font-bold text-danger">{criticalPath.durationDays} días</span>
          </div>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-soft">
        <div className="flex flex-col gap-3 border-b border-border p-3 md:flex-row md:items-center">
          <div className="inline-flex min-h-11 w-fit rounded-lg border border-border bg-subtle p-1" aria-label="Presentación de dependencias">
            <button type="button" onClick={() => setView("graph")} aria-pressed={view === "graph"} className={`inline-flex min-h-9 items-center gap-2 rounded-md px-3 text-[10px] font-bold ${view === "graph" ? "bg-brand text-white" : "text-content-secondary hover:bg-surface"}`}><Network size={15} aria-hidden="true" /> Grafo</button>
            <button type="button" onClick={() => setView("table")} aria-pressed={view === "table"} className={`inline-flex min-h-9 items-center gap-2 rounded-md px-3 text-[10px] font-bold ${view === "table" ? "bg-brand text-white" : "text-content-secondary hover:bg-surface"}`}><Table2 size={15} aria-hidden="true" /> Tabla</button>
          </div>

          <label className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg border border-border px-3 text-content-secondary md:max-w-sm">
            <Search size={15} className="shrink-0" aria-hidden="true" />
            <span className="sr-only">Buscar tarea o código</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 border-0 bg-transparent text-xs text-content outline-none" placeholder="Buscar tarea o código…" />
          </label>

          <label className="flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-[10px] font-semibold text-content-secondary">
            <Filter size={15} aria-hidden="true" />
            <span className="sr-only">Filtrar por estado</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="border-0 bg-transparent text-content outline-none">
              <option value="all">Todos los estados</option>
              {statusOrder.filter((item) => tasks.some((task) => task.status === item)).map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}
            </select>
          </label>

          <label className={`inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-[10px] font-bold ${criticalPath.calculable ? "cursor-pointer border-border text-content" : "cursor-not-allowed border-border bg-subtle text-content-tertiary"}`}>
            <input type="checkbox" checked={criticalOnly && criticalPath.calculable} disabled={!criticalPath.calculable} onChange={(event) => setCriticalOnly(event.target.checked)} className="h-4 w-4 accent-brand" />
            Sólo críticas
          </label>
        </div>

        <div className="grid min-w-0 xl:grid-cols-[minmax(0,1fr)_19rem]">
          <div className="min-w-0 border-border xl:border-r">
            {view === "graph" ? (
              <div className="relative min-w-0 overflow-x-auto p-3" tabIndex={0} aria-label="Grafo desplazable de dependencias reales">
                <div className="absolute left-5 top-5 z-10 grid rounded-lg border border-border bg-surface shadow-soft">
                  <button type="button" className="inline-flex min-h-11 min-w-11 items-center justify-center border-b border-border" onClick={() => setZoom((value) => Math.min(1.35, Number((value + 0.1).toFixed(2))))} aria-label="Acercar grafo"><Plus size={16} /></button>
                  <button type="button" className="inline-flex min-h-11 min-w-11 items-center justify-center" onClick={() => setZoom((value) => Math.max(0.75, Number((value - 0.1).toFixed(2))))} aria-label="Alejar grafo"><Minus size={16} /></button>
                </div>

                {visible.tasks.length ? (
                  <div className="flex min-h-[28rem] min-w-max items-start gap-8 px-16 py-5">
                    {graphColumns.map((column, columnIndex) => (
                      <section key={`${columnIndex}-${column.join("-")}`} className="grid content-start gap-3" style={{ width: nodeWidth }} aria-label={`Nivel ${columnIndex + 1} de la red`}>
                        <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-content-tertiary">Nivel {String(columnIndex + 1).padStart(2, "0")}</span>
                        {column.map((taskId) => {
                          const task = taskById.get(taskId);
                          if (!task) return null;
                          const outgoing = visible.edges.filter((edge) => edge.predecessorTaskId === taskId);
                          const isCritical = criticalPath.calculable && criticalPath.taskIds.includes(taskId);
                          return (
                            <article key={taskId} className={`rounded-xl border bg-surface p-3 shadow-sm ${selectedTaskId === taskId ? "ring-2 ring-brand" : ""} ${isCritical ? "border-danger/60" : task.status === "blocked" ? "border-warning/60" : "border-border"}`}>
                              <button type="button" onClick={() => setSelectedTaskId(taskId)} className="block min-h-11 w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
                                <span className="flex items-center justify-between gap-2">
                                  <strong className="text-[10px] text-content">{codeById.get(taskId)}</strong>
                                  <span className={`rounded-full border px-2 py-1 text-[8px] font-bold ${statusClasses(task.status)}`}>{statusLabel(task.status)}</span>
                                </span>
                                <span className="mt-2 block text-xs font-black leading-5 text-content">{task.title}</span>
                                <span className="mt-2 flex items-center justify-between gap-2 text-[9px] text-content-secondary"><span>{displayDate(task.startsAt)}</span><span>{task.progress == null ? "Sin avance" : `${Math.max(0, Math.min(100, task.progress))}%`}</span></span>
                              </button>
                              {outgoing.length ? <div className="mt-3 grid gap-1.5 border-t border-border pt-2" aria-label="Sucesoras reales">{outgoing.map((edge) => <button type="button" key={edge.id} onClick={() => setSelectedTaskId(edge.successorTaskId)} className={`flex min-h-9 items-center gap-1.5 rounded-md px-2 text-left text-[8px] font-semibold hover:bg-subtle ${criticalPath.calculable && criticalPath.edgeIds.has(edge.id) ? "text-danger" : "text-brand-strong"}`}><ArrowRight size={12} className="shrink-0" aria-hidden="true" /><span className="truncate">{codeById.get(edge.successorTaskId)} · {edgeTypeLabel(edge.type)}</span></button>)}</div> : null}
                            </article>
                          );
                        })}
                      </section>
                    ))}
                    {visible.network.cycleTaskIds.length ? (
                      <section className="w-48 rounded-xl border border-danger/40 bg-danger/5 p-3">
                        <AlertTriangle size={18} className="text-danger" aria-hidden="true" />
                        <strong className="mt-2 block text-xs text-content">Ciclo detectado</strong>
                        <p className="mt-1 text-[9px] leading-4 text-content-secondary">Estas tareas no pueden ordenarse hasta corregir sus dependencias.</p>
                        <ul className="mt-2 grid gap-1 text-[9px] font-semibold text-danger">{visible.network.cycleTaskIds.map((id) => <li key={id}>{codeById.get(id)} · {taskById.get(id)?.title}</li>)}</ul>
                      </section>
                    ) : null}
                  </div>
                ) : (
                  <NetworkEmpty canManage={canManage} workId={workId} clientId={clientId} />
                )}
              </div>
            ) : (
              <DependencyTable
                tasks={visible.tasks}
                edges={visible.edges}
                taskById={taskById}
                codeById={codeById}
                criticalPath={criticalPath}
                onSelect={setSelectedTaskId}
              />
            )}
          </div>

          <aside className="min-w-0 bg-subtle/60 p-4" aria-label="Inspector de dependencias">
            <div className="flex min-h-11 items-center gap-2 border-b border-border pb-3">
              <GitBranch size={17} className="text-brand-strong" aria-hidden="true" />
              <h2 className="text-xs font-black text-content">Inspector de dependencias</h2>
              {selectedTask ? <button type="button" onClick={() => setSelectedTaskId(null)} className="ml-auto inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-surface" aria-label="Cerrar inspector"><X size={16} /></button> : null}
            </div>
            {selectedTask ? (
              <div className="mt-4 grid gap-3">
                <div className="rounded-xl border border-border bg-surface p-3">
                  <div className="flex items-center justify-between gap-2"><strong className="text-xs text-content">{codeById.get(selectedTask.id)}</strong><span className={`rounded-full border px-2 py-1 text-[8px] font-bold ${statusClasses(selectedTask.status)}`}>{statusLabel(selectedTask.status)}</span></div>
                  <h3 className="mt-2 text-sm font-black leading-5 text-content">{selectedTask.title}</h3>
                  <dl className="mt-3 grid gap-2 text-[10px]">
                    <InspectorRow label="Inicio" value={displayDate(selectedTask.startsAt)} />
                    <InspectorRow label="Fin" value={displayDate(selectedTask.dueAt)} />
                    <InspectorRow label="Duración validada" value={selectedTask.durationDays == null ? "No registrada" : `${selectedTask.durationDays} días`} />
                    <InspectorRow label="Holgura calculada" value={criticalPath.calculable ? `${criticalPath.slackByTask.get(selectedTask.id) ?? 0} días` : "No calculable"} />
                  </dl>
                </div>
                <RelationshipList title={`Predecesoras (${selectedPredecessors.length})`} edges={selectedPredecessors} taskIdKey="predecessorTaskId" taskById={taskById} codeById={codeById} onSelect={setSelectedTaskId} />
                <RelationshipList title={`Sucesoras (${selectedSuccessors.length})`} edges={selectedSuccessors} taskIdKey="successorTaskId" taskById={taskById} codeById={codeById} onSelect={setSelectedTaskId} />
                <Link href={`/tareas/${selectedTask.id}`} className="secondary-button w-full justify-center">Abrir tarea</Link>
                <Link href={`/obras/${workId}/planificacion/gantt`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg text-xs font-bold text-brand-strong hover:bg-brand-soft"><CalendarDays size={15} aria-hidden="true" /> Ver en Gantt</Link>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-border bg-surface p-4">
                <CircleDot size={20} className="text-brand-strong" aria-hidden="true" />
                <strong className="mt-3 block text-xs text-content">Selecciona una tarea</strong>
                <p className="mt-2 text-[10px] leading-5 text-content-secondary">El inspector mostrará únicamente predecesoras, sucesoras, fechas y holguras sustentadas por los datos recibidos.</p>
              </div>
            )}
          </aside>
        </div>

        <footer className="flex flex-wrap items-center gap-3 border-t border-border px-4 py-3 text-[9px] text-content-secondary">
          <span className="inline-flex items-center gap-1.5"><GitBranch size={12} className="text-brand-strong" aria-hidden="true" /> {network.validEdges.length} dependencias reales</span>
          <span className="inline-flex items-center gap-1.5"><Clock3 size={12} className="text-warning" aria-hidden="true" /> {tasks.filter((task) => !terminalStatuses.has(task.status)).length} tareas activas</span>
          <span className="inline-flex items-center gap-1.5"><LockKeyhole size={12} className="text-success" aria-hidden="true" /> Sin conexiones consecutivas inferidas</span>
          {canManage ? <Link href={`/tareas?nuevo=1&workId=${workId}${clientId ? `&clientId=${clientId}` : ""}`} className="primary-button ml-auto">Nueva tarea</Link> : null}
        </footer>
      </section>
    </div>
  );
}

function DependencyTable({ tasks, edges, taskById, codeById, criticalPath, onSelect }: {
  tasks: PlanningNetworkTask[];
  edges: PlanningNetworkEdge[];
  taskById: Map<string, PlanningNetworkTask>;
  codeById: Map<string, string>;
  criticalPath: CriticalPathResult;
  onSelect: (taskId: string) => void;
}) {
  if (!edges.length) return <NetworkEmpty canManage={false} workId="" />;
  return (
    <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Tabla desplazable de dependencias reales">
      <table className="w-full min-w-[58rem] border-collapse text-left text-[10px]">
        <thead className="border-b border-border bg-subtle text-content-secondary">
          <tr><th className="px-3 py-3">Código</th><th className="px-3 py-3">Predecesora</th><th className="px-3 py-3">Sucesora</th><th className="px-3 py-3">Tipo</th><th className="px-3 py-3">Desfase</th><th className="px-3 py-3">Inicio sucesora</th><th className="px-3 py-3">Fin sucesora</th><th className="px-3 py-3">Estado</th><th className="px-3 py-3">Ruta</th></tr>
        </thead>
        <tbody className="divide-y divide-border">
          {edges.map((edge, index) => {
            const predecessor = taskById.get(edge.predecessorTaskId);
            const successor = taskById.get(edge.successorTaskId);
            if (!predecessor || !successor) return null;
            const isCritical = criticalPath.calculable && criticalPath.edgeIds.has(edge.id);
            return (
              <tr key={edge.id} className="hover:bg-subtle/70">
                <td className="px-3 py-2.5 font-bold text-content">D-{String(index + 1).padStart(3, "0")}</td>
                <td className="px-3 py-2.5"><button type="button" onClick={() => onSelect(predecessor.id)} className="min-h-11 text-left font-semibold text-content hover:underline">{codeById.get(predecessor.id)} · {predecessor.title}</button></td>
                <td className="px-3 py-2.5"><button type="button" onClick={() => onSelect(successor.id)} className="min-h-11 text-left font-semibold text-content hover:underline">{codeById.get(successor.id)} · {successor.title}</button></td>
                <td className="px-3 py-2.5 text-content-secondary">{edgeTypeLabel(edge.type)}</td>
                <td className="px-3 py-2.5 tabular-nums text-content-secondary">{edge.lagDays == null ? "0 días" : `${edge.lagDays} días`}</td>
                <td className="px-3 py-2.5 text-content-secondary">{displayDate(successor.startsAt)}</td>
                <td className="px-3 py-2.5 text-content-secondary">{displayDate(successor.dueAt)}</td>
                <td className="px-3 py-2.5"><span className={`rounded-full border px-2 py-1 text-[8px] font-bold ${statusClasses(successor.status)}`}>{statusLabel(successor.status)}</span></td>
                <td className="px-3 py-2.5">{isCritical ? <span className="inline-flex items-center gap-1 rounded-full bg-danger/10 px-2 py-1 font-bold text-danger"><AlertTriangle size={11} aria-hidden="true" /> Crítica</span> : <span className="text-content-tertiary">No crítica</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="border-t border-border px-3 py-3 text-[9px] text-content-secondary">Mostrando {edges.length} relaciones entre {tasks.length} tareas visibles.</p>
    </div>
  );
}

function RelationshipList({ title, edges, taskIdKey, taskById, codeById, onSelect }: {
  title: string;
  edges: PlanningNetworkEdge[];
  taskIdKey: "predecessorTaskId" | "successorTaskId";
  taskById: Map<string, PlanningNetworkTask>;
  codeById: Map<string, string>;
  onSelect: (taskId: string) => void;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface p-3">
      <h3 className="text-[10px] font-black text-content">{title}</h3>
      {edges.length ? <div className="mt-2 grid gap-1">{edges.map((edge) => {
        const taskId = edge[taskIdKey];
        const task = taskById.get(taskId);
        if (!task) return null;
        return <button type="button" key={edge.id} onClick={() => onSelect(taskId)} className="flex min-h-11 items-center justify-between gap-2 rounded-lg px-2 text-left text-[9px] hover:bg-subtle"><span className="min-w-0"><strong className="block truncate text-content">{codeById.get(taskId)} · {task.title}</strong><span className="mt-0.5 block text-content-secondary">{edgeTypeLabel(edge.type)}</span></span><ArrowRight size={13} className="shrink-0 text-brand-strong" aria-hidden="true" /></button>;
      })}</div> : <p className="mt-2 text-[9px] leading-4 text-content-secondary">Ninguna relación registrada.</p>}
    </section>
  );
}

function InspectorRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-3 border-b border-border pb-2 last:border-0 last:pb-0"><dt className="text-content-secondary">{label}</dt><dd className="text-right font-bold text-content">{value}</dd></div>;
}

function NetworkEmpty({ canManage, workId, clientId }: { canManage: boolean; workId: string; clientId?: string | null }) {
  return (
    <div className="grid min-h-[22rem] place-content-center p-6 text-center">
      <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-brand-strong"><ListTree size={21} aria-hidden="true" /></span>
      <strong className="mt-4 text-sm text-content">Sin una red visible</strong>
      <p className="mx-auto mt-2 max-w-md text-[10px] leading-5 text-content-secondary">Registra y confirma dependencias entre tareas reales. Esta pantalla no conecta tareas consecutivas por apariencia.</p>
      {canManage && workId ? <Link href={`/tareas?nuevo=1&workId=${workId}${clientId ? `&clientId=${clientId}` : ""}`} className="primary-button mx-auto mt-4">Gestionar tareas</Link> : null}
    </div>
  );
}
