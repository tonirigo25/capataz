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

export default async function DocumentsPage() {
  const auth = await requireCapability("documents.view");
  const manifest = await buildPortalManifest(auth);
  const [canUpload, canManage, canManageReceivedInvoices, canSeeFinancialData, scopedWorkIds] = await Promise.all([
    resolveAuthorization(auth, "documents.upload"),
    resolveAuthorization(auth, "documents.manage"),
    resolveAuthorization(auth, "purchases.received_invoices.manage"),
    resolveAuthorization(auth, "reports.view"),
    resolveScopedEntityIds(auth, "documents.view", "Work"),
  ]);
  const documents = await prisma.document.findMany({
    where: {
      companyId: auth.companyId,
      archivedAt: null,
      classification: { in: manifest.documentClasses },
      ...(scopedWorkIds === null ? {} : { workId: { in: scopedWorkIds } }),
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
  const selected = workspaceDocuments.find((document) => document.requiresReview)?.id ?? null;

  return (
    <ListWorkspace>
      <GlobalDocumentsWorkspace
        documents={workspaceDocuments}
        selectedId={selected}
        primaryAction={canManageReceivedInvoices.allowed
          ? { href: "/gastos-materiales/lector", label: "Subir documento" }
          : canUpload.allowed
            ? { href: "/gestion?tipo=documento&returnTo=/documentos", label: "Añadir documento" }
            : null}
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
  const originalHref = readerDocument && document.storageKey ? `${reviewHref}/archivo` : safeResourceHref(document.url);
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
  const reviewAction = access.canManageReceivedInvoices && reviewHref
    ? { href: reviewHref, label: "Revisar documento" }
    : null;

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
        field("invoice", "Número", access.canSeeFinancialData ? document.extractedInvoiceNo : null),
        field("date", "Fecha", extractedDate),
        field("type", "Tipo", documentTypeLabel(document)),
      ]),
      totals: compactFields([
        field("total", "Total extraído", amount),
      ]),
      notes: document.storageKey
        ? ["El original se sirve mediante una ruta privada y autenticada.", "La extracción es una propuesta y requiere revisión humana."]
        : ["Este registro no contiene un binario privado disponible."],
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
      download: originalHref ? { href: originalHref, label: "Descargar", target: "_blank", download: true } : null,
      edit: access.canManage && !readerDocument
        ? { href: `/gestion?tipo=documento&id=${document.id}&returnTo=/documentos`, label: "Editar ficha" }
        : reviewAction,
      linkWork: reviewAction ? { ...reviewAction, label: "Vincular a trabajo" } : null,
      linkPartner: reviewAction ? { ...reviewAction, label: "Vincular a proveedor" } : null,
      confirm: reviewAction,
      correct: reviewAction ? { ...reviewAction, label: "Corregir datos" } : null,
    },
  };
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
