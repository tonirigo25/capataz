import Link from "next/link";
import { FileScan, FileText, Upload } from "lucide-react";
import { uploadExpenseDocument } from "@/app/(app)/gastos-materiales/actions";
import { SectionHeader } from "@/components/section-header";
import { requireCompanyContext } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ExpenseDocumentReaderPage({ searchParams }: { searchParams: Promise<{ error?: string; deleted?: string }> }) {
  const query = await searchParams;
  const { companyId } = await requireCompanyContext();
  const documents = await prisma.document.findMany({
    where: { companyId, metadata: { path: ["source"], equals: "expense_document_reader" }, archivedAt: null },
    orderBy: { createdAt: "desc" }, take: 30, include: { expense: { select: { id: true, concepto: true } } }
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
    <section><h2 className="mb-3 text-lg font-black text-obra-ink">Documentos recientes</h2><div className="grid gap-3 lg:grid-cols-2">
      {documents.length ? documents.map((document) => <Link key={document.id} href={`/gastos-materiales/lector/${document.id}`} className="card flex items-start gap-3 p-4 transition hover:border-obra-orange"><FileText className="mt-1 shrink-0 text-obra-orange" size={22} /><div className="min-w-0"><h3 className="truncate font-black text-obra-ink">{document.name}</h3><p className="mt-1 text-sm text-slate-500">{formatDate(document.createdAt)} · {statusLabel(document.status)}</p>{document.expense ? <p className="mt-2 text-xs font-bold text-green-700">Gasto: {document.expense.concepto}</p> : null}</div></Link>) : <div className="card p-5 text-sm text-slate-600">Todavía no hay justificantes subidos.</div>}
    </div></section>
  </main>;
}

function statusLabel(status: string) { return ({ UPLOADED: "Subido", PROCESSING: "Analizando", REVIEW_REQUIRED: "Revisión necesaria", READY: "Listo", SAVED: "Guardado como gasto", FAILED: "Análisis fallido", CANCELLED: "Cancelado" } as Record<string, string>)[status] || status; }
function safeMessage(value: string) { const allowed = value.slice(0, 240); return allowed || "No se pudo completar la operación."; }
