import { randomBytes } from "node:crypto";
import { generate } from "otplib";
import { prisma } from "../../lib/prisma";
import { createOpaqueToken, hashPassword, hashToken } from "../../lib/auth/crypto";
import { ensureBasePlans, provisionCompany } from "../../lib/commercial/provisioning";
import { profileDefaultPackages } from "../../lib/commercial/functional-profiles";
import { confirmTotpEnrollment, startTotpEnrollment } from "../../lib/security/mfa";

const EXPECTED_PROJECT_ID = "c54a5065-df2c-46b9-a82b-cfac3be07315";
const EXPECTED_ENVIRONMENT_ID = "e41b5add-511c-4697-b2b5-48164506f49a";
const EXPECTED_DATABASE_SERVICE_ID = "d14f98ec-1a00-4cc5-88fc-2ac0c99c8f1b";
const REVIEW_ORIGIN = "https://orqena-review-web-review.up.railway.app";

type LegacyMembershipRole = "OWNER" | "ADMIN" | "MANAGER" | "MEMBER" | "VIEWER";
type ProfileFixture = { key: string; label: string; role: LegacyMembershipRole; profile: keyof typeof profileDefaultPackages; readOnly?: boolean };
const profiles: readonly ProfileFixture[] = [
  { key: "owner", label: "Propietario Review", role: "OWNER", profile: "OWNER" },
  { key: "general-manager", label: "Dirección Review", role: "MANAGER", profile: "GENERAL_MANAGER" },
  { key: "admin", label: "Administración Review", role: "ADMIN", profile: "ADMINISTRATIVE" },
  { key: "sales", label: "Comercial Review", role: "MEMBER", profile: "SALES" },
  { key: "finance", label: "Finanzas Review", role: "ADMIN", profile: "FINANCE" },
  { key: "procurement", label: "Compras Review", role: "MANAGER", profile: "PROCUREMENT_MANAGER" },
  { key: "project-manager", label: "Responsable de obra Review", role: "MANAGER", profile: "PROJECT_MANAGER" },
  { key: "supervisor", label: "Supervisor Review", role: "MEMBER", profile: "TEAM_SUPERVISOR" },
  { key: "worker", label: "Trabajador Review", role: "MEMBER", profile: "WORKER" },
  { key: "external", label: "Colaborador externo Review", role: "MEMBER", profile: "EXTERNAL_COLLABORATOR" },
  { key: "viewer", label: "Auditor Review", role: "VIEWER", profile: "ADVISOR_AUDITOR", readOnly: true },
];

function guardReview() {
  if (process.env.ORQENA_REVIEW_SEED_APPROVED !== "true") throw new Error("REVIEW_SEED_APPROVAL_REQUIRED");
  if (process.env.RAILWAY_PROJECT_ID !== EXPECTED_PROJECT_ID) throw new Error("REVIEW_PROJECT_ID_MISMATCH");
  if (process.env.RAILWAY_ENVIRONMENT_ID !== EXPECTED_ENVIRONMENT_ID) throw new Error("REVIEW_ENVIRONMENT_ID_MISMATCH");
  if (process.env.ORQENA_REVIEW_DATABASE_SERVICE_ID !== EXPECTED_DATABASE_SERVICE_ID) throw new Error("REVIEW_DATABASE_SERVICE_ID_MISMATCH");
  if (process.env.NEXT_PUBLIC_APP_ENV !== "preview" || process.env.CREDENTIAL_SCOPE !== "preview") throw new Error("REVIEW_SCOPE_REQUIRED");
  const database = new URL(process.env.DATABASE_URL ?? "");
  if (!/(?:railway\.internal|proxy\.rlwy\.net)$/u.test(database.hostname)) throw new Error("REVIEW_DATABASE_HOST_INVALID");
}

function reviewWeekDate(dayOffset: number, hour: number) {
  const value = new Date();
  const weekday = value.getDay();
  value.setDate(value.getDate() + (weekday === 0 ? -6 : 1 - weekday) + dayOffset);
  value.setHours(hour, 0, 0, 0);
  return value;
}

