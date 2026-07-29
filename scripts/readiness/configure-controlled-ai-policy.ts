import { prisma } from "../../lib/prisma";
import { readRuntimeAiControl } from "../../lib/ai/runtime-gateway";
import { stableReference } from "../../lib/ai/redaction";

async function main() {
  const control = readRuntimeAiControl();
  if (control.companyAllowlist.length === 0) throw new Error("AI_COMPANY_ALLOWLIST_EMPTY");
  const apply = process.env.AI_POLICY_APPLY === "true";
  const companies = await prisma.company.findMany({ where: { id: { in: control.companyAllowlist } }, select: { id: true } });
  if (companies.length !== control.companyAllowlist.length) throw new Error("AI_ALLOWLIST_COMPANY_NOT_FOUND");
  if (!apply) {
    console.log(JSON.stringify({ ok: true, mode: "plan", companies: companies.map((item) => stableReference(item.id)), companyMonthlyBudgetEur: control.defaultCompanyMonthlyBudgetEur, userDailyRequestLimit: control.userDailyRequestLimit }, null, 2));
    return;
  }
  const approvedModels = [
    control.fastModel,
    control.reasoningModel,
    control.transcriptionModel,
    process.env.OPENAI_MODEL_FAST_SNAPSHOT,
    process.env.OPENAI_MODEL_REASONING_SNAPSHOT,
    control.transcriptionSnapshot,
  ].map((value) => value?.trim()).filter((value): value is string => Boolean(value));
  for (const company of companies) {
    await prisma.companyAiPolicy.upsert({
      where: { companyId: company.id },
      create: {
        companyId: company.id,
        enabled: true,
        killSwitch: false,
        allowedPurposes: ["chat-command", "transcription", "document-extraction"],
        prohibitedData: ["rawDocument", "bankAccount", "credentials", "secrets"],
        approvedModels,
        allowedRoles: ["OWNER", "ADMIN"],
        allowedScopes: ["orqena.use", "purchases.received_invoices.manage"],
        allowedFields: {
          "chat-command": ["message", "context"],
          transcription: ["audioRef", "mimeType", "sizeBytes"],
          "document-extraction": ["documentRef", "mimeType"],
        },
        approvedClassifications: ["INTERNAL", "CONFIDENTIAL", "RESTRICTED"],
        dataProfile: process.env.OPENAI_DATA_PROFILE?.trim() || "minimized-redacted-v1",
        companyMonthlyBudget: control.defaultCompanyMonthlyBudgetEur,
        userMonthlyBudget: control.defaultCompanyMonthlyBudgetEur,
        operationBudget: 0.25,
        maxInputTokens: control.maxInputTokens,
        maxOutputTokens: control.maxOutputTokens,
        maxPayloadBytes: 65_536,
        maxConcurrency: 2,
        timeoutMs: 30_000,
        retentionDays: 7,
        humanReviewRequired: true,
        sensitiveEffectsNeedOutbox: true,
      },
      update: {
        enabled: true,
        killSwitch: false,
        allowedPurposes: ["chat-command", "transcription", "document-extraction"],
        prohibitedData: ["rawDocument", "bankAccount", "credentials", "secrets"],
        approvedModels,
        allowedRoles: ["OWNER", "ADMIN"],
        allowedScopes: ["orqena.use", "purchases.received_invoices.manage"],
        allowedFields: {
          "chat-command": ["message", "context"],
          transcription: ["audioRef", "mimeType", "sizeBytes"],
          "document-extraction": ["documentRef", "mimeType"],
        },
        approvedClassifications: ["INTERNAL", "CONFIDENTIAL", "RESTRICTED"],
        dataProfile: process.env.OPENAI_DATA_PROFILE?.trim() || "minimized-redacted-v1",
        companyMonthlyBudget: control.defaultCompanyMonthlyBudgetEur,
        userMonthlyBudget: control.defaultCompanyMonthlyBudgetEur,
        operationBudget: 0.25,
        maxInputTokens: control.maxInputTokens,
        maxOutputTokens: control.maxOutputTokens,
        maxPayloadBytes: 65_536,
        maxConcurrency: 2,
        timeoutMs: 30_000,
        retentionDays: 7,
        humanReviewRequired: true,
        sensitiveEffectsNeedOutbox: true,
      },
    });
  }
  console.log(JSON.stringify({ ok: true, mode: "apply", companies: companies.map((item) => stableReference(item.id)) }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "AI_POLICY_CONFIGURATION_FAILED");
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
