import { NextResponse } from "next/server";
import { BillingAccessError, requireBillingContext } from "@/lib/billing/auth";
import { createCheckout } from "@/lib/billing/service";
import { normalizeBillingInterval, normalizeBillingPlanKey } from "@/lib/billing/config";
import { publicRequestContext } from "@/lib/platform/request-boundary";

export async function POST(request: Request) {
  return publicRequestContext("POST /api/billing/checkout", request, async () => {
    try {
      const context = await requireBillingContext();
      const input = await request.json() as {
        planKey?: string;
        interval?: string;
        idempotencyKey?: string;
      };
      const planKey = normalizeBillingPlanKey(String(input.planKey ?? ""));
      const interval = normalizeBillingInterval(input.interval);
      const idempotencyKey = request.headers.get("idempotency-key") || input.idempotencyKey || "";
      const session = await createCheckout({
        companyId: context.companyId,
        planKey,
        interval,
        idempotencyKey,
      });
      return NextResponse.json({ checkoutUrl: session.url, sessionId: session.id });
    } catch (error) {
      return billingError(error);
    }
  });
}

function billingError(error: unknown) {
  if (error instanceof BillingAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
  const code = error instanceof Error ? error.message.split(":")[0] : "BILLING_CHECKOUT_FAILED";
  const status = code === "BILLING_DISABLED"
    ? 503
    : ["BILLING_ACTIVE_SUBSCRIPTION_EXISTS", "BILLING_CHECKOUT_IN_PROGRESS"].includes(code)
      ? 409
      : code.includes("NOT_CONFIGURED")
        ? 503
        : 400;
  return NextResponse.json({ error: code }, { status });
}
