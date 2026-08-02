import type { Prisma } from "@prisma/client";
import { ListWorkspace } from "@/components/workspaces";
import {
  GlobalDocumentsWorkspace,
  type GlobalDocumentHistoryItem,
  type GlobalDocumentKind,
  type GlobalDocumentTone,
  type GlobalDocumentWorkspaceItem,
} from "@/components/portal/modules-a/global-documents-workspace";
import { buildPortalManifest } from "@/lib/commercial/portal-manifest";
import {
  requireCapability,
  resolveAuthorization,
  resolveScopedEntityIds,
} from "@/lib/commercial/authorization";
import { documentTemplateAssets } from "@/lib/document-templates";
import { normalizeExpenseExtraction } from "@/lib/expense-document";
import { formatCurrency, formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const documentInclude = {
  client: { select: { id: true, nombre: true } },
  work: { select: { id: true, titulo: true } },
  budget: { select: { id: true, numero: true, titulo: true } },
  invoice: { select: { id: true, numero: true, concepto: true } },
  expense: { select: { id: true, concepto: true } },
  businessPartner: { select: { id: true, commercialName: true } },
  uploadedBy: { select: { displayName: true } },
} satisfies Prisma.DocumentInclude;

type DocumentRecord = Prisma.DocumentGetPayload<{ include: typeof documentInclude }>;

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ documento?: string; vista?: string }>;
}) {
  const query = await searchParams;
  const auth = await requireCapability("documents.view");
  const manifest = await buildPortalManifest(auth);
  const [canUpload, canManage, canManageReceivedInvoices, canSeeFinancialData, scopedDocumentIds] = await Promise.all([
    resolveAuthorization(auth, "documents.upload"),
    resolveAuthorization(auth, "documents.manage"),
    resolveAuthorization(auth, "purchases.received_invoices.manage"),
    resolveAuthorization(auth, "reports.view"),
    resolveScopedEntityIds(auth, "documents.view", "Document"),
  ]);
  const documents = await prisma.document.findMany({
    where: {
      companyId: auth.companyId,
      archivedAt: null,
      classification: { in: manifest.documentClasses },
      ...(scopedDocumentIds === null ? {} : { id: { in: scopedDocumentIds } }),
    },
    include: documentInclude,
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    take: 128,
  });

  const workspaceDocuments = documents.map((document) =>
    toWorkspaceDocument(document, {
      canManage: canManage.allowed,
      canManageReceivedInvoices: canManageReceivedInvoices.allowed,
      canSeeFinancialData: canSeeFinancialData.allowed,
    }),
  );
  const requestedSelection = query.documento?.slice(0, 160) ?? null;
  const selected = workspaceDocuments.some((document) => document.id === requestedSelection)
    ? requestedSelection
    : workspaceDocuments.find((document) => document.requiresReview)?.id ?? null;

  return (
    <ListWorkspace className="documents-page">
      <GlobalDocumentsWorkspace
        documents={workspaceDocuments}
        selectedId={selected}
        initialView={query.vista === "plantillas" ? "templates" : "documents"}
        primaryAction={canUpload.allowed ? { href: "/documentos/subir", label: "Subir documento" } : null}
        templates={documentTemplateAssets.map((asset) => ({
          id: asset.slug,
          label: asset.label,
          kindLabel: asset.kind === "budget" ? "Presupuesto" : "Factura",
          formatLabel: asset.format.toUpperCase(),
          previewAction: asset.format === "pdf"
            ? { href: `/documentos/plantillas/${asset.slug}?preview=1`, label: "Vista previa", target: "_blank" }
            : null,
          downloadAction: { href: `/documentos/plantillas/${asset.slug}`, label: "Descargar", target: "_blank", download: true },
        }))}
        emptyTitle="Todavía no hay documentos"
        emptyDescription="Incorpora el primer archivo desde una acción autorizada. No se crean muestras ni registros de demostración."
      />
    </ListWorkspace>
  );
}

