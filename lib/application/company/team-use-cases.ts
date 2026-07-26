import { invalidateActionPath as revalidatePath } from "@/lib/application/action-effects";
import { assignCompanyTeamMember, createCompanyTeam } from "@/lib/application/company/team-service";
import { requireCapability } from "@/lib/commercial/authorization";
import { prisma } from "@/lib/prisma";

export async function createTeam(formData: FormData) {
  const auth = await requireCapability("company.teams.manage");
  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  if (!name) throw new Error("TEAM_NAME_REQUIRED");
  await createCompanyTeam(prisma, auth, {
    name,
    description: String(formData.get("description") ?? "").trim().slice(0, 240) || null,
  });
  revalidatePath("/equipos");
}

export async function assignTeamMember(formData: FormData) {
  const auth = await requireCapability("company.teams.manage");
  await assignCompanyTeamMember(prisma, auth, {
    teamId: String(formData.get("teamId") ?? ""),
    membershipId: String(formData.get("membershipId") ?? ""),
  });
  revalidatePath("/equipos");
}
