import Link from "next/link";
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  ClipboardSignature,
  Download,
  Eye,
  FileArchive,
  FileCheck2,
  FileText,
  FolderOpen,
  Plus,
  Receipt,
  ScanLine,
  ScrollText,
  ShieldCheck,
} from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { ListWorkspace } from "@/components/workspaces";
import { StatusPill } from "@/components/status-pill";
import {
  CompactTabs,
  KpiCard,
  KpiGrid,
  ModuleHeader,
  SoftBadge,
} from "@/components/portal/modules-b/module-frame";
import {
  documentCategories,
  documentTemplateAssets,
} from "@/lib/document-templates";
import { documentDetail, repositoryDocumentDisplay } from "@/lib/documents";
import { formatCurrency, formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { deriveInvoiceStatus } from "@/lib/status";
import {
  requireCapability,
  resolveAuthorization,
  resolveScopedEntityIds,
} from "@/lib/commercial/authorization";
import { buildPortalManifest } from "@/lib/commercial/portal-manifest";

export const dynamic = "force-dynamic";

const categoryIcons = {
  presupuestos: FileText,
  facturas: Receipt,
  albaranes: ScrollText,
  contratos: ClipboardSignature,
  archivos: Archive,
  plantillas: FileArchive,
};

export default async function DocumentsPage() {
  const auth = await requireCapability("documents.view");
  const { companyId } = auth;
  const manifest = await buildPortalManifest(auth);
  const canUpload = (await resolveAuthorization(auth, "documents.upload"))
    .allowed;
  const canManage = (await resolveAuthorization(auth, "documents.manage"))
    .allowed;
  const canCreateBudget = (
    await resolveAuthorization(auth, "sales.budgets.create")
  ).allowed;
  const canUpdateBudget = (
    await resolveAuthorization(auth, "sales.budgets.update")
  ).allowed;
  const canCreateInvoice = (
    await resolveAuthorization(auth, "sales.invoices.create")
  ).allowed;
  const canManageReceivedInvoices = (
    await resolveAuthorization(auth, "purchases.received_invoices.manage")
  ).allowed;
  const canViewBudgets = (
    await resolveAuthorization(auth, "sales.budgets.view")
  ).allowed;
  const canViewInvoices = (
    await resolveAuthorization(auth, "sales.invoices.view")
  ).allowed;
  const scopedWorkIds = await resolveScopedEntityIds(
    auth,
    "documents.view",
    "Work",
  );
  const budgetWorkIds = canViewBudgets
    ? await resolveScopedEntityIds(auth, "sales.budgets.view", "Work")
    : [];
  const invoiceWorkIds = canViewInvoices
    ? await resolveScopedEntityIds(auth, "sales.invoices.view", "Work")
    : [];
  const documentScope =
    scopedWorkIds === null ? {} : { workId: { in: scopedWorkIds } };
  const economicAllowed = (await resolveAuthorization(auth, "reports.view"))
    .allowed;
  if (!economicAllowed) {
    const operationalDocuments = await prisma.document.findMany({
      where: {
        companyId,
        ...documentScope,
        archivedAt: null,
        classification: { in: manifest.documentClasses },
      },
      select: {
        id: true,
        name: true,
        category: true,
        createdAt: true,
        client: { select: { nombre: true } },
        work: { select: { titulo: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return (
      <ListWorkspace>
        <ModuleHeader
          eyebrow="Repositorio autorizado"
          title="Documentos"
          description="Documentación operativa disponible según tu perfil y alcance."
          action={
            canUpload ? (
              <Link
                href="/gestion?tipo=documento&returnTo=/documentos"
                className="primary-button"
              >
                <Plus size={18} />
                Documento
              </Link>
            ) : undefined
          }
        />
        <KpiGrid>
          <KpiCard
            label="Documentos visibles"
            value={String(operationalDocuments.length)}
            detail="Sólo clases autorizadas"
            icon={FileText}
          />
          <KpiCard
            label="Acceso"
            value="Operativo"
            detail="Los importes financieros permanecen protegidos"
            icon={ShieldCheck}
            tone="success"
          />
          <KpiCard
            label="Archivo"
            value="Privado"
            detail="Descargas autenticadas y sin caché pública"
            icon={Archive}
            tone="accent"
          />
          <KpiCard
            label="Confirmación"
            value="Humana"
            detail="Ningún dato se registra automáticamente"
            icon={FileCheck2}
            tone="warning"
          />
        </KpiGrid>
        <div className="grid gap-3 md:grid-cols-2">
          {operationalDocuments.map((document) => (
            <article key={document.id} className="card p-4">
              <h2 className="font-black text-obra-ink">{document.name}</h2>
              <p className="mt-1 text-sm text-slate-600">
                {document.work?.titulo ??
                  document.client?.nombre ??
                  "Documento interno"}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                {formatDate(document.createdAt)}
              </p>
            </article>
          ))}
        </div>
      </ListWorkspace>
    );
  }
  const [budgets, invoices, repositoryDocuments, inboxDocuments] =
    await Promise.all([
      canViewBudgets
        ? prisma.budget.findMany({
            where: {
              companyId,
              ...(budgetWorkIds === null
                ? {}
                : { obraId: { in: budgetWorkIds } }),
            },
            orderBy: { fechaCreacion: "desc" },
            take: 5,
            include: { client: true, work: true },
          })
        : Promise.resolve([]),
      canViewInvoices
        ? prisma.invoice.findMany({
            where: {
              companyId,
              ...(invoiceWorkIds === null
                ? {}
                : { obraId: { in: invoiceWorkIds } }),
            },
            orderBy: { fechaEmision: "desc" },
            take: 5,
            include: { client: true, work: true },
          })
        : Promise.resolve([]),
      prisma.document.findMany({
        where: {
          companyId,
          ...documentScope,
          archivedAt: null,
          classification: { in: manifest.documentClasses },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          client: true,
          work: true,
          budget: true,
          invoice: true,
          expense: true,
        },
      }),
      prisma.document.findMany({
        where: {
          companyId,
          ...documentScope,
          archivedAt: null,
          classification: { in: manifest.documentClasses },
          metadata: { path: ["source"], equals: "expense_document_reader" },
        },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: {
          businessPartner: { select: { commercialName: true } },
          work: { select: { titulo: true } },
          expense: { select: { concepto: true } },
        },
      }),
    ]);
  const documents = repositoryDocuments.map(repositoryDocumentDisplay);
  const activeInboxDocument = inboxDocuments[0] ?? null;
  const reviewDocuments = inboxDocuments.filter((document) =>
    [
      "REVIEW_REQUIRED",
      "AWAITING_PARTNER",
      "AWAITING_WORK",
      "POSSIBLE_DUPLICATE",
    ].includes(document.status),
  );
  const confirmedDocuments = inboxDocuments.filter((document) =>
    ["READY", "REGISTERED", "SAVED"].includes(document.status),
  );
  const linkedDocuments = repositoryDocuments.filter(
    (document) =>
      document.clientId ||
      document.workId ||
      document.budgetId ||
      document.invoiceId ||
      document.expenseId,
  );

  return (
    <ListWorkspace>
      <ModuleHeader
        eyebrow="Repositorio privado"
        title="Documentos"
        description="Entrada, extracción y revisión humana con el original siempre disponible y el acceso aislado por empresa."
        action={
          <div className="flex flex-wrap gap-2">
            {canManageReceivedInvoices ? (
              <Link href="/gastos-materiales/lector" className="primary-button">
                <Plus size={18} />
                Subir documento
              </Link>
            ) : null}
            {canCreateBudget ? (
              <Link
                href="/gestion?tipo=presupuesto&returnTo=/documentos"
                className="secondary-button"
              >
                <Plus size={18} />
                Presupuesto
              </Link>
            ) : null}
            {canCreateInvoice ? (
              <Link
                href="/gestion?tipo=factura&returnTo=/documentos"
                className="secondary-button"
              >
                <Plus size={18} />
                Factura
              </Link>
            ) : null}
            {canUpload ? (
              <Link
                href="/gestion?tipo=documento&returnTo=/documentos"
                className="secondary-button"
              >
                <Plus size={18} />
                Añadir ficha
              </Link>
            ) : null}
          </div>
        }
      />

      <CompactTabs label="Categorías documentales">
        {documentCategories
          .filter((category) =>
            ["presupuestos", "facturas", "archivos", "plantillas"].includes(
              category.id,
            ),
          )
          .map((category) => {
            const Icon =
              categoryIcons[category.id as keyof typeof categoryIcons] ??
              FolderOpen;
            return (
              <Link
                key={category.id}
                href={category.href}
                className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-bold text-slate-600 hover:bg-white hover:text-obra-ink"
              >
                <Icon size={16} />
                {category.label}
              </Link>
            );
          })}
      </CompactTabs>

      <KpiGrid>
        <KpiCard
          label="Bandeja reciente"
          value={String(inboxDocuments.length)}
          detail="Hasta 8 recepciones recientes en tu alcance"
          icon={ScanLine}
        />
        <KpiCard
          label="Pendientes recientes"
          value={String(reviewDocuments.length)}
          detail="Dentro de las recepciones mostradas"
          icon={AlertTriangle}
          tone={reviewDocuments.length ? "warning" : "success"}
        />
        <KpiCard
          label="Confirmados recientes"
          value={String(confirmedDocuments.length)}
          detail="Dentro de las recepciones mostradas"
          icon={CheckCircle2}
          tone="success"
        />
        <KpiCard
          label="Vinculados mostrados"
          value={String(linkedDocuments.length)}
          detail="Hasta 20 registros de la biblioteca visible"
          icon={FileCheck2}
          tone="accent"
        />
      </KpiGrid>

      <section className="mb-5 mt-5">
        <div className="mb-3">
          <p className="type-eyebrow">Bandeja documental</p>
          <h2 className="type-title mt-1">
            Revisión con el original a la vista
          </h2>
          <p className="type-body mt-2 max-w-3xl">
            La extracción es una propuesta. Comprueba el archivo, corrige los
            datos y confirma antes de registrar un gasto.
          </p>
        </div>
        {activeInboxDocument ? (
          <div className="overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-white shadow-[var(--shadow-panel)] xl:grid xl:min-h-[34rem] xl:grid-cols-[17rem_minmax(0,1fr)_20rem]">
            <div className="border-b border-[var(--color-border)] lg:border-b-0 lg:border-r">
              <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3">
                <h3 className="font-black text-obra-ink">Entrada</h3>
                <span className="type-meta">
                  {inboxDocuments.length} recientes
                </span>
              </div>
              <div className="divide-y divide-[var(--color-border)]">
                {inboxDocuments.map((document, index) => (
                  <Link
                    key={document.id}
                    href={`/gastos-materiales/lector/${document.id}`}
                    className={`block p-4 transition hover:bg-slate-50 ${index === 0 ? "bg-emerald-50/70 ring-1 ring-inset ring-emerald-200" : ""}`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="rounded-lg bg-slate-100 p-2 text-slate-600">
                        <FileText size={18} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-obra-ink">
                          {document.name}
                        </p>
                        <p className="mt-1 truncate text-xs text-slate-500">
                          {document.businessPartner?.commercialName ||
                            document.extractedIssuer ||
                            "Proveedor pendiente"}
                        </p>
                        <div className="mt-2">
                          <InboxStatus status={document.status} />
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            <div className="border-b border-[var(--color-border)] bg-slate-50/70 p-4 sm:p-6 lg:border-b-0 lg:border-r">
              <p className="label mb-3">Vista textual de la extracción</p>
              <div className="mx-auto flex min-h-[25rem] max-w-[30rem] flex-col bg-white p-6 shadow-sm sm:p-8">
                <div className="text-center">
                  <ScanLine className="mx-auto text-slate-400" size={28} />
                  <p className="mt-3 break-words font-mono text-sm font-black uppercase text-obra-ink">
                    {activeInboxDocument.originalName ||
                      activeInboxDocument.name}
                  </p>
                </div>
                <div className="mt-8 space-y-4 border-y border-slate-300 py-6 font-mono text-sm">
                  <DocumentDatum
                    label="Emisor"
                    value={
                      activeInboxDocument.extractedIssuer ||
                      "Pendiente de revisar"
                    }
                  />
                  <DocumentDatum
                    label="Factura"
                    value={
                      activeInboxDocument.extractedInvoiceNo || "Pendiente"
                    }
                  />
                  <DocumentDatum
                    label="Fecha"
                    value={
                      activeInboxDocument.extractedIssueDate
                        ? formatDate(activeInboxDocument.extractedIssueDate)
                        : "Pendiente"
                    }
                  />
                  <DocumentDatum
                    label="Total"
                    value={
                      activeInboxDocument.extractedTotal != null
                        ? formatCurrency(activeInboxDocument.extractedTotal)
                        : "Pendiente"
                    }
                    strong
                  />
                </div>
                <p className="mt-auto pt-8 text-center text-xs text-slate-500">
                  {activeInboxDocument.storageKey
                    ? "La vista completa se abre por una ruta privada y autenticada."
                    : "Registro sintético de Review sin binario adjunto."}
                </p>
              </div>
            </div>

            <aside className="p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-black text-obra-ink">Datos extraídos</h3>
                {activeInboxDocument.extractionConfidence != null ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-black text-emerald-800">
                    {Math.round(activeInboxDocument.extractionConfidence * 100)}{" "}
                    % confianza
                  </span>
                ) : null}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {activeInboxDocument.storageKey ? (
                  <>
                    <SoftBadge tone="success">R2 privado</SoftBadge>
                    <SoftBadge>URL temporal disponible</SoftBadge>
                  </>
                ) : (
                  <SoftBadge tone="warning">Sin binario adjunto</SoftBadge>
                )}
                <SoftBadge tone="accent">Scope de empresa</SoftBadge>
              </div>
              <div className="mt-4 grid gap-3">
                <ReviewDatum
                  label="Proveedor"
                  value={
                    activeInboxDocument.businessPartner?.commercialName ||
                    activeInboxDocument.extractedIssuer ||
                    "Por identificar"
                  }
                />
                <ReviewDatum
                  label="Trabajo"
                  value={
                    activeInboxDocument.work?.titulo ||
                    "Por asignar o gasto general"
                  }
                />
                <ReviewDatum
                  label="Estado"
                  value={inboxStatusLabel(activeInboxDocument.status)}
                />
                <ReviewDatum
                  label="Resultado"
                  value={
                    activeInboxDocument.expense
                      ? `Gasto único · ${activeInboxDocument.expense.concepto}`
                      : "Aún no se ha creado ningún gasto"
                  }
                />
              </div>
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="flex items-center gap-2 text-sm font-black text-obra-ink">
                  <ShieldCheck size={18} />
                  Comprobaciones
                </p>
                <ul className="mt-3 grid gap-2 text-xs leading-5 text-slate-600">
                  <li>✓ Tipo MIME y firma binaria validados.</li>
                  <li>✓ Archivo aislado por empresa.</li>
                  <li>
                    {activeInboxDocument.sha256
                      ? `✓ Huella SHA-256 · ${activeInboxDocument.sha256.slice(0, 12)}…`
                      : "! Huella pendiente"}
                  </li>
                  <li>
                    {activeInboxDocument.status === "POSSIBLE_DUPLICATE"
                      ? "! Posible duplicado: requiere confirmación."
                      : "✓ Sin duplicado confirmado en este estado."}
                  </li>
                </ul>
              </div>
              <Link
                href={`/gastos-materiales/lector/${activeInboxDocument.id}`}
                className="secondary-button mt-4 w-full justify-center"
              >
                {activeInboxDocument.status === "REGISTERED" ? (
                  <CheckCircle2 size={18} />
                ) : (
                  <AlertTriangle size={18} />
                )}
                {activeInboxDocument.status === "REGISTERED"
                  ? "Abrir registro"
                  : "Revisar y confirmar"}
              </Link>
              {activeInboxDocument.storageKey ? (
                <Link
                  href={`/gastos-materiales/lector/${activeInboxDocument.id}/archivo`}
                  target="_blank"
                  className="mt-3 block text-center text-sm font-bold underline decoration-slate-300 underline-offset-4"
                >
                  Abrir original
                </Link>
              ) : null}
            </aside>
          </div>
        ) : (
          <div className="card p-6">
            <h3 className="font-black text-obra-ink">Bandeja preparada</h3>
            <p className="mt-2 text-sm text-slate-600">
              Todavía no hay justificantes dentro de tu alcance. Al subir uno,
              aparecerán juntos el original, la propuesta y sus comprobaciones.
            </p>
            {canManageReceivedInvoices ? (
              <Link
                href="/gastos-materiales/lector"
                className="secondary-button mt-4"
              >
                Abrir subida segura
              </Link>
            ) : null}
          </div>
        )}
      </section>

      <section className="card mb-5 flex flex-col gap-3 border-emerald-200 bg-emerald-50/50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-black text-obra-ink">
            Tú decides antes de crear
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Revisa, corrige y confirma. Orqena no registra ni envía documentos
            sin autorización.
          </p>
        </div>
        <ShieldCheck className="shrink-0 text-emerald-700" size={28} />
      </section>

      <section id="plantillas" className="card mb-5 scroll-mt-24 p-4">
        <div className="mb-3 flex items-center gap-2">
          <FileArchive size={20} className="text-obra-yellowDark" />
          <h2 className="text-lg font-black text-obra-ink">
            Plantillas profesionales
          </h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {documentTemplateAssets.map((asset) => (
            <article
              key={asset.slug}
              className="rounded-lg border border-slate-200 p-3"
            >
              <p className="text-sm font-black text-obra-ink">{asset.label}</p>
              <p className="mt-1 break-words text-xs font-semibold text-slate-500">
                {asset.fileName}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {asset.format === "pdf" ? (
                  <Link
                    href={`/documentos/plantillas/${asset.slug}?preview=1`}
                    target="_blank"
                    className="secondary-button"
                  >
                    <Eye size={18} />
                    Ver
                  </Link>
                ) : null}
                <Link
                  href={`/documentos/plantillas/${asset.slug}`}
                  className="secondary-button"
                >
                  <Download size={18} />
                  Descargar
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="archivos" className="card mb-5 scroll-mt-24 p-4">
        <h2 className="text-lg font-black text-obra-ink">
          Archivos y documentos
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Orqena reúne los documentos asociados a clientes, trabajos,
          presupuestos, facturas y gastos.{" "}
          {"Cuando un archivo está disponible, puedes abrirlo desde su ficha."}
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {documents.map((document) => (
            <article
              key={document.id}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <p className="label">{document.type}</p>
              <h3 className="mt-1 font-black text-obra-ink">{document.name}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {document.relatedLabel}
              </p>
              <p className="mt-1 text-xs font-bold uppercase text-slate-500">
                {documentDetail(document)}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {document.href ? (
                  <Link href={document.href} className="secondary-button">
                    Abrir
                  </Link>
                ) : null}
                {canManage ? (
                  <Link
                    href={`/gestion?tipo=documento&id=${document.id}&returnTo=/documentos`}
                    className="secondary-button"
                  >
                    Editar ficha
                  </Link>
                ) : null}
              </div>
            </article>
          ))}
          {!documents.length ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-white p-4 text-sm leading-6 text-slate-500">
              Todavía no hay documentos registrados en el repositorio.
            </div>
          ) : null}
        </div>
      </section>
      <div className="grid gap-5 lg:grid-cols-2">
        <section>
          <SectionHeader level={2} title="Últimos presupuestos" />
          <div className="grid gap-3">
            {budgets.map((budget) => (
              <article key={budget.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-500">
                      {budget.numero}
                    </p>
                    <h3 className="mt-1 text-base font-black text-obra-ink">
                      {budget.titulo}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {budget.client.nombre}
                      {budget.work ? ` · ${budget.work.titulo}` : ""}
                    </p>
                  </div>
                  <StatusPill status={budget.estado} />
                </div>
                <p className="mt-3 text-sm font-black text-obra-ink">
                  {formatCurrency(budget.total)}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {canUpdateBudget ? (
                    <Link
                      href={`/gestion?tipo=presupuesto&id=${budget.id}&returnTo=/documentos`}
                      className="secondary-button"
                    >
                      Editar
                    </Link>
                  ) : null}
                  <Link
                    href={`/presupuestos/${budget.id}/pdf?preview=1`}
                    target="_blank"
                    className="secondary-button"
                  >
                    Vista PDF
                  </Link>
                  <Link
                    href={`/presupuestos/${budget.id}/pdf`}
                    className="secondary-button"
                  >
                    Descargar
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section>
          <SectionHeader level={2} title="Últimas facturas" />
          <div className="grid gap-3">
            {invoices.map((invoice) => {
              const liveStatus =
                invoice.estado === "borrador"
                  ? "borrador"
                  : deriveInvoiceStatus(
                      invoice.total,
                      invoice.pendiente,
                      invoice.fechaVencimiento,
                    );
              return (
                <article key={invoice.id} className="card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase text-slate-500">
                        {invoice.numero}
                      </p>
                      <h3 className="mt-1 text-base font-black text-obra-ink">
                        {invoice.concepto}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {invoice.client.nombre}
                        {invoice.work ? ` · ${invoice.work.titulo}` : ""}
                      </p>
                    </div>
                    <StatusPill status={liveStatus} />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-500">
                    {formatDate(invoice.fechaEmision)} · Pendiente{" "}
                    {formatCurrency(invoice.pendiente)}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {canCreateInvoice ? (
                      <Link
                        href={`/gestion?tipo=factura&id=${invoice.id}&returnTo=/documentos`}
                        className="secondary-button"
                      >
                        Editar
                      </Link>
                    ) : null}
                    <Link
                      href={`/dinero/${invoice.id}/pdf?preview=1`}
                      target="_blank"
                      className="secondary-button"
                    >
                      Vista PDF
                    </Link>
                    <Link
                      href={`/dinero/${invoice.id}/pdf`}
                      className="secondary-button"
                    >
                      Descargar
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </ListWorkspace>
  );
}

function InboxStatus({ status }: { status: string }) {
  const warning = [
    "REVIEW_REQUIRED",
    "AWAITING_PARTNER",
    "AWAITING_WORK",
    "POSSIBLE_DUPLICATE",
    "FAILED",
  ].includes(status);
  const complete = ["READY", "REGISTERED", "SAVED"].includes(status);
  return (
    <span
      className={`rounded-full px-2 py-1 text-[11px] font-black ${complete ? "bg-emerald-100 text-emerald-800" : warning ? "bg-orange-100 text-orange-800" : "bg-slate-100 text-slate-700"}`}
    >
      {inboxStatusLabel(status)}
    </span>
  );
}

function inboxStatusLabel(status: string) {
  return (
    (
      {
        UPLOADED: "Recibido",
        PROCESSING: "Procesando",
        REVIEW_REQUIRED: "Revisar",
        AWAITING_PARTNER: "Falta proveedor",
        AWAITING_WORK: "Falta trabajo",
        POSSIBLE_DUPLICATE: "Posible duplicado",
        READY: "Listo",
        REGISTERED: "Registrado",
        SAVED: "Guardado",
        FAILED: "Error",
      } as Record<string, string>
    )[status] || status.replaceAll("_", " ").toLowerCase()
  );
}

function DocumentDatum({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className={`text-right ${strong ? "font-black" : "font-bold"}`}>
        {value}
      </span>
    </div>
  );
}

function ReviewDatum({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <p className="label">{label}</p>
      <p className="mt-1 text-sm font-bold text-obra-ink">{value}</p>
    </div>
  );
}
