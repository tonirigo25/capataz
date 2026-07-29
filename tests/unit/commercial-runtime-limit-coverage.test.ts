import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { durableAuditEvents, durableAuditRequestIds, durableTransaction, getEntitlements } = vi.hoisted(() => {
  const events: Array<Record<string, unknown>> = [];
  const requestIds = new Set<string>();
  return {
    durableAuditEvents: events,
    durableAuditRequestIds: requestIds,
    durableTransaction: vi.fn(async (operation: (transaction: unknown) => Promise<unknown>) =>
      operation({
        $executeRaw: vi.fn(async () => 1),
        auditLog: {
          findFirst: vi.fn(async ({ where }: { where: { requestId: string } }) =>
            requestIds.has(where.requestId) ? { id: where.requestId } : null),
          create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
            const requestId = String(data.requestId);
            requestIds.add(requestId);
            events.push(data);
            return data;
          }),
        },
      })),
    getEntitlements: vi.fn(),
  };
});

vi.mock("../../lib/commercial/authorization", () => ({
  getEntitlements,
}));

vi.mock("../../lib/prisma", () => ({
  prisma: { $transaction: durableTransaction },
}));

import {
  assertEntitlementMutationAllowed,
  currentUsagePeriod,
  recordLimitedUsage,
} from "../../lib/commercial/usage";

describe("commercial runtime limit guard", () => {
  beforeEach(() => {
    durableAuditEvents.length = 0;
    durableAuditRequestIds.clear();
    durableTransaction.mockClear();
    getEntitlements.mockReset();
  });

  it("locks before measuring and allows reaching exactly 100 percent", async () => {
    const calls: string[] = [];
    const transaction = {
      $executeRaw: vi.fn(async () => {
        calls.push("lock");
        return 1;
      }),
    };
    getEntitlements.mockImplementationOnce(async () => {
      calls.push("entitlements");
      return { values: { max_automations: 5 } };
    });

    const decision = await assertEntitlementMutationAllowed(
      transaction as never,
      {
        companyId: "company-a",
        limitKey: "max_automations",
        quantity: 1,
        measure: async () => {
          calls.push("measure");
          return 4;
        },
      },
    );

    expect(calls[0]).toBe("lock");
    expect(decision).toMatchObject({
      allowed: true,
      warning: true,
      projected: 5,
      remaining: 0,
      audit: { automaticCharge: false },
    });
  });

  it("durably audits a blocked creating mutation before propagating the error", async () => {
    const transaction = { $executeRaw: vi.fn(async () => 1) };
    getEntitlements.mockResolvedValueOnce({
      values: { max_documents: 250 },
    });

    await expect(
      assertEntitlementMutationAllowed(transaction as never, {
        companyId: "company-a",
        limitKey: "max_documents",
        audit: {
          actorId: "user-a",
          origin: "document_create",
          targetType: "Document",
          targetId: "sensitive-document-reference",
          idempotencyKey: "request-a",
        },
        measure: async () => 250,
      }),
    ).rejects.toThrow("USAGE_LIMIT_REACHED_NO_AUTOMATIC_CHARGE");

    expect(durableAuditEvents).toHaveLength(1);
    expect(durableAuditEvents[0]).toMatchObject({
      companyId: "company-a",
      userActorId: "user-a",
      action: "commercial.limit_evaluated",
      targetType: "Document",
      requestId: expect.stringMatching(/^limit-blocked:[a-f0-9]{32}$/),
      metadata: {
        origin: "document_create",
        limitKey: "max_documents",
        used: 250,
        requested: 1,
        projected: 251,
        limit: 250,
        outcome: "blocked",
        automaticCharge: false,
        targetReferenceHash: expect.stringMatching(/^[a-f0-9]{32}$/),
      },
    });
    expect(JSON.stringify(durableAuditEvents[0])).not.toContain(
      "sensitive-document-reference",
    );
  });

  it("deduplicates a retried blocked request while preserving the tenant scope", async () => {
    const transaction = { $executeRaw: vi.fn(async () => 1) };
    getEntitlements.mockResolvedValue({
      values: { max_documents: 250 },
    });
    const blocked = () =>
      assertEntitlementMutationAllowed(transaction as never, {
        companyId: "company-a",
        limitKey: "max_documents",
        audit: {
          origin: "document_create",
          idempotencyKey: "request-a",
        },
        measure: async () => 250,
      });

    await expect(blocked()).rejects.toThrow(
      "USAGE_LIMIT_REACHED_NO_AUTOMATIC_CHARGE",
    );
    await expect(blocked()).rejects.toThrow(
      "USAGE_LIMIT_REACHED_NO_AUTOMATIC_CHARGE",
    );

    expect(durableAuditEvents).toHaveLength(1);
    expect(durableAuditEvents[0]).toMatchObject({ companyId: "company-a" });
    expect(durableTransaction).toHaveBeenCalledTimes(2);
  });

  it("commits the blocked audit without creating the rejected usage record", async () => {
    const createUsage = vi.fn();
    const transaction = {
      $executeRaw: vi.fn(async () => 1),
      usageRecord: {
        findUnique: vi.fn(async () => null),
        aggregate: vi.fn(async () => ({ _sum: { quantity: 5 } })),
        create: createUsage,
      },
    };
    const database = {
      $transaction: vi.fn(async (operation: (tx: typeof transaction) => Promise<unknown>) =>
        operation(transaction)),
    };
    const periodStart = new Date("2026-07-01T00:00:00.000Z");
    const periodEnd = new Date("2026-08-01T00:00:00.000Z");

    await expect(recordLimitedUsage(database as never, {
      companyId: "company-a",
      metric: "documents",
      limit: 5,
      quantity: 1,
      idempotencyKey: "documents-request-a",
      origin: "document_create",
      reference: "sensitive-document-reference",
      periodStart,
      periodEnd,
    })).rejects.toThrow("USAGE_LIMIT_REACHED_NO_AUTOMATIC_CHARGE");

    expect(createUsage).not.toHaveBeenCalled();
    expect(durableAuditEvents).toHaveLength(1);
    expect(durableAuditEvents[0]).toMatchObject({
      companyId: "company-a",
      action: "commercial.limit_evaluated",
      metadata: {
        origin: "document_create",
        limitKey: "explicit",
        outcome: "blocked",
        automaticCharge: false,
      },
    });
    expect(JSON.stringify(durableAuditEvents[0])).not.toContain(
      "documents-request-a",
    );
    expect(JSON.stringify(durableAuditEvents[0])).not.toContain(
      "sensitive-document-reference",
    );
  });

  it("uses stable UTC month boundaries for monthly limits", () => {
    expect(currentUsagePeriod(new Date("2026-07-29T23:50:00-05:00"))).toEqual({
      periodStart: new Date("2026-07-01T00:00:00.000Z"),
      periodEnd: new Date("2026-08-01T00:00:00.000Z"),
    });
  });
});

