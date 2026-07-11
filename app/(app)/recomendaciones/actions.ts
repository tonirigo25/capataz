"use server";

import { revalidatePath } from "next/cache";
import {
  acceptBusinessRecommendation,
  dismissBusinessRecommendation,
  executeConfirmedRecommendationAction,
  markRecommendationViewed,
  snoozeBusinessRecommendation
} from "@/lib/business-recommendations";
import type { SignalSnoozePreset } from "@/lib/business-signals";

const VALID_SNOOZE_PRESETS = new Set<SignalSnoozePreset>(["tomorrow", "week", "month"]);

export async function markRecommendationViewedAction(formData: FormData) {
  const fingerprint = clean(formData.get("fingerprint"));
  if (!fingerprint) return;
  await markRecommendationViewed(fingerprint);
  revalidateRecommendationConsumers();
}

export async function snoozeRecommendationAction(formData: FormData) {
  const fingerprint = clean(formData.get("fingerprint"));
  const preset = clean(formData.get("preset")) as SignalSnoozePreset;
  if (!fingerprint || !VALID_SNOOZE_PRESETS.has(preset)) return;
  await snoozeBusinessRecommendation(fingerprint, preset);
  revalidateRecommendationConsumers();
}

export async function dismissRecommendationAction(formData: FormData) {
  const fingerprint = clean(formData.get("fingerprint"));
  const reason = clean(formData.get("reason"));
  if (!fingerprint) return;
  await dismissBusinessRecommendation(fingerprint, reason);
  revalidateRecommendationConsumers();
}

export async function acceptRecommendationAction(formData: FormData) {
  const fingerprint = clean(formData.get("fingerprint"));
  if (!fingerprint) return;
  await acceptBusinessRecommendation(fingerprint);
  revalidateRecommendationConsumers();
}

export async function executeRecommendationAction(formData: FormData) {
  const fingerprint = clean(formData.get("fingerprint"));
  const actionId = clean(formData.get("actionId"));
  const confirmed = clean(formData.get("confirmed")) === "true";
  if (!fingerprint || !actionId || !confirmed) return;
  const idempotencyKey = clean(formData.get("idempotencyKey")) || `${fingerprint}:${actionId}`;
  await executeConfirmedRecommendationAction({ fingerprint, actionId, userIntent: "confirmed_from_recommendation_center", idempotencyKey });
  revalidateRecommendationConsumers();
}

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function revalidateRecommendationConsumers() {
  revalidatePath("/recomendaciones");
  revalidatePath("/recomendaciones/control");
  revalidatePath("/hoy");
  revalidatePath("/alertas");
  revalidatePath("/capataz");
  revalidatePath("/clientes");
  revalidatePath("/obras");
  revalidatePath("/tesoreria");
}
