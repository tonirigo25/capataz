import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  assertExclusiveOwnerMembership,
  assertReviewRigoHoyTarget,
  buildRigoHoyAgendaFixtures,
  REVIEW_RIGO_HOY_IDS,
  REVIEW_RIGO_HOY_TARGET,
  safeProvisionErrorCode,
} from "../../scripts/readiness/provision-review-rigo-hoy";

const validEnvironment = {
  ORQENA_REVIEW_RIGO_HOY_APPROVED: "true",
  ORQENA_REVIEW_RIGO_OWNER_EMAIL: "rigo.owner@review.orqena.invalid",
  ORQENA_REVIEW_DATABASE_SERVICE_ID: REVIEW_RIGO_HOY_TARGET.databaseServiceId,
  RAILWAY_PROJECT_ID: REVIEW_RIGO_HOY_TARGET.projectId,
  RAILWAY_ENVIRONMENT_ID: REVIEW_RIGO_HOY_TARGET.environmentId,
  RAILWAY_ENVIRONMENT_NAME: REVIEW_RIGO_HOY_TARGET.environmentName,
  RAILWAY_SERVICE_ID: REVIEW_RIGO_HOY_TARGET.databaseServiceId,
  NEXT_PUBLIC_APP_ENV: "preview",
  CREDENTIAL_SCOPE: "preview",
  DATABASE_URL: "postgresql://synthetic:unreported@containers-us-west-1.railway.internal:5432/railway",
};

describe("Rigo Hoy Railway Review provisioner", () => {
  it("accepts only the exact Review project, environment, database service and preview scope", () => {
    expect(assertReviewRigoHoyTarget(validEnvironment)).toBe("rigo.owner@review.orqena.invalid");
    expect(assertReviewRigoHoyTarget({ ...validEnvironment, ORQENA_REVIEW_RIGO_OWNER_EMAIL: "demo@demo" })).toBe("demo@demo");

    const rejected = [
      ["ORQENA_REVIEW_RIGO_HOY_APPROVED", "false", "REVIEW_RIGO_HOY_APPROVAL_REQUIRED"],
      ["RAILWAY_PROJECT_ID", "production-project", "REVIEW_RIGO_HOY_PROJECT_MISMATCH"],
      ["RAILWAY_ENVIRONMENT_ID", "staging-environment", "REVIEW_RIGO_HOY_ENVIRONMENT_MISMATCH"],
      ["RAILWAY_ENVIRONMENT_NAME", "production", "REVIEW_RIGO_HOY_ENVIRONMENT_NAME_MISMATCH"],
      ["RAILWAY_SERVICE_ID", "web-service", "REVIEW_RIGO_HOY_SERVICE_MISMATCH"],
      ["ORQENA_REVIEW_DATABASE_SERVICE_ID", "staging-database", "REVIEW_RIGO_HOY_DATABASE_SERVICE_MISMATCH"],
      ["NEXT_PUBLIC_APP_ENV", "staging", "REVIEW_RIGO_HOY_PREVIEW_SCOPE_REQUIRED"],
      ["CREDENTIAL_SCOPE", "production", "REVIEW_RIGO_HOY_PREVIEW_SCOPE_REQUIRED"],
      ["DATABASE_URL", "postgresql://user:secret@production.example.com/db", "REVIEW_RIGO_HOY_DATABASE_HOST_INVALID"],
      ["ORQENA_REVIEW_RIGO_OWNER_EMAIL", "owner@example.com", "REVIEW_RIGO_HOY_OWNER_EMAIL_INVALID"],
    ] as const;

    for (const [key, value, error] of rejected) {
      expect(() => assertReviewRigoHoyTarget({ ...validEnvironment, [key]: value })).toThrow(error);
    }
  });

  it("fails closed when the existing owner has any membership outside Rigo Asociados", () => {
    const target = new Set([REVIEW_RIGO_HOY_IDS.company]);
    expect(() => assertExclusiveOwnerMembership([], target)).not.toThrow();
    expect(() => assertExclusiveOwnerMembership([{ companyId: REVIEW_RIGO_HOY_IDS.company }], target)).not.toThrow();
    expect(() => assertExclusiveOwnerMembership([
      { companyId: REVIEW_RIGO_HOY_IDS.company },
      { companyId: "another-review-company" },
    ], target)).toThrow("REVIEW_RIGO_HOY_OWNER_HAS_OTHER_MEMBERSHIPS");
  });

  it("builds five deterministic same-day agenda fixtures matching the Hoy reference", () => {
    const now = new Date("2026-07-31T08:15:00.000Z");
    const fixtures = buildRigoHoyAgendaFixtures(now);
    expect(fixtures).toHaveLength(5);
    expect(new Set(fixtures.map((fixture) => fixture.id)).size).toBe(5);
    expect(fixtures.map((fixture) => fixture.titulo)).toEqual([
      "Reunión interna de obra",
      "Visita técnica",
      "Revisión de presupuesto",
      "Llamada seguimiento comercial",
      "Confirmar documento",
    ]);
    expect(fixtures.map((fixture) => [fixture.fechaInicio.getHours(), fixture.fechaInicio.getMinutes()])).toEqual([
      [9, 0],
      [10, 30],
      [12, 0],
      [15, 30],
      [17, 0],
    ]);
    expect(fixtures.every((fixture) => fixture.fechaInicio.toDateString() === now.toDateString())).toBe(true);
  });

  it("does not contain credential, security-factor, active-company or destructive membership mutations", () => {
    const source = readFileSync("scripts/readiness/provision-review-rigo-hoy.ts", "utf8");
    expect(source).not.toMatch(/passwordHash|passwordResetToken|mfaFactor|activeCompanyId/u);
    expect(source).not.toMatch(/companyMembership\.(?:update|updateMany|delete|deleteMany)/u);
    expect(source).not.toContain("ORQENA_REVIEW_ROTATE_OWNER_ACCESS");
    expect(source).not.toContain("ORQENA_REVIEW_PROVISION_MFA");
    expect(source).not.toContain("console.log");
  });

  it("never returns free-form failure details that could disclose configuration", () => {
    expect(safeProvisionErrorCode(new Error("REVIEW_RIGO_HOY_PROJECT_MISMATCH"))).toBe("REVIEW_RIGO_HOY_PROJECT_MISMATCH");
    expect(safeProvisionErrorCode(new Error("connect failed: postgresql://secret"))).toBe("REVIEW_RIGO_HOY_PROVISION_FAILED");
  });
});
