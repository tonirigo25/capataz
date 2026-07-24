"use server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { provisionCompany } from "@/lib/commercial/provisioning";
import { organizationTypes, sectorKeys } from "@/lib/business-profile/types";

export async function createCompanyAction(formData: FormData) {
  const session = await requireAuthenticatedUser();
  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  const organizationType = String(formData.get("organizationType") ?? "");
  const sectorKey = String(formData.get("sectorKey") ?? "");
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "").trim();
  if (!name || !idempotencyKey || !organizationTypes.includes(organizationType as never) || !sectorKeys.includes(sectorKey as never)) throw new Error("Revisa los datos de la empresa.");
  await provisionCompany(prisma, { userId: session.userId, name, organizationType: organizationType as "SELF_EMPLOYED" | "COMPANY", sectorKey, country: String(formData.get("country") ?? "España"), mainGoal: String(formData.get("mainGoal") ?? ""), teamSize: String(formData.get("teamSize") ?? ""), planKey: "STARTER", idempotencyKey });
  redirect("/onboarding");
}
