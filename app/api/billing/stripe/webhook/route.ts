import { NextResponse } from "next/server";
import { isBillingEnabled } from "@/lib/billing/config";
import { getStripeClient, requireStripeWebhookSecret } from "@/lib/billing/stripe-client";
import { processStripeEvent } from "@/lib/billing/webhook";
import { webhookRequestContext } from "@/lib/platform/request-boundary";

export async function POST(request: Request) {
  return webhookRequestContext("stripe", "POST /api/billing/stripe/webhook", request, async () => {
    if (!isBillingEnabled()) {
      return NextResponse.json({ error: "BILLING_DISABLED" }, { status: 503 });
    }
    const signature = request.headers.get("stripe-signature");
    if (!signature) return NextResponse.json({ error: "STRIPE_SIGNATURE_MISSING" }, { status: 400 });
    let event;
    try {
      const body = await request.text();
      event = getStripeClient().webhooks.constructEvent(body, signature, requireStripeWebhookSecret());
    } catch {
      return NextResponse.json({ error: "STRIPE_SIGNATURE_INVALID" }, { status: 400 });
    }
    try {
      const result = await processStripeEvent(event);
      return NextResponse.json({ received: true, duplicate: result.duplicate, result: result.result });
    } catch {
      return NextResponse.json({ error: "STRIPE_EVENT_PROCESSING_FAILED" }, { status: 500 });
    }
  });
}
