import Link from "next/link";
import { requireCompanyRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { applyImport, previewImport, rollbackImport } from "./actions";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const actor = await requireCompanyRole(["OWNER", "ADMIN"]);
  const batches = await prisma.companyImportBatch.findMany({ where: { companyId: actor.companyId }, orderBy: { createdAt: "desc" }, take: 10, include: { rows: { orderBy: { rowNumber: "asc" }, take: 20 } } });
  return <main className="screen">
    <Link href="/configuracion" className="text-sm text-muted">← Configuración</Link>
    <h1 className="type-page-title mt-2">Importación segura</h1>
    <p className="type-secondary mt-2">Primero se muestra una vista previa. Las filas inválidas o duplicadas no se crean y cada lote aplicado se puede revertir sin borrar su evidencia.</p>
    <section className="card mt-6 p-5">
      <h2 className="type-section-title">Preparar CSV</h2>
      <form action={previewImport} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <select className="field" name="kind"><option value="CLIENTS">Clientes</option><option value="DOCUMENTS">Metadatos de documentos</option></select>
        <input className="field" type="file" name="csv" accept=".csv,text/csv,text/plain" required />
        <button className="primary-button">Crear vista previa</button>
      </form>
      <p className="type-meta mt-3">Clientes: nombre,telefono,direccion,tipo,email,nifCif. Documentos: name,category,classification,originalName,mimeType,sha256. Máximo 500 filas y 512 KB.</p>
    </section>
    <section className="mt-6 grid gap-4">
      {batches.map((batch) => <article key={batch.id} className="card p-5">
        <div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-semibold">{batch.kind === "CLIENTS" ? "Clientes" : "Documentos"} · {batch.status}</h2><p className="type-meta">{batch.totalRows} filas · {batch.validRows} válidas · {batch.invalidRows} con error · {batch.duplicateRows} duplicadas</p></div><span className="status-badge">{batch.status}</span></div>
        <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th>Fila</th><th>Estado</th><th>Errores</th></tr></thead><tbody>{batch.rows.map((row) => <tr key={row.id}><td>{row.rowNumber}</td><td>{row.status}</td><td>{Array.isArray(row.errorCodes) ? row.errorCodes.join(", ") : ""}</td></tr>)}</tbody></table></div>
        {batch.status === "PREVIEWED" ? <form action={applyImport} className="mt-4 flex flex-wrap gap-2"><input type="hidden" name="batchId" value={batch.id}/><input className="field max-w-80" name="confirmation" placeholder={batch.confirmationKey} required/><button className="primary-button">Aplicar filas válidas</button></form> : null}
        {batch.status === "APPLIED" ? <form action={rollbackImport} className="mt-4 flex flex-wrap gap-2"><input type="hidden" name="batchId" value={batch.id}/><input className="field max-w-80" name="confirmation" placeholder={`ROLLBACK_BATCH:${batch.id}`} required/><button className="secondary-button">Revertir este lote</button></form> : null}
      </article>)}
      {!batches.length ? <div className="rounded-xl border border-dashed border-border p-8 text-center">No hay lotes preparados.</div> : null}
    </section>
  </main>;
}
