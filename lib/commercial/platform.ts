import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import type { PlatformRole } from "@prisma/client";

const rank: Record<PlatformRole, number> = { PLATFORM_OWNER: 4, PLATFORM_ADMIN: 3, PLATFORM_SUPPORT: 2, PLATFORM_ANALYST: 1 };
export async function requirePlatformAccount(minimum: PlatformRole = "PLATFORM_ANALYST") { const session=await requireAuthenticatedUser(); const account=await prisma.platformAccount.findUnique({where:{userId:session.userId}}); if(!account||account.status!=="ACTIVE"||rank[account.role]<rank[minimum]) redirect("/hoy?error=platform-forbidden"); return {...session,platformAccountId:account.id,platformRole:account.role}; }
export async function resolveSupportAccess(platformAccountId:string,companyId:string){const now=new Date();return prisma.supportAccessGrant.findFirst({where:{platformAccountId,companyId,status:"ACTIVE",startsAt:{lte:now},expiresAt: { gt: now }}});}
export async function requireSupportAccess(companyId:string,capability:string){const platform=await requirePlatformAccount("PLATFORM_SUPPORT");const grant=await resolveSupportAccess(platform.platformAccountId,companyId);const keys=Array.isArray(grant?.capabilityKeys)?grant.capabilityKeys:[];if(!grant||!keys.includes(capability))throw new Error("TEMPORARY_SUPPORT_ACCESS_REQUIRED");return{...platform,grant};}