describe("runtime creation paths", () => {
  it.each([
    [
      "app/api/documents/presign-upload/route.ts",
      "assertDocumentCreationAllowed",
    ],
    [
      "lib/application/finance/expense-use-cases.ts",
      "assertDocumentCreationAllowed",
    ],
    [
      "lib/application/operations/management-use-cases.ts",
      "assertDocumentCreationAllowed",
    ],
    ["lib/product/import-service.ts", "assertDocumentCreationAllowed"],
    [
      "lib/application/automation/automation-use-cases.ts",
      "assertEntitlementMutationAllowed",
    ],
    ["lib/commercial/provisioning.ts", "assertEntitlementMutationAllowed"],
    ["lib/private-storage.ts", "assertStorageMutationAllowed"],
    ["lib/ai/prisma-store.ts", "assertEntitlementMutationAllowed"],
  ])("%s routes creation through %s", (path, guard) => {
    const source = readFileSync(path, "utf8");
    expect(source).toContain(guard);
    expect(source).toContain('isolationLevel: "Serializable"');
  });

  it("does not let registration bypass invitation capacity", () => {
    const source = readFileSync(
      "lib/application/auth/auth-use-cases.ts",
      "utf8",
    );
    expect(source).toContain("acceptEmployeeInvitationDuringRegistration");
    expect(source).not.toContain("tx.companyMembership.create");

    const invitationService = readFileSync(
      "lib/commercial/invitation-service.ts",
      "utf8",
    );
    expect(invitationService).toContain(
      "acceptEmployeeInvitationDuringRegistration",
    );
    expect(invitationService).toContain('limitKey: "max_members"');
    expect(invitationService).toContain("excludeInvitationId: invitation.id");
  });

  it("keeps storage replays deterministic and conflict-safe", () => {
    const source = readFileSync("lib/private-storage.ts", "utf8");
    expect(source).toContain("input.companyId}:${input.idempotencyKey}");
    expect(source).toContain("STORAGE_IDEMPOTENCY_CONFLICT");
    expect(source).toContain("stored.replayed");
  });
});
