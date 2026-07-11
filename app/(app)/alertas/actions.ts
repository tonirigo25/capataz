"use server";

import { revalidatePath } from "next/cache";
import {
  dismissBusinessSignal,
  resolveBusinessSignal,
  snoozeBusinessSignal,
  type SignalSnoozePreset
} from "@/lib/business-signals";

const VALID_SNOOZE_PRESETS = new Set<SignalSnoozePreset>(["tomorrow", "week", "month"]);

export async function dismissSignalAction(formData: FormData) {
  const fingerprint = String(formData.get("fingerprint") ?? "");
  const reason = String(formData.get("reason") ?? "");
  if (!fingerprint) return;
  await dismissBusinessSignal(fingerprint, reason);
  revalidateAlertConsumers();
}

export async function snoozeSignalAction(formData: FormData) {
  const fingerprint = String(formData.get("fingerprint") ?? "");
  const preset = String(formData.get("preset") ?? "tomorrow") as SignalSnoozePreset;
  if (!fingerprint || !VALID_SNOOZE_PRESETS.has(preset)) return;
  await snoozeBusinessSignal(fingerprint, preset);
  revalidateAlertConsumers();
}

export async function resolveSignalAction(formData: FormData) {
  const fingerprint = String(formData.get("fingerprint") ?? "");
  const resolution = String(formData.get("resolution") ?? "");
  if (!fingerprint) return;
  await resolveBusinessSignal(fingerprint, resolution || "Resuelta manualmente desde el centro de alertas");
  revalidateAlertConsumers();
}

function revalidateAlertConsumers() {
  revalidatePath("/alertas");
  revalidatePath("/hoy");
  revalidatePath("/capataz");
}
