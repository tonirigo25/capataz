"use server";

import { executeNextAction } from "@/lib/platform/next-action-boundary";
import { switchActiveCompany as switchActiveCompanyUseCase } from "@/lib/application/tenancy/select-company-use-case";

export async function switchActiveCompany(formData: FormData) {
  return executeNextAction({ operation: "app/seleccionar-empresa/actions.ts#switchActiveCompany" }, () => switchActiveCompanyUseCase(formData));
}
