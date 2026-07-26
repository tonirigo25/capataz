"use server";

import { executeNextAction } from "@/lib/platform/next-action-boundary";
import { createTaskAction as createTaskActionUseCase, completeTaskAction as completeTaskActionUseCase, addChecklistAction as addChecklistActionUseCase, toggleChecklistAction as toggleChecklistActionUseCase, updateTaskAction as updateTaskActionUseCase, archiveTaskAction as archiveTaskActionUseCase, changeTaskStatusAction as changeTaskStatusActionUseCase, addTaskCommentAction as addTaskCommentActionUseCase, editChecklistAction as editChecklistActionUseCase, moveChecklistAction as moveChecklistActionUseCase, createSubtaskAction as createSubtaskActionUseCase, addDependencyAction as addDependencyActionUseCase, removeDependencyAction as removeDependencyActionUseCase, saveRecurrenceAction as saveRecurrenceActionUseCase, editSeriesAction as editSeriesActionUseCase } from "@/lib/application/operations/task-use-cases";

export async function createTaskAction(data: FormData) {
  return executeNextAction({ operation: "app/(app)/tareas/actions.ts#createTaskAction" }, () => createTaskActionUseCase(data));
}

export async function completeTaskAction(data: FormData) {
  return executeNextAction({ operation: "app/(app)/tareas/actions.ts#completeTaskAction" }, () => completeTaskActionUseCase(data));
}

export async function addChecklistAction(data: FormData) {
  return executeNextAction({ operation: "app/(app)/tareas/actions.ts#addChecklistAction" }, () => addChecklistActionUseCase(data));
}

export async function toggleChecklistAction(data: FormData) {
  return executeNextAction({ operation: "app/(app)/tareas/actions.ts#toggleChecklistAction" }, () => toggleChecklistActionUseCase(data));
}

export async function updateTaskAction(data: FormData) {
  return executeNextAction({ operation: "app/(app)/tareas/actions.ts#updateTaskAction" }, () => updateTaskActionUseCase(data));
}

export async function archiveTaskAction(data: FormData) {
  return executeNextAction({ operation: "app/(app)/tareas/actions.ts#archiveTaskAction" }, () => archiveTaskActionUseCase(data));
}

export async function changeTaskStatusAction(data: FormData) {
  return executeNextAction({ operation: "app/(app)/tareas/actions.ts#changeTaskStatusAction" }, () => changeTaskStatusActionUseCase(data));
}

export async function addTaskCommentAction(data: FormData) {
  return executeNextAction({ operation: "app/(app)/tareas/actions.ts#addTaskCommentAction" }, () => addTaskCommentActionUseCase(data));
}

export async function editChecklistAction(data: FormData) {
  return executeNextAction({ operation: "app/(app)/tareas/actions.ts#editChecklistAction" }, () => editChecklistActionUseCase(data));
}

export async function moveChecklistAction(data: FormData) {
  return executeNextAction({ operation: "app/(app)/tareas/actions.ts#moveChecklistAction" }, () => moveChecklistActionUseCase(data));
}

export async function createSubtaskAction(data: FormData) {
  return executeNextAction({ operation: "app/(app)/tareas/actions.ts#createSubtaskAction" }, () => createSubtaskActionUseCase(data));
}

export async function addDependencyAction(data: FormData) {
  return executeNextAction({ operation: "app/(app)/tareas/actions.ts#addDependencyAction" }, () => addDependencyActionUseCase(data));
}

export async function removeDependencyAction(data: FormData) {
  return executeNextAction({ operation: "app/(app)/tareas/actions.ts#removeDependencyAction" }, () => removeDependencyActionUseCase(data));
}

export async function saveRecurrenceAction(data: FormData) {
  return executeNextAction({ operation: "app/(app)/tareas/actions.ts#saveRecurrenceAction" }, () => saveRecurrenceActionUseCase(data));
}

export async function editSeriesAction(data: FormData) {
  return executeNextAction({ operation: "app/(app)/tareas/actions.ts#editSeriesAction" }, () => editSeriesActionUseCase(data));
}
