"use server";

import { executeNextAction } from "@/lib/platform/next-action-boundary";
import { acceptInvitation as acceptInvitationUseCase } from "@/lib/application/company/accept-invitation-use-case";

export async function acceptInvitation(formData: FormData) {
  return executeNextAction({ operation: "app/aceptar-invitacion/actions.ts#acceptInvitation" }, () => acceptInvitationUseCase(formData));
}
