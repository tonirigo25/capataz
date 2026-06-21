import Link from "next/link";
import { LegalBackButton } from "@/components/legal-back-button";

export default function PoliciesPage() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-3xl px-4 pb-8 pt-20 sm:px-6">
      <LegalBackButton />
      <Link href="/" className="text-sm font-bold text-slate-600 hover:text-obra-ink">Capataz</Link>
      <h1 className="mt-4 text-3xl font-black text-obra-ink">Políticas legales</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        Acceso rápido a las páginas legales principales de Capataz.
      </p>

      <section className="card mt-6 grid gap-3 p-5 text-sm leading-6 text-slate-600">
        <Link href="/privacidad" className="secondary-button justify-start">Política de privacidad</Link>
        <Link href="/terminos" className="secondary-button justify-start">Términos de uso</Link>
        <Link href="/cookies" className="secondary-button justify-start">Política de cookies</Link>
        <Link href="/soporte" className="secondary-button justify-start">Soporte</Link>
      </section>
    </main>
  );
}
