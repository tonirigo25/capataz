import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { validatePublishedVersion } from "./automation-validation";
export const DEFAULT_RETRY_POLICY = {
  maxAttempts: 3,
  backoffType: "exponential",
  initialDelaySeconds: 2,
  maxDelaySeconds: 60,
  retryableErrors: ["TRANSIENT", "TIMEOUT"],
  nonRetryableErrors: [
    "INVALID",
    "NOT_FOUND",
    "CANCELLED",
    "DUPLICATE",
    "CONFIRMATION_REQUIRED",
  ],
};

export async function publishAutomationVersion(versionId: string) {
  const version = await prisma.automationVersion.findUnique({
    where: { id: versionId },
    include: { triggers: true, conditions: true, actions: true },
  });
  if (!version) throw new Error("AUTOMATION_VERSION_NOT_FOUND");
  if (version.status !== "draft")
    throw new Error("PUBLISHED_VERSION_IMMUTABLE");
  validatePublishedVersion(version);
  const definitionHash = createHash("sha256")
    .update(
      JSON.stringify({
        triggers: version.triggers,
        conditions: version.conditions,
        actions: version.actions,
      }),
    )
    .digest("hex");
  return prisma.$transaction(async (tx) => {
    await tx.automationVersion.updateMany({
      where: {
        automationDefinitionId: version.automationDefinitionId,
        status: "published",
      },
      data: { status: "retired", retiredAt: new Date() },
    });
    const published = await tx.automationVersion.update({
      where: { id: versionId },
      data: { status: "published", definitionHash, publishedAt: new Date() },
    });
    await tx.automationDefinition.update({
      where: { id: version.automationDefinitionId },
      data: { currentVersionId: versionId, status: "active", active: true },
    });
    return published;
  });
}
