import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { recordFirstPartyEvent } from "../../lib/product/analytics";
import { buildPlatformHealthSnapshot } from "../../lib/product/metrics";
import { recordPilotFeedback, registerVerifiedServiceCost, setTestimonialConsent, updateSupportTicketOperations, upsertPilotCohort, upsertProductExperiment } from "../../lib/product/pilot-governance";
import { createAuthenticatedSupportTicket } from "../../lib/product/support-service";
import { reconcileBillingSubscription } from "../../lib/commercial/subscription-service";
import { withRequestContext } from "../../lib/platform/request-context";

const prisma = new PrismaClient();
const now = new Date("2026-07-26T12:00:00.000Z");

async function main() {
  let passed = 0;
  async function check(name: string, operation: () => unknown | Promise<unknown>) { await operation(); passed += 1; process.stdout.write(`PASS ${name}\n`); }
  const migrations = await prisma.$queryRaw<Array<{ count: number }>>`SELECT COUNT(*)::int AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;
  assert.equal(migrations[0]?.count, 45);
  const suffix = Date.now().toString(36);
  const [companyA, companyB] = await Promise.all([
    prisma.company.create({ data: { slug: `f8-a-${suffix}`, nombreComercial: "F8 Synthetic Alpha", createdAt: new Date("2026-03-01T00:00:00.000Z") } }),
    prisma.company.create({ data: { slug: `f8-b-${suffix}`, nombreComercial: "F8 Synthetic Beta", createdAt: new Date("2026-03-01T00:00:00.000Z") } }),
  ]);
  const [userA, userB] = await Promise.all([
    prisma.user.create({ data: { email: `f8-a-${suffix}@example.invalid`, emailNormalized: `f8-a-${suffix}@example.invalid`, passwordHash: "synthetic-only", displayName: "F8 Alpha", status: "active" } }),
    prisma.user.create({ data: { email: `f8-b-${suffix}@example.invalid`, emailNormalized: `f8-b-${suffix}@example.invalid`, passwordHash: "synthetic-only", displayName: "F8 Beta", status: "active" } }),
  ]);

  await check("first-party event is idempotent and tenant bound", async () => {
    const first = await recordFirstPartyEvent(prisma, { eventId: `f8-active-${suffix}`, companyId: companyA.id, actorId: userA.id, eventName: "user.active", properties: { surface: "app" }, occurredAt: now });
    const replay = await recordFirstPartyEvent(prisma, { eventId: `f8-active-${suffix}`, companyId: companyA.id, actorId: userA.id, eventName: "user.active", properties: { surface: "app" }, occurredAt: now });
    assert.equal(first.replayed, false);
    assert.equal(replay.replayed, true);
    await assert.rejects(() => recordFirstPartyEvent(prisma, { eventId: `f8-active-${suffix}`, companyId: companyB.id, actorId: userB.id, eventName: "user.active", properties: { surface: "app" } }), /PRODUCT_EVENT_ID_REUSED/);
    await assert.rejects(() => recordFirstPartyEvent(prisma, { eventId: `f8-private-${suffix}`, companyId: companyA.id, eventName: "user.active", properties: { surface: "synthetic@example.invalid" } }));
  });

  await check("activation retention and value events use synthetic allowlisted data", async () => {
    await Promise.all([
      recordFirstPartyEvent(prisma, { eventId: `f8-activation-${suffix}`, companyId: companyA.id, actorId: userA.id, eventName: "activation.completed", properties: { milestone: "all", withinSevenDays: true, measurementVersion: "f7-v1" }, occurredAt: new Date("2026-03-05T00:00:00.000Z") }),
      recordFirstPartyEvent(prisma, { eventId: `f8-m1-${suffix}`, companyId: companyA.id, actorId: userA.id, eventName: "user.active", properties: { surface: "app" }, occurredAt: new Date("2026-04-10T00:00:00.000Z") }),
      recordFirstPartyEvent(prisma, { eventId: `f8-m2-${suffix}`, companyId: companyA.id, actorId: userA.id, eventName: "user.active", properties: { surface: "app" }, occurredAt: new Date("2026-05-10T00:00:00.000Z") }),
      recordFirstPartyEvent(prisma, { eventId: `f8-m3-${suffix}`, companyId: companyA.id, actorId: userA.id, eventName: "user.active", properties: { surface: "app" }, occurredAt: new Date("2026-06-10T00:00:00.000Z") }),
      recordFirstPartyEvent(prisma, { eventId: `f8-time-${suffix}`, companyId: companyA.id, actorId: userA.id, eventName: "outcome.time_saved", properties: { minutes: 45, methodology: "workflow_baseline_v1" }, occurredAt: now }),
      recordFirstPartyEvent(prisma, { eventId: `f8-ai-${suffix}`, companyId: companyA.id, actorId: userA.id, eventName: "outcome.ai_action", properties: { outcome: "accepted", minutesSaved: 15 }, occurredAt: now }),
    ]);
  });

  const plan = await prisma.plan.create({ data: { key: `f8-paid-${suffix}`, name: "F8 Synthetic Paid", description: "Fixture only", audience: "test", commercialState: "internal", currency: "EUR", period: "month", price: 100 } });
  const periodStart = new Date("2026-07-01T00:00:00.000Z");
  const periodEnd = new Date("2026-08-01T00:00:00.000Z");
  await prisma.subscription.create({ data: { companyId: companyA.id, planId: plan.id, status: "ACTIVE", provider: "stripe", currentPeriodStart: periodStart, currentPeriodEnd: periodEnd, cancelAtPeriodEnd: false } });
  await check("MRR uses only matching provider reconciliation", async () => {
    const run = await reconcileBillingSubscription(prisma, { companyId: companyA.id, provider: "stripe", providerSnapshot: { status: "ACTIVE", currentPeriodStart: periodStart.toISOString(), currentPeriodEnd: periodEnd.toISOString(), cancelAtPeriodEnd: false, planKey: plan.key, mrrEur: 100 } });
    assert.equal(run.status, "MATCHED");
    assert.equal(run.divergenceCount, 0);
    await prisma.subscription.create({ data: { companyId: companyB.id, planId: plan.id, status: "ACTIVE", provider: "local", currentPeriodStart: periodStart, currentPeriodEnd: periodEnd, cancelAtPeriodEnd: false } });
    const diverged = await reconcileBillingSubscription(prisma, { companyId: companyB.id, provider: "stripe", providerSnapshot: { status: "PAST_DUE", currentPeriodStart: periodStart.toISOString(), currentPeriodEnd: periodEnd.toISOString(), cancelAtPeriodEnd: false, planKey: plan.key, mrrEur: 999 } });
    assert.equal(diverged.status, "DIVERGED");
  });

  await check("cost ledger accepts verified evidence and excludes unverified amounts", async () => {
    const verified = await registerVerifiedServiceCost(prisma, { companyId: companyA.id, periodStart, periodEnd, category: "INFRASTRUCTURE", amount: 50, sourceType: "PROVIDER_INVOICE", sourceReference: "synthetic-invoice-001", verified: true, planKey: plan.key });
    const replay = await registerVerifiedServiceCost(prisma, { companyId: companyA.id, periodStart, periodEnd, category: "INFRASTRUCTURE", amount: 50, sourceType: "PROVIDER_INVOICE", sourceReference: "synthetic-invoice-001", verified: true, planKey: plan.key });
    assert.equal(replay.id, verified.id);
    await registerVerifiedServiceCost(prisma, { companyId: companyB.id, periodStart, periodEnd, category: "AI", amount: 999, sourceType: "MEASURED_USAGE", sourceReference: "synthetic-unverified", verified: false });
  });

  const clientA = await prisma.client.create({ data: { companyId: companyA.id, nombre: "Synthetic Client A", telefono: "600000001", direccion: "Synthetic Street 1", tipo: "empresa", origen: "fixture" } });
  await prisma.budget.createMany({ data: [
    { companyId: companyA.id, clienteId: clientA.id, numero: `F8-A-${suffix}`, titulo: "Accepted fixture", partidas: "[]", subtotal: 100, iva: 21, total: 121, margenEstimado: 20, estado: "aceptado" },
    { companyId: companyA.id, clienteId: clientA.id, numero: `F8-R-${suffix}`, titulo: "Rejected fixture", partidas: "[]", subtotal: 100, iva: 21, total: 121, margenEstimado: 20, estado: "rechazado" },
  ] });
  const invoice = await prisma.invoice.create({ data: { companyId: companyA.id, clienteId: clientA.id, numero: `F8-I-${suffix}`, concepto: "Synthetic invoice", importeBase: 100, iva: 21, total: 121, pagado: 121, pendiente: 0, fechaEmision: new Date("2026-04-01T00:00:00.000Z"), fechaVencimiento: new Date("2026-04-30T00:00:00.000Z"), estado: "pagada" } });
  await prisma.payment.create({ data: { companyId: companyA.id, facturaId: invoice.id, clienteId: clientA.id, importe: 121, metodo: "synthetic", fecha: new Date("2026-05-10T00:00:00.000Z"), tipo: "pago_final" } });

  let cohortId = "";
  await check("pilot lifecycle has paid contract consent criteria and handoff", async () => {
    const cohort = await upsertPilotCohort(prisma, { companyId: companyA.id, cohortKey: `pilot-${suffix}`, status: "COMPLETED", startsAt: periodStart, endsAt: new Date("2026-07-20T00:00:00.000Z"), paid: true, contractStatus: "SIGNED", consentStatus: "GRANTED", goals: ["Validar activación"], successCriteria: ["Activación en siete días"], cadence: "WEEKLY", onboardingStartedAt: new Date("2026-07-01T09:00:00.000Z"), onboardingCompletedAt: new Date("2026-07-01T10:00:00.000Z"), resultStatus: "SUCCESS", outcome: { summary: "Synthetic success", metrics: ["activation_7d=true"] }, handoff: { commercialSummary: "Paid synthetic pilot", supportNeeds: "Weekly review", productFocus: "Activation" } });
    cohortId = cohort.id;
    assert.equal(cohort.paid, true);
    assert.equal(cohort.resultStatus, "SUCCESS");
    assert(cohort.onboardingStartedAt && cohort.onboardingCompletedAt);
    assert.equal(cohort.onboardingCompletedAt.getTime() - cohort.onboardingStartedAt.getTime(), 3_600_000);
    await assert.rejects(() => recordPilotFeedback(prisma, { companyId: companyA.id, cohortId, actorId: userA.id, category: "NPS", score: 9, comment: "No consent", consentGranted: false, contactAllowed: false }), /CONSENT_REQUIRED/);
    const feedback = await recordPilotFeedback(prisma, { companyId: companyA.id, cohortId, actorId: userA.id, category: "NPS", score: 9, comment: "Synthetic feedback synthetic@example.invalid 600000000", consentGranted: true, contactAllowed: false });
    assert.equal(feedback.sentiment, "PROMOTER");
    assert.doesNotMatch(feedback.content, /synthetic@example|600000000/);
    await assert.rejects(() => recordPilotFeedback(prisma, { companyId: companyB.id, cohortId, actorId: userB.id, category: "CSAT", score: 5, consentGranted: true, contactAllowed: false }), /COHORT_NOT_FOUND/);
  });

  await check("testimonial consent is scoped and revocable", async () => {
    const granted = await setTestimonialConsent(prisma, { companyId: companyA.id, actorId: userA.id, scopes: ["anonymous_quote"], granted: true, artifactReference: "synthetic-case-001" });
    assert.equal(granted.status, "GRANTED");
    const withdrawn = await setTestimonialConsent(prisma, { companyId: companyA.id, actorId: userA.id, scopes: [], granted: false });
    assert.equal(withdrawn.status, "WITHDRAWN");
    assert(withdrawn.withdrawnAt);
  });

  await check("experiment has metric guardrails and decision", async () => {
    const experiment = await upsertProductExperiment(prisma, { experimentKey: `activation-${suffix}`, area: "ONBOARDING", hypothesis: "A shorter checklist improves activation", primaryMetric: "activation_7d", guardrails: ["support_minutes"], status: "DECIDED", decision: "Keep synthetic variant" });
    assert.equal(experiment.status, "DECIDED");
    assert(experiment.decisionAt);
  });

  await check("support SLA time and satisfaction are tenant scoped", async () => {
    const ticket = await withRequestContext({ requestId: `f8-request-${suffix}`, correlationId: `f8-correlation-${suffix}`, causationId: `f8-causation-${suffix}`, companyId: companyA.id, actor: { type: "user", id: userA.id }, release: "synthetic-release", environment: "test" }, () => createAuthenticatedSupportTicket(prisma, { companyId: companyA.id, actorId: userA.id, category: "OPERATIONS", priority: "URGENT", subject: "Synthetic support", description: "Synthetic operational fixture without customer content." }));
    assert(ticket.firstResponseDueAt);
    assert(Math.abs(ticket.firstResponseDueAt.getTime() - ticket.createdAt.getTime() - 3_600_000) < 1_000);
    await assert.rejects(() => updateSupportTicketOperations(prisma, { companyId: companyB.id, ticketId: ticket.id, status: "RESOLVED", minutes: 10, resolutionCode: "GUIDANCE", satisfactionScore: 5, satisfactionConsent: true }));
    const resolved = await updateSupportTicketOperations(prisma, { companyId: companyA.id, ticketId: ticket.id, status: "RESOLVED", minutes: 30, resolutionCode: "GUIDANCE", satisfactionScore: 5, satisfactionConsent: true });
    assert.equal(resolved.supportMinutes, 30);
    assert(resolved.resolvedAt && resolved.satisfactionConsentAt);
  });

  await check("aggregate snapshot excludes identifiers and unverified sources", async () => {
    const snapshot = await buildPlatformHealthSnapshot(prisma, now);
    assert.equal(snapshot.methodologyVersion, "f8-v1");
    assert.equal(snapshot.activation.rate, 1);
    assert.equal(snapshot.wau.users, 1);
    assert.equal(snapshot.wau.companies, 1);
    assert.deepEqual(snapshot.retention.map((row) => row.rate), [0.5, 0.5, 0.5]);
    assert.equal(snapshot.commercial.mrrEur, 100);
    assert.equal(snapshot.commercial.reconciledCompanies, 1);
    assert.equal(snapshot.commercial.localSimulationIncluded, false);
    assert.equal(snapshot.economics.verifiedCostEur, 50);
    assert.equal(snapshot.economics.grossMarginEur, 50);
    assert.equal(snapshot.economics.grossMarginRate, 0.5);
    assert.equal(snapshot.value.budgetConversionRate, 0.5);
    assert.equal(snapshot.value.recoveredDebtEur, 121);
    assert.equal(snapshot.value.minutesSaved, 60);
    assert.equal(snapshot.support.hours, 0.5);
    const serialized = JSON.stringify(snapshot);
    assert.doesNotMatch(serialized, new RegExp([companyA.id, companyB.id, userA.id, userB.id, "Synthetic Client", "synthetic@example"].join("|")));
  });

  await check("tenant B remains isolated", async () => {
    assert.equal(await prisma.pilotCohort.count({ where: { companyId: companyB.id } }), 0);
    assert.equal(await prisma.pilotFeedback.count({ where: { companyId: companyB.id } }), 0);
    assert.equal(await prisma.testimonialConsent.count({ where: { companyId: companyB.id } }), 0);
    assert.equal(await prisma.supportTicket.count({ where: { companyId: companyB.id } }), 0);
  });

  console.log(JSON.stringify({ ok: true, passed, migrations: migrations[0]?.count, companies: 2, methodology: "f8-v1", data: "synthetic-only", externalCalls: 0, productionWrites: 0 }, null, 2));
}

main().finally(() => prisma.$disconnect()).catch((error) => { console.error(error); process.exitCode = 1; });
