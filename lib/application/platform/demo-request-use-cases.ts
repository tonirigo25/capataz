import { invalidateActionPath as revalidatePath } from "@/lib/application/action-effects";
import { requirePlatformAccount } from "@/lib/commercial/platform";
import { prisma } from "@/lib/prisma";
import { appendSensitiveAuditLog } from "@/lib/security/audit-chain";

const statuses = ["PENDING", "IN_REVIEW", "QUALIFIED", "DECLINED", "CONVERTED", "LEGAL_HOLD", "SPAM"] as const;

export async function updateDemoRequestUseCase(formData: FormData) {
  const actor = await requirePlatformAccount("PLATFORM_OWNER");
  const requestId = text(formData, "requestId", 64);
  const status = text(formData, "status", 32);
  const reason = text(formData, "reason", 240);
  if (!requestId || !statuses.includes(status as typeof statuses[number]) || !reason) throw new Error("DEMO_REQUEST_UPDATE_INVALID");
  await prisma.$transaction(async (transaction) => {
    const updated = await transaction.demoRequest.updateMany({ where: { id: requestId }, data: { status } });
    if (updated.count !== 1) throw new Error("DEMO_REQUEST_NOT_FOUND");
    await appendSensitiveAuditLog(transaction, {
      platformActorId: actor.platformAccountId,
      action: "demo_request.status_updated",
      targetType: "DemoRequest",
      targetId: requestId,
      metadata: { status },
      reason,
      actorType: "platform",
    });
  });
  revalidatePath("/plataforma");
}

function text(formData: FormData, key: string, max: number) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
