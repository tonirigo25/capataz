import { invalidateActionPath as revalidatePath } from "@/lib/application/action-effects";
import { requireCompanyRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { createAuthenticatedSupportTicket } from "@/lib/product/support-service";

export async function createSupportTicketUseCase(formData: FormData) {
  const actor = await requireCompanyRole(["OWNER", "ADMIN"]);
  const attachment = formData.get("attachment");
  await createAuthenticatedSupportTicket(prisma, {
    companyId: actor.companyId,
    actorId: actor.userId,
    category: String(formData.get("category") ?? ""),
    priority: String(formData.get("priority") ?? ""),
    subject: String(formData.get("subject") ?? ""),
    description: String(formData.get("description") ?? ""),
    route: String(formData.get("route") ?? ""),
    attachment: attachment instanceof File && attachment.size ? attachment : undefined,
  });
  revalidatePath("/configuracion/soporte");
}
