"use server";

import { executeNextAction } from "@/lib/platform/next-action-boundary";
import { runGuidedDemoStep as runGuidedDemoStepUseCase } from "@/lib/application/demo/guided-demo-use-case";

export async function runGuidedDemoStep(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/demo-guiada/actions.ts#runGuidedDemoStep" }, () => runGuidedDemoStepUseCase(formData));
}
