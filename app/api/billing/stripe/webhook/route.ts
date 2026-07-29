import { NextResponse } from "next/server";
import { isBillingEnabled, STRIPE_WEBHOOK_EVENTS } from "@/lib/billing/config";
import { getStripeClient, requireStripeWebhookSecret } from "@/lib/billing/stripe-client";
import { processStripeEvent } from "@/lib/billing/webhook";
import { webhookRequestContext } from "@/lib/platform/request-boundary";

export async function POST(request: Request) {
  return webhookRequestContext("stripe", "POST /api/billing/stripe/webhook", request, async () => {
    const signature = request.headers.get("stripe-signature");
    if (!signature) return NextResponse.json({ error: "STRIPE_SIGNATURE_MISSING" }, { status: 400 });
    let event: ReturnType<ReturnType<typeof getStripeClient>["webhooks"]["constructEvent"]>;
    try {
      const body = await request.text();
      event = getStripeClient().webhooks.constructEvent(body, signature, requireStripeWebhookSecret());
    } catch {
      return NextResponse.json({ error: "STRIPE_SIGNATURE_INVALID" }, { status: 400 });
    }
    if (!STRIPE_WEBHOOK_EVENTS.includes(event.type as (typeof STRIPE_WEBHOOK_EVENTS)[number])) {
      return NextResponse.json({ received: true, ignored: true });
    }
    try {
      const result = await processStripeEvent(event, { effectsEnabled: isBillingEnabled() });
      return NextResponse.json(
        { received: true, queued: result.result === "RECEIVED", duplicate: result.duplicate },
        { status: 202 },
      );
    } catch {
      return NextResponse.json({ error: "STRIPE_EVENT_PROCESSING_FAILED" }, { status: 500 });
    }
  });
}
