import { invalidateActionPath as revalidatePath } from "@/lib/application/action-effects";
import { requireCompanyRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { completePrivacyRequest, createCompanyExport, createPrivacyRequest, privacyRequestTypes, verifyPrivacyRequestIdentity } from "@/lib/privacy/governance";
import { seedCompanyPrivacyCatalog } from "@/lib/privacy/catalog";

export async function preparePrivacyCatalogUseCase() {
  const actor = await requireCompanyRole(["OWNER", "ADMIN"]);
  await seedCompanyPrivacyCatalog(prisma, actor.companyId);
  revalidatePath("/configuracion/privacidad");
}

export async function createPrivacyRequestUseCase(formData: FormData) {
  const actor = await requireCompanyRole(["OWNER", "ADMIN"]);
  const requestType = String(formData.get("requestType") ?? "") as typeof privacyRequestTypes[number];
  await createPrivacyRequest(prisma, { companyId: actor.companyId, requestType, subjectReference: String(formData.get("subjectReference") ?? "").trim() });
  revalidatePath("/configuracion/privacidad");
}

export async function verifyPrivacyRequestUseCase(formData: FormData) {
  const actor = await requireCompanyRole(["OWNER", "ADMIN"]);
  await verifyPrivacyRequestIdentity(prisma, { companyId: actor.companyId, requestId: String(formData.get("requestId") ?? ""), actorReference: actor.userId });
  revalidatePath("/configuracion/privacidad");
}

export async function exportPrivacyRequestUseCase(formData: FormData) {
  const actor = await requireCompanyRole(["OWNER", "ADMIN"]);
  const requestId = String(formData.get("requestId") ?? "");
  const request = await prisma.privacyRequest.findFirstOrThrow({ where: { id: requestId, companyId: actor.companyId, identityVerifiedAt: { not: null }, completedAt: null } });
  await createCompanyExport(prisma, { companyId: actor.companyId, exportType: "SUBJECT", subjectReference: request.subjectReference, privacyRequestId: request.id });
  revalidatePath("/configuracion/privacidad");
}

export async function completePrivacyRequestUseCase(formData: FormData) {
  const actor = await requireCompanyRole(["OWNER", "ADMIN"]);
  await completePrivacyRequest(prisma, { companyId: actor.companyId, requestId: String(formData.get("requestId") ?? ""), communicationRef: String(formData.get("communicationRef") ?? "").trim(), actorReference: actor.userId, resolution: { summary: String(formData.get("resolution") ?? "").trim(), closedBy: actor.userId } });
  revalidatePath("/configuracion/privacidad");
}
