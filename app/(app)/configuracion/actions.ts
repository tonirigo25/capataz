"use server";

import { executeNextAction } from "@/lib/platform/next-action-boundary";
import { saveUserProfile as saveUserProfileUseCase, saveCompanySettings as saveCompanySettingsUseCase, uploadCompanyAsset as uploadCompanyAssetUseCase } from "@/lib/application/company/settings-use-cases";

export async function saveUserProfile(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/configuracion/actions.ts#saveUserProfile" }, () => saveUserProfileUseCase(formData));
}

export async function saveCompanySettings(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/configuracion/actions.ts#saveCompanySettings" }, () => saveCompanySettingsUseCase(formData));
}

export async function uploadCompanyAsset(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/configuracion/actions.ts#uploadCompanyAsset" }, () => uploadCompanyAssetUseCase(formData));
}