async function main() {
  guardReview();
  await ensureBasePlans(prisma);
  const configuredQaPassword = process.env.ORQENA_REVIEW_QA_PASSWORD;
  if (configuredQaPassword && configuredQaPassword.length < 24) throw new Error("REVIEW_QA_PASSWORD_TOO_SHORT");
  const temporaryPassword = configuredQaPassword ?? `${randomBytes(28).toString("base64url")}Aa1!`;
  const passwordHash = await hashPassword(temporaryPassword);
  const users = new Map(await Promise.all(profiles.map(async (fixture) => {
    const email = `${fixture.key}@review.orqena.invalid`;
    const user = await prisma.user.upsert({
      where: { emailNormalized: email },
      update: { displayName: fixture.label, passwordHash, status: "active", emailVerifiedAt: new Date(), failedLoginCount: 0, lockedUntil: null },
      create: { email, emailNormalized: email, displayName: fixture.label, passwordHash, status: "active", emailVerifiedAt: new Date() },
    });
    return [fixture.key, user] as const;
  })));

  const owner = users.get("owner")!;
  const primary = await provisionCompany(prisma, {
    userId: owner.id,
    name: "Orqena Review · Construcción",
    organizationType: "COMPANY",
    sectorKey: "construction",
    mainGoal: "Auditar un ciclo sintético completo",
    teamSize: "6-20",
    planKey: "BUSINESS",
    idempotencyKey: "continuous-review:construction:v1",
    isDemo: true,
    demoScenarioKey: "construction",
  });
  const negativeTenant = await provisionCompany(prisma, {
    userId: owner.id,
    name: "Orqena Review · Instalaciones",
    organizationType: "COMPANY",
    sectorKey: "installations",
    mainGoal: "Control negativo multiempresa",
    teamSize: "2-5",
    planKey: "STARTER",
    idempotencyKey: "continuous-review:installations:v1",
    isDemo: true,
    demoScenarioKey: "installations",
  });

  const memberships = new Map();
  for (const fixture of profiles) {
    const user = users.get(fixture.key)!;
    const membership = await prisma.companyMembership.upsert({
      where: { userId_companyId: { userId: user.id, companyId: primary.id } },
      update: { role: fixture.role, functionalProfileKey: fixture.profile, accessMode: fixture.readOnly ? "READ_ONLY" : "STANDARD", status: "active", acceptedAt: new Date(), joinedAt: new Date(), origin: "continuous-review" },
      create: { userId: user.id, companyId: primary.id, role: fixture.role, functionalProfileKey: fixture.profile, accessMode: fixture.readOnly ? "READ_ONLY" : "STANDARD", status: "active", acceptedAt: new Date(), joinedAt: new Date(), origin: "continuous-review", isDemo: true },
    });
    await prisma.membershipAccessPackage.deleteMany({ where: { membershipId: membership.id } });
    await prisma.membershipAccessPackage.createMany({ data: profileDefaultPackages[fixture.profile].map((packageKey) => ({ companyId: primary.id, membershipId: membership.id, packageKey, grantedById: owner.id })) });
    await prisma.user.update({ where: { id: user.id }, data: { activeCompanyId: primary.id } });
    memberships.set(fixture.key, membership);
  }
  const invitationTokenHash = hashToken("continuous-review-invitation-d8");
  await prisma.invitation.upsert({
    where: { id: "review-invitation-1" },
    update: {
      companyId: primary.id,
      emailNormalized: "persona.pendiente@review.orqena.invalid",
      role: "MEMBER",
      functionalProfileKey: "WORKER",
      accessMode: "READ_ONLY",
      status: "PENDING_OWNER_APPROVAL",
      tokenHash: invitationTokenHash,
      inviterId: owner.id,
      accessPackageKeys: ["WORK_EXECUTION"],
      scopeTemplate: { scope: "ASSIGNED" },
      fieldVisibilityTemplate: [],
      expiresAt: new Date(Date.now() + 7 * 86_400_000),
      employeeAcceptedAt: new Date(),
      revokedAt: null,
      rejectedAt: null,
    },
    create: {
      id: "review-invitation-1",
      companyId: primary.id,
      emailNormalized: "persona.pendiente@review.orqena.invalid",
      role: "MEMBER",
      functionalProfileKey: "WORKER",
      accessMode: "READ_ONLY",
      status: "PENDING_OWNER_APPROVAL",
      tokenHash: invitationTokenHash,
      inviterId: owner.id,
      accessPackageKeys: ["WORK_EXECUTION"],
      scopeTemplate: { scope: "ASSIGNED" },
      fieldVisibilityTemplate: [],
      expiresAt: new Date(Date.now() + 7 * 86_400_000),
      employeeAcceptedAt: new Date(),
    },
  });

  const client = await prisma.client.upsert({
    where: { id: "review-client-1" },
    update: { companyId: primary.id },
    create: { id: "review-client-1", companyId: primary.id, nombre: "Cliente Sintético Review", telefono: "+34 000 000 201", email: "cliente@review.orqena.invalid", direccion: "Calle Sintética 1", tipo: "Empresa", origen: "continuous-review" },
  });
  const contact = await prisma.contact.upsert({
    where: { id: "review-contact-1" },
    update: { companyId: primary.id, clientId: client.id, nombre: "Marta", apellidos: "Contacto Review", cargo: "Responsable de obra", telefono: "+34 000 000 202", email: "contacto@review.orqena.invalid", isPrimary: true, isSiteContact: true },
    create: { id: "review-contact-1", companyId: primary.id, clientId: client.id, nombre: "Marta", apellidos: "Contacto Review", cargo: "Responsable de obra", telefono: "+34 000 000 202", email: "contacto@review.orqena.invalid", isPrimary: true, isSiteContact: true },
  });
  const work = await prisma.work.upsert({
    where: { id: "review-work-1" },
    update: { companyId: primary.id, clienteId: client.id, estado: "en_curso", costePrevisto: 12_500, gastoReal: 850, margenEstimado: 5_500, responsable: "Responsable sintético" },
    create: { id: "review-work-1", companyId: primary.id, clienteId: client.id, numeroInterno: "OB-REV-1", titulo: "Reforma sintética completa", direccion: "Calle Sintética 1", tipoTrabajo: "Reforma", estado: "en_curso", presupuestoAprobado: 18_000, costePrevisto: 12_500, gastoReal: 850, margenEstimado: 5_500, responsable: "Responsable sintético" },
  });
  const reviewBudgetLines = JSON.stringify([
    { descripcion: "Demolición y retirada", cantidad: 1, unidad: "servicio", precioUnitario: 2_200, total: 2_200, categoria: "Demolición" },
    { descripcion: "Instalación principal", cantidad: 1, unidad: "servicio", precioUnitario: 4_800, total: 4_800, categoria: "Instalaciones" },
    { descripcion: "Acabados", cantidad: 30, unidad: "m2", precioUnitario: 100, total: 3_000, categoria: "Acabados" },
  ]);
  await prisma.budget.upsert({
    where: { id: "review-budget-1" },
    update: { companyId: primary.id, clienteId: client.id, obraId: work.id, partidas: reviewBudgetLines, subtotal: 10_000, iva: 2_100, total: 12_100, margenEstimado: 2_400 },
    create: { id: "review-budget-1", companyId: primary.id, clienteId: client.id, obraId: work.id, numero: "P-REV-1", titulo: "Presupuesto sintético", partidas: reviewBudgetLines, subtotal: 10_000, iva: 2_100, total: 12_100, margenEstimado: 2_400, estado: "enviado" },
  });
  const invoice = await prisma.invoice.upsert({
    where: { id: "review-invoice-1" },
    update: { companyId: primary.id, clienteId: client.id, obraId: work.id },
    create: { id: "review-invoice-1", companyId: primary.id, clienteId: client.id, obraId: work.id, numero: "F-REV-1", concepto: "Factura sintética parcial", importeBase: 5_000, iva: 1_050, total: 6_050, pagado: 2_000, pendiente: 4_050, fechaEmision: new Date(), fechaVencimiento: new Date(Date.now() + 14 * 86_400_000), estado: "emitida" },
  });
  await prisma.payment.upsert({
    where: { id: "review-payment-1" },
    update: { companyId: primary.id, facturaId: invoice.id, clienteId: client.id, obraId: work.id },
    create: { id: "review-payment-1", companyId: primary.id, facturaId: invoice.id, clienteId: client.id, obraId: work.id, importe: 2_000, metodo: "transferencia sintética", tipo: "pago_parcial", notas: "Dato sintético para validar saldo e historial en Review." },
  });
  await prisma.reminder.upsert({
    where: { id: "review-invoice-reminder-1" },
    update: { companyId: primary.id, clienteId: client.id, obraId: work.id, facturaId: invoice.id, contactId: contact.id, fechaProgramada: new Date(Date.now() + 7 * 86_400_000), estado: "programado", requiereConfirmacion: true },
    create: { id: "review-invoice-reminder-1", companyId: primary.id, clienteId: client.id, obraId: work.id, facturaId: invoice.id, contactId: contact.id, tipo: "recordatorio_factura", canal: "interno", mensaje: "Revisar el cobro sintético antes del vencimiento.", fechaProgramada: new Date(Date.now() + 7 * 86_400_000), estado: "programado", requiereConfirmacion: true },
  });
  await prisma.reminder.upsert({
    where: { id: "review-reminder-prepared-1" },
    update: { companyId: primary.id, clienteId: client.id, obraId: work.id, contactId: contact.id, fechaProgramada: new Date(Date.now() + 2 * 86_400_000), estado: "pendiente_confirmacion", requiereConfirmacion: true },
    create: { id: "review-reminder-prepared-1", companyId: primary.id, clienteId: client.id, obraId: work.id, contactId: contact.id, tipo: "recordatorio_interno", canal: "interno", mensaje: "Mensaje sintético preparado; requiere confirmación humana antes de cualquier envío.", fechaProgramada: new Date(Date.now() + 2 * 86_400_000), estado: "pendiente_confirmacion", requiereConfirmacion: true },
  });
  await prisma.reminder.upsert({
    where: { id: "review-reminder-sent-1" },
    update: { companyId: primary.id, clienteId: client.id, obraId: work.id, contactId: contact.id, fechaProgramada: new Date(Date.now() - 2 * 86_400_000), estado: "enviado", requiereConfirmacion: true },
    create: { id: "review-reminder-sent-1", companyId: primary.id, clienteId: client.id, obraId: work.id, contactId: contact.id, tipo: "recordatorio_interno", canal: "interno", mensaje: "Histórico sintético de envío interno; ningún proveedor live fue utilizado.", fechaProgramada: new Date(Date.now() - 2 * 86_400_000), estado: "enviado", requiereConfirmacion: true },
  });
  await prisma.eventoAgenda.upsert({
    where: { id: "review-invoice-promise-1" },
    update: { companyId: primary.id, clienteId: client.id, obraId: work.id, facturaId: invoice.id },
    create: { id: "review-invoice-promise-1", companyId: primary.id, clienteId: client.id, obraId: work.id, facturaId: invoice.id, titulo: "Compromiso sintético de revisión", descripcion: "Compromiso de prueba, sin comunicación ni proveedor real.", tipo: "seguimiento_cobro", estado: "confirmado", fechaInicio: new Date(Date.now() + 8 * 86_400_000), requiereConfirmacion: false, confirmadoPorUsuario: true },
  });
  await prisma.expense.upsert({
    where: { id: "review-expense-1" },
    update: { companyId: primary.id, obraId: work.id },
    create: { id: "review-expense-1", companyId: primary.id, obraId: work.id, proveedor: "Proveedor Sintético Review", concepto: "Material de prueba", categoria: "materiales", importe: 850, fecha: new Date() },
  });
  const supplier = await prisma.businessPartner.upsert({
    where: { id: "review-partner-1" },
    update: { companyId: primary.id, kind: "SUPPLIER", commercialName: "Ferretería Norte Review", legalName: "Ferretería Norte Review Sintética", taxId: "B12345678", email: "proveedor@review.orqena.invalid", contactPerson: "Contacto sintético", tags: ["materiales", "habitual"], paymentTerms: "Transferencia a 30 días", preferredPaymentMethod: "Transferencia", status: "ACTIVE" },
    create: { id: "review-partner-1", companyId: primary.id, kind: "SUPPLIER", commercialName: "Ferretería Norte Review", legalName: "Ferretería Norte Review Sintética", taxId: "B12345678", email: "proveedor@review.orqena.invalid", contactPerson: "Contacto sintético", tags: ["materiales", "habitual"], paymentTerms: "Transferencia a 30 días", preferredPaymentMethod: "Transferencia", status: "ACTIVE" },
  });
  await prisma.businessPartner.upsert({
    where: { id: "review-partner-2" },
    update: { companyId: primary.id, kind: "SUPPLIER", commercialName: "Pinturas Sol Review", legalName: "Pinturas Sol Review Sintética", taxId: "B87654321", contactPerson: "Compras sintéticas", tags: ["pintura"], status: "ACTIVE" },
    create: { id: "review-partner-2", companyId: primary.id, kind: "SUPPLIER", commercialName: "Pinturas Sol Review", legalName: "Pinturas Sol Review Sintética", taxId: "B87654321", contactPerson: "Compras sintéticas", tags: ["pintura"], status: "ACTIVE" },
  });
  const subcontractor = await prisma.businessPartner.upsert({
    where: { id: "review-subcontractor-1" },
    update: { companyId: primary.id, kind: "SUBCONTRACTOR", commercialName: "Fontanería Serra Review", legalName: "Fontanería Serra Review Sintética", taxId: "B11223344", tradeType: "Fontanería", specialty: "Instalaciones de agua", liabilityInsurance: "RC sintética registrada", documentStatus: "EXPIRING", documentExpiresAt: new Date(Date.now() + 12 * 86_400_000), status: "ACTIVE" },
    create: { id: "review-subcontractor-1", companyId: primary.id, kind: "SUBCONTRACTOR", commercialName: "Fontanería Serra Review", legalName: "Fontanería Serra Review Sintética", taxId: "B11223344", tradeType: "Fontanería", specialty: "Instalaciones de agua", liabilityInsurance: "RC sintética registrada", documentStatus: "EXPIRING", documentExpiresAt: new Date(Date.now() + 12 * 86_400_000), status: "ACTIVE" },
  });
  await prisma.businessPartnerWork.upsert({
    where: { businessPartnerId_workId: { businessPartnerId: supplier.id, workId: work.id } },
    update: { companyId: primary.id },
    create: { id: "review-partner-work-1", companyId: primary.id, businessPartnerId: supplier.id, workId: work.id },
  });
  await prisma.businessPartnerWork.upsert({
    where: { businessPartnerId_workId: { businessPartnerId: subcontractor.id, workId: work.id } },
    update: { companyId: primary.id },
    create: { id: "review-subcontractor-work-1", companyId: primary.id, businessPartnerId: subcontractor.id, workId: work.id },
  });
  const purchaseInvoice = await prisma.purchaseInvoice.upsert({
    where: { id: "review-purchase-invoice-1" },
    update: { companyId: primary.id, businessPartnerId: supplier.id, workId: work.id, kind: "SUPPLIER", status: "PARTIALLY_PAID", invoiceNumber: "FV-2841-REV", issueDate: new Date(), dueDate: new Date(Date.now() + 22 * 86_400_000), taxableBase: 1_045, vatRate: 21, vatAmount: 219.45, withholdingAmount: 0, total: 1_264.45, paidAmount: 400, pendingAmount: 864.45, paymentMethod: "Transferencia", description: "Materiales sintéticos para Review" },
    create: { id: "review-purchase-invoice-1", companyId: primary.id, businessPartnerId: supplier.id, workId: work.id, kind: "SUPPLIER", status: "PARTIALLY_PAID", invoiceNumber: "FV-2841-REV", issueDate: new Date(), dueDate: new Date(Date.now() + 22 * 86_400_000), taxableBase: 1_045, vatRate: 21, vatAmount: 219.45, withholdingAmount: 0, total: 1_264.45, paidAmount: 400, pendingAmount: 864.45, paymentMethod: "Transferencia", description: "Materiales sintéticos para Review" },
  });
  await prisma.purchaseInvoicePayment.upsert({
    where: { id: "review-purchase-payment-1" },
    update: { companyId: primary.id, purchaseInvoiceId: purchaseInvoice.id, amount: 400, method: "Transferencia sintética", reference: "REV-PAGO-1" },
    create: { id: "review-purchase-payment-1", companyId: primary.id, purchaseInvoiceId: purchaseInvoice.id, amount: 400, paidAt: new Date(), method: "Transferencia sintética", reference: "REV-PAGO-1" },
  });
  await prisma.purchaseInvoiceHistory.upsert({
    where: { id: "review-purchase-history-1" },
    update: { companyId: primary.id, purchaseInvoiceId: purchaseInvoice.id, action: "REVIEW_CONFIRMED", detail: "Factura sintética revisada con confirmación humana" },
    create: { id: "review-purchase-history-1", companyId: primary.id, purchaseInvoiceId: purchaseInvoice.id, action: "REVIEW_CONFIRMED", detail: "Factura sintética revisada con confirmación humana", createdById: owner.id },
  });
  const purchaseExpense = await prisma.expense.upsert({
    where: { id: "review-purchase-expense-1" },
    update: { companyId: primary.id, obraId: work.id, clienteId: client.id, businessPartnerId: supplier.id, purchaseInvoiceId: purchaseInvoice.id, proveedor: supplier.commercialName, concepto: "Materiales sintéticos para Review", categoria: "materiales", importe: 1_264.45, paymentStatus: "pending", paymentDueDate: purchaseInvoice.dueDate },
    create: { id: "review-purchase-expense-1", companyId: primary.id, obraId: work.id, clienteId: client.id, businessPartnerId: supplier.id, purchaseInvoiceId: purchaseInvoice.id, proveedor: supplier.commercialName, concepto: "Materiales sintéticos para Review", categoria: "materiales", importe: 1_264.45, fecha: new Date(), paymentStatus: "pending", paymentDueDate: purchaseInvoice.dueDate },
  });
  const extraction = {
    documentType: "MATERIAL_INVOICE",
    issuerName: supplier.commercialName,
    issuerTaxId: supplier.taxId,
    invoiceNumber: purchaseInvoice.invoiceNumber,
    issueDate: purchaseInvoice.issueDate.toISOString().slice(0, 10),
    dueDate: purchaseInvoice.dueDate.toISOString().slice(0, 10),
    taxableBase: purchaseInvoice.taxableBase,
    vatRate: purchaseInvoice.vatRate,
    vatAmount: purchaseInvoice.vatAmount,
    withholdingAmount: purchaseInvoice.withholdingAmount,
    total: purchaseInvoice.total,
    paymentMethod: purchaseInvoice.paymentMethod,
    description: purchaseInvoice.description,
    suggestedCategory: "materiales",
    confidence: 0.92,
    warnings: [],
    lines: [{ description: "Materiales sintéticos", quantity: 1, unitPrice: 1_045, total: 1_045 }],
    fieldConfidence: {},
  };
  await prisma.document.upsert({
    where: { id: "review-expense-document-1" },
    update: { companyId: primary.id, name: "Factura Ferretería Norte Review.pdf", originalName: "factura-ferreteria-norte-review.pdf", mimeType: "application/pdf", size: 2_048, sha256: "a".repeat(64), category: "factura", status: "REGISTERED", extractionStatus: "COMPLETED", extractionConfidence: 0.92, extractedData: extraction, extractedIssuer: supplier.commercialName, extractedIssuerTaxId: supplier.taxId, extractedInvoiceNo: purchaseInvoice.invoiceNumber, extractedIssueDate: purchaseInvoice.issueDate, extractedTotal: purchaseInvoice.total, clientId: client.id, workId: work.id, expenseId: purchaseExpense.id, businessPartnerId: supplier.id, purchaseInvoiceId: purchaseInvoice.id, uploadedById: owner.id, processedAt: new Date(), metadata: { source: "expense_document_reader", synthetic: true, review: { confirmed: true } } },
    create: { id: "review-expense-document-1", companyId: primary.id, name: "Factura Ferretería Norte Review.pdf", originalName: "factura-ferreteria-norte-review.pdf", mimeType: "application/pdf", size: 2_048, sha256: "a".repeat(64), category: "factura", status: "REGISTERED", extractionStatus: "COMPLETED", extractionConfidence: 0.92, extractedData: extraction, extractedIssuer: supplier.commercialName, extractedIssuerTaxId: supplier.taxId, extractedInvoiceNo: purchaseInvoice.invoiceNumber, extractedIssueDate: purchaseInvoice.issueDate, extractedTotal: purchaseInvoice.total, clientId: client.id, workId: work.id, expenseId: purchaseExpense.id, businessPartnerId: supplier.id, purchaseInvoiceId: purchaseInvoice.id, uploadedById: owner.id, processedAt: new Date(), metadata: { source: "expense_document_reader", synthetic: true, review: { confirmed: true } }, createdAt: new Date() },
  });
  await prisma.document.upsert({
    where: { id: "review-expense-document-duplicate-1" },
    update: { companyId: primary.id, name: "Ticket duplicado Review.png", originalName: "ticket-duplicado-review.png", mimeType: "image/png", size: 1_024, sha256: "a".repeat(64), category: "ticket", status: "POSSIBLE_DUPLICATE", extractionStatus: "COMPLETED", extractionConfidence: 0.76, extractedIssuer: supplier.commercialName, extractedIssuerTaxId: supplier.taxId, extractedInvoiceNo: purchaseInvoice.invoiceNumber, extractedIssueDate: purchaseInvoice.issueDate, extractedTotal: purchaseInvoice.total, workId: work.id, businessPartnerId: supplier.id, uploadedById: owner.id, processedAt: new Date(), metadata: { source: "expense_document_reader", synthetic: true } },
    create: { id: "review-expense-document-duplicate-1", companyId: primary.id, name: "Ticket duplicado Review.png", originalName: "ticket-duplicado-review.png", mimeType: "image/png", size: 1_024, sha256: "a".repeat(64), category: "ticket", status: "POSSIBLE_DUPLICATE", extractionStatus: "COMPLETED", extractionConfidence: 0.76, extractedIssuer: supplier.commercialName, extractedIssuerTaxId: supplier.taxId, extractedInvoiceNo: purchaseInvoice.invoiceNumber, extractedIssueDate: purchaseInvoice.issueDate, extractedTotal: purchaseInvoice.total, workId: work.id, businessPartnerId: supplier.id, uploadedById: owner.id, processedAt: new Date(), metadata: { source: "expense_document_reader", synthetic: true }, createdAt: new Date(Date.now() - 86_400_000) },
  });
  await prisma.eventoAgenda.upsert({
    where: { id: "review-event-1" },
    update: { companyId: primary.id, clienteId: client.id, obraId: work.id, contactId: contact.id, fechaInicio: reviewWeekDate(0, 9), estado: "confirmado" },
    create: { id: "review-event-1", companyId: primary.id, titulo: "Visita sintética", descripcion: "Revisión de avance con el contacto de obra.", tipo: "visita", estado: "confirmado", fechaInicio: reviewWeekDate(0, 9), clienteId: client.id, obraId: work.id, contactId: contact.id },
  });
  const reviewAgendaEvents = [
    { id: "review-event-2", titulo: "Llamada de coordinación", descripcion: "Confirmar acceso y materiales.", tipo: "llamada", day: 1, hour: 10 },
    { id: "review-event-3", titulo: "Seguimiento del presupuesto", descripcion: "Revisar la decisión pendiente.", tipo: "seguimiento_presupuesto", day: 2, hour: 12 },
    { id: "review-event-4", titulo: "Entrega de materiales", descripcion: "Comprobar albarán y recepción.", tipo: "compra_material", day: 3, hour: 8 },
    { id: "review-event-5", titulo: "Revisión de cierre semanal", descripcion: "Actualizar el siguiente paso con el equipo.", tipo: "recordatorio_interno", day: 4, hour: 16 },
  ] as const;
  for (const event of reviewAgendaEvents) {
    await prisma.eventoAgenda.upsert({
      where: { id: event.id },
      update: { companyId: primary.id, titulo: event.titulo, descripcion: event.descripcion, tipo: event.tipo, estado: "confirmado", fechaInicio: reviewWeekDate(event.day, event.hour), clienteId: client.id, obraId: work.id, contactId: contact.id },
      create: { id: event.id, companyId: primary.id, titulo: event.titulo, descripcion: event.descripcion, tipo: event.tipo, estado: "confirmado", fechaInicio: reviewWeekDate(event.day, event.hour), clienteId: client.id, obraId: work.id, contactId: contact.id },
    });
  }
  const task = await prisma.task.upsert({
    where: { id: "review-task-1" },
    update: { companyId: primary.id, clientId: client.id, workId: work.id, status: "in_progress", priority: "high", createdById: owner.id, assigneeId: users.get("worker")!.id, dueAt: new Date(Date.now() + 86_400_000) },
    create: { id: "review-task-1", companyId: primary.id, clientId: client.id, workId: work.id, title: "Revisar avance sintético", description: "Tarea visible para los perfiles operativos", status: "in_progress", priority: "high", createdById: owner.id, assigneeId: users.get("worker")!.id, dueAt: new Date(Date.now() + 86_400_000) },
  });
  await prisma.taskAssignment.deleteMany({ where: { taskId: task.id } });
  await prisma.taskAssignment.createMany({ data: ["project-manager", "supervisor", "worker", "external"].map((key) => ({ taskId: task.id, userId: users.get(key)!.id, role: "responsible" })) });
  const reviewTasks = [
    { id: "review-task-2", title: "Confirmar mediciones", status: "planned", priority: "urgent", dueAt: new Date() },
    { id: "review-task-3", title: "Preparar pedido de pintura", status: "planned", priority: "medium", dueAt: new Date(Date.now() + 2 * 86_400_000) },
    { id: "review-task-4", title: "Resolver acceso a cubierta", status: "blocked", priority: "high", dueAt: new Date() },
    { id: "review-task-5", title: "Esperar validación del cliente", status: "waiting", priority: "medium", dueAt: new Date(Date.now() + 3 * 86_400_000) },
    { id: "review-task-6", title: "Coordinar retirada de escombros", status: "inbox", priority: "low", dueAt: null },
    { id: "review-task-7", title: "Revisar parte diario", status: "in_progress", priority: "medium", dueAt: new Date(Date.now() + 4 * 86_400_000) },
    { id: "review-task-completed-1", title: "Validar replanteo inicial", status: "completed", priority: "medium", dueAt: new Date(Date.now() - 86_400_000) },
  ] as const;
  for (const fixture of reviewTasks) {
    await prisma.task.upsert({
      where: { id: fixture.id },
      update: { companyId: primary.id, clientId: client.id, workId: work.id, title: fixture.title, status: fixture.status, priority: fixture.priority, createdById: owner.id, assigneeId: users.get("worker")!.id, dueAt: fixture.dueAt },
      create: { id: fixture.id, companyId: primary.id, clientId: client.id, workId: work.id, title: fixture.title, description: "Dato sintético D7 para revisar volumen, estados y jerarquía.", status: fixture.status, priority: fixture.priority, createdById: owner.id, assigneeId: users.get("worker")!.id, dueAt: fixture.dueAt },
    });
  }

  const reviewFollowUps = [
    { id: "review-followup-1", title: "Confirmar decisión del presupuesto", type: "budget_followup", status: "promised", priority: "high", nextActionAt: new Date(Date.now() + 86_400_000), expectedOutcome: "Respuesta comprometida antes del viernes" },
    { id: "review-followup-2", title: "Revisar cobro parcial", type: "collection_followup", status: "waiting_response", priority: "urgent", nextActionAt: new Date(Date.now() - 86_400_000), expectedOutcome: "Acordar fecha del siguiente pago" },
    { id: "review-followup-3", title: "Coordinar visita final", type: "client_contact", status: "planned", priority: "medium", nextActionAt: new Date(Date.now() + 3 * 86_400_000), expectedOutcome: "Cerrar una fecha de visita" },
    { id: "review-followup-completed-1", title: "Confirmar recepción de materiales", type: "general", status: "completed", priority: "low", nextActionAt: new Date(Date.now() - 2 * 86_400_000), expectedOutcome: "Recepción confirmada" },
  ] as const;
  for (const fixture of reviewFollowUps) {
    await prisma.followUp.upsert({
      where: { id: fixture.id },
      update: { companyId: primary.id, title: fixture.title, type: fixture.type, status: fixture.status, priority: fixture.priority, createdById: owner.id, responsibleId: users.get("sales")!.id, clientId: client.id, contactId: contact.id, workId: work.id, budgetId: "review-budget-1", invoiceId: invoice.id, nextActionAt: fixture.nextActionAt, expectedOutcome: fixture.expectedOutcome },
      create: { id: fixture.id, companyId: primary.id, title: fixture.title, type: fixture.type, status: fixture.status, priority: fixture.priority, createdById: owner.id, responsibleId: users.get("sales")!.id, clientId: client.id, contactId: contact.id, workId: work.id, budgetId: "review-budget-1", invoiceId: invoice.id, nextActionAt: fixture.nextActionAt, expectedOutcome: fixture.expectedOutcome },
    });
  }
  await prisma.followUpAttempt.upsert({
    where: { id: "review-followup-attempt-1" },
    update: { followUpId: "review-followup-1", attemptedAt: new Date(Date.now() - 4 * 60 * 60_000), channel: "telefono", responsibleId: users.get("sales")!.id, summary: "Contacto sintético realizado", response: "Promete revisar la propuesta" },
    create: { id: "review-followup-attempt-1", followUpId: "review-followup-1", attemptedAt: new Date(Date.now() - 4 * 60 * 60_000), channel: "telefono", responsibleId: users.get("sales")!.id, summary: "Contacto sintético realizado", response: "Promete revisar la propuesta" },
  });
  await prisma.followUpOutcome.upsert({
    where: { id: "review-followup-outcome-1" },
    update: { followUpId: "review-followup-1", type: "promise", summary: "Respuesta prometida para el viernes", recordedById: users.get("sales")!.id },
    create: { id: "review-followup-outcome-1", followUpId: "review-followup-1", type: "promise", summary: "Respuesta prometida para el viernes", recordedById: users.get("sales")!.id },
  });

  const automation = await prisma.automationDefinition.upsert({
    where: { id: "review-automation-1" },
    update: { companyId: primary.id, name: "Recordatorio interno de revisión", description: "Automatización sintética con confirmación humana y proveedor live desactivado.", category: "followups", status: "active", priority: 10, source: "continuous-review", createdById: owner.id, active: true },
    create: { id: "review-automation-1", companyId: primary.id, name: "Recordatorio interno de revisión", description: "Automatización sintética con confirmación humana y proveedor live desactivado.", category: "followups", status: "active", priority: 10, source: "continuous-review", createdById: owner.id, active: true },
  });
  const automationVersion = await prisma.automationVersion.upsert({
    where: { id: "review-automation-version-1" },
    update: { automationDefinitionId: automation.id, version: 1, status: "published", triggerMode: "schedule", cooldownSeconds: 86_400, timeoutSeconds: 60, retryPolicy: { maxAttempts: 3, backoff: "exponential" }, requiresConfirmation: true, confirmationMode: "per_action", deduplicationStrategy: "occurrence", definitionHash: "review-automation-d7-v1", publishedAt: new Date() },
    create: { id: "review-automation-version-1", automationDefinitionId: automation.id, version: 1, status: "published", triggerMode: "schedule", cooldownSeconds: 86_400, timeoutSeconds: 60, retryPolicy: { maxAttempts: 3, backoff: "exponential" }, requiresConfirmation: true, confirmationMode: "per_action", deduplicationStrategy: "occurrence", definitionHash: "review-automation-d7-v1", publishedAt: new Date() },
  });
  await prisma.automationTrigger.upsert({
    where: { id: "review-automation-trigger-1" },
    update: { automationVersionId: automationVersion.id, type: "schedule", eventType: null, entityType: "FollowUp", configuration: { cadence: "daily" } },
    create: { id: "review-automation-trigger-1", automationVersionId: automationVersion.id, type: "schedule", entityType: "FollowUp", configuration: { cadence: "daily" } },
  });
  await prisma.automationAction.upsert({
    where: { id: "review-automation-action-1" },
    update: { automationVersionId: automationVersion.id, actionType: "create_internal_reminder", order: 0, configuration: { channel: "internal" }, requiresConfirmation: true, confirmationMode: "per_action", onFailure: "retry" },
    create: { id: "review-automation-action-1", automationVersionId: automationVersion.id, actionType: "create_internal_reminder", order: 0, configuration: { channel: "internal" }, requiresConfirmation: true, confirmationMode: "per_action", onFailure: "retry" },
  });
  await prisma.automationSchedule.upsert({
    where: { automationDefinitionId: automation.id },
    update: { timezone: "Europe/Madrid", cronExpression: "0 8 * * 1-5", nextRunAt: new Date(Date.now() + 86_400_000), active: true },
    create: { id: "review-automation-schedule-1", automationDefinitionId: automation.id, timezone: "Europe/Madrid", cronExpression: "0 8 * * 1-5", nextRunAt: new Date(Date.now() + 86_400_000), active: true },
  });
  await prisma.automationDefinition.update({ where: { id: automation.id }, data: { currentVersionId: automationVersion.id } });
  await prisma.automationRun.upsert({
    where: { id: "review-automation-run-1" },
    update: { companyId: primary.id, automationDefinitionId: automation.id, automationVersionId: automationVersion.id, status: "failed", triggerType: "schedule", triggeredBy: "continuous-review", correlationId: "review-automation-correlation-1", idempotencyKey: "review-automation-run-d7-v1", failedAt: new Date(Date.now() - 60 * 60_000), errorCode: "REVIEW_SYNTHETIC_FAILURE", errorSummary: "Fallo sintético visible; no se llamó a ningún proveedor.", nextRetryAt: new Date(Date.now() + 60 * 60_000), attemptCount: 1, lastAttemptAt: new Date(Date.now() - 60 * 60_000), lastErrorCode: "REVIEW_SYNTHETIC_FAILURE", lastErrorSummary: "Fallo sintético para auditar retries." },
    create: { id: "review-automation-run-1", companyId: primary.id, automationDefinitionId: automation.id, automationVersionId: automationVersion.id, status: "failed", triggerType: "schedule", triggeredBy: "continuous-review", correlationId: "review-automation-correlation-1", idempotencyKey: "review-automation-run-d7-v1", failedAt: new Date(Date.now() - 60 * 60_000), errorCode: "REVIEW_SYNTHETIC_FAILURE", errorSummary: "Fallo sintético visible; no se llamó a ningún proveedor.", nextRetryAt: new Date(Date.now() + 60 * 60_000), attemptCount: 1, lastAttemptAt: new Date(Date.now() - 60 * 60_000), lastErrorCode: "REVIEW_SYNTHETIC_FAILURE", lastErrorSummary: "Fallo sintético para auditar retries." },
  });

  await prisma.platformAccount.upsert({ where: { userId: owner.id }, update: { role: "PLATFORM_OWNER", status: "ACTIVE" }, create: { userId: owner.id, role: "PLATFORM_OWNER", status: "ACTIVE" } });
  let ownerMfaToken: string | null = null;
  let ownerMfaSecret: string | null = null;
  if (process.env.ORQENA_REVIEW_PROVISION_MFA === "true") {
    const enrollment = await startTotpEnrollment({ prisma, userId: owner.id, email: owner.email });
    const secret = new URL(enrollment.uri).searchParams.get("secret");
    if (!secret) throw new Error("REVIEW_MFA_SECRET_MISSING");
    ownerMfaSecret = secret;
    const mfaIssuedAt = new Date();
    ownerMfaToken = await generate({ secret, epoch: Math.floor(mfaIssuedAt.getTime() / 1_000) });
    await confirmTotpEnrollment({ prisma, userId: owner.id, factorId: enrollment.factorId, token: ownerMfaToken, now: mfaIssuedAt });
  }
  const rotateOwnerAccess = process.env.ORQENA_REVIEW_ROTATE_OWNER_ACCESS !== "false";
  const token = rotateOwnerAccess ? createOpaqueToken() : null;
  if (token) {
    await prisma.passwordResetToken.updateMany({ where: { userId: owner.id, usedAt: null }, data: { usedAt: new Date() } });
    await prisma.passwordResetToken.create({ data: { userId: owner.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 60 * 60_000) } });
  }
  await prisma.auditLog.create({ data: { companyId: primary.id, userActorId: owner.id, action: "continuous_review.provisioned", targetType: "Company", targetId: primary.id, metadata: { synthetic: true, version: 1, profiles: profiles.length, negativeTenantId: negativeTenant.id } } });

  process.stdout.write(`${JSON.stringify({
    ok: true,
    synthetic: true,
    companies: 2,
    profiles: profiles.map(({ key, profile, readOnly }) => ({ key, profile, readOnly: Boolean(readOnly) })),
    platformOwner: true,
    passwordPrinted: false,
    resetUrl: token ? `${REVIEW_ORIGIN}/restablecer-contrasena?token=${encodeURIComponent(token)}` : null,
    resetExpiresAt: token ? new Date(Date.now() + 60 * 60_000).toISOString() : null,
    ownerAccessRotated: Boolean(token),
    ownerMfaProvisioned: Boolean(ownerMfaToken),
    ownerMfaSecret,
  })}\n`);
}

main().finally(() => prisma.$disconnect()).catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
