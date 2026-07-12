import Link from "next/link";

export function AuthShell({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <main className="mx-auto flex min-h-dvh w-full max-w-lg items-center px-4 py-8 sm:px-6">
    <section className="card w-full p-5 sm:p-7">
      <Link href="/" className="mb-6 inline-flex items-center gap-3" aria-label="Volver al inicio de Capataz">
        <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-obra-ink text-lg font-black text-obra-yellow">C</span>
        <span className="text-xl font-black text-obra-ink">Capataz</span>
      </Link>
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
