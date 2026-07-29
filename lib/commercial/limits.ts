export type ApprovedMemberPlanKey = "STARTER" | "PROFESSIONAL" | "BUSINESS";

export const runtimeUsageLimitKeys = [
  "max_members",
  "max_companies",
  "max_documents",
  "storage_bytes",
  "monthly_orqena_actions",
  "max_automations",
] as const;

export type RuntimeUsageLimitKey = (typeof runtimeUsageLimitKeys)[number];

export const approvedMemberLimits = {
  STARTER: 2,
  PROFESSIONAL: 5,
  BUSINESS: 15,
} as const satisfies Record<ApprovedMemberPlanKey, number>;

type EntitlementValue = boolean | number | string;

export function approvedMemberLimitForPlan(planKey: string) {
  const normalized = planKey.trim().toUpperCase();
  const canonical = normalized === "PRO" ? "PROFESSIONAL" : normalized;
  return canonical in approvedMemberLimits
    ? approvedMemberLimits[canonical as ApprovedMemberPlanKey]
    : null;
}

export function applyApprovedMemberLimitOverlay(
  planKey: string,
  values: Record<string, EntitlementValue>,
): Record<string, EntitlementValue> {
  const approvedLimit = approvedMemberLimitForPlan(planKey);
  return approvedLimit === null
    ? { ...values }
    : { ...values, max_members: approvedLimit };
}

export type UsageLimitDecision = {
  allowed: boolean;
  blocked: boolean;
  warning: boolean;
  status: "within_limit" | "warning" | "blocked";
  used: number;
  requested: number;
  projected: number;
  limit: number;
  remaining: number;
  utilization: number;
  nextAction: "none" | "offer_plan_change_or_renewal";
  audit: {
    action: "commercial.limit_evaluated";
    outcome: "allowed" | "blocked";
    automaticCharge: false;
  };
};

export function evaluateUsageLimit(input: {
  used: number;
  limit: number;
  quantity?: number;
  operation: "READ" | "CREATE";
}): UsageLimitDecision {
  const requested = input.operation === "READ" ? 0 : (input.quantity ?? 0);
  if (!Number.isFinite(input.used) || input.used < 0)
    throw new Error("USAGE_CURRENT_INVALID");
  if (!Number.isFinite(input.limit) || input.limit < 0)
    throw new Error("USAGE_LIMIT_INVALID");
  if (
    !Number.isFinite(requested) ||
    (input.operation === "CREATE" && requested <= 0)
  )
    throw new Error("USAGE_QUANTITY_MUST_BE_POSITIVE");

  const projected =
    input.operation === "READ" ? input.used : input.used + requested;
  const blocked = input.operation === "CREATE" && projected > input.limit;
  const utilization =
    input.limit === 0 ? (projected === 0 ? 0 : 1) : projected / input.limit;
  const warning = input.limit > 0 && utilization >= 0.8;
  return {
    allowed: input.operation === "READ" || !blocked,
    blocked,
    warning,
    status: blocked ? "blocked" : warning ? "warning" : "within_limit",
    used: input.used,
    requested,
    projected,
    limit: input.limit,
    remaining: Math.max(0, input.limit - projected),
    utilization,
    nextAction:
      warning || blocked ? "offer_plan_change_or_renewal" : "none",
    audit: {
      action: "commercial.limit_evaluated",
      outcome: blocked ? "blocked" : "allowed",
      automaticCharge: false,
    },
  };
}

export function assertUsageMutationAllowed(decision: UsageLimitDecision) {
  if (!decision.allowed)
    throw new Error("USAGE_LIMIT_REACHED_NO_AUTOMATIC_CHARGE");
  return decision;
}
