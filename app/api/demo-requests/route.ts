import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { normalizeEmail } from "@/lib/auth/crypto";
import { prisma } from "@/lib/prisma";
import { queueEmailEvent } from "@/lib/email/outbox";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const input = contentType.includes("application/json") ? await request.json() as Record<string, unknown> : Object.fromEntries((await request.formData()).entries());
  const emailNormalized = normalizeEmail(String(input.email ?? ""));
  const displayName = clean(input.displayName ?? input.name, 100);
  const companyName = clean(input.companyName ?? input.company, 140);
  const consent = input.consent === true || input.consent === "true" || input.consent === "on";
  if (!/^\S+@\S+\.\S+$/.test(emailNormalized) || !displayName || !companyName || !consent) return NextResponse.json({ ok: false, error: "INVALID_REQUEST" }, { status: 400 });
  const hourAgo = new Date(Date.now() - 3_600_000);
  if (await prisma.demoRequest.count({ where: { emailNormalized, createdAt: { gt: hourAgo } } }) >= 3) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 });
  const forwarded = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const requestHash = createHash("sha256").update(`${emailNormalized}|${companyName}|${forwarded}|${new Date().toISOString().slice(0, 13)}`).digest("hex");
  const created = await prisma.$transaction(async (tx) => {
    const demo = await tx.demoRequest.upsert({ where: { requestHash }, update: {}, create: { emailNormalized, displayName, companyName, phone: clean(input.phone, 40), teamSize: clean(input.teamSize ?? input.companySize, 40), sectorKey: clean(input.sectorKey ?? input.sector, 60), message: clean(input.message ?? input.need, 1500), consentAt: new Date(), requestHash } });
    await tx.auditLog.create({ data: { action: "demo_request.created", targetType: "DemoRequest", targetId: demo.id, metadata: { source: "public-web", sectorKey: demo.sectorKey, teamSize: demo.teamSize }, ipHash: createHash("sha256").update(forwarded).digest("hex") } });
    await queueEmailEvent(tx as typeof prisma, { eventKey: "demo_requested", recipient: "demo-requests@orqena.invalid", payload: { demoRequestId: demo.id, source: "public-web" } });
    return demo;
  });
  return NextResponse.json({ ok: true, requestId: created.id }, { status: 201 });
}

function clean(value: unknown, max: number) { const normalized = String(value ?? "").trim(); return normalized ? normalized.slice(0, max) : undefined; }
