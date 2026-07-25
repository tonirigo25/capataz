import { SecurityAuditOutcome } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { log, safeErrorCode } from "@/lib/observability/logger";
import { getRequestContext } from "@/lib/platform/request-context";

type AuditInput = {
  type: string;
  outcome: SecurityAuditOutcome;
  userId?: string | null;
  companyId?: string | null;
  requestId?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
};

export async function recordSecurityEvent(input: AuditInput) {
  try {
    const requestId = input.requestId ?? getRequestContext()?.requestId ?? null;
    await prisma.securityAuditEvent.create({ data: { ...input, requestId } });
  } catch (error) {
    log("error", "security_audit_persist_failed", { operation: input.type, errorCode: safeErrorCode(error) });
  }
}
