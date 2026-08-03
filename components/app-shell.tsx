import type { ReactNode } from "react";
import { AppChrome } from "@/components/app-chrome";
import { appModeLabel, getAppMode } from "@/lib/app-mode";
import { getUnreadNotificationCount } from "@/lib/notifications";
import { logoutAction } from "@/app/(auth)/actions";
import { requireCompanyContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getEffectiveCapabilities } from "@/lib/commercial/authorization";
import { buildPortalManifest } from "@/lib/commercial/portal-manifest";
import { getPersistedPortalRailRecommendations } from "@/lib/application/intelligence/today-recommendation";

export async function AppShell({ children }: { children: ReactNode }) {
  const mode = getAppMode();
  const context = await requireCompanyContext();
  const [capabilities, portalManifest, platformAccount] = await Promise.all([getEffectiveCapabilities(context), buildPortalManifest(context), prisma.platformAccount.findFirst({ where: { userId: context.userId, status: "ACTIVE" }, select: { id: true } })]);
  const unreadCount = await getUnreadNotificationCount(context, portalManifest.notificationDomains);
  const railRecommendations = await getPersistedPortalRailRecommendations(context, capabilities);
  const platformAccess = Boolean(platformAccount);
  const modeLabel = process.env.NEXT_PUBLIC_APP_ENV === "preview"
    ? "Review"
    : mode === "demo" && platformAccess
      ? appModeLabel(mode)
      : undefined;

  return <AppChrome portalManifest={portalManifest} capabilities={capabilities} modeLabel={modeLabel} unreadNotifications={unreadCount} companyName={context.companyName} userName={context.displayName} platformAccess={platformAccess} logoutAction={logoutAction} railRecommendations={railRecommendations}>{children}</AppChrome>;
}
