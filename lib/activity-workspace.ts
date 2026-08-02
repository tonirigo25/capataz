import type { ActivityItem, ActivityPeriod } from "@/lib/activity";
import { getActivityFeed } from "@/lib/activity";
import { prisma } from "@/lib/prisma";

export type ActivitySection = "all" | "operational" | "updates" | "orders" | "incidents" | "milestones" | "files" | "comments";

export type WorkspaceActivityItem = ActivityItem & {
  section: Exclude<ActivitySection, "all">;
  workId: string | null;
  workTitle: string | null;
  actorName: string | null;
  tone: "green" | "blue" | "orange" | "red" | "violet" | "slate";
};

export type ActivityWorkspace = {
  items: WorkspaceActivityItem[];
  workOptions: Array<{ id: string; label: string }>;
  actorOptions: Array<{ id: string; label: string }>;
  activeSignals: Array<{ id: string; title: string; summary: string | null; href: string; workId: string | null; level: string }>;
};

export async function getActivityWorkspace(companyId: string, period: ActivityPeriod): Promise<ActivityWorkspace> {
  const since = periodStart(period);
  const [baseItems, tasks, signals, photos, works] = await Promise.all([
    getActivityFeed({ period }),
    prisma.task.findMany({
      where: { companyId, archivedAt: null, ...(since ? { updatedAt: { gte: since } } : {}) },
      select: { id: true, title: true, description: true, category: true, priority: true, status: true, workId: true, assigneeId: true, createdAt: true, updatedAt: true, completedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 40,
    }),
    prisma.businessSignalState.findMany({
      where: { companyId, status: "active" },
      select: { id: true, title: true, summary: true, level: true, workId: true, lastDetectedAt: true, lastPriority: true },
      orderBy: [{ lastPriority: "desc" }, { lastDetectedAt: "desc" }],
      take: 30,
    }),
    prisma.workPhoto.findMany({
      where: { work: { companyId }, ...(since ? { createdAt: { gte: since } } : {}) },
      select: { id: true, titulo: true, categoria: true, autor: true, createdAt: true, work: { select: { id: true, titulo: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.work.findMany({
      where: { companyId, archivada: false },
      select: { id: true, titulo: true },
      orderBy: { titulo: "asc" },
      take: 200,
    }),
  ]);

  const workMap = new Map(works.map((work) => [work.id, work.titulo]));
  const actorIds = new Set<string>();
  for (const item of baseItems) if (item.actor) actorIds.add(item.actor);
  for (const task of tasks) if (task.assigneeId) actorIds.add(task.assigneeId);
  const ids = [...actorIds];
  const [users, memberships] = await Promise.all([
    ids.length ? prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, displayName: true } }) : Promise.resolve([]),
    ids.length ? prisma.companyMembership.findMany({ where: { companyId, OR: [{ id: { in: ids } }, { userId: { in: ids } }] }, select: { id: true, userId: true, user: { select: { displayName: true } } } }) : Promise.resolve([]),
  ]);
  const actorMap = new Map(users.map((user) => [user.id, user.displayName]));
  for (const membership of memberships) {
    actorMap.set(membership.id, membership.user.displayName);
    actorMap.set(membership.userId, membership.user.displayName);
  }

  const items: WorkspaceActivityItem[] = baseItems.map((item) => {
    const workId = extractWorkId(item.href);
    return {
      ...item,
      section: sectionForBase(item),
      workId,
      workTitle: workId ? workMap.get(workId) ?? item.entity : null,
      actorName: item.actor ? actorMap.get(item.actor) ?? humanActor(item.actor) : null,
      tone: toneForBase(item),
    };
  });

  for (const task of tasks) {
    const isMilestone = /hito|milestone/i.test(task.category) || /hito|milestone/i.test(task.title);
    const completedMilestone = isMilestone && task.status === "completed";
    const workTitle = task.workId ? workMap.get(task.workId) ?? "Trabajo vinculado" : null;
    items.push({
      id: `task-${task.id}`,
      kind: "agenda",
      label: completedMilestone ? "Hito alcanzado" : "Orden de trabajo actualizada",
      title: task.title,
      detail: [workTitle, statusText(task.status), task.description].filter(Boolean).join(" · "),
      date: task.completedAt ?? task.updatedAt,
      entity: completedMilestone ? "Hito" : "Orden de trabajo",
      href: `/tareas/${task.id}`,
      actor: task.assigneeId,
      actorName: task.assigneeId ? actorMap.get(task.assigneeId) ?? humanActor(task.assigneeId) : null,
      section: completedMilestone ? "milestones" : "orders",
      workId: task.workId,
      workTitle,
      tone: completedMilestone ? "green" : task.status === "blocked" ? "red" : "orange",
    });
  }

  for (const signal of signals) {
    const workTitle = signal.workId ? workMap.get(signal.workId) ?? "Trabajo vinculado" : null;
    items.push({
      id: `signal-${signal.id}`,
      kind: "nota",
      label: "Incidencia operativa detectada",
      title: signal.title,
      detail: [workTitle, signal.summary].filter(Boolean).join(" · "),
      date: signal.lastDetectedAt,
      entity: "Incidencia",
      href: signal.workId ? `/obras/${signal.workId}/incidencias` : `/alertas?seleccion=${encodeURIComponent(signal.id)}`,
      actorName: null,
      section: "incidents",
      workId: signal.workId,
      workTitle,
      tone: signal.level === "critico" ? "red" : "orange",
    });
  }

  for (const photo of photos) {
    items.push({
      id: `photo-${photo.id}`,
      kind: "documento",
      label: "Archivo adjunto",
      title: photo.titulo,
      detail: `${photo.categoria} · ${photo.work.titulo}`,
      date: photo.createdAt,
      entity: "Archivo de obra",
      href: `/obras/${photo.work.id}/actividad/galeria`,
      actor: photo.autor,
      actorName: photo.autor ? humanActor(photo.autor) : null,
      section: "files",
      workId: photo.work.id,
      workTitle: photo.work.titulo,
      tone: "slate",
    });
  }

  const deduped = [...new Map(items.map((item) => [item.id, item])).values()]
    .filter((item) => (since ? item.date >= since : true))
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 160);

  const actorOptions = [...new Map(deduped.filter((item) => item.actor && item.actorName).map((item) => [item.actor as string, { id: item.actor as string, label: item.actorName as string }])).values()]
    .sort((a, b) => a.label.localeCompare(b.label, "es"));

  return {
    items: deduped,
    workOptions: works.map((work) => ({ id: work.id, label: work.titulo })),
    actorOptions,
    activeSignals: signals.map((signal) => ({
      id: signal.id,
      title: signal.title,
      summary: signal.summary,
      href: signal.workId ? `/obras/${signal.workId}/incidencias` : `/alertas?seleccion=${encodeURIComponent(signal.id)}`,
      workId: signal.workId,
      level: signal.level,
    })),
  };
}

function sectionForBase(item: ActivityItem): WorkspaceActivityItem["section"] {
  if (item.kind === "documento") return "files";
  if (item.kind === "nota") return "comments";
  if (item.kind === "obra" && /actualiz/i.test(item.label)) return "updates";
  if (item.kind === "cliente" || item.kind === "contacto" || item.kind === "presupuesto" || item.kind === "factura" || item.kind === "pago" || item.kind === "gasto") return "updates";
  return "operational";
}

function toneForBase(item: ActivityItem): WorkspaceActivityItem["tone"] {
  if (item.kind === "obra" || item.kind === "agenda") return "green";
  if (item.kind === "nota") return "violet";
  if (item.kind === "documento") return "slate";
  if (item.kind === "gasto" || item.kind === "factura" || item.kind === "pago") return "orange";
  return "blue";
}

function periodStart(period: ActivityPeriod) {
  if (period === "todo") return null;
  const days = period === "7d" ? 7 : period === "90d" ? 90 : 30;
  const value = new Date();
  value.setDate(value.getDate() - days);
  value.setHours(0, 0, 0, 0);
  return value;
}

function extractWorkId(href: string) {
  return href.match(/^\/obras\/([^/?#]+)/)?.[1] ?? null;
}

function humanActor(value: string) {
  return value.includes(" ") && value.length < 80 ? value : null;
}

function statusText(status: string) {
  return status.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}
