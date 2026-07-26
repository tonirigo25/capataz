import type { PrismaClient } from "@prisma/client";
import { stableReference } from "@/lib/ai/redaction";
import { appendSensitiveAuditLog } from "@/lib/security/audit-chain";

export async function saveExperiencePreferences(prisma: PrismaClient, input: {
  companyId: string;
  actorId: string;
  aiSuggestionsEnabled: boolean;
  operationalEmailEnabled: boolean;
  marketingEmailEnabled: boolean;
}) {
  return prisma.$transaction(async (transaction) => {
    const preference = await transaction.companyExperiencePreference.upsert({
      where: { companyId: input.companyId },
      create: {
        companyId: input.companyId,
        aiSuggestionsEnabled: input.aiSuggestionsEnabled,
        operationalEmailEnabled: input.operationalEmailEnabled,
        marketingEmailEnabled: input.marketingEmailEnabled,
        updatedByHash: stableReference(input.actorId),
      },
      update: {
        aiSuggestionsEnabled: input.aiSuggestionsEnabled,
        operationalEmailEnabled: input.operationalEmailEnabled,
        marketingEmailEnabled: input.marketingEmailEnabled,
        updatedByHash: stableReference(input.actorId),
        policyVersion: "v1",
      },
    });
    if (!input.aiSuggestionsEnabled) await transaction.companyAiPolicy.updateMany({ where: { companyId: input.companyId }, data: { killSwitch: true } });
    await appendSensitiveAuditLog(transaction, {
      companyId: input.companyId,
      userActorId: input.actorId,
      action: "experience.preferences.updated",
      targetType: "CompanyExperiencePreference",
      targetId: preference.id,
      metadata: {
        aiSuggestionsEnabled: input.aiSuggestionsEnabled,
        operationalEmailEnabled: input.operationalEmailEnabled,
        marketingEmailEnabled: input.marketingEmailEnabled,
        policyVersion: "v1",
      },
    });
    return preference;
  });
}
