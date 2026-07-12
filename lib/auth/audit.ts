import { SecurityAuditOutcome } from "@prisma/client";
import { prisma } from "@/lib/prisma";

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
    await prisma.securityAuditEvent.create({ data: input });
  } catch (error) {
    console.error("[security-audit] event could not be persisted", {
      type: input.type,
      requestId: input.requestId ?? null,
      cause: error instanceof Error ? error.name : "unknown"
    });
  }
}
