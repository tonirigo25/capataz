"use server";

import { executeNextAction } from "@/lib/platform/next-action-boundary";
import { createTeam as createTeamUseCase, assignTeamMember as assignTeamMemberUseCase } from "@/lib/application/company/team-use-cases";

export async function createTeam(formData:FormData) {
  return executeNextAction({ operation: "app/(app)/equipos/actions.ts#createTeam" }, () => createTeamUseCase(formData));
}

export async function assignTeamMember(formData:FormData) {
  return executeNextAction({ operation: "app/(app)/equipos/actions.ts#assignTeamMember" }, () => assignTeamMemberUseCase(formData));
}
