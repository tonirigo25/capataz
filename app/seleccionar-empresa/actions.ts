"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { requireAuthenticatedUser, requireCompanyMembership } from "@/lib/auth/session";

export async function switchActiveCompany(formData: FormData) {
  const session = await requireAuthenticatedUser();
  const companyId = String(formData.get("companyId") ?? "");
  const membership = await requireCompanyMembership(session.userId, companyId);
  if (!membership) redirect("/seleccionar-empresa?error=invalid");
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { activeCompanyId: true } });
  const pendingConversations = user?.activeCompanyId && user.activeCompanyId !== membership.companyId
    ? await prisma.chatConversation.findMany({
        where: {
          companyId: user.activeCompanyId,
          AND: [
            { pendingConfirmation: { path: ["userId"], equals: session.userId } },
            { pendingConfirmation: { path: ["status"], equals: "PENDING" } }
          ]
        },
        select: { id: true, pendingConfirmation: true }
      })
    : [];
  await prisma.$transaction([
    prisma.user.update({ where: { id: session.userId }, data: { activeCompanyId: membership.companyId } }),
    ...pendingConversations.map((conversation) => prisma.chatConversation.updateMany({
      where: { id: conversation.id, companyId: user!.activeCompanyId! },
      data: { pendingConfirmation: { ...(conversation.pendingConfirmation as Prisma.JsonObject), status: "INVALIDATED", invalidatedAt: new Date().toISOString() } }
    })),
    prisma.auditLog.create({ data: { companyId: membership.companyId, userActorId: session.userId, action: "active_company.switched", targetType: "Company", targetId: membership.companyId, metadata: { membershipId: membership.id } } })
  ]);
  revalidatePath("/", "layout");
  redirect("/hoy");
}
