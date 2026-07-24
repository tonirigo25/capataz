import Link from "next/link";
import { BrandLockup } from "@/components/brand/brand-mark";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";

export function AuthShell({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <main className="mx-auto flex min-h-dvh w-full max-w-lg items-center px-4 py-8 sm:px-6">
    <section className="card relative w-full p-5 sm:p-7">
      <div className="mb-6 flex items-start justify-between gap-4">
        <Link href="/" aria-label="Volver al inicio de Orqena">
          <BrandLockup compact />
        </Link>
        <ThemeSwitcher compact />
      </div>
      <h1 className="text-2xl font-black text-obra-ink">{title}</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
      <div className="mt-6">{children}</div>
    </section>
  </main>;
}

export function AuthMessage({ state }: { state: { status: string; message?: string } }) {
  if (!state.message) return null;
  return <p role="status" className={`rounded-lg border p-3 text-sm ${state.status === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{state.message}</p>;
}
