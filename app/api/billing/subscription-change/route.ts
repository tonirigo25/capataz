import { NextResponse } from "next/server";
import { BillingAccessError, requireBillingContext } from "@/lib/billing/auth";
import { normalizeBillingInterval, normalizeBillingPlanKey } from "@/lib/billing/config";
import { changeSubscription } from "@/lib/billing/service";
import { publicRequestContext } from "@/lib/platform/request-boundary";

export async function POST(request: Request) {
  return publicRequestContext("POST /api/billing/subscription-change", request, async () => {
    try {
      const context = await requireBillingContext();
      const input = await request.json() as {
        planKey?: string;
        interval?: string;
        idempotencyKey?: string;
      };
      const result = await changeSubscription({
        companyId: context.companyId,
        planKey: normalizeBillingPlanKey(String(input.planKey ?? "")),
        interval: normalizeBillingInterval(input.interval),
        idempotencyKey: request.headers.get("idempotency-key") || input.idempotencyKey || "",
      });
      return NextResponse.json({
        subscriptionId: result.id,
        planKey: result.scheduledPlanKey,
        effectiveAt: result.effectiveAt,
        mode: result.mode,
      });
    } catch (error) {
      if (error instanceof BillingAccessError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      const code = error instanceof Error ? error.message.split(":")[0] : "BILLING_SUBSCRIPTION_CHANGE_FAILED";
      const status = code === "BILLING_DISABLED" || code.includes("NOT_CONFIGURED")
        ? 503
        : code.includes("NOT_FOUND")
          ? 404
          : code.includes("IN_PROGRESS") || code.includes("EXISTS")
            ? 409
            : 400;
      return NextResponse.json({ error: code }, { status });
    }
  });
}
