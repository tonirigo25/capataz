import { createHash } from "node:crypto";
import { normalizeEmail } from "@/lib/auth/crypto";
import { queueEmailEvent } from "@/lib/email/outbox";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/lib/platform/rate-limit";

export type DemoRequestInput = {
  email: string;
  displayName: string;
  companyName: string;
  phone?: string;
  teamSize?: string;
  sectorKey?: string;
  message?: string;
  consent: boolean;
  sourceAddress: string;
};

export async function requestProductDemo(input: DemoRequestInput) {
  const emailNormalized = normalizeEmail(input.email);
  if (!/^\S+@\S+\.\S+$/.test(emailNormalized) || !input.displayName || !input.companyName || !input.consent) throw new Error("INVALID_DEMO_REQUEST");
  const limit = await consumeRateLimit({ prisma, scope: "demo_request", subject: `${emailNormalized}:${input.sourceAddress}`, limit: 3, windowMs: 3_600_000 });
  if (!limit.allowed) throw new Error("DEMO_RATE_LIMITED");
  const requestHash = createHash("sha256").update(`${emailNormalized}|${input.companyName}|${input.sourceAddress}|${new Date().toISOString().slice(0, 13)}`).digest("hex");
  return prisma.$transaction(async (transaction) => {
    const demo = await transaction.demoRequest.upsert({
      where: { requestHash },
      update: {},
      create: { emailNormalized, displayName: input.displayName, companyName: input.companyName, phone: input.phone, teamSize: input.teamSize, sectorKey: input.sectorKey, message: input.message, consentAt: new Date(), requestHash },
    });
    await transaction.auditLog.create({ data: { action: "demo_request.created", targetType: "DemoRequest", targetId: demo.id, metadata: { source: "public-web", sectorKey: demo.sectorKey, teamSize: demo.teamSize }, ipHash: createHash("sha256").update(input.sourceAddress).digest("hex") } });
    await queueEmailEvent(transaction as typeof prisma, { eventKey: "demo_requested", recipient: "demo-requests@orqena.invalid", payload: { demoRequestId: demo.id, source: "public-web" } });
    return demo;
  });
}
