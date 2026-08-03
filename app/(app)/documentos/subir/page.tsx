import Link from "next/link";
import { FileText, ReceiptText, ShieldCheck, Upload } from "lucide-react";
import { uploadRepositoryDocument } from "@/app/(app)/documentos/actions";
import { InternalBreadcrumbs } from "@/components/internal-breadcrumbs";
import { buildPortalManifest } from "@/lib/commercial/portal-manifest";
import { requireCapability, resolveAuthorization } from "@/lib/commercial/authorization";
import {
  repositoryDocumentCategories,
  repositoryDocumentClassifications,
} from "@/lib/document-upload";

export const dynamic = "force-dynamic";

export default async function UploadDocumentPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [query, auth] = await Promise.all([
    searchParams,
    requireCapability("documents.upload"),
  ]);
  const [manifest, receivedInvoices] = await Promise.all([
    buildPortalManifest(auth),
    resolveAuthorization(auth, "purchases.received_invoices.manage"),
  ]);
  const classifications = repositoryDocumentClassifications.filter((item) =>
    manifest.documentClasses.includes(item.value),
  );

  return (
    <main className="screen min-w-0">
      <InternalBreadcrumbs
        items={[
          { label: "Documentos", href: "/documentos" },
          { label: "Subir documento" },
        ]}
      />
      <header className="mt-4 max-w-3xl">
        <h1 className="type-page-title text-content">Subir documento</h1>
        <p className="type-secondary mt-1">
          Guarda un archivo real en el repositorio privado de tu empresa. La
          clasificación limita quién puede verlo.
        </p>
      </header>

      {query.error ? (
        <p role="alert" className="mt-4 rounded-xl border border-danger/25 bg-danger/5 p-4 text-sm font-semibold text-danger">
          {uploadErrorMessage(query.error)}
        </p>
      ) : null}

      <div className="mt-5 grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <form action={uploadRepositoryDocument} className="card grid min-w-0 gap-5 p-4 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="type-label mb-1.5 block">Categoría</span>
              <select name="category" className="field" defaultValue="otro" required>
                {repositoryDocumentCategories.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="type-label mb-1.5 block">Clasificación de acceso</span>
              <select name="classification" className="field" defaultValue={classifications[0]?.value} required>
                {classifications.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="grid min-h-52 cursor-pointer place-items-center rounded-xl border border-dashed border-brand/45 bg-brand-soft/35 p-6 text-center transition hover:border-brand hover:bg-brand-soft/55">
            <span>
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-brand text-white">
                <Upload size={22} aria-hidden="true" />
              </span>
              <strong className="mt-3 block text-sm text-content">Selecciona el archivo</strong>
              <span className="mt-1 block text-xs leading-5 text-content-secondary">
                PDF, JPG, PNG, WEBP o TXT · máximo 10 MB
              </span>
            </span>
            <input
              type="file"
              name="document"
              required
              accept="application/pdf,image/jpeg,image/png,image/webp,text/plain,.pdf,.jpg,.jpeg,.png,.webp,.txt"
              className="mt-4 block w-full max-w-md text-xs text-content-secondary file:mr-3 file:rounded-lg file:border-0 file:bg-surface file:px-3 file:py-2 file:text-xs file:font-semibold file:text-content"
            />
          </label>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Link href="/documentos" className="secondary-button justify-center">Cancelar</Link>
            <button type="submit" className="primary-button justify-center">
              <Upload size={16} aria-hidden="true" />
              Guardar documento
            </button>
          </div>
        </form>

        <aside className="grid content-start gap-3">
          <section className="card p-4">
            <ShieldCheck size={21} className="text-success" aria-hidden="true" />
            <h2 className="mt-3 text-sm font-semibold text-content">Archivo privado y aislado</h2>
            <p className="mt-1 text-xs leading-5 text-content-secondary">
              Se valida el contenido real, se cifra en el almacenamiento privado y se sirve sólo a perfiles autorizados de esta empresa.
            </p>
          </section>
          {receivedInvoices.allowed ? (
            <section className="card p-4">
              <ReceiptText size={21} className="text-warning" aria-hidden="true" />
              <h2 className="mt-3 text-sm font-semibold text-content">¿Es una factura o un ticket?</h2>
              <p className="mt-1 text-xs leading-5 text-content-secondary">
                Usa el lector para extraer importes y preparar el gasto con revisión humana.
              </p>
              <Link href="/gastos-materiales/lector" className="secondary-button mt-3 w-full justify-center">
                <FileText size={16} aria-hidden="true" />
                Abrir lector de gastos
              </Link>
            </section>
          ) : null}
        </aside>
      </div>
    </main>
  );
}

function uploadErrorMessage(code: string) {
  return ({
    missing_file: "Selecciona un archivo antes de continuar.",
    invalid_classification: "La categoría o clasificación no está autorizada para tu perfil.",
    empty_document: "El archivo está vacío.",
    document_too_large: "El archivo supera el límite de 10 MB.",
    document_format_unsupported: "Formato no admitido. Usa PDF, JPG, PNG, WEBP o TXT.",
    document_extension_mismatch: "La extensión no coincide con el contenido real del archivo.",
    document_mime_mismatch: "El tipo declarado no coincide con el contenido real del archivo.",
    storage_failed: "No se pudo guardar el archivo. No se ha dejado un registro incompleto.",
    invalid_file: "No se pudo validar el archivo seleccionado.",
  } as Record<string, string>)[code] ?? "No se pudo completar la subida.";
}
