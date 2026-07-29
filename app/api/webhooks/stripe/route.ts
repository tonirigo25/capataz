import { webhookRequestContext } from "@/lib/platform/request-boundary";

export async function POST(request: Request) {
  return webhookRequestContext("stripe", "POST /api/webhooks/stripe", request, async () => {
    return Response.json({
      error: "STRIPE_WEBHOOK_ENDPOINT_RETIRED",
      canonical: "/api/billing/stripe/webhook",
    }, {
      status: 410,
      headers: { "cache-control": "no-store" },
    });
  });
}
