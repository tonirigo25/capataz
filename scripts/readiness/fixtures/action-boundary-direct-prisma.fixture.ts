"use server";

import { prisma } from "@/lib/prisma";

export async function unsafeAction() {
  return prisma.$transaction((transaction) => transaction.company.update({ where: { id: "cross-tenant" }, data: { status: "active" } }));
}
