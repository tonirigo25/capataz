"use server";

import { executeNextAction } from "@/lib/platform/next-action-boundary";
import { updateBudgetStatus as updateBudgetStatusUseCase, convertBudgetToWork as convertBudgetToWorkUseCase, convertBudgetToInvoice as convertBudgetToInvoiceUseCase, duplicateBudget as duplicateBudgetUseCase, createBudgetFromTemplate as createBudgetFromTemplateUseCase, saveBudgetLine as saveBudgetLineUseCase, deleteBudgetLine as deleteBudgetLineUseCase } from "@/lib/application/finance/budget-use-cases";

export async function updateBudgetStatus(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/presupuestos/actions.ts#updateBudgetStatus" }, () => updateBudgetStatusUseCase(formData));
}

export async function convertBudgetToWork(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/presupuestos/actions.ts#convertBudgetToWork" }, () => convertBudgetToWorkUseCase(formData));
}

export async function convertBudgetToInvoice(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/presupuestos/actions.ts#convertBudgetToInvoice" }, () => convertBudgetToInvoiceUseCase(formData));
}

export async function duplicateBudget(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/presupuestos/actions.ts#duplicateBudget" }, () => duplicateBudgetUseCase(formData));
}

export async function createBudgetFromTemplate(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/presupuestos/actions.ts#createBudgetFromTemplate" }, () => createBudgetFromTemplateUseCase(formData));
}

export async function saveBudgetLine(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/presupuestos/actions.ts#saveBudgetLine" }, () => saveBudgetLineUseCase(formData));
}

export async function deleteBudgetLine(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/presupuestos/actions.ts#deleteBudgetLine" }, () => deleteBudgetLineUseCase(formData));
}
