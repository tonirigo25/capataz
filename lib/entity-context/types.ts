export type EntitySelection = { clientId?: string | null; workId?: string | null; budgetId?: string | null; invoiceId?: string | null; documentId?: string | null; contactId?: string | null };
export type ValidatedEntityContext = EntitySelection & { companyId: string };
export class EntityContextError extends Error { constructor(public code: "NOT_FOUND" | "CROSS_COMPANY" | "INCOMPATIBLE_RELATION", message: string) { super(message); this.name = "EntityContextError"; } }
