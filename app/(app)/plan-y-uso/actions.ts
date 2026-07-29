"use server";

import { executeNextAction } from "@/lib/platform/next-action-boundary";
import { changeLocalPlan as changeLocalPlanUseCase } from "@/lib/application/billing/plan-use-case";
import {
  changeStripeSubscription as changeStripeSubscriptionUseCase,
  openStripeCustomerPortal as openStripeCustomerPortalUseCase,
  scheduleStripeDowngrade as scheduleStripeDowngradeUseCase,
  startStripeCheckout as startStripeCheckoutUseCase,
} from "@/lib/application/billing/stripe-use-cases";

export async function changeLocalPlan(formData:FormData) {
  return executeNextAction({ operation: "app/(app)/plan-y-uso/actions.ts#changeLocalPlan" }, () => changeLocalPlanUseCase(formData));
}

export async function startStripeCheckout(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/plan-y-uso/actions.ts#startStripeCheckout" }, () => startStripeCheckoutUseCase(formData));
}

export async function openStripeCustomerPortal(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/plan-y-uso/actions.ts#openStripeCustomerPortal" }, () => openStripeCustomerPortalUseCase(formData));
}

export async function scheduleStripeDowngrade(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/plan-y-uso/actions.ts#scheduleStripeDowngrade" }, () => scheduleStripeDowngradeUseCase(formData));
}

export async function changeStripeSubscription(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/plan-y-uso/actions.ts#changeStripeSubscription" }, () => changeStripeSubscriptionUseCase(formData));
}
