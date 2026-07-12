import Link from "next/link";

export default function ModuleUnavailablePage() {
  return <main className="mx-auto flex min-h-dvh w-full max-w-lg items-center px-4 py-8">
    <section className="card w-full p-6 text-center">
      <h1 className="text-2xl font-black text-obra-ink">Esta función no está disponible temporalmente</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">Tus datos se conservan. Estamos terminando las comprobaciones necesarias antes de volver a habilitar este módulo.</p>
      <Link href="/hoy" className="primary-button mt-6 w-full">Volver al inicio</Link>
    </section>
  </main>;
}
