import type { TaskPriority, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
export async function createTask(input: {
  title: string;
  description?: string;
  priority?: TaskPriority;
  dueAt?: Date;
  origin?: string;
  automationRunId?: string;
  clientId?: string;
  workId?: string;
  invoiceId?: string;
  budgetId?: string;
  requiresConfirmation?: boolean;
  parentTaskId?: string;
  assigneeId?: string;
}) {
  return prisma.task.create({
    data: {
      ...input,
      status: input.requiresConfirmation ? "inbox" : "planned",
    },
  });
}
export async function changeTaskStatus(
  id: string,
  status: TaskStatus,
  actorId?: string,
  reason?: string,
) {
  return prisma.$transaction(async (tx) => {
    const task = await tx.task.findUniqueOrThrow({ where: { id } });
    const updated = await tx.task.update({
      where: { id },
      data: {
        status,
        completedAt: status === "completed" ? new Date() : task.completedAt,
        cancelledAt: status === "cancelled" ? new Date() : task.cancelledAt,
        blockedReason: status === "blocked" ? reason ?? "Bloqueada" : status === "planned" || status === "in_progress" ? null : task.blockedReason,
      },
    });
    await tx.taskStatusHistory.create({
      data: {
        taskId: id,
        previousStatus: task.status,
        newStatus: status,
        actorId,
        reason,
      },
    });
    return updated;
  });
}
export async function addTaskDependency(
  taskId: string,
  dependsOnTaskId: string,
  type = "finish_to_start",
) {
  if (taskId === dependsOnTaskId) throw new Error("TASK_DEPENDENCY_CYCLE");
  const dependencies = await prisma.taskDependency.findMany({
    select: { taskId: true, dependsOnTaskId: true },
  });
  const graph = new Map<string, string[]>();
  for (const edge of dependencies)
    graph.set(edge.taskId, [
      ...(graph.get(edge.taskId) ?? []),
      edge.dependsOnTaskId,
    ]);
  graph.set(taskId, [...(graph.get(taskId) ?? []), dependsOnTaskId]);
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const cyclic = (node: string): boolean => {
    if (visiting.has(node)) return true;
    if (visited.has(node)) return false;
    visiting.add(node);
    for (const next of graph.get(node) ?? []) if (cyclic(next)) return true;
    visiting.delete(node);
    visited.add(node);
    return false;
  };
  if ([...graph.keys()].some(cyclic)) throw new Error("TASK_DEPENDENCY_CYCLE");
  return prisma.taskDependency.create({
    data: { taskId, dependsOnTaskId, type },
  });
}

export async function addChecklistItem(taskId: string, title: string) {
  const last = await prisma.taskChecklistItem.aggregate({
    where: { taskId },
    _max: { order: true },
  });
  return prisma.taskChecklistItem.create({
    data: { taskId, title, order: (last._max.order ?? -1) + 1 },
  });
}
export async function toggleChecklistItem(
  id: string,
  completed: boolean,
  actorId?: string,
) {
  return prisma.taskChecklistItem.update({
    where: { id },
    data: {
      completed,
      completedAt: completed ? new Date() : null,
      completedBy: completed ? actorId : null,
    },
  });
}
export async function editTask(
  id: string,
  data: {
    title?: string;
    description?: string | null;
    dueAt?: Date | null;
    priority?: TaskPriority;
    assigneeId?: string | null;
    blockedReason?: string | null;
  },
) {
  return prisma.task.update({ where: { id }, data });
}
export async function archiveTask(id: string) {
  return prisma.task.update({
    where: { id },
    data: { status: "archived", archivedAt: new Date() },
  });
}
export async function addTaskComment(
  taskId: string,
  content: string,
  authorId?: string,
) {
  if (!content.trim()) throw new Error("TASK_COMMENT_REQUIRED");
  return prisma.taskComment.create({
    data: { taskId, content: content.trim(), authorId },
  });
}
export async function editChecklistItem(id: string, title: string) {
  if (!title.trim()) throw new Error("CHECKLIST_TITLE_REQUIRED");
  return prisma.taskChecklistItem.update({
    where: { id },
    data: { title: title.trim() },
  });
}
export async function moveChecklistItem(id: string, direction: "up" | "down") {
  return prisma.$transaction(async (tx) => {
    const item = await tx.taskChecklistItem.findUniqueOrThrow({
      where: { id },
    });
    const other = await tx.taskChecklistItem.findFirst({
      where: {
        taskId: item.taskId,
        order: direction === "up" ? { lt: item.order } : { gt: item.order },
      },
      orderBy: { order: direction === "up" ? "desc" : "asc" },
    });
    if (!other) return item;
    await tx.taskChecklistItem.update({
      where: { id: item.id },
      data: { order: other.order },
    });
    await tx.taskChecklistItem.update({
      where: { id: other.id },
      data: { order: item.order },
    });
    return item;
  });
}
export async function removeTaskDependency(id: string) {
  return prisma.taskDependency.delete({ where: { id } });
}
export async function createSubtask(
  parentTaskId: string,
  input: { title: string; dueAt?: Date },
) {
  let cursor: string | undefined = parentTaskId,
    depth = 0;
  const seen = new Set<string>();
  while (cursor) {
    if (seen.has(cursor) || depth >= 10)
      throw new Error("TASK_SUBTASK_DEPTH_EXCEEDED");
    seen.add(cursor);
    const parent: { parentTaskId: string | null } =
      await prisma.task.findUniqueOrThrow({
        where: { id: cursor },
        select: { parentTaskId: true },
      });
    cursor = parent.parentTaskId ?? undefined;
    depth++;
  }
  return createTask({ ...input, parentTaskId, origin: "subtask" });
}
