import type { ReactNode } from "react";
import { AppChrome } from "@/components/app-chrome";
import { appModeLabel, getAppMode } from "@/lib/app-mode";
import { getUnreadNotificationCount } from "@/lib/notifications";

export async function AppShell({ children }: { children: ReactNode }) {
  const mode = getAppMode();
  const unreadCount = await getUnreadNotificationCount();

  return <AppChrome modeLabel={appModeLabel(mode)} unreadNotifications={unreadCount}>{children}</AppChrome>;
}
