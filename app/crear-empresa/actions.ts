"use server";

import { executeNextAction } from "@/lib/platform/next-action-boundary";
import { createCompanyAction as createCompanyActionUseCase } from "@/lib/application/tenancy/create-company-use-case";

export async function createCompanyAction(formData: FormData) {
  return executeNextAction({ operation: "app/crear-empresa/actions.ts#createCompanyAction" }, () => createCompanyActionUseCase(formData));
}
