import type { ReactNode } from "react";
import { AppChrome } from "@/components/app-chrome";
import { appModeLabel, getAppMode } from "@/lib/app-mode";

export function AppShell({ children }: { children: ReactNode }) {
  const mode = getAppMode();

  return <AppChrome modeLabel={appModeLabel(mode)}>{children}</AppChrome>;
}
