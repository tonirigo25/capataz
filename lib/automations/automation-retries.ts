import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { executeAutomationAction } from "./automation-actions";
type Policy = {
  maxAttempts: number;
  backoffType: "fixed" | "linear" | "exponential";
  initialDelaySeconds: number;
  maxDelaySeconds: number;
  retryableErrors: string[];
  nonRetryableErrors: string[];
};
const object = (value: Prisma.JsonValue) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
export function parseRetryPolicy(value: Prisma.JsonValue): Policy {
  const data = object(value);
  return {
    maxAttempts: Math.max(1, Number(data.maxAttempts ?? 1)),
    backoffType: ["fixed", "linear", "exponential"].includes(
      String(data.backoffType),
    )
      ? (String(data.backoffType) as Policy["backoffType"])
      : "fixed",
    initialDelaySeconds: Math.max(1, Number(data.initialDelaySeconds ?? 5)),
    maxDelaySeconds: Math.max(1, Number(data.maxDelaySeconds ?? 300)),
    retryableErrors: Array.isArray(data.retryableErrors)
      ? data.retryableErrors.map(String)
      : [],
    nonRetryableErrors: Array.isArray(data.nonRetryableErrors)
      ? data.nonRetryableErrors.map(String)
      : [],
  };
}
export function retryDelaySeconds(policy: Policy, attempt: number) {
  const factor =
    policy.backoffType === "exponential"
      ? 2 ** Math.max(0, attempt - 1)
      : policy.backoffType === "linear"
        ? attempt
        : 1;
  return Math.min(policy.maxDelaySeconds, policy.initialDelaySeconds * factor);
}
export async function scheduleRunRetry(
  runId: string,
  errorCode: string,
  errorSummary: string,
) {
  const run = await prisma.automationRun.findUniqueOrThrow({
    where: { id: runId },
    include: { version: true },
  });
  const policy = parseRetryPolicy(run.version.retryPolicy);
  const attempt = run.attemptCount + 1;
  if (
    policy.nonRetryableErrors.includes(errorCode) ||
    !policy.retryableErrors.includes(errorCode) ||
    attempt >= policy.maxAttempts
  )
    return prisma.automationRun.update({
      where: { id: runId },
      data: {
        status: "failed",
        failedAt: new Date(),
        nextRetryAt: null,
        attemptCount: attempt,
        lastAttemptAt: new Date(),
        lastErrorCode: errorCode,
        lastErrorSummary: errorSummary,
      },
    });
  return prisma.automationRun.update({
    where: { id: runId },
    data: {
      status: "queued",
      attemptCount: attempt,
      lastAttemptAt: new Date(),
      lastErrorCode: errorCode,
      lastErrorSummary: errorSummary,
      nextRetryAt: new Date(
        Date.now() + retryDelaySeconds(policy, attempt) * 1000,
      ),
      lockUntil: null,
    },
  });
}
export async function claimDueRetries(now = new Date()) {
  return prisma.automationRun.findMany({
    where: {
      status: "queued",
      nextRetryAt: { lte: now },
      OR: [{ lockUntil: null }, { lockUntil: { lt: now } }],
    },
    take: 25,
    orderBy: { nextRetryAt: "asc" },
  });
}
export async function retryAutomationRun(runId: string) {
  const claimed = await prisma.automationRun.updateMany({
    where: {
      id: runId,
      status: "queued",
      nextRetryAt: { lte: new Date() },
      OR: [{ lockUntil: null }, { lockUntil: { lt: new Date() } }],
    },
    data: {
      status: "running",
      lockUntil: new Date(Date.now() + 300000),
      lastAttemptAt: new Date(),
    },
  });
  if (!claimed.count) return null;
  const run = await prisma.automationRun.findUniqueOrThrow({
    where: { id: runId },
    include: {
      steps: { where: { status: "failed" }, include: { action: true } },
    },
  });
  let failed = 0;
  for (const step of run.steps) {
    try {
      const result = run.dryRun
        ? { dryRun: true }
        : await executeAutomationAction(step.action, run);
      await prisma.automationStepRun.update({
        where: { id: step.id },
        data: {
          status: "completed",
          attempt: { increment: 1 },
          completedAt: new Date(),
          outputSummary: result as never,
          errorCode: null,
          errorSummary: null,
        },
      });
    } catch (error) {
      failed++;
      await prisma.automationStepRun.update({
        where: { id: step.id },
        data: {
          attempt: { increment: 1 },
          errorCode: error instanceof Error ? error.message : "UNKNOWN",
          errorSummary: "El reintento no pudo completarse.",
        },
      });
    }
  }
  if (failed)
    return scheduleRunRetry(
      runId,
      "TRANSIENT",
      "El reintento programado falló.",
    );
  return prisma.automationRun.update({
    where: { id: runId },
    data: {
      status: "completed",
      completedAt: new Date(),
      nextRetryAt: null,
      lockUntil: null,
      lastErrorCode: null,
      lastErrorSummary: null,
    },
  });
}
