import { ingestStripeBillingWebhook } from "@/lib/commercial/subscription-service";
import { prisma } from "@/lib/prisma";
import { webhookRequestContext } from "@/lib/platform/request-boundary";

export async function POST(request: Request) {
  return webhookRequestContext("stripe", "POST /api/webhooks/stripe", request, async () => {
  if (process.env.BILLING_ENABLED !== "true" || !process.env.STRIPE_WEBHOOK_SECRET) return Response.json({ error: "billing_disabled" }, { status: 503 });
  const rawBody = await request.text();
  const signatureHeader = request.headers.get("stripe-signature") ?? "";
  const result = await ingestStripeBillingWebhook(prisma, { rawBody, signatureHeader, webhookSecret: process.env.STRIPE_WEBHOOK_SECRET });
  return Response.json({ accepted: true, replayed: result.replayed });
  });
}
