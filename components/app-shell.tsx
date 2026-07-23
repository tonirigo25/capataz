import type { ReactNode } from "react";
import { AppChrome } from "@/components/app-chrome";
import { appModeLabel, getAppMode } from "@/lib/app-mode";
import { getUnreadNotificationCount } from "@/lib/notifications";
import { logoutAction } from "@/app/(auth)/actions";
import { requireCompanyContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getEffectiveCapabilities } from "@/lib/commercial/authorization";

export async function AppShell({ children }: { children: ReactNode }) {
  const mode = getAppMode();
  const context = await requireCompanyContext();
  const unreadCount = await getUnreadNotificationCount();
  const modeLabel = mode === "production" ? undefined : appModeLabel(mode);
  const platformAccess = Boolean(await prisma.platformAccount.findFirst({ where: { userId: context.userId, status: "ACTIVE" }, select: { id: true } }));
  const capabilities = await getEffectiveCapabilities(context);

  return <AppChrome capabilities={capabilities} modeLabel={modeLabel} unreadNotifications={unreadCount} companyName={context.companyName} userName={context.displayName} platformAccess={platformAccess} logoutAction={logoutAction}>{children}</AppChrome>;
}
