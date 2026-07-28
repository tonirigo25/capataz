import { createHmac, timingSafeEqual } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { Resend } from "resend";
import { hashCanonical } from "@/lib/platform/idempotency";
import { consumeRateLimit } from "@/lib/platform/rate-limit";
import { getRequestContext } from "@/lib/platform/request-context";

export type SignedWebhook = {
  provider: string;
  externalEventId: string;
  eventType: string;
  rawBody: string;
  signature: string;
  timestamp: number;
  secret: string;
  companyId?: string;
  toleranceSeconds?: number;
};

export function verifyHmacWebhook(input: SignedWebhook, now = Date.now()) {
  const tolerance = (input.toleranceSeconds ?? 300) * 1_000;
  if (Math.abs(now - input.timestamp * 1_000) > tolerance) throw new Error("WEBHOOK_TIMESTAMP_OUTSIDE_TOLERANCE");
  const expected = createHmac("sha256", input.secret).update(`${input.timestamp}.${input.rawBody}`).digest("hex");
  const provided = input.signature.replace(/^sha256=/, "").toLowerCase();
  const expectedBuffer = Buffer.from(expected, "hex");
  const providedBuffer = /^[a-f0-9]{64}$/.test(provided) ? Buffer.from(provided, "hex") : Buffer.alloc(0);
  if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) throw new Error("WEBHOOK_SIGNATURE_INVALID");
  return true;
}

export function verifyStripeWebhook(input: { rawBody: string; signatureHeader: string; secret: string; toleranceSeconds?: number }, now = Date.now()) {
  const parts = input.signatureHeader.split(",").map((part) => part.trim().split("=", 2));
  const timestamp = Number(parts.find(([key]) => key === "t")?.[1]);
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value).filter(Boolean);
  if (!Number.isInteger(timestamp) || signatures.length === 0) throw new Error("WEBHOOK_SIGNATURE_MALFORMED");
  let lastError: unknown;
  for (const signature of signatures) {
    try {
      return verifyHmacWebhook({ provider: "stripe", externalEventId: "pending", eventType: "pending", rawBody: input.rawBody, signature, timestamp, secret: input.secret, toleranceSeconds: input.toleranceSeconds }, now);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error("WEBHOOK_SIGNATURE_INVALID");
}

export function verifyResendWebhook(input: { rawBody: string; id: string; timestamp: string; signature: string; secret: string }) {
  const verifier = new Resend("webhook-verification-only");
  return verifier.webhooks.verify({ payload: input.rawBody, headers: { id: input.id, timestamp: input.timestamp, signature: input.signature }, webhookSecret: input.secret });
}

export async function persistVerifiedWebhook(prisma: PrismaClient, input: SignedWebhook) {
  const context = getRequestContext();
  const limit = await consumeRateLimit({ prisma, scope: `webhook:${input.provider}`, subject: input.companyId ?? input.provider, companyId: input.companyId, limit: 120, windowMs: 60_000 });
  if (!limit.allowed) throw new Error("WEBHOOK_RATE_LIMITED");
  verifyHmacWebhook(input);
  try {
    const event = await prisma.webhookEvent.create({ data: {
      companyId: input.companyId,
      provider: input.provider,
      externalEventId: input.externalEventId,
      eventType: input.eventType,
      schemaVersion: 1,
      payload: { bodyHash: hashCanonical(input.rawBody), timestamp: input.timestamp },
      signatureVerified: true,
      requestId: context?.requestId,
      correlationId: context?.correlationId,
      causationId: context?.causationId,
      operation: context?.operation,
      release: context?.release,
      environment: context?.environment,
    } });
    return { event, replayed: false };
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    const event = await prisma.webhookEvent.findUniqueOrThrow({ where: { provider_externalEventId: { provider: input.provider, externalEventId: input.externalEventId } } });
    return { event, replayed: true };
  }
}
