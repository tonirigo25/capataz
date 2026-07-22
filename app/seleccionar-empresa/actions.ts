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
  await prisma.$transaction([
    prisma.user.update({ where: { id: session.userId }, data: { activeCompanyId: membership.companyId } }),
    prisma.chatConversation.updateMany({ where: { companyId: { not: membership.companyId }, pendingConfirmation: { not: Prisma.DbNull } }, data: { pendingConfirmation: Prisma.DbNull } }),
    prisma.auditLog.create({ data: { companyId: membership.companyId, userActorId: session.userId, action: "active_company.switched", targetType: "Company", targetId: membership.companyId, metadata: { membershipId: membership.id } } })
  ]);
  revalidatePath("/", "layout");
  redirect("/hoy");
}
