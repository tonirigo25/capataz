import { invalidateActionPath as revalidatePath } from "@/lib/application/action-effects";
import { requireCompanyRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { saveExperiencePreferences } from "@/lib/product/experience-preferences";

export async function saveExperiencePreferencesUseCase(formData: FormData) {
  const actor = await requireCompanyRole(["OWNER", "ADMIN"]);
  await saveExperiencePreferences(prisma, {
    companyId: actor.companyId,
    actorId: actor.userId,
    aiSuggestionsEnabled: formData.get("aiSuggestionsEnabled") === "on",
    operationalEmailEnabled: formData.get("operationalEmailEnabled") === "on",
    marketingEmailEnabled: formData.get("marketingEmailEnabled") === "on",
  });
  revalidatePath("/configuracion/preferencias");
  revalidatePath("/configuracion/ia");
}
