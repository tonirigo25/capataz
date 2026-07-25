import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { requireCompanyContext } from "@/lib/auth/session";
import { PRIVATE_ROBOTS_METADATA } from "@/lib/public-indexing";

export const metadata: Metadata = { robots: PRIVATE_ROBOTS_METADATA };

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  await requireCompanyContext();
  return <AppShell>{children}</AppShell>;
}
