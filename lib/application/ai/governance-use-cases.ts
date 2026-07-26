import { invalidateActionPath as revalidatePath } from "@/lib/application/action-effects";
import { requireCompanyRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { recordAiReview, setCompanyAiKillSwitch } from "@/lib/ai/governance-service";

export async function reviewAiResultUseCase(formData: FormData) {
  const actor = await requireCompanyRole(["OWNER", "ADMIN"]);
  await recordAiReview(prisma, {
    companyId: actor.companyId,
    actorId: actor.userId,
    usageEventId: String(formData.get("usageEventId") ?? ""),
    outcome: String(formData.get("outcome") ?? ""),
    correctionKinds: String(formData.get("correctionKinds") ?? "").split(",").map((value) => value.trim()).filter(Boolean),
    reasonCode: String(formData.get("reasonCode") ?? "") || undefined,
  });
  revalidatePath("/configuracion/ia");
}

export async function changeAiKillSwitchUseCase(formData: FormData) {
  const actor = await requireCompanyRole(["OWNER"]);
  await setCompanyAiKillSwitch(prisma, { companyId: actor.companyId, actorId: actor.userId, killSwitch: String(formData.get("killSwitch")) !== "false" });
  revalidatePath("/configuracion/ia");
}