function toWorkspaceDocument(
  document: DocumentRecord,
  access: { canManage: boolean; canManageReceivedInvoices: boolean; canSeeFinancialData: boolean },
): GlobalDocumentWorkspaceItem {
  const source = metadataSource(document.metadata);
  const readerDocument = source === "expense_document_reader";
  const reviewHref = readerDocument ? `/gastos-materiales/lector/${document.id}` : null;
  const privateFileHref = document.storageKey ? `/documentos/${document.id}/archivo` : null;
  const originalHref = privateFileHref ?? safeResourceHref(document.url);
  const downloadHref = privateFileHref ? `${privateFileHref}?download=1` : originalHref;
  const kind = documentKind(document);
  const status = documentStatus(document.status);
  const related = relatedLabel(document);
  const amount = access.canSeeFinancialData && document.extractedTotal != null
    ? formatCurrency(document.extractedTotal)
    : null;
  const extractedDate = document.extractedIssueDate ? formatDate(document.extractedIssueDate) : null;
  const issuer = access.canSeeFinancialData
    ? document.businessPartner?.commercialName ?? document.extractedIssuer
    : document.businessPartner?.commercialName ?? null;
  const proposal = document.extractedData ? normalizeExpenseExtraction(document.extractedData) : null;
  const canReviewReader = access.canManageReceivedInvoices && reviewHref && !document.expenseId;
  const reviewAction = canReviewReader
    ? { href: intentHref(reviewHref, "review", "document-review"), label: "Revisar documento" }
    : null;
  const genericEditHref = `/gestion?tipo=documento&id=${document.id}&returnTo=/documentos`;
  const previewTable = access.canSeeFinancialData && proposal?.lines.length
    ? {
        columns: ["Concepto", "Cantidad", "Precio", "Importe"],
        rows: proposal.lines.map((line, index) => ({
          id: `${document.id}-line-${index}`,
          cells: [
            line.description,
            line.quantity == null ? "—" : formatNumber(line.quantity),
            line.unitPrice == null ? "—" : formatCurrency(line.unitPrice),
            line.total == null ? "—" : formatCurrency(line.total),
          ],
        })),
      }
    : null;
  const previewTotals = access.canSeeFinancialData && proposal
    ? compactFields([
        field("taxable-base", "Base imponible", money(proposal.taxableBase)),
        field("vat", proposal.vatRate == null ? "IVA" : `IVA (${formatNumber(proposal.vatRate)} %)`, money(proposal.vatAmount)),
        field("withholding", "Retención", proposal.withholdingAmount == null ? null : `−${formatCurrency(proposal.withholdingAmount)}`),
        field("total", "Total", money(proposal.total) ?? amount),
      ])
    : compactFields([field("total", "Total extraído", amount)]);
  const attentionItems = [
    ...(proposal?.warnings ?? []),
    ...(document.status === "AWAITING_PARTNER" ? ["Falta confirmar el proveedor relacionado."] : []),
    ...(document.status === "AWAITING_WORK" ? ["Falta confirmar el trabajo relacionado."] : []),
  ].slice(0, 3);

  return {
    id: document.id,
    name: document.originalName || document.name,
    kind,
    kindLabel: documentKindLabel(kind),
    statusLabel: status.label,
    statusTone: status.tone,
    requiresReview: status.requiresReview,
    relatedLabel: related,
    dateLabel: formatDate(document.createdAt),
    amountLabel: amount,
    updatedLabel: relativeUpdateLabel(document.updatedAt),
    preview: {
      href: originalHref,
      title: document.originalName || document.name,
      subtitle: related,
      facts: compactFields([
        field("issuer", "Proveedor / emisor", issuer),
        field("tax-id", "NIF / VAT", access.canSeeFinancialData ? document.extractedIssuerTaxId : null),
        field("invoice", "Número", access.canSeeFinancialData ? document.extractedInvoiceNo : null),
        field("date", "Fecha", extractedDate),
        field("due-date", "Vencimiento", proposal?.dueDate ? formatDate(new Date(`${proposal.dueDate}T00:00:00Z`)) : null),
        field("type", "Tipo", documentTypeLabel(document)),
      ]),
      table: previewTable,
      totals: previewTotals,
      notes: [
        ...(proposal?.paymentMethod ? [`Forma de pago: ${proposal.paymentMethod}.`] : []),
        ...(attentionItems.length ? attentionItems.map((item) => `Revisión: ${item}`) : []),
        document.storageKey
          ? "El original se sirve mediante una ruta privada y autenticada."
          : "Este registro no contiene un binario privado disponible.",
        "La extracción es una propuesta y requiere revisión humana.",
      ],
    },
    ocrFields: compactFields([
      field("document-type", "Tipo de documento", documentTypeLabel(document)),
      field("document-number", "Número", access.canSeeFinancialData ? document.extractedInvoiceNo : null),
      field("document-date", "Fecha", extractedDate),
      field("issuer", "Proveedor / emisor", issuer),
      field("related", document.work ? "Trabajo" : document.client ? "Cliente" : "Relación", related),
      field("total", "Total", amount),
      field("confidence", "Confianza OCR", confidenceLabel(document.extractionConfidence)),
    ]),
    reviewDescription: status.requiresReview
      ? "Pendiente de revisión humana. Ningún dato se registra automáticamente."
      : "El estado mostrado procede del registro documental de la empresa.",
    aiContext: {
      documentId: document.id,
      title: document.originalName || document.name,
      statusLabel: status.label,
      relationLabel: related,
      confidenceLabel: confidenceLabel(document.extractionConfidence),
      attentionItems,
      reviewHref: reviewAction?.href
        ?? (access.canManage && !readerDocument ? `${genericEditHref}#document-details` : null),
    },
    history: compactHistory([
      {
        id: `${document.id}-created`,
        timestampLabel: formatDate(document.createdAt),
        title: "Documento incorporado",
        detail: document.uploadedBy?.displayName ?? "Origen no informado",
        tone: "info" as const,
      },
      document.processedAt ? {
        id: `${document.id}-processed`,
        timestampLabel: formatDate(document.processedAt),
        title: document.extractionStatus === "COMPLETED" ? "Extracción completada" : "Procesamiento registrado",
        detail: document.extractionError ?? null,
        tone: document.extractionStatus === "FAILED" ? "danger" as const : "success" as const,
      } : null,
      document.updatedAt.getTime() !== document.createdAt.getTime() ? {
        id: `${document.id}-updated`,
        timestampLabel: formatDate(document.updatedAt),
        title: "Registro actualizado",
        detail: status.label,
        tone: status.tone,
      } : null,
    ]),
    actions: {
      original: originalHref ? { href: originalHref, label: "Abrir original", target: "_blank" } : null,
      download: downloadHref ? { href: downloadHref, label: "Descargar", target: "_blank", download: true } : null,
      edit: access.canManage && !readerDocument
        ? { href: `${genericEditHref}#document-details`, label: "Editar ficha" }
        : reviewAction,
      linkWork: canReviewReader ? { href: intentHref(reviewHref, "link-work", "document-work"), label: "Vincular a trabajo" } : null,
      linkPartner: canReviewReader ? { href: intentHref(reviewHref, "link-partner", "document-partner"), label: "Vincular a proveedor" } : null,
      confirm: reviewAction,
      correct: canReviewReader
        ? { href: intentHref(reviewHref, "correct", "document-fields"), label: "Corregir datos" }
        : access.canManage && !readerDocument
          ? { href: `${genericEditHref}#document-details`, label: "Corregir datos" }
          : null,
    },
  };
}

