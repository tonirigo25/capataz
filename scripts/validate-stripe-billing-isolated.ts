import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  billingPlanForStripePrice,
  stripePriceForPlan,
} from "../lib/billing/config";
import { enforceExpiredBillingGrace } from "../lib/billing/grace-job";
import {
  isTerminalBillingEventResult,
  shouldIgnoreStripeEvent,
} from "../lib/billing/webhook";
import { evaluateUsageLimit } from "../lib/commercial/limits";

const results: Array<{ control: string; status: "PASS"; evidence: string }> = [];

async function control(name: string, evidence: string, run: () => void | Promise<void>) {
  await run();
  results.push({ control: name, status: "PASS", evidence });
}

async function main() {
  const previousBillingEnabled = process.env.BILLING_ENABLED;
  try {
    await control("grace-job-idempotency", "production job + fake Prisma transaction", async () => {
      process.env.BILLING_ENABLED = "true";
      const graceEndsAt = new Date("2026-07-29T03:00:00.000Z");
      const state = {
        id: "sub_test_company_a",
        companyId: "company_a",
        status: "PAST_DUE",
        graceEndsAt,
        readOnlyAt: null as Date | null,
        metadata: {} as Record<string, unknown>,
      };
      const histories: Array<Record<string, unknown>> = [];
      const audits: Array<Record<string, unknown>> = [];
      let locks = 0;
      const transaction = {
        $executeRaw: async () => {
          locks += 1;
          return 1;
        },
        subscription: {
          findUnique: async () => ({ ...state }),
          update: async ({ data }: { data: { readOnlyAt: Date; metadata: Record<string, unknown> } }) => {
            state.readOnlyAt = data.readOnlyAt;
            state.metadata = data.metadata;
            return { ...state };
          },
        },
        subscriptionHistory: {
          create: async ({ data }: { data: Record<string, unknown> }) => {
            histories.push(data);
            return data;
          },
        },
        auditLog: {
          create: async ({ data }: { data: Record<string, unknown> }) => {
            audits.push(data);
            return data;
          },
        },
      };
      const database = {
        subscription: { findMany: async () => [{ id: state.id }] },
        $transaction: async <T>(operation: (tx: typeof transaction) => Promise<T>) => operation(transaction),
      };

      const first = await enforceExpiredBillingGrace({
        database: database as never,
        now: new Date("2026-07-29T03:00:01.000Z"),
      });
      const replay = await enforceExpiredBillingGrace({
        database: database as never,
        now: new Date("2026-07-29T03:00:02.000Z"),
      });

      assert.deepEqual(first, { examined: 1, enforced: 1, skipped: null });
      assert.deepEqual(replay, { examined: 1, enforced: 0, skipped: null });
      assert.deepEqual(state.readOnlyAt, graceEndsAt);
      assert.equal(state.metadata.billingGraceEnforcedFor, graceEndsAt.toISOString());
      assert.equal(histories.length, 1);
      assert.equal(audits.length, 1);
      assert.equal(locks, 2);
    });

    await control("webhook-replay-order", "production pure functions", () => {
      assert.equal(isTerminalBillingEventResult("PROCESSED"), true);
      assert.equal(isTerminalBillingEventResult("VERIFIED_BILLING_DISABLED"), true);
      assert.equal(isTerminalBillingEventResult("FAILED:TRANSIENT"), false);
      assert.equal(shouldIgnoreStripeEvent({ stripeLastEventCreated: 200 }, 199), true);
      assert.equal(shouldIgnoreStripeEvent({ stripeLastEventCreated: 200 }, 200), false);
    });

    await control("price-ambiguity", "production resolver", () => {
      const environment = {
        STRIPE_PRICE_STARTER_MONTHLY: "price_same",
        STRIPE_PRICE_STARTER_ANNUAL: "price_same",
      };
      assert.throws(
        () => billingPlanForStripePrice("price_same", environment),
        /BILLING_PRICE_CONFIGURATION_AMBIGUOUS/,
      );
      assert.throws(
        () => stripePriceForPlan("STARTER", "month", {
          ...environment,
          STRIPE_PRICE_STARTER: "price_other",
        }),
        /BILLING_PRICE_CONFIGURATION_AMBIGUOUS/,
      );
    });

    await control("checkout-concurrency", "reference fake + production lock contract", async () => {
      const activeByCompany = new Map<string, string>();
      const reserve = async (companyId: string, idempotencyKey: string) => {
        const replayKey = `${companyId}:${idempotencyKey}`;
        if (activeByCompany.get(companyId) === replayKey) return "replay";
        if (activeByCompany.has(companyId)) throw new Error("BILLING_ACTIVE_SUBSCRIPTION_EXISTS");
        activeByCompany.set(companyId, replayKey);
        return "create";
      };
      const concurrent = await Promise.allSettled([
        reserve("company_a", "attempt_a"),
        reserve("company_a", "attempt_b"),
      ]);
      assert.equal(concurrent.filter((result) => result.status === "fulfilled").length, 1);
      assert.equal(concurrent.filter((result) => result.status === "rejected").length, 1);
      assert.equal(await reserve("company_a", "attempt_a"), "replay");

      const service = readFileSync("lib/billing/service.ts", "utf8");
      assert.match(service, /pg_advisory_xact_lock/);
      assert.match(service, /BILLING_CHECKOUT_IN_PROGRESS/);
      assert.match(service, /BILLING_ACTIVE_SUBSCRIPTION_EXISTS/);
    });

    await control("tenant-authority", "production route contract", () => {
      const checkout = readFileSync("app/api/billing/checkout/route.ts", "utf8");
      const portal = readFileSync("app/api/billing/portal/route.ts", "utf8");
      const authorization = readFileSync("lib/billing/auth.ts", "utf8");
      assert.match(checkout, /companyId:\s*context\.companyId/);
      assert.doesNotMatch(checkout, /input\.companyId|body\.companyId/);
      assert.match(portal, /companyId:\s*context\.companyId/);
      assert.match(authorization, /resolveAuthorization\(context,\s*"company\.billing\.manage"\)/);
    });

    await control("usage-limits", "production pure functions", () => {
      const warning = evaluateUsageLimit({ used: 3, quantity: 1, limit: 5, operation: "CREATE" });
      const blocked = evaluateUsageLimit({ used: 5, quantity: 1, limit: 5, operation: "CREATE" });
      const read = evaluateUsageLimit({ used: 6, limit: 5, operation: "READ" });
      assert.deepEqual(
        { warning: warning.warning, allowed: warning.allowed, utilization: warning.utilization },
        { warning: true, allowed: true, utilization: 0.8 },
      );
      assert.equal(blocked.blocked, true);
      assert.equal(blocked.allowed, false);
      assert.equal(blocked.audit.automaticCharge, false);
      assert.equal(read.allowed, true);
      assert.equal(read.blocked, false);
    });
  } finally {
    if (previousBillingEnabled === undefined) delete process.env.BILLING_ENABLED;
    else process.env.BILLING_ENABLED = previousBillingEnabled;
  }

  console.log(JSON.stringify({
    ok: true,
    evidence: "isolated-fake-and-production-contract",
    controls: results.length,
    database: "fake-prisma-transaction",
    externalCalls: 0,
    liveMutations: 0,
    results,
  }, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "ISOLATED_STRIPE_VALIDATION_FAILED";
  console.error(`[stripe-isolated] FAIL ${message}`);
  process.exitCode = 1;
});
