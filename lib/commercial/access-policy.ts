import type { SubscriptionStatus } from "@prisma/client";

export type CommercialAccess = "FULL" | "READ_ONLY" | "BLOCKED";

export function commercialAccessPolicy(input: {
  status: SubscriptionStatus;
  graceEndsAt: Date | null;
  currentPeriodEnd?: Date | null;
  now?: Date;
}): { access: CommercialAccess; reason: string } {
  const now = input.now ?? new Date();
  if (input.status === "CANCELED" && input.currentPeriodEnd && input.currentPeriodEnd > now) {
    return { access: "FULL", reason: "canceled_period_remaining" };
  }
  if (["CANCELED", "EXPIRED"].includes(input.status)) return { access: "READ_ONLY", reason: "subscription_ended" };
  if (input.status === "PAUSED") return { access: "READ_ONLY", reason: "subscription_paused" };
  if (input.status === "PAST_DUE") {
    if (input.graceEndsAt && input.graceEndsAt > now) return { access: "FULL", reason: "payment_grace" };
    return { access: "READ_ONLY", reason: "payment_grace_expired" };
  }
  return { access: "FULL", reason: "subscription_active" };
}

export const overusePolicy = {
  defaultDecision: "BLOCK",
  hiddenChargesAllowed: false,
  allowedDecisions: ["BLOCK", "EXPLICIT_ALLOWANCE", "REQUIRE_PLAN_CHANGE"],
  userMessage: "Has alcanzado el límite incluido. No se realizará ningún cargo automático: ajusta el plan o solicita una ampliación explícita.",
} as const;
