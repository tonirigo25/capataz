export type MissingRequirement = { code: string; label: string; description: string; reason: string; entityType: string; entityId: string; fieldPath: string; severity: "required" | "recommended"; requiredFor: string[]; href: string; canResolveInline: boolean; isSensitive: boolean };
type CompanyLike = { id: string; taxId?: string | null; direccion?: string | null; codigoPostal?: string | null; ciudad?: string | null; defaultPaymentTerms?: string | null; iban?: string | null };
export function companyCompleteness(company: CompanyLike, requiredFor = "documents"): MissingRequirement[] {
  const definitions = [
    ["tax-id", "NIF/CIF", "taxId", "Identifica legalmente al emisor.", true], ["fiscal-address", "Dirección fiscal", "direccion", "Aparecerá en el encabezado.", true],
    ["postal-code", "Código postal", "codigoPostal", "Completa la dirección.", false], ["city", "Localidad", "ciudad", "Completa la dirección.", false],
    ["payment-terms", "Forma de pago", "defaultPaymentTerms", "Aparecerá en las condiciones.", true],
  ] as const;
  return definitions.filter(([, , field]) => !company[field]).map(([code, label, fieldPath, reason, sensitive]) => ({ code, label, description: reason, reason, entityType: "company", entityId: company.id, fieldPath, severity: "required", requiredFor: [requiredFor], href: "/configuracion?seccion=empresa", canResolveInline: !sensitive, isSensitive: sensitive }));
}
