import { NextResponse } from "next/server";
import { BillingAccessError, requireBillingContext } from "@/lib/billing/auth";
import { normalizeBillingInterval, normalizeBillingPlanKey } from "@/lib/billing/config";
import { scheduleDowngrade } from "@/lib/billing/service";
import { publicRequestContext } from "@/lib/platform/request-boundary";

export async function POST(request: Request) {
  return publicRequestContext("POST /api/billing/downgrade", request, async () => {
    try {
      const context = await requireBillingContext();
      const input = await request.json() as {
        planKey?: string;
        interval?: string;
        idempotencyKey?: string;
      };
      const result = await scheduleDowngrade({
        companyId: context.companyId,
        planKey: normalizeBillingPlanKey(String(input.planKey ?? "")),
        interval: normalizeBillingInterval(input.interval),
        idempotencyKey: request.headers.get("idempotency-key") || input.idempotencyKey || "",
      });
      return NextResponse.json({
        scheduleId: result.id,
        scheduledPlanKey: result.scheduledPlanKey,
        effectiveAt: result.effectiveAt,
      });
    } catch (error) {
      if (error instanceof BillingAccessError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      const code = error instanceof Error ? error.message.split(":")[0] : "BILLING_DOWNGRADE_FAILED";
      const status = code === "BILLING_DISABLED" || code.includes("NOT_CONFIGURED")
        ? 503
        : code.includes("NOT_FOUND")
          ? 404
          : code.includes("IN_PROGRESS")
            ? 409
            : 400;
      return NextResponse.json({ error: code }, { status });
    }
  });
}
