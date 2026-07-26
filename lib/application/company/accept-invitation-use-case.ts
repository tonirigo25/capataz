import { navigateAction as redirect } from "@/lib/application/action-effects";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { acceptEmployeeInvitation } from "@/lib/commercial/invitation-service";

// Macrofase 2 compatibility: ACCEPTED now advances to PENDING_OWNER_APPROVAL;
// the service enforces invitation.emailNormalized!==auth.email equivalently after normalization.

export async function acceptInvitation(formData: FormData) {
  const auth = await requireAuthenticatedUser();
  await acceptEmployeeInvitation({ token: String(formData.get("token") ?? ""), userId: auth.userId, email: auth.email });
  redirect("/acceso-pendiente");
}
