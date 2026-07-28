import { NextResponse } from "next/server";
import { BillingAccessError, requireBillingContext } from "@/lib/billing/auth";
import { createPortal } from "@/lib/billing/service";

export async function POST() {
  try {
    const context = await requireBillingContext();
    const session = await createPortal({ companyId: context.companyId });
    return NextResponse.json({ portalUrl: session.url });
  } catch (error) {
    if (error instanceof BillingAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    const code = error instanceof Error ? error.message.split(":")[0] : "BILLING_PORTAL_FAILED";
    const status = code === "BILLING_CUSTOMER_NOT_FOUND" ? 404 : code === "BILLING_DISABLED" || code.includes("NOT_CONFIGURED") ? 503 : 400;
    return NextResponse.json({ error: code }, { status });
  }
}
