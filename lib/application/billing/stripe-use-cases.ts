import { navigateAction } from "@/lib/application/action-effects";
import { normalizeBillingInterval, normalizeBillingPlanKey } from "@/lib/billing/config";
import { changeSubscription, createCheckout, createPortal, scheduleDowngrade } from "@/lib/billing/service";
import { requireCapability } from "@/lib/commercial/authorization";

export async function startStripeCheckout(formData: FormData) {
  const auth = await requireCapability("company.billing.manage");
  if (auth.role !== "OWNER" || formData.get("confirm") !== "CONTINUAR_STRIPE") {
    throw new Error("BILLING_CHECKOUT_INPUT_INVALID");
  }
  const result = await createCheckout({
    companyId: auth.companyId,
    planKey: normalizeBillingPlanKey(String(formData.get("planKey") ?? "")),
    interval: normalizeBillingInterval(String(formData.get("interval") ?? "")),
    idempotencyKey: String(formData.get("idempotencyKey") ?? ""),
  });
  const url = result.url;
  if (!url || new URL(url).protocol !== "https:") throw new Error("BILLING_CHECKOUT_URL_INVALID");
  navigateAction(url);
}

export async function scheduleStripeDowngrade(formData: FormData) {
  const auth = await requireCapability("company.billing.manage");
  if (auth.role !== "OWNER" || formData.get("confirm") !== "PROGRAMAR_DOWNGRADE") {
    throw new Error("BILLING_DOWNGRADE_INPUT_INVALID");
  }
  await scheduleDowngrade({
    companyId: auth.companyId,
    planKey: normalizeBillingPlanKey(String(formData.get("planKey") ?? "")),
    interval: normalizeBillingInterval(String(formData.get("interval") ?? "")),
    idempotencyKey: String(formData.get("idempotencyKey") ?? ""),
  });
}

export async function changeStripeSubscription(formData: FormData) {
  const auth = await requireCapability("company.billing.manage");
  if (auth.role !== "OWNER" || formData.get("confirm") !== "CAMBIAR_SUSCRIPCION") {
    throw new Error("BILLING_SUBSCRIPTION_CHANGE_INPUT_INVALID");
  }
  await changeSubscription({
    companyId: auth.companyId,
    planKey: normalizeBillingPlanKey(String(formData.get("planKey") ?? "")),
    interval: normalizeBillingInterval(String(formData.get("interval") ?? "")),
    idempotencyKey: String(formData.get("idempotencyKey") ?? ""),
  });
}

export async function openStripeCustomerPortal(formData: FormData) {
  const auth = await requireCapability("company.billing.manage");
  if (auth.role !== "OWNER" || formData.get("confirm") !== "ABRIR_PORTAL") throw new Error("BILLING_PORTAL_INPUT_INVALID");
  const result = await createPortal({
    companyId: auth.companyId,
    idempotencyKey: String(formData.get("idempotencyKey") ?? ""),
  });
  const url = result.url;
  if (!url || new URL(url).protocol !== "https:") throw new Error("BILLING_PORTAL_URL_INVALID");
  navigateAction(url);
}
