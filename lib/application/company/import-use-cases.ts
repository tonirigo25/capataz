import { invalidateActionPath as revalidatePath } from "@/lib/application/action-effects";
import { requireCompanyRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { applyCompanyImport, previewCompanyImport, rollbackCompanyImport, type ImportKind } from "@/lib/product/import-service";

export async function previewImportUseCase(formData: FormData) {
  const actor = await requireCompanyRole(["OWNER", "ADMIN"]);
  const file = formData.get("csv");
  const kind = String(formData.get("kind") ?? "") as ImportKind;
  if (!(file instanceof File) || !file.size || file.size > 512 * 1024 || file.type && !["text/csv", "text/plain", "application/vnd.ms-excel"].includes(file.type)) throw new Error("IMPORT_FILE_INVALID");
  if (!(["CLIENTS", "DOCUMENTS"] as const).includes(kind)) throw new Error("IMPORT_KIND_INVALID");
  await previewCompanyImport(prisma, { companyId: actor.companyId, actorId: actor.userId, kind, source: await file.text() });
  revalidatePath("/configuracion/importar");
}

export async function applyImportUseCase(formData: FormData) {
  const actor = await requireCompanyRole(["OWNER", "ADMIN"]);
  await applyCompanyImport(prisma, { companyId: actor.companyId, actorId: actor.userId, batchId: String(formData.get("batchId") ?? ""), confirmation: String(formData.get("confirmation") ?? "") });
  revalidatePath("/configuracion/importar");
  revalidatePath("/clientes");
  revalidatePath("/documentos");
}

export async function rollbackImportUseCase(formData: FormData) {
  const actor = await requireCompanyRole(["OWNER", "ADMIN"]);
  await rollbackCompanyImport(prisma, { companyId: actor.companyId, actorId: actor.userId, batchId: String(formData.get("batchId") ?? ""), confirmation: String(formData.get("confirmation") ?? "") });
  revalidatePath("/configuracion/importar");
  revalidatePath("/clientes");
  revalidatePath("/documentos");
}