function intentHref(base: string, intent: "review" | "link-work" | "link-partner" | "correct", anchor: string) {
  return `${base}?intent=${intent}&returnTo=${encodeURIComponent("/documentos")}#${anchor}`;
}

function money(value: number | null | undefined) {
  return value == null ? null : formatCurrency(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(value);
}

function documentKind(document: DocumentRecord): GlobalDocumentKind {
  const category = document.category.toLocaleLowerCase("es-ES");
  const type = document.documentType?.toLocaleLowerCase("es-ES") ?? "";
  const source = metadataSource(document.metadata)?.toLocaleLowerCase("es-ES") ?? "";
  if (category === "contrato") return "contract";
  if (category === "ticket" || type.includes("receipt")) return "ticket";
  if (source.includes("parte") || category === "informe" && document.name.toLocaleLowerCase("es-ES").includes("parte")) return "work_part";
  if (category === "factura" || type.includes("invoice")) return "invoice";
  return "other";
}

function documentKindLabel(kind: GlobalDocumentKind) {
  if (kind === "invoice") return "Factura";
  if (kind === "ticket") return "Ticket";
  if (kind === "contract") return "Contrato";
  if (kind === "work_part") return "Parte";
  return "Documento";
}

function documentTypeLabel(document: DocumentRecord) {
  if (document.documentType) return document.documentType.toLocaleLowerCase("es-ES").replaceAll("_", " ");
  return document.category.toLocaleLowerCase("es-ES").replaceAll("_", " ");
}

function documentStatus(status: DocumentRecord["status"]): { label: string; tone: GlobalDocumentTone; requiresReview: boolean } {
  if (["REVIEW_REQUIRED", "AWAITING_PARTNER", "AWAITING_WORK", "POSSIBLE_DUPLICATE"].includes(status)) {
    const label = status === "POSSIBLE_DUPLICATE" ? "Posible duplicado" : status === "AWAITING_PARTNER" ? "Falta proveedor" : status === "AWAITING_WORK" ? "Falta trabajo" : "Revisión pendiente";
    return { label, tone: "warning", requiresReview: true };
  }
  if (["READY", "SAVED", "REGISTERED"].includes(status)) return { label: "Confirmado", tone: "success", requiresReview: false };
  if (["FAILED", "CANCELLED"].includes(status)) return { label: status === "FAILED" ? "Error" : "Cancelado", tone: "danger", requiresReview: false };
  if (status === "PROCESSING") return { label: "Procesando", tone: "info", requiresReview: false };
  if (status === "ARCHIVED") return { label: "Archivado", tone: "neutral", requiresReview: false };
  return { label: "Recibido", tone: "neutral", requiresReview: false };
}

function relatedLabel(document: DocumentRecord) {
  return document.work?.titulo
    ?? document.client?.nombre
    ?? document.businessPartner?.commercialName
    ?? document.budget?.numero
    ?? document.invoice?.numero
    ?? document.expense?.concepto
    ?? null;
}

function metadataSource(value: Prisma.JsonValue) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return typeof value.source === "string" ? value.source : null;
}

function safeResourceHref(value: string | null | undefined) {
  if (!value) return null;
  if (value.startsWith("/") || value.startsWith("https://")) return value;
  return null;
}

function field(id: string, label: string, value: string | null | undefined) {
  return value?.trim() ? { id, label, value: value.trim() } : null;
}

function compactFields(values: Array<ReturnType<typeof field>>) {
  return values.filter((value): value is NonNullable<typeof value> => value != null);
}

function compactHistory(values: Array<GlobalDocumentHistoryItem | null>) {
  return values.filter((value): value is NonNullable<typeof value> => value != null);
}

function confidenceLabel(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return null;
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)} %`;
}

function relativeUpdateLabel(value: Date) {
  const difference = Date.now() - value.getTime();
  if (difference >= 0 && difference < 24 * 60 * 60 * 1000) return "Hoy";
  if (difference >= 0 && difference < 48 * 60 * 60 * 1000) return "Ayer";
  return formatDate(value);
}
