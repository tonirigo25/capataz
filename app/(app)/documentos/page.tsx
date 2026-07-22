import Link from "next/link";
import { Archive, ClipboardSignature, Download, Eye, FileArchive, FileText, FolderOpen, Plus, Receipt, ScrollText } from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { StatusPill } from "@/components/status-pill";
import { documentCategories, documentPlaceholders, documentTemplateAssets } from "@/lib/document-templates";
import { documentDetail, repositoryDocumentDisplay } from "@/lib/documents";
import { formatCurrency, formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { deriveInvoiceStatus } from "@/lib/status";
import { requireCompanyContext } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const categoryIcons = {
  presupuestos: FileText,
  facturas: Receipt,
  albaranes: ScrollText,
  contratos: ClipboardSignature,
  archivos: Archive,
  plantillas: FileArchive
};

export default async function DocumentsPage() {
  const { companyId } = await requireCompanyContext();
  const [budgets, invoices, repositoryDocuments] = await Promise.all([
    prisma.budget.findMany({
      where: { companyId },
      orderBy: { fechaCreacion: "desc" },
      take: 5,
      include: { client: true, work: true }
    }),
    prisma.invoice.findMany({
      where: { companyId },
      orderBy: { fechaEmision: "desc" },
      take: 5,
      include: { client: true, work: true }
    }),
    prisma.document.findMany({
      where: { companyId, archivedAt: null },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { client: true, work: true, budget: true, invoice: true, expense: true }
    })
  ]);
  const documents = repositoryDocuments.map(repositoryDocumentDisplay);

  return (
    <main className="screen">
      <SectionHeader
        title="Documentos"
        description="Presupuestos, facturas, plantillas y documentos profesionales generados desde datos editables."
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/gestion?tipo=presupuesto&returnTo=/documentos" className="primary-button">
              <Plus size={18} />
              Presupuesto
            </Link>
            <Link href="/gestion?tipo=factura&returnTo=/documentos" className="secondary-button">
              <Plus size={18} />
              Factura
            </Link>
            <Link href="/gestion?tipo=documento&returnTo=/documentos" className="secondary-button">
              <Plus size={18} />
              Documento
            </Link>
          </div>
        }
      />

      <section className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {documentCategories.map((category) => {
          const Icon = categoryIcons[category.id as keyof typeof categoryIcons] ?? FolderOpen;
          return (
            <Link key={category.id} href={category.href} className="card p-4 transition hover:border-obra-yellowDark hover:bg-obra-yellow/10">
              <Icon size={22} className="text-obra-yellowDark" />
              <h2 className="mt-3 text-base font-black text-obra-ink">{category.label}</h2>
              <p className="mt-1 text-xs font-semibold text-slate-500">{categoryDetail(category.id)}</p>
            </Link>
          );
        })}
      </section>

      <section className="card mb-5 p-4">
        <h2 className="text-lg font-black text-obra-ink">Revisión antes de generar</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Orqena permite revisar cliente, trabajo, partidas, impuestos, totales, condiciones, validez, vencimiento y estado antes de generar el documento final.
          No se envía ningún documento por WhatsApp ni email sin confirmación explícita del usuario.
        </p>
      </section>

      <section id="plantillas" className="card mb-5 scroll-mt-24 p-4">
        <div className="mb-3 flex items-center gap-2">
          <FileArchive size={20} className="text-obra-yellowDark" />
          <h2 className="text-lg font-black text-obra-ink">Plantillas profesionales</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {documentTemplateAssets.map((asset) => (
            <article key={asset.slug} className="rounded-lg border border-slate-200 p-3">
              <p className="text-sm font-black text-obra-ink">{asset.label}</p>
              <p className="mt-1 break-words text-xs font-semibold text-slate-500">{asset.fileName}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {asset.format === "pdf" ? (
                  <Link href={`/documentos/plantillas/${asset.slug}?preview=1`} target="_blank" className="secondary-button">
                    <Eye size={18} />
                    Ver
                  </Link>
                ) : null}
                <Link href={`/documentos/plantillas/${asset.slug}`} className="secondary-button">
                  <Download size={18} />
                  Descargar
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="card mb-5 p-4">
        <h2 className="text-lg font-black text-obra-ink">Placeholders soportados</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {documentPlaceholders.map((placeholder) => (
            <code key={placeholder} className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
              [[{placeholder}]]
            </code>
          ))}
        </div>
      </section>

      <section id="archivos" className="card mb-5 scroll-mt-24 p-4">
        <h2 className="text-lg font-black text-obra-ink">Archivos y documentos</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Orqena reúne los documentos asociados a clientes, trabajos, presupuestos, facturas y gastos. Cuando un archivo está disponible, puedes abrirlo desde su ficha.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {documents.map((document) => (
            <article key={document.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="label">{document.type}</p>
              <h3 className="mt-1 font-black text-obra-ink">{document.name}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{document.relatedLabel}</p>
              <p className="mt-1 text-xs font-bold uppercase text-slate-500">{documentDetail(document)}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {document.href ? <Link href={document.href} className="secondary-button">Abrir</Link> : null}
                <Link href={`/gestion?tipo=documento&id=${document.id}&returnTo=/documentos`} className="secondary-button">Editar ficha</Link>
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
      <div id="albaranes" className="scroll-mt-24" aria-hidden="true" />
      <div id="contratos" className="scroll-mt-24" aria-hidden="true" />

      <div className="grid gap-5 lg:grid-cols-2">
        <section>
          <SectionHeader title="Últimos presupuestos" />
          <div className="grid gap-3">
            {budgets.map((budget) => (
              <article key={budget.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-500">{budget.numero}</p>
                    <h3 className="mt-1 text-base font-black text-obra-ink">{budget.titulo}</h3>
                    <p className="mt-1 text-sm text-slate-500">{budget.client.nombre}{budget.work ? ` · ${budget.work.titulo}` : ""}</p>
                  </div>
                  <StatusPill status={budget.estado} />
                </div>
                <p className="mt-3 text-sm font-black text-obra-ink">{formatCurrency(budget.total)}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={`/gestion?tipo=presupuesto&id=${budget.id}&returnTo=/documentos`} className="secondary-button">Editar</Link>
                  <Link href={`/presupuestos/${budget.id}/pdf?preview=1`} target="_blank" className="secondary-button">Vista PDF</Link>
                  <Link href={`/presupuestos/${budget.id}/pdf`} className="secondary-button">Descargar</Link>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section>
          <SectionHeader title="Últimas facturas" />
          <div className="grid gap-3">
            {invoices.map((invoice) => {
              const liveStatus = invoice.estado === "borrador" ? "borrador" : deriveInvoiceStatus(invoice.total, invoice.pendiente, invoice.fechaVencimiento);
              return (
                <article key={invoice.id} className="card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase text-slate-500">{invoice.numero}</p>
                      <h3 className="mt-1 text-base font-black text-obra-ink">{invoice.concepto}</h3>
                      <p className="mt-1 text-sm text-slate-500">{invoice.client.nombre}{invoice.work ? ` · ${invoice.work.titulo}` : ""}</p>
                    </div>
                    <StatusPill status={liveStatus} />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-500">
                    {formatDate(invoice.fechaEmision)} · Pendiente {formatCurrency(invoice.pendiente)}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link href={`/gestion?tipo=factura&id=${invoice.id}&returnTo=/documentos`} className="secondary-button">Editar</Link>
                    <Link href={`/dinero/${invoice.id}/pdf?preview=1`} target="_blank" className="secondary-button">Vista PDF</Link>
                    <Link href={`/dinero/${invoice.id}/pdf`} className="secondary-button">Descargar</Link>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}

function categoryDetail(id: string) {
  const details: Record<string, string> = {
    presupuestos: "Crear, editar, aceptar y convertir",
    facturas: "Crear, editar, cobrar y descargar",
    albaranes: "Preparado para siguientes fases",
    contratos: "Preparado para siguientes fases",
    archivos: "Archivos y documentos",
    plantillas: "DOCX y PDF base"
  };
  return details[id] ?? "Documentos";
}
