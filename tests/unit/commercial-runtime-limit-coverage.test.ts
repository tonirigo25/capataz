import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

const { getEntitlements } = vi.hoisted(() => ({
  getEntitlements: vi.fn(),
}));

vi.mock("../../lib/commercial/authorization", () => ({
  getEntitlements,
}));

import {
  assertEntitlementMutationAllowed,
  currentUsagePeriod,
} from "../../lib/commercial/usage";

describe("commercial runtime limit guard", () => {
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

  it("blocks only the creating mutation above the approved limit", async () => {
    const transaction = { $executeRaw: vi.fn(async () => 1) };
    getEntitlements.mockResolvedValueOnce({
      values: { max_documents: 250 },
    });

    await expect(
      assertEntitlementMutationAllowed(transaction as never, {
        companyId: "company-a",
        limitKey: "max_documents",
        measure: async () => 250,
      }),
    ).rejects.toThrow("USAGE_LIMIT_REACHED_NO_AUTOMATIC_CHARGE");
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
