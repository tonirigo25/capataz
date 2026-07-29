import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { prisma } from "../../lib/prisma";
import { claimEmailItem, processClaimedEmail, queueEmailEvent } from "../../lib/email/outbox";
import { getEmailDeliveryProvider } from "../../lib/email";

if (process.env.EMAIL_LIVE_SMOKE !== "true") throw new Error("EMAIL_LIVE_SMOKE_EXPLICIT_OPT_IN_REQUIRED");
if (process.env.EMAIL_LIVE_ENABLED !== "true") throw new Error("EMAIL_LIVE_DISABLED");
if (process.env.EMAIL_TRACKING_ENABLED !== "false") throw new Error("EMAIL_TRACKING_MUST_REMAIN_DISABLED");
const companyId = process.env.EMAIL_LIVE_SMOKE_COMPANY_ID?.trim();
if (!companyId) throw new Error("EMAIL_LIVE_SMOKE_COMPANY_ID_REQUIRED");
const controlledCompanyId = companyId;

const scenarios = [
  { key: "delivered", recipient: "delivered@resend.dev" },
  { key: "bounced", recipient: "bounced@resend.dev" },
  { key: "complained", recipient: "complained@resend.dev" },
  { key: "suppressed", recipient: "suppressed@resend.dev" },
] as const;

async function providerStatus(reference: string) {
  const response = await fetch(`https://api.resend.com/emails/${encodeURIComponent(reference)}`, {
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY ?? ""}` },
  });
  const payload = await response.json().catch(() => null) as { last_event?: unknown; statusCode?: unknown; name?: unknown } | null;
  return {
    httpStatus: response.status,
    lastEvent: typeof payload?.last_event === "string" ? payload.last_event : null,
    errorType: response.ok ? null : typeof payload?.name === "string" ? payload.name : "provider_read_unavailable",
  };
}

async function main() {
  const provider = getEmailDeliveryProvider();
  if (provider.name !== "resend" || provider.mode !== "live") throw new Error("RESEND_LIVE_PROVIDER_REQUIRED");
  const runId = randomUUID();
  const sent: Array<{ scenario: string; outboxId: string; reference: string }> = [];
  for (const scenario of scenarios) {
    const item = await queueEmailEvent(prisma, {
      companyId: controlledCompanyId,
      eventKey: "support_update",
      recipient: scenario.recipient,
      payload: { fixture: "synthetic-live-smoke", scenario: scenario.key },
      idempotencyKey: `email-live-smoke:${runId}:${scenario.key}`,
    });
    const claimed = await claimEmailItem(prisma, { id: item.id, companyId: controlledCompanyId });
    if (!claimed) throw new Error("EMAIL_LIVE_SMOKE_CLAIM_FAILED");
    const result = await processClaimedEmail(prisma, claimed, provider);
    if (result.status !== "SENT") throw new Error(`EMAIL_LIVE_SMOKE_SEND_FAILED:${scenario.key}`);
    const stored = await prisma.emailOutbox.findUniqueOrThrow({ where: { id: item.id }, select: { providerMessageId: true } });
    if (!stored.providerMessageId) throw new Error("EMAIL_LIVE_SMOKE_PROVIDER_REFERENCE_MISSING");
    sent.push({ scenario: scenario.key, outboxId: item.id, reference: stored.providerMessageId });
  }
  await delay(8_000);
  const results = [];
  for (const item of sent) {
    const [providerResult, stored] = await Promise.all([
      providerStatus(item.reference),
      prisma.emailOutbox.findUniqueOrThrow({ where: { id: item.outboxId }, select: { status: true, lastError: true } }),
    ]);
    results.push({ scenario: item.scenario, acceptedByProvider: true, provider: providerResult, outboxStatus: stored.status, webhookEvent: stored.lastError?.startsWith("email.") ? stored.lastError : null });
  }
  console.log(JSON.stringify({ ok: true, fixture: "official-resend-test-addresses", tracking: false, rawContentLogged: false, results }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "EMAIL_LIVE_SMOKE_FAILED");
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
