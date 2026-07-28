import type { PrismaClient } from "@prisma/client";
import catalog from "@/contracts/privacy/v1/catalog.json";
import { upsertProcessingActivity, upsertSubprocessor } from "@/lib/privacy/governance";

export async function seedCompanyPrivacyCatalog(prisma: PrismaClient, companyId: string) {
  for (const activity of catalog.processingActivities) await upsertProcessingActivity(prisma, companyId, activity);
  for (const policy of catalog.retentionPolicies) await prisma.retentionPolicy.upsert({ where: { companyId_key: { companyId, key: policy.key } }, update: { resourceType: policy.resourceType, retentionDays: policy.retentionDays, action: policy.action }, create: { companyId, key: policy.key, resourceType: policy.resourceType, retentionDays: policy.retentionDays, action: policy.action, enabled: false } });
  const reviewedAt = new Date(`${catalog.effectiveDate}T00:00:00.000Z`);
  for (const subprocessor of catalog.subprocessors) await upsertSubprocessor(prisma, { key: subprocessor.key, name: subprocessor.name, purpose: subprocessor.purpose, dataCategories: subprocessor.dataCategories, processingLocations: subprocessor.processingLocations, safeguards: [subprocessor.activation], effectiveAt: reviewedAt, reviewedAt });
  return { processingActivities: catalog.processingActivities.length, retentionPolicies: catalog.retentionPolicies.length, subprocessors: catalog.subprocessors.length, reviewStatus: catalog.reviewStatus };
}
