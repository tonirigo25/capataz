"use server";

import { executeNextAction } from "@/lib/platform/next-action-boundary";
import { saveExperiencePreferencesUseCase } from "@/lib/application/company/preference-use-case";

export async function savePreferences(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/configuracion/preferencias/actions.ts#savePreferences" }, () => saveExperiencePreferencesUseCase(formData));
}
