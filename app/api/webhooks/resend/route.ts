import { ingestResendWebhook } from "@/lib/email/outbox";
import { prisma } from "@/lib/prisma";
import { webhookRequestContext } from "@/lib/platform/request-boundary";

export async function POST(request: Request) {
  return webhookRequestContext("resend", "POST /api/webhooks/resend", request, async () => {
  if (process.env.EMAIL_LIVE_ENABLED !== "true" || !process.env.RESEND_WEBHOOK_SECRET) return Response.json({ error: "email_disabled" }, { status: 503 });
  const rawBody = await request.text();
  const result = await ingestResendWebhook(prisma, { rawBody, id: request.headers.get("svix-id") ?? request.headers.get("webhook-id") ?? "", timestamp: request.headers.get("svix-timestamp") ?? request.headers.get("webhook-timestamp") ?? "", signature: request.headers.get("svix-signature") ?? request.headers.get("webhook-signature") ?? "", secret: process.env.RESEND_WEBHOOK_SECRET });
  return Response.json({ accepted: true, replayed: result.replayed });
  });
}
