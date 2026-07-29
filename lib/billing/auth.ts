import { resolveActiveCompany, type CompanyContext } from "@/lib/auth/session";
import { getOptionalSession } from "@/lib/auth/session";
import { resolveAuthorization } from "@/lib/commercial/authorization";

export class BillingAccessError extends Error {
  constructor(readonly status: 401 | 403, code: string) {
    super(code);
  }
}

export async function requireBillingContext(): Promise<CompanyContext> {
  const session = await getOptionalSession();
  if (!session) throw new BillingAccessError(401, "AUTHENTICATION_REQUIRED");
  const resolved = await resolveActiveCompany(session.userId);
  if (!resolved.membership || resolved.requiresSelection) throw new BillingAccessError(403, "COMPANY_CONTEXT_REQUIRED");
  const membership = resolved.membership;
  const context: CompanyContext = {
    ...session,
    companyId: membership.companyId,
    membershipId: membership.id,
    role: membership.role,
    functionalProfileKey: membership.functionalProfileKey,
    isDemo: membership.company.isDemo,
    companyName: membership.company.nombreComercial,
    companyStatus: membership.company.status,
    commercialStatus: membership.company.commercialStatus ?? "ACTIVE",
  };
  const decision = await resolveAuthorization(context, "company.billing.manage");
  if (!decision.allowed || context.role !== "OWNER") throw new BillingAccessError(403, "BILLING_FORBIDDEN");
  return context;
}
