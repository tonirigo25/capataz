import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  applyApprovedMemberLimitOverlay,
  approvedMemberLimitForPlan,
  approvedMemberLimits,
  evaluateUsageLimit,
} from "../../lib/commercial/limits";
import { planCatalog } from "../../lib/commercial/plans";

describe("commercial limits", () => {
  it("uses the approved member limits without changing the other catalog limits", () => {
    expect(approvedMemberLimits).toEqual({
      STARTER: 2,
      PROFESSIONAL: 5,
      BUSINESS: 15,
    });
    expect(planCatalog.STARTER.entitlements.max_members).toBe(2);
    expect(planCatalog.PROFESSIONAL.entitlements.max_members).toBe(5);
    expect(planCatalog.BUSINESS.entitlements.max_members).toBe(15);
    expect(planCatalog.STARTER.entitlements.max_documents).toBe(250);
    expect(planCatalog.PROFESSIONAL.entitlements.max_documents).toBe(2500);
    expect(planCatalog.BUSINESS.entitlements.max_documents).toBe(20000);
  });

  it("overlays legacy persisted member values reversibly", () => {
    const persisted = { max_members: 50, max_documents: 2500 };
    expect(applyApprovedMemberLimitOverlay("PROFESSIONAL", persisted)).toEqual({
      max_members: 5,
      max_documents: 2500,
    });
    expect(applyApprovedMemberLimitOverlay("pro", persisted).max_members).toBe(5);
    expect(approvedMemberLimitForPlan("BUSINESS")).toBe(15);
    expect(persisted).toEqual({ max_members: 50, max_documents: 2500 });
    expect(applyApprovedMemberLimitOverlay("ENTERPRISE", persisted)).toEqual(
      persisted,
    );
  });

  it("warns at 80 percent and allows creation through the exact limit", () => {
    const warning = evaluateUsageLimit({
      used: 3,
      quantity: 1,
      limit: 5,
      operation: "CREATE",
    });
    expect(warning).toMatchObject({
      allowed: true,
      blocked: false,
      warning: true,
      status: "warning",
      projected: 4,
      nextAction: "offer_plan_change_or_renewal",
    });
    expect(
      evaluateUsageLimit({
        used: 4,
        quantity: 1,
        limit: 5,
        operation: "CREATE",
      }),
    ).toMatchObject({ allowed: true, projected: 5, remaining: 0 });
  });

  it("blocks only new usage above 100 percent and never creates an overage charge", () => {
    const blocked = evaluateUsageLimit({
      used: 5,
      quantity: 1,
      limit: 5,
      operation: "CREATE",
    });
    expect(blocked).toMatchObject({
      allowed: false,
      blocked: true,
      status: "blocked",
      projected: 6,
      remaining: 0,
      audit: {
        action: "commercial.limit_evaluated",
        outcome: "blocked",
        automaticCharge: false,
      },
    });
  });

  it("always permits reads, including legacy companies already above the new limit", () => {
    expect(
      evaluateUsageLimit({ used: 12, limit: 5, operation: "READ" }),
    ).toMatchObject({
      allowed: true,
      blocked: false,
      warning: true,
      projected: 12,
      nextAction: "offer_plan_change_or_renewal",
    });
    expect(
      evaluateUsageLimit({ used: 1, limit: 0, operation: "READ" }).allowed,
    ).toBe(true);
  });

  it("keeps invitation transitions server-authoritative under the company lock", () => {
    const source = readFileSync(
      "lib/commercial/invitation-service.ts",
      "utf8",
    );
    expect(source).toContain("acquireEntitlementLimitLock");
    expect(source.match(/await assertMemberCapacity\(/g)).toHaveLength(4);
    expect(source).toContain('status: { in: ["active", "invited", "pending_owner_approval"] }');
    expect(source).toContain('status: { in: ["PENDING", "PENDING_EMPLOYEE"] }');
    expect(source).toContain("automaticCharge: false");
  });

  it("keeps limited usage idempotent and durably attributable", () => {
    const source = readFileSync("lib/commercial/usage.ts", "utf8");
    expect(source).toContain("companyId_metric_idempotencyKey");
    expect(source).toContain("USAGE_IDEMPOTENCY_CONFLICT");
    expect(source).toContain("origin: input.origin");
    expect(source).toContain("reference: input.reference");
    expect(source).toContain("replayed: true");
  });
});
