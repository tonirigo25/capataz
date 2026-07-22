import Link from "next/link";
import { LegalBackButton } from "@/components/legal-back-button";

export default function CookiesPage() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-3xl px-4 pb-8 pt-20 sm:px-6">
      <LegalBackButton />
      <Link href="/" className="text-sm font-bold text-slate-600 hover:text-obra-ink">Orqena</Link>
      <h1 className="mt-4 text-3xl font-black text-obra-ink">Política de cookies</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        Esta página resume el uso previsto de cookies y almacenamiento local en Orqena.
      </p>

      <section className="card mt-6 grid gap-4 p-5 text-sm leading-6 text-slate-600">
        <Block title="Uso actual">
          Orqena puede usar almacenamiento técnico del navegador para mantener sesión, preferencias y funcionamiento básico de la app.
        </Block>
        <Block title="Analítica y marketing">
          No hay cookies publicitarias activadas en esta fase. Si se añaden herramientas de analítica o marketing, se documentarán antes de activarlas.
        </Block>
        <Block title="Gestión">
          Puedes borrar cookies y datos del sitio desde los ajustes del navegador. Algunas funciones pueden requerir volver a iniciar sesión o recargar la PWA.
        </Block>
      </section>
    </main>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-black text-obra-ink">{title}</h2>
      <p className="mt-1">{children}</p>
    </div>
  );
}
