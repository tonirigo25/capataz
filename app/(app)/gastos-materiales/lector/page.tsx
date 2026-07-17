import Link from "next/link";
import { FileScan, FileText, Search, Upload } from "lucide-react";
import { uploadExpenseDocument } from "@/app/(app)/gastos-materiales/actions";
import { SectionHeader } from "@/components/section-header";
import { requireCompanyContext } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ExpenseDocumentReaderPage({ searchParams }: { searchParams: Promise<{ error?: string; deleted?: string; estado?: string; buscar?: string }> }) {
  const query = await searchParams;
  const { companyId } = await requireCompanyContext();
  const status = validStatus(query.estado);
  const documents = await prisma.document.findMany({
    where: {
      companyId, metadata: { path: ["source"], equals: "expense_document_reader" }, archivedAt: null,
      ...(status ? { status } : {}),
      ...(query.buscar ? { OR: [
        { name: { contains: query.buscar.slice(0, 100), mode: "insensitive" } },
        { extractedIssuer: { contains: query.buscar.slice(0, 100), mode: "insensitive" } },
        { extractedInvoiceNo: { contains: query.buscar.slice(0, 100), mode: "insensitive" } }
      ] } : {})
    },
    orderBy: { createdAt: "desc" }, take: 60, include: { expense: { select: { id: true, concepto: true } }, businessPartner: { select: { commercialName: true } }, work: { select: { titulo: true } } }
  });
  return <main className="screen">
    <SectionHeader title="Lector de facturas y tickets" description="Sube el justificante, revisa la propuesta y decide si lo guardas como gasto." action={<Link href="/gastos-materiales" className="secondary-button">Volver</Link>} />
    {query.error ? <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">{safeMessage(query.error)}</div> : null}
    {query.deleted ? <div role="status" className="mb-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-800">Documento eliminado.</div> : null}
    <section className="card mb-6 p-4 sm:p-6">
      <div className="mb-4 flex items-start gap-3"><span className="rounded-xl bg-obra-yellow/30 p-3"><FileScan size={24} /></span><div><h2 className="text-lg font-black text-obra-ink">Subir justificante</h2><p className="mt-1 text-sm leading-6 text-slate-600">JPG, JPEG, PNG, WEBP o PDF. Máximo 10 MB. En móvil puedes usar la cámara.</p></div></div>
      <form action={uploadExpenseDocument} className="grid gap-4">
        <label className="grid cursor-pointer gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-5 text-center focus-within:border-obra-orange"><Upload className="mx-auto text-obra-orange" size={28} /><span className="font-black text-obra-ink">Seleccionar factura o ticket</span><input className="field" type="file" name="document" required accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf" /></label>
        <button className="primary-button w-full justify-center sm:w-auto" type="submit">Subir y preparar revisión</button>
      </form>
      <p className="mt-4 text-xs leading-5 text-slate-500">El gasto no se crea automáticamente. El archivo queda aislado por empresa y solo se consulta mediante una ruta autenticada.</p>
    </section>
    <section><div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div><h2 className="text-lg font-black text-obra-ink">Bandeja documental</h2><p className="text-sm text-slate-600">Clasifica por estado, proveedor, obra, factura o nombre de archivo.</p></div><form className="grid gap-2 sm:grid-cols-[minmax(12rem,1fr)_13rem_auto]"><label><span className="label mb-1 block">Buscar</span><input className="field" name="buscar" defaultValue={query.buscar || ""} placeholder="Proveedor, factura..." /></label><label><span className="label mb-1 block">Estado</span><select className="field" name="estado" defaultValue={query.estado || ""}><option value="">Todos</option>{statusOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label><button className="primary-button self-end" type="submit"><Search size={17} />Filtrar</button></form></div><div className="grid gap-3 lg:grid-cols-2">
      {documents.length ? documents.map((document) => <Link key={document.id} href={`/gastos-materiales/lector/${document.id}`} className="card flex items-start gap-3 p-4 transition hover:border-obra-orange"><FileText className="mt-1 shrink-0 text-obra-orange" size={22} /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><h3 className="truncate font-black text-obra-ink">{document.name}</h3><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-black text-slate-700">{statusLabel(document.status)}</span></div><p className="mt-1 text-sm text-slate-500">{formatDate(document.createdAt)} · {document.businessPartner?.commercialName || document.extractedIssuer || "Proveedor pendiente"}</p><p className="mt-1 text-xs text-slate-500">{document.work?.titulo || "Obra pendiente o gasto general"}{document.extractedInvoiceNo ? ` · ${document.extractedInvoiceNo}` : ""}</p>{document.expense ? <p className="mt-2 text-xs font-bold text-green-700">Registrado: {document.expense.concepto}</p> : null}</div></Link>) : <div className="card p-5 text-sm text-slate-600">No hay documentos con estos criterios.</div>}
    </div></section>
  </main>;
}

const statusOptions = [["UPLOADED", "Pendiente"], ["PROCESSING", "Analizando"], ["REVIEW_REQUIRED", "Pendiente revisión"], ["AWAITING_PARTNER", "Pendiente proveedor"], ["AWAITING_WORK", "Pendiente obra"], ["POSSIBLE_DUPLICATE", "Posible duplicado"], ["READY", "Listo"], ["REGISTERED", "Registrado"], ["FAILED", "Error"], ["ARCHIVED", "Archivado"]] as const;
function statusLabel(status: string) { return statusOptions.find(([id]) => id === status)?.[1] || ({ SAVED: "Registrado", CANCELLED: "Cancelado" } as Record<string, string>)[status] || status; }
function validStatus(value?: string) { return statusOptions.some(([id]) => id === value) ? value as typeof statusOptions[number][0] : undefined; }
function safeMessage(value: string) { const allowed = value.slice(0, 240); return allowed || "No se pudo completar la operación."; }
