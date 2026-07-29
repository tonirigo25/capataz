import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { normalizeEmail } from "@/lib/auth/crypto";
import { queueEmailEvent } from "@/lib/email/outbox";
import { prisma } from "@/lib/prisma";
import { publicRequestContext } from "@/lib/platform/request-boundary";

const ALLOWED_REASONS = new Set(["informacion", "acceso", "soporte", "privacidad"]);
const ALLOWED_ORIGINS = new Set(["https://orqenatech.com", "https://app.orqenatech.com"]);

export async function POST(request: Request) {
  return publicRequestContext("POST /api/marketing/contact", request, async () => {
    if (!isAllowedOrigin(request.headers.get("origin"))) {
      return NextResponse.json({ ok: false, error: "ORIGIN_NOT_ALLOWED" }, { status: 403 });
    }

  let input: Record<string, unknown>;
    try {
      input = await request.json() as Record<string, unknown>;
    } catch {
      return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
    }

    if (clean(input.website, 200)) return NextResponse.json({ ok: true }, { status: 201 });
  const renderedAt = Number(input.renderedAt);
  const elapsed = Date.now() - renderedAt;
  const name = clean(input.name, 120);
  const email = normalizeEmail(clean(input.email, 200));
  const company = clean(input.company, 160);
  const reason = clean(input.reason, 40);
  const message = clean(input.message, 2_000);
  const consent = input.consent === true || input.consent === "true" || input.consent === "on";
  if (
    !name
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    || !ALLOWED_REASONS.has(reason)
    || message.length < 10
    || !consent
    || !Number.isFinite(renderedAt)
    || elapsed < 1_500
    || elapsed > 2 * 60 * 60 * 1_000
  ) {
    return NextResponse.json({ ok: false, error: "INVALID_REQUEST" }, { status: 400 });
  }

  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const hour = new Date().toISOString().slice(0, 13);
  const requestHash = hash(`${email}|${company}|${forwarded}|${hour}|contact`);
  const hourAgo = new Date(Date.now() - 60 * 60 * 1_000);
  if (await prisma.demoRequest.count({ where: { emailNormalized: email, createdAt: { gt: hourAgo } } }) >= 3) {
    return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 });
  }

    try {
      const contact = await prisma.$transaction(async (transaction) => {
        const saved = await transaction.demoRequest.upsert({
          where: { requestHash },
          update: {},
          create: {
            emailNormalized: email,
            displayName: name,
            companyName: company || "No indicada",
            message,
            consentAt: new Date(),
            source: "orqenatech-contact",
            requestHash,
            status: "PENDING",
          },
        });
        await queueEmailEvent(transaction, {
          eventKey: "contact_requested",
          recipient: "hola@orqenatech.com",
          payload: { demoRequestId: saved.id, reason },
          idempotencyKey: `contact-request:${requestHash}`,
        });
        await transaction.auditLog.create({
          data: {
            action: "marketing.contact.queued",
            targetType: "DemoRequest",
            targetId: saved.id,
            metadata: { source: "orqenatech.com", reason },
            ipHash: hash(forwarded),
          },
        });
        return saved;
      });
      return NextResponse.json({ ok: true, requestId: contact.id, delivery: "queued" }, { status: 202 });
    } catch (error) {
      const code = error instanceof Error ? error.message.split(":")[0].slice(0, 120) : "EMAIL_QUEUE_FAILED";
      await prisma.auditLog.create({
        data: {
          action: "marketing.contact.queue_failed",
          targetType: "DemoRequest",
          targetId: requestHash,
          metadata: { source: "orqenatech.com", reason, code },
          ipHash: hash(forwarded),
        },
      });
      return NextResponse.json({ ok: false, error: code }, { status: 503 });
    }
  });
}

function isAllowedOrigin(origin: string | null) {
  if (!origin) return process.env.NODE_ENV !== "production";
  if (ALLOWED_ORIGINS.has(origin)) return true;
  if (process.env.NODE_ENV === "production") return false;
  try {
    const url = new URL(origin);
    return ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  } catch {
    return false;
  }
}

function clean(value: unknown, max = 2_000) {
  return String(value ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ").trim().slice(0, max);
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
