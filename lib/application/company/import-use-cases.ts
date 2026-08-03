import { invalidateActionPath as revalidatePath } from "@/lib/application/action-effects";
import { requireCompanyRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { applyCompanyImport, previewCompanyImport, rollbackCompanyImport } from "@/lib/product/import-service";
import { IMPORT_CATALOG, isImportKind } from "@/lib/product/import-catalog";

export async function previewImportUseCase(formData: FormData) {
  const actor = await requireCompanyRole(["OWNER", "ADMIN"]);
  const file = formData.get("csv");
  const kind = String(formData.get("kind") ?? "");
  if (!(file instanceof File) || !file.size || file.size > 512 * 1024 || file.type && !["text/csv", "text/plain", "application/vnd.ms-excel"].includes(file.type)) throw new Error("IMPORT_FILE_INVALID");
  if (!isImportKind(kind)) throw new Error("IMPORT_KIND_INVALID");
  await previewCompanyImport(prisma, { companyId: actor.companyId, actorId: actor.userId, kind, source: await file.text() });
  revalidatePath("/configuracion/importar");
}

export async function applyImportUseCase(formData: FormData) {
  const actor = await requireCompanyRole(["OWNER", "ADMIN"]);
  await applyCompanyImport(prisma, { companyId: actor.companyId, actorId: actor.userId, batchId: String(formData.get("batchId") ?? ""), confirmation: String(formData.get("confirmation") ?? "") });
  revalidatePath("/configuracion/importar");
  revalidateImportDestinations();
}

export async function rollbackImportUseCase(formData: FormData) {
  const actor = await requireCompanyRole(["OWNER", "ADMIN"]);
  await rollbackCompanyImport(prisma, { companyId: actor.companyId, actorId: actor.userId, batchId: String(formData.get("batchId") ?? ""), confirmation: String(formData.get("confirmation") ?? "") });
  revalidatePath("/configuracion/importar");
  revalidateImportDestinations();
}

function revalidateImportDestinations() {
  for (const path of new Set(Object.values(IMPORT_CATALOG).map((item) => item.destination.split("?")[0]))) revalidatePath(path);
}
