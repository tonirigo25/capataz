"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type {
  CashMovementSource,
  CashMovementStatus,
  CashMovementType,
  ExpectedCashFlowSource,
  ExpectedCashFlowStatus,
  ExpectedCashFlowType,
  FinancialAccountType,
  RecurringExpenseFrequency
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { reevaluateProactiveAfterMutation, type ProactiveEvaluationScope } from "@/lib/proactive-evaluation";

export async function createFinancialAccount(formData: FormData) {
  const returnTo = optionalText(formData, "returnTo") ?? "/tesoreria";
  const currentManualBalance = optionalNumber(formData, "currentManualBalance");

  await prisma.financialAccount.create({
    data: {
      name: text(formData, "name"),
      type: text(formData, "type") as FinancialAccountType,
      currency: optionalText(formData, "currency") ?? "EUR",
      openingBalance: number(formData, "openingBalance"),
      currentManualBalance,
      manualBalanceUpdatedAt: currentManualBalance !== null ? new Date() : null,
      minimumBalance: optionalNumber(formData, "minimumBalance")
    }
  });

  await revalidateTreasury({ entityType: "treasury", reason: "financial_account_created" });
  redirect(returnTo);
}

export async function updateFinancialAccount(formData: FormData) {
  const id = text(formData, "id");
  const returnTo = optionalText(formData, "returnTo") ?? "/tesoreria";
  const currentManualBalance = optionalNumber(formData, "currentManualBalance");

  await prisma.financialAccount.update({
    where: { id },
    data: {
      name: text(formData, "name"),
      type: text(formData, "type") as FinancialAccountType,
      currency: optionalText(formData, "currency") ?? "EUR",
      openingBalance: number(formData, "openingBalance"),
      currentManualBalance,
      manualBalanceUpdatedAt: currentManualBalance !== null ? new Date() : null,
      minimumBalance: optionalNumber(formData, "minimumBalance"),
      isActive: formData.get("isActive") === "on"
    }
  });

  await revalidateTreasury({ entityType: "treasury", reason: "financial_account_updated" });
  redirect(returnTo);
}

export async function archiveFinancialAccount(formData: FormData) {
  const id = text(formData, "id");
  const returnTo = optionalText(formData, "returnTo") ?? "/tesoreria";
  await prisma.financialAccount.update({
    where: { id },
    data: { isActive: false, archivedAt: new Date() }
  });
  await revalidateTreasury({ entityType: "treasury", reason: "financial_account_archived" });
  redirect(returnTo);
}

export async function createCashMovement(formData: FormData) {
  const returnTo = optionalText(formData, "returnTo") ?? "/tesoreria";
  const type = text(formData, "type") as CashMovementType;
  const amount = number(formData, "amount");
  if (type !== "adjustment" && amount <= 0) throw new Error("El importe debe ser positivo.");
  if (type === "adjustment" && amount === 0) throw new Error("El ajuste no puede ser cero.");

  await prisma.cashMovement.create({
    data: {
      accountId: text(formData, "accountId"),
      type,
      amount,
      date: requiredDate(formData, "date"),
      description: text(formData, "description"),
      invoiceId: optionalText(formData, "invoiceId"),
      paymentId: optionalText(formData, "paymentId"),
      expenseId: optionalText(formData, "expenseId"),
      workId: optionalText(formData, "workId"),
      clientId: optionalText(formData, "clientId"),
      category: optionalText(formData, "category"),
      provider: optionalText(formData, "provider"),
      status: (optionalText(formData, "status") ?? "confirmed") as CashMovementStatus,
      source: (optionalText(formData, "source") ?? (type === "adjustment" ? "adjustment" : "manual")) as CashMovementSource,
      notes: optionalText(formData, "notes")
    }
  });

  await revalidateTreasury({ entityType: "cashMovement", reason: "cash_movement_created" });
  redirect(returnTo);
}

export async function createCashTransfer(formData: FormData) {
  const returnTo = optionalText(formData, "returnTo") ?? "/tesoreria";
  const fromAccountId = text(formData, "fromAccountId");
  const toAccountId = text(formData, "toAccountId");
  const amount = number(formData, "amount");
  if (fromAccountId === toAccountId) throw new Error("La cuenta origen y destino deben ser distintas.");
  if (amount <= 0) throw new Error("El importe debe ser positivo.");

  const groupId = randomUUID();
  const date = requiredDate(formData, "date");
  const description = optionalText(formData, "description") ?? "Transferencia entre cuentas";
  const notes = optionalText(formData, "notes");

  await prisma.$transaction([
    prisma.cashMovement.create({
      data: {
        accountId: fromAccountId,
        type: "transfer_out",
        amount,
        date,
        description,
        status: "confirmed",
        source: "manual",
        transferGroupId: groupId,
        notes
      }
    }),
    prisma.cashMovement.create({
      data: {
        accountId: toAccountId,
        type: "transfer_in",
        amount,
        date,
        description,
        status: "confirmed",
        source: "manual",
        transferGroupId: groupId,
        notes
      }
    })
  ]);

  await revalidateTreasury({ entityType: "cashMovement", reason: "cash_transfer_created" });
  redirect(returnTo);
}

