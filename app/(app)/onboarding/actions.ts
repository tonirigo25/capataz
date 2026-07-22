"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCompanyRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { organizationTypes, sectorKeys } from "@/lib/business-profile/types";

export async function saveBusinessOnboarding(formData: FormData) {
  const auth = await requireCompanyRole(["ADMIN"]);
  const organizationType = String(formData.get("organizationType") ?? "");
  const sectorKey = String(formData.get("sectorKey") ?? "");
  if (!organizationTypes.includes(organizationType as never) || !sectorKeys.includes(sectorKey as never)) throw new Error("Selecciona un perfil válido.");
  const workSingular = clean(formData, "workSingular"); const workPlural = clean(formData, "workPlural");
  const completed = formData.get("complete") === "true";
  await prisma.company.update({ where: { id: auth.companyId }, data: {
    organizationType: organizationType as "SELF_EMPLOYED" | "COMPANY", sectorKey,
    nombreComercial: clean(formData, "displayName") || auth.companyName,
    terminologyOverrides: workSingular || workPlural ? { ...(workSingular ? { workSingular } : {}), ...(workPlural ? { workPlural } : {}) } : undefined,
    businessProfileVersion: "1", onboardingState: { step: completed ? 7 : Number(formData.get("step") ?? 1), mainGoal: clean(formData, "mainGoal"), firstAction: clean(formData, "firstAction") },
    onboardingCompletedAt: completed ? new Date() : undefined,
  } });
  revalidatePath("/onboarding"); revalidatePath("/hoy"); revalidatePath("/configuracion");
  if (completed) redirect("/hoy");
}
function clean(formData: FormData, key: string) { const value = formData.get(key); return typeof value === "string" ? value.trim().slice(0, 160) : ""; }
