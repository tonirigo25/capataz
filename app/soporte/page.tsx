import Link from "next/link";
import { LegalBackButton } from "@/components/legal-back-button";

const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "soporte@capataz.app";
const appEnv = process.env.NEXT_PUBLIC_APP_ENV || "development";
const appMode = process.env.NEXT_PUBLIC_APP_MODE || "demo";

export default function SupportPage() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-3xl px-4 pb-8 pt-20 sm:px-6">
      <LegalBackButton />
      <Link href="/" className="text-sm font-bold text-slate-600 hover:text-obra-ink">Orqena</Link>
      <h1 className="mt-4 text-3xl font-black text-obra-ink">Soporte</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        Para ayuda, incidencias, revisión de datos o solicitudes de eliminación, contacta con soporte.
      </p>

      <section className="card mt-6 grid gap-3 p-5 text-sm leading-6 text-slate-600">
        <p><strong className="text-obra-ink">Email:</strong> <a className="font-bold text-obra-ink underline" href={`mailto:${supportEmail}`}>{supportEmail}</a></p>
        <p><strong className="text-obra-ink">App:</strong> Orqena</p>
        <p><strong className="text-obra-ink">Versión:</strong> 1.0.0</p>
        <p><strong className="text-obra-ink">Entorno:</strong> {appEnv}</p>
        <p><strong className="text-obra-ink">Modo:</strong> {appMode}</p>
      </section>
    </main>
  );
}
