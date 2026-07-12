import { AppShell } from "@/components/app-shell";
import { requireCompanyContext } from "@/lib/auth/session";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  await requireCompanyContext();
  return <AppShell>{children}</AppShell>;
}
