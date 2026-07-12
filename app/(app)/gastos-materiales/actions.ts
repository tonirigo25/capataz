"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCompanyContext } from "@/lib/auth/session";

export async function updateMaterialStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const estado = String(formData.get("estado") ?? "");
  if (!id || !estado) return;

  const { companyId } = await requireCompanyContext();
  await prisma.material.updateMany({ where: { id, companyId }, data: { estado: estado as any } });

  revalidatePath("/gastos-materiales");
  revalidatePath("/obras");
  revalidatePath("/hoy");
}
