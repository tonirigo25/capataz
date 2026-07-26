"use server";

import { executeNextAction } from "@/lib/platform/next-action-boundary";
import { createFinancialAccount as createFinancialAccountUseCase, updateFinancialAccount as updateFinancialAccountUseCase, archiveFinancialAccount as archiveFinancialAccountUseCase, createCashMovement as createCashMovementUseCase, createCashTransfer as createCashTransferUseCase, createRecurringExpense as createRecurringExpenseUseCase, createExpectedCashFlow as createExpectedCashFlowUseCase, saveTreasurySettings as saveTreasurySettingsUseCase } from "@/lib/application/finance/treasury-use-cases";

export async function createFinancialAccount(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/tesoreria/actions.ts#createFinancialAccount" }, () => createFinancialAccountUseCase(formData));
}

export async function updateFinancialAccount(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/tesoreria/actions.ts#updateFinancialAccount" }, () => updateFinancialAccountUseCase(formData));
}

export async function archiveFinancialAccount(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/tesoreria/actions.ts#archiveFinancialAccount" }, () => archiveFinancialAccountUseCase(formData));
}

export async function createCashMovement(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/tesoreria/actions.ts#createCashMovement" }, () => createCashMovementUseCase(formData));
}

export async function createCashTransfer(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/tesoreria/actions.ts#createCashTransfer" }, () => createCashTransferUseCase(formData));
}

export async function createRecurringExpense(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/tesoreria/actions.ts#createRecurringExpense" }, () => createRecurringExpenseUseCase(formData));
}

export async function createExpectedCashFlow(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/tesoreria/actions.ts#createExpectedCashFlow" }, () => createExpectedCashFlowUseCase(formData));
}

export async function saveTreasurySettings(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/tesoreria/actions.ts#saveTreasurySettings" }, () => saveTreasurySettingsUseCase(formData));
}
