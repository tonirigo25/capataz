"use server";

import { executeNextAction } from "@/lib/platform/next-action-boundary";
import { saveBusinessOnboarding as saveBusinessOnboardingUseCase } from "@/lib/application/company/onboarding-use-case";

export async function saveBusinessOnboarding(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/onboarding/actions.ts#saveBusinessOnboarding" }, () => saveBusinessOnboardingUseCase(formData));
}