export async function createRecurringExpense(formData: FormData) {
  const returnTo = optionalText(formData, "returnTo") ?? "/tesoreria";
  const amount = number(formData, "amount");
  if (amount <= 0) throw new Error("El importe debe ser positivo.");

  await prisma.recurringExpense.create({
    data: {
      name: text(formData, "name"),
      amount,
      frequency: text(formData, "frequency") as RecurringExpenseFrequency,
      nextDueDate: requiredDate(formData, "nextDueDate"),
      category: optionalText(formData, "category"),
      workId: optionalText(formData, "workId"),
      provider: optionalText(formData, "provider"),
      fixedCost: formData.get("fixedCost") === "on",
      isActive: true
    }
  });

  await revalidateTreasury({ entityType: "recurringExpense", reason: "recurring_expense_created" });
  redirect(returnTo);
}

export async function createExpectedCashFlow(formData: FormData) {
  const returnTo = optionalText(formData, "returnTo") ?? "/tesoreria";
  const amount = number(formData, "amount");
  if (amount <= 0) throw new Error("El importe debe ser positivo.");

  await prisma.expectedCashFlow.create({
    data: {
      type: text(formData, "type") as ExpectedCashFlowType,
      amount,
      expectedDate: requiredDate(formData, "expectedDate"),
      description: text(formData, "description"),
      probability: optionalProbability(formData, "probability"),
      confidenceSource: optionalText(formData, "confidenceSource"),
      invoiceId: optionalText(formData, "invoiceId"),
      expenseId: optionalText(formData, "expenseId"),
      workId: optionalText(formData, "workId"),
      clientId: optionalText(formData, "clientId"),
      status: (optionalText(formData, "status") ?? "pending") as ExpectedCashFlowStatus,
      source: (optionalText(formData, "source") ?? "manual") as ExpectedCashFlowSource
    }
  });

  await revalidateTreasury({ entityType: "expectedCashFlow", reason: "expected_cashflow_created" });
  redirect(returnTo);
}

export async function saveTreasurySettings(formData: FormData) {
  const returnTo = optionalText(formData, "returnTo") ?? "/tesoreria";
  const existing = await prisma.treasurySettings.findFirst({ orderBy: { updatedAt: "desc" } });
  const data = {
    currency: optionalText(formData, "currency") ?? "EUR",
    minimumCashBalance: optionalNumber(formData, "minimumCashBalance"),
    safetyBuffer: optionalNumber(formData, "safetyBuffer"),
    targetCoverageDays: optionalInteger(formData, "targetCoverageDays"),
    includeEstimatedInflows: formData.get("includeEstimatedInflows") === "on"
  };

  if (existing) await prisma.treasurySettings.update({ where: { id: existing.id }, data });
  else await prisma.treasurySettings.create({ data });

  await revalidateTreasury({ entityType: "treasury", reason: "treasury_settings_saved" });
  redirect(returnTo);
}

async function revalidateTreasury(scope: ProactiveEvaluationScope) {
  await reevaluateProactiveAfterMutation(scope);
  revalidatePath("/tesoreria");
  revalidatePath("/hoy");
  revalidatePath("/inteligencia");
  revalidatePath("/capataz");
}

function text(formData: FormData, key: string) {
  const value = optionalText(formData, key);
  if (!value) throw new Error(`Falta el campo ${key}.`);
  return value;
}

function optionalText(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function number(formData: FormData, key: string, fallback = 0) {
  const value = optionalText(formData, key);
  if (!value) return fallback;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function optionalNumber(formData: FormData, key: string) {
  const value = optionalText(formData, key);
  if (!value) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function optionalInteger(formData: FormData, key: string) {
  const value = optionalText(formData, key);
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function optionalProbability(formData: FormData, key: string) {
  const value = optionalNumber(formData, key);
  if (value === null) return null;
  return Math.max(0, Math.min(1, value > 1 ? value / 100 : value));
}

function requiredDate(formData: FormData, key: string) {
  const value = optionalText(formData, key);
  return value ? new Date(value) : new Date();
}
