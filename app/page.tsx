import { ArrowRight, Bot, ClipboardCheck, ShieldCheck, WalletCards } from "lucide-react";
import Link from "next/link";
import { DemoEntry } from "@/components/demo-entry";

const highlights = [
  { icon: Bot, label: "Chat de obra", text: "Apunta gastos, pagos y seguimientos con frases normales." },
  { icon: ClipboardCheck, label: "Día claro", text: "Leads, visitas, materiales y tareas urgentes en una vista." },
  { icon: WalletCards, label: "Cobros bajo control", text: "Facturas vencidas y pagos parciales sin perder el hilo." }
];

export default function LoginPage() {
  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-5xl gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_420px] lg:items-center">
      <section className="flex flex-col justify-between gap-8">
        <div>
          <div className="mb-8 flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-obra-ink text-xl font-black text-obra-yellow">
              C
            </span>
            <div>
              <h1 className="text-3xl font-black text-obra-ink">Capataz</h1>
              <p className="text-sm font-semibold text-slate-500">Tu asistente IA para reformas y construcción.</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {highlights.map(({ icon: Icon, label, text }) => (
              <article key={label} className="card p-4">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-obra-yellow/30 text-obra-yellowDark">
                  <Icon size={21} />
                </div>
                <h2 className="text-base font-bold text-obra-ink">{label}</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">{text}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="hidden rounded-lg border border-obra-yellowDark/20 bg-obra-yellow/20 p-4 text-sm font-semibold text-obra-yellowDark sm:block">
          Capataz prepara borradores y recordatorios, pero nunca envía WhatsApp, emails, facturas o reclamaciones sin confirmación.
        </div>
      </section>

      <section className="card p-5">
        <div className="mb-5">
          <h2 className="text-xl font-black text-obra-ink">Acceso demo</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Entra con datos ficticios para probar clientes, obras, presupuestos, cobros y el chat mock.
          </p>
        </div>

        <div className="grid gap-3">
          <label>
            <span className="label mb-1 block">Teléfono o email</span>
            <input className="field" value="demo@capataz.app" readOnly />
          </label>
          <label>
            <span className="label mb-1 block">Contraseña</span>
            <input className="field" type="password" value="demodemo" readOnly />
          </label>
        </div>

        <div className="mt-5 grid gap-3">
          <DemoEntry />
          <button type="button" className="secondary-button w-full">
            <ShieldCheck size={18} />
            Crear cuenta
            <ArrowRight size={17} />
          </button>
        </div>

        <div className="mt-5 rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-600">
          Modo demo: los datos son ficticios y no se envía nada fuera de la app.
        </div>

        <div className="mt-4 flex flex-wrap gap-3 text-sm font-bold text-slate-600">
          <Link href="/privacidad" className="hover:text-obra-ink">Privacidad</Link>
          <Link href="/terminos" className="hover:text-obra-ink">Términos</Link>
          <Link href="/cookies" className="hover:text-obra-ink">Cookies</Link>
          <Link href="/politicas" className="hover:text-obra-ink">Políticas</Link>
          <Link href="/soporte" className="hover:text-obra-ink">Soporte</Link>
        </div>
      </section>
    </main>
  );
}
