import { NextResponse } from "next/server";
import { BillingAccessError, requireBillingContext } from "@/lib/billing/auth";
import { createCheckout } from "@/lib/billing/service";
import { planCatalog, type PlanKey } from "@/lib/commercial/plans";
import { publicRequestContext } from "@/lib/platform/request-boundary";

export async function POST(request: Request) {
  return publicRequestContext("POST /api/billing/checkout", request, async () => {
    try {
      const context = await requireBillingContext();
      const input = await request.json() as { planKey?: string };
      const planKey = String(input.planKey ?? "").toUpperCase() as PlanKey;
      if (!(planKey in planCatalog) || planKey === "ENTERPRISE") {
        return NextResponse.json({ error: "BILLING_PLAN_INVALID" }, { status: 400 });
      }
      const session = await createCheckout({
        companyId: context.companyId,
        userEmail: context.email,
        companyName: context.companyName,
        planKey,
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
  const status = code === "BILLING_DISABLED" ? 503 : code === "BILLING_ACTIVE_SUBSCRIPTION_EXISTS" ? 409 : code.includes("NOT_CONFIGURED") ? 503 : 400;
  return NextResponse.json({ error: code }, { status });
}
