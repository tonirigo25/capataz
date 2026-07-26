import { invalidateActionPath as revalidatePath } from "@/lib/application/action-effects";
import { rotateCurrentSession } from "@/lib/auth/session";
import { requirePlatformAccount } from "@/lib/commercial/platform";
import { endSupportAccess, setCompanySuspension, startSupportAccess } from "@/lib/commercial/platform-service";

export async function createSupportGrant(formData: FormData) {
  const actor = await requirePlatformAccount("PLATFORM_ADMIN");
  await startSupportAccess(actor, {
    companyId: String(formData.get("companyId") ?? ""),
    reason: String(formData.get("reason") ?? ""),
    ticket: String(formData.get("ticket") ?? ""),
    minutes: Number(formData.get("minutes") ?? 30),
  });
  await rotateCurrentSession("privilege_elevation");
  revalidatePath("/plataforma");
}

export async function closeSupportGrant(formData: FormData) {
  const actor = await requirePlatformAccount("PLATFORM_SUPPORT");
  await endSupportAccess(actor, String(formData.get("grantId") ?? ""));
  revalidatePath("/plataforma");
}

export async function toggleCompanySuspension(formData: FormData) {
  const actor = await requirePlatformAccount("PLATFORM_ADMIN");
  await setCompanySuspension(actor, {
    companyId: String(formData.get("companyId") ?? ""),
    suspended: String(formData.get("suspend")) === "true",
    reason: String(formData.get("reason") ?? ""),
  });
  revalidatePath("/plataforma");
}
