"use server";
import { revalidatePath } from "next/cache";
import {
  createTask,
  changeTaskStatus,
  addChecklistItem,
  toggleChecklistItem,
  editTask,
  archiveTask,
  addTaskComment,
  editChecklistItem,
  moveChecklistItem,
  addTaskDependency,
  removeTaskDependency,
  createSubtask,
} from "@/lib/tasks/task-engine";
import {
  parseRRule,
  nextOccurrence,
  editTaskSeries,
} from "@/lib/tasks/task-recurrence";
import { prisma } from "@/lib/prisma";
export async function createTaskAction(data: FormData) {
  const title = String(data.get("title") ?? "").trim();
  if (!title) return;
  await createTask({
    title,
    description: String(data.get("description") ?? "") || undefined,
    dueAt: data.get("dueAt") ? new Date(String(data.get("dueAt"))) : undefined,
    priority: String(data.get("priority") ?? "medium") as
      | "low"
      | "medium"
      | "high"
      | "urgent",
  });
  revalidatePath("/tareas");
  revalidatePath("/hoy");
}
export async function completeTaskAction(data: FormData) {
  await changeTaskStatus(
    String(data.get("id")),
    "completed",
    "user",
    "Completada desde Tareas",
  );
  revalidatePath("/tareas");
  revalidatePath("/hoy");
}
export async function addChecklistAction(data: FormData) {
  const title = String(data.get("title") ?? "").trim();
  if (title) await addChecklistItem(String(data.get("taskId")), title);
  revalidatePath("/tareas");
}
export async function toggleChecklistAction(data: FormData) {
  await toggleChecklistItem(
    String(data.get("id")),
    data.get("completed") !== "true",
    "user",
  );
  revalidatePath("/tareas");
}
export async function updateTaskAction(data: FormData) {
  await editTask(String(data.get("id")), {
    title: String(data.get("title") ?? "").trim() || undefined,
    description: String(data.get("description") ?? "").trim() || null,
    priority: String(data.get("priority")) as
      | "low"
      | "medium"
      | "high"
      | "urgent",
    dueAt: data.get("dueAt") ? new Date(String(data.get("dueAt"))) : null,
    assigneeId: String(data.get("assigneeId") ?? "").trim() || null,
  });
  revalidatePath("/tareas");
  revalidatePath(`/tareas/${String(data.get("id"))}`);
}
export async function archiveTaskAction(data: FormData) {
  await archiveTask(String(data.get("id")));
  revalidatePath("/tareas");
}
const refresh = (id: string) => {
  revalidatePath("/tareas");
  revalidatePath(`/tareas/${id}`);
  revalidatePath("/hoy");
};
export async function changeTaskStatusAction(data: FormData) {
  const id = String(data.get("id"));
  await changeTaskStatus(
    id,
    String(data.get("status")) as never,
    "user",
    String(data.get("reason") ?? "") || undefined,
  );
  refresh(id);
}
export async function addTaskCommentAction(data: FormData) {
  const id = String(data.get("taskId"));
  await addTaskComment(id, String(data.get("content") ?? ""), "user");
  refresh(id);
}
export async function editChecklistAction(data: FormData) {
  const taskId = String(data.get("taskId"));
  await editChecklistItem(
    String(data.get("id")),
    String(data.get("title") ?? ""),
  );
  refresh(taskId);
}
export async function moveChecklistAction(data: FormData) {
  const taskId = String(data.get("taskId"));
  await moveChecklistItem(
    String(data.get("id")),
    String(data.get("direction")) as "up" | "down",
  );
  refresh(taskId);
}
export async function createSubtaskAction(data: FormData) {
  const id = String(data.get("parentTaskId"));
  await createSubtask(id, {
    title: String(data.get("title") ?? ""),
    dueAt: data.get("dueAt") ? new Date(String(data.get("dueAt"))) : undefined,
  });
  refresh(id);
}
export async function addDependencyAction(data: FormData) {
  const id = String(data.get("taskId"));
  await addTaskDependency(
    id,
    String(data.get("dependsOnTaskId")),
    String(data.get("type") ?? "finish_to_start"),
  );
  refresh(id);
}
export async function removeDependencyAction(data: FormData) {
  const taskId = String(data.get("taskId"));
  await removeTaskDependency(String(data.get("id")));
  refresh(taskId);
}
export async function saveRecurrenceAction(data: FormData) {
  const taskId = String(data.get("taskId")),
    rrule = String(data.get("rrule") ?? "");
  parseRRule(rrule);
  const task = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });
  const startsAt = data.get("startsAt")
    ? new Date(String(data.get("startsAt")))
    : (task.dueAt ?? new Date());
  const recurrence = task.recurrenceId
    ? await prisma.taskRecurrence.update({
        where: { id: task.recurrenceId },
        data: {
          rrule,
          frequency: String(data.get("frequency") ?? "custom"),
          timezone: String(data.get("timezone") ?? "Europe/Madrid"),
          startsAt,
          nextOccurrenceAt: nextOccurrence(startsAt, rrule, startsAt),
        },
      })
    : await prisma.taskRecurrence.create({
        data: {
          rrule,
          frequency: String(data.get("frequency") ?? "custom"),
          timezone: String(data.get("timezone") ?? "Europe/Madrid"),
          startsAt,
          nextOccurrenceAt: startsAt,
        },
      });
  await prisma.task.update({
    where: { id: taskId },
    data: { recurrenceId: recurrence.id },
  });
  refresh(taskId);
}
export async function editSeriesAction(data: FormData) {
  const id = String(data.get("taskId"));
  await editTaskSeries(
    id,
    String(data.get("scope")) as "this" | "following" | "all",
    {
      title: String(data.get("title") ?? "") || undefined,
      dueAt: data.get("dueAt")
        ? new Date(String(data.get("dueAt")))
        : undefined,
    },
  );
  refresh(id);
}
