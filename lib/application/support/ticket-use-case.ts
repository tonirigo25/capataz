import { invalidateActionPath as revalidatePath } from "@/lib/application/action-effects";
import { requireCompanyContext, requireCompanyRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { createAuthenticatedSupportTicket } from "@/lib/product/support-service";
import { recordPilotFeedback, setTestimonialConsent } from "@/lib/product/pilot-governance";
import { recordFirstPartyEvent } from "@/lib/product/analytics";

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

export async function submitSupportFeedbackUseCase(formData: FormData) {
  const actor = await requireCompanyContext();
  const category = String(formData.get("category") ?? "");
  const feedback = await recordPilotFeedback(prisma, { companyId: actor.companyId, actorId: actor.userId, category, score: Number(formData.get("score")), comment: String(formData.get("comment") ?? ""), consentGranted: formData.get("consent") === "on", contactAllowed: formData.get("contactAllowed") === "on" });
  if (["NPS", "CSAT"].includes(category)) await recordFirstPartyEvent(prisma, { eventId: `feedback:${feedback.id}`, companyId: actor.companyId, actorId: actor.userId, eventName: `feedback.${category.toLowerCase()}`, properties: { score: feedback.score, consent: "explicit" } });
  revalidatePath("/configuracion/soporte");
}

export async function setTestimonialConsentUseCase(formData: FormData) {
  const actor = await requireCompanyContext();
  const scopes = formData.getAll("scope").flatMap((value) => typeof value === "string" ? [value] : []);
  await setTestimonialConsent(prisma, { companyId: actor.companyId, actorId: actor.userId, scopes, granted: String(formData.get("decision")) === "GRANT" });
  revalidatePath("/configuracion/soporte");
}
