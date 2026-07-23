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
import { requireCapability } from "@/lib/commercial/authorization";
async function taskGuard(data:FormData){const auth=await requireCapability("tasks.manage");const ids=["id","taskId","parentTaskId","dependsOnTaskId"].map(key=>String(data.get(key)??"")).filter(Boolean);for(const id of ids){const found=await prisma.task.findFirst({where:{companyId:auth.companyId,OR:[{id},{checklist:{some:{id}}},{dependencies:{some:{id}}},{blocking:{some:{id}}}]},select:{id:true}});if(!found)throw new Error("TASK_NOT_AVAILABLE");}return auth;}
export async function createTaskAction(data: FormData) {
  const auth=await requireCapability("tasks.manage");
  const title = String(data.get("title") ?? "").trim();
  if (!title) return;
  await createTask({
    companyId:auth.companyId,
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
  await taskGuard(data);
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
  await taskGuard(data);
  const title = String(data.get("title") ?? "").trim();
  if (title) await addChecklistItem(String(data.get("taskId")), title);
  revalidatePath("/tareas");
}
export async function toggleChecklistAction(data: FormData) {
  await taskGuard(data);
  await toggleChecklistItem(
    String(data.get("id")),
    data.get("completed") !== "true",
    "user",
  );
  revalidatePath("/tareas");
}
export async function updateTaskAction(data: FormData) {
  await taskGuard(data);
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
  await taskGuard(data);
  await archiveTask(String(data.get("id")));
  revalidatePath("/tareas");
}
const refresh = (id: string) => {
  revalidatePath("/tareas");
  revalidatePath(`/tareas/${id}`);
  revalidatePath("/hoy");
};
export async function changeTaskStatusAction(data: FormData) {
  await taskGuard(data);
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
  await taskGuard(data);
  const id = String(data.get("taskId"));
  await addTaskComment(id, String(data.get("content") ?? ""), "user");
  refresh(id);
}
export async function editChecklistAction(data: FormData) {
  await taskGuard(data);
  const taskId = String(data.get("taskId"));
  await editChecklistItem(
    String(data.get("id")),
    String(data.get("title") ?? ""),
  );
  refresh(taskId);
}
export async function moveChecklistAction(data: FormData) {
  await taskGuard(data);
  const taskId = String(data.get("taskId"));
  await moveChecklistItem(
    String(data.get("id")),
    String(data.get("direction")) as "up" | "down",
  );
  refresh(taskId);
}
export async function createSubtaskAction(data: FormData) {
  const auth=await taskGuard(data);
  const id = String(data.get("parentTaskId"));
  await createSubtask(id, {
    companyId:auth.companyId,
    title: String(data.get("title") ?? ""),
    dueAt: data.get("dueAt") ? new Date(String(data.get("dueAt"))) : undefined,
  });
  refresh(id);
}
export async function addDependencyAction(data: FormData) {
  await taskGuard(data);
  const id = String(data.get("taskId"));
  await addTaskDependency(
    id,
    String(data.get("dependsOnTaskId")),
    String(data.get("type") ?? "finish_to_start"),
  );
  refresh(id);
}
export async function removeDependencyAction(data: FormData) {
  await taskGuard(data);
  const taskId = String(data.get("taskId"));
  await removeTaskDependency(String(data.get("id")));
  refresh(taskId);
}
export async function saveRecurrenceAction(data: FormData) {
  const auth=await taskGuard(data);
  const taskId = String(data.get("taskId")),
    rrule = String(data.get("rrule") ?? "");
  parseRRule(rrule);
  const task = await prisma.task.findFirstOrThrow({ where: { id: taskId, companyId:auth.companyId } });
  const startsAt = data.get("startsAt")
    ? new Date(String(data.get("startsAt")))
    : (task.dueAt ?? new Date());
  const recurrence = task.recurrenceId
    ? await prisma.taskRecurrence.update({
        where: { id: (await prisma.taskRecurrence.findFirstOrThrow({where:{id:task.recurrenceId,companyId:auth.companyId},select:{id:true}})).id },
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
          companyId:auth.companyId,
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
  await taskGuard(data);
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
