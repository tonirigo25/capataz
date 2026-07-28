import { NextResponse } from "next/server";
import { BillingAccessError, requireBillingContext } from "@/lib/billing/auth";
import { isBillingEnabled } from "@/lib/billing/config";
import { paidAccessState } from "@/lib/billing/service";
import { getEntitlements } from "@/lib/commercial/authorization";

export async function GET() {
  try {
    const context = await requireBillingContext();
    const commercial = await getEntitlements(context.companyId);
    return NextResponse.json({
      enabled: isBillingEnabled(),
      planKey: commercial.planKey,
      status: commercial.subscription?.status ?? null,
      access: paidAccessState(commercial.subscription),
    });
  } catch (error) {
    if (error instanceof BillingAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "BILLING_STATUS_FAILED" }, { status: 500 });
  }
}
