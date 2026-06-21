"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function updateMaterialStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const estado = String(formData.get("estado") ?? "");
  if (!id || !estado) return;

  await prisma.material.update({ where: { id }, data: { estado: estado as any } });

  revalidatePath("/gastos-materiales");
  revalidatePath("/obras");
  revalidatePath("/hoy");
}
