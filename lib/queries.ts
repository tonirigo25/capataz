import { prisma } from "@/lib/prisma";
import { requireCompanyContext } from "@/lib/auth/session";
import { companyCore } from "@/lib/tenant/core";

export async function getDashboardData() {
  const { companyId } = await requireCompanyContext();
  return companyCore(prisma, companyId).dashboard();
}
