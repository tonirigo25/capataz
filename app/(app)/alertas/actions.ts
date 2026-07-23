"use server";

import { revalidatePath } from "next/cache";
import {
  dismissBusinessSignal,
  resolveBusinessSignal,
  snoozeBusinessSignal,
  type SignalSnoozePreset
} from "@/lib/business-signals";
import { requireCapability } from "@/lib/commercial/authorization";
import { prisma } from "@/lib/prisma";

const VALID_SNOOZE_PRESETS = new Set<SignalSnoozePreset>(["tomorrow", "week", "month"]);

export async function dismissSignalAction(formData: FormData) {
  const { companyId } = await requireCapability("reports.view");
  const fingerprint = String(formData.get("fingerprint") ?? "");
  const reason = String(formData.get("reason") ?? "");
  if (!fingerprint) return;
  if (!await signalBelongsToCompany(fingerprint, companyId)) return;
  await dismissBusinessSignal(companyId, fingerprint, reason);
  revalidateAlertConsumers();
}

export async function snoozeSignalAction(formData: FormData) {
  const { companyId } = await requireCapability("reports.view");
  const fingerprint = String(formData.get("fingerprint") ?? "");
  const preset = String(formData.get("preset") ?? "tomorrow") as SignalSnoozePreset;
  if (!fingerprint || !VALID_SNOOZE_PRESETS.has(preset)) return;
  if (!await signalBelongsToCompany(fingerprint, companyId)) return;
  await snoozeBusinessSignal(companyId, fingerprint, preset);
  revalidateAlertConsumers();
}

export async function resolveSignalAction(formData: FormData) {
  const { companyId } = await requireCapability("reports.view");
  const fingerprint = String(formData.get("fingerprint") ?? "");
  const resolution = String(formData.get("resolution") ?? "");
  if (!fingerprint) return;
  if (!await signalBelongsToCompany(fingerprint, companyId)) return;
  await resolveBusinessSignal(companyId, fingerprint, resolution || "Resuelta manualmente desde el centro de alertas");
  revalidateAlertConsumers();
}

async function signalBelongsToCompany(fingerprint: string, companyId: string) {
  return Boolean(await prisma.businessSignalState.findFirst({ where: { fingerprint, companyId }, select: { id: true } }));
}

function revalidateAlertConsumers() {
  revalidatePath("/alertas");
  revalidatePath("/hoy");
  revalidatePath("/capataz");
}
