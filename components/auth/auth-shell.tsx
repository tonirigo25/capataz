import Link from "next/link";
import { BarChart3, ShieldCheck, UsersRound } from "lucide-react";
import { BrandLockup, BrandMark } from "@/components/brand/brand-mark";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";

export function AuthShell({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <main className="auth-portal-shell">
    <section className="auth-portal-story" aria-label="Presentación de Orqena">
      <Link href="/" aria-label="Volver al inicio de Orqena" className="inline-flex">
        <BrandLockup inverse compact />
      </Link>
      <div className="auth-portal-story__copy">
        <p className="type-label text-brand">Plataforma empresarial</p>
        <h2>Automatiza. Optimiza.<br />Toma el control.</h2>
        <p>Orqena centraliza procesos, datos y equipos para impulsar decisiones más rápidas y seguras.</p>
        <ul>
          <li><ShieldCheck aria-hidden="true" /><span><strong>Automatización supervisada</strong><small>Reduce tareas manuales sin perder el control humano.</small></span></li>
          <li><BarChart3 aria-hidden="true" /><span><strong>Visibilidad en tiempo real</strong><small>Métricas y procesos siempre conectados.</small></span></li>
          <li><UsersRound aria-hidden="true" /><span><strong>Colaboración segura</strong><small>Equipos alineados con permisos por empresa.</small></span></li>
        </ul>
      </div>
      <div className="auth-portal-preview" aria-label="Vista previa de Orqena IA">
        <header><BrandMark className="h-6 w-6" /><strong>Orqena IA</strong><span>Acceso controlado</span></header>
        <div className="auth-portal-preview__metrics">
          <article><small>Acciones sensibles</small><strong>Revisables</strong><span>Con confirmación humana</span></article>
          <article><small>Impacto explicado</small><strong>Visible</strong><span>Antes de aplicar</span></article>
          <article><small>Trazabilidad</small><strong>Auditable</strong><span>Origen y decisión</span></article>
        </div>
        <div className="auth-portal-preview__rows">
          <p><span>01</span>Revisar presupuesto pendiente<em>Preparado</em></p>
          <p><span>02</span>Ordenar cobros prioritarios<em>Revisable</em></p>
          <p><span>03</span>Coordinar la agenda de mañana<em>Sin cambios</em></p>
        </div>
      </div>
      <footer>
        <span>Datos aislados por empresa</span><span>Acceso seguro</span><span>Decisiones confirmables</span>
      </footer>
    </section>

    <section className="auth-portal-form">
      <div className="auth-portal-form__card">
        <div className="flex justify-end"><ThemeSwitcher compact /></div>
        <div className="auth-portal-form__brand"><BrandMark className="h-12 w-12" /></div>
        <h1>{title}</h1>
        <p>{description}</p>
        <div className="mt-7">{children}</div>
        <p className="mt-7 text-center text-xs text-content-tertiary">Acceso seguro para clientes y equipos</p>
      </div>
    </section>
  </main>;
}

export function AuthMessage({ state }: { state: { status: string; message?: string } }) {
  if (!state.message) return null;
  return <p role="status" className={`rounded-lg border p-3 text-sm ${state.status === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{state.message}</p>;
}
