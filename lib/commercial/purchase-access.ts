import type { CompanyContext } from "@/lib/auth/session";
import { resolveAuthorization, resolveScopedEntityIds } from "@/lib/commercial/authorization";

export type PurchaseAccess = {
  read: { allowed: boolean; scope: string; workIds: string[] | null; clientIds: string[] | null };
  manage: { allowed: boolean; scope: string; workIds: string[] | null; clientIds: string[] | null };
  pay: { allowed: boolean; scope: string; workIds: string[] | null; clientIds: string[] | null };
};

export async function getPurchaseAccess(context: CompanyContext): Promise<PurchaseAccess> {
  const [readDecision, manageDecision, payDecision] = await Promise.all([
    resolveAuthorization(context, "purchases.received_invoices.view"),
    resolveAuthorization(context, "purchases.received_invoices.manage"),
    resolveAuthorization(context, "treasury.payments.register")
  ]);
  const scoped = async (capability: "purchases.received_invoices.view" | "purchases.received_invoices.manage" | "treasury.payments.register", allowed: boolean) => {
    if (!allowed) return { workIds: [] as string[], clientIds: [] as string[] };
    const [workIds, clientIds] = await Promise.all([resolveScopedEntityIds(context, capability, "Work"), resolveScopedEntityIds(context, capability, "Client")]);
    return { workIds, clientIds };
  };
  const [read, manage, pay] = await Promise.all([
    scoped("purchases.received_invoices.view", readDecision.allowed),
    scoped("purchases.received_invoices.manage", manageDecision.allowed),
    scoped("treasury.payments.register", payDecision.allowed)
  ]);
  return {
    read: { ...readDecision, ...read }, manage: { ...manageDecision, ...manage }, pay: { ...payDecision, ...pay }
  };
}

export function purchaseRelationAllowed(access: PurchaseAccess["read"], workId?: string | null, clientId?: string | null) {
  if (!access.allowed) return false;
  if (access.scope === "COMPANY") return true;
  if (access.scope === "SELECTED_WORKS") return Boolean(workId && access.workIds?.includes(workId));
  if (access.scope === "SELECTED_CLIENTS") return Boolean(clientId && access.clientIds?.includes(clientId));
  return workId ? Boolean(access.workIds?.includes(workId)) : Boolean(clientId && access.clientIds?.includes(clientId));
}

export function purchaseDocumentWhere(access: PurchaseAccess["read"]) {
  if (access.scope === "COMPANY") return {};
  if (access.scope === "SELECTED_WORKS") return { workId: { in: access.workIds ?? [] } };
  if (access.scope === "SELECTED_CLIENTS") return { clientId: { in: access.clientIds ?? [] } };
  const OR: Array<Record<string, unknown>> = [];
  if (access.workIds?.length) OR.push({ workId: { in: access.workIds } });
  if (access.clientIds?.length) OR.push({ clientId: { in: access.clientIds }, workId: null });
  return OR.length ? { OR } : { id: { in: [] as string[] } };
}
