import Link from "next/link";
import {
  Activity,
  BarChart3,
  Box,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  FileCheck2,
  FileText,
  Gauge,
  Home,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  UsersRound,
  WalletCards
} from "lucide-react";
import { BrandLockup, BrandMark } from "@/components/brand/brand-mark";

export function AuthShell({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <main className="auth-portal-shell">
    <section className="auth-portal-story" aria-label="Presentación de Orqena">
      <Link href="/" aria-label="Volver al inicio de Orqena" className="inline-flex">
        <BrandLockup inverse compact />
      </Link>
      <div className="auth-portal-story__copy">
        <p className="auth-portal-eyebrow">Plataforma empresarial</p>
        <h2>Automatiza. Optimiza.<br />Toma el control.</h2>
        <p>Orqena centraliza procesos, datos y equipos para impulsar decisiones más rápidas y seguras.</p>
        <ul>
          <li><ShieldCheck aria-hidden="true" /><span><strong>Automatización inteligente</strong><small>Reduce tareas manuales y errores.</small></span></li>
          <li><BarChart3 aria-hidden="true" /><span><strong>Visibilidad en tiempo real</strong><small>Métricas y procesos siempre actualizados.</small></span></li>
          <li><UsersRound aria-hidden="true" /><span><strong>Colaboración segura</strong><small>Equipos alineados en una única plataforma.</small></span></li>
        </ul>
      </div>
      <div className="auth-portal-preview" aria-label="Vista previa de Orqena IA">
        <aside className="auth-portal-preview__rail" aria-hidden="true">
          <BrandMark />
          <Home />
          <BarChart3 />
          <UsersRound />
          <FileText />
          <FileCheck2 />
          <WalletCards />
          <span><UsersRound /></span>
          <Home />
        </aside>
        <div className="auth-portal-preview__workspace">
          <header><strong>Orqena IA</strong><button type="button">Este mes <span>⌄</span></button></header>
          <p className="auth-portal-preview__section-title">Acciones confirmadas</p>
          <div className="auth-portal-preview__metrics">
            <article><small>Acciones confirmadas</small><div><CheckCircle2 /><strong>9</strong></div><span>+2 vs ayer</span></article>
            <article><small>Impacto estimado</small><div><Activity /><strong>24.850,00 €</strong></div><span>+8.250,00 € vs ayer</span></article>
            <article><small>Nivel de confianza</small><div><ShieldCheck /><strong>92%</strong></div><span>+4% vs ayer</span></article>
          </div>
          <div className="auth-portal-preview__recommendations-title"><strong>Recomendaciones hoy</strong><span>18</span></div>
          <div className="auth-portal-preview__rows">
            <p><BriefcaseBusiness /><span><strong>Revisar presupuestos P-0247 antes del mediodía</strong><small><i>Comercial</i><b>Alta prioridad</b></small></span><em>€ 24.600,00<small>Impacto</small></em><em>76%<small>Prob.</small></em><button type="button" aria-label="Más opciones">•••</button></p>
            <p><Gauge /><span><strong>Optimiza el cobro en 3 días</strong><small><i>Finanzas</i><b>Hoy</b></small></span><em>€ 3.520,00<small>Impacto</small></em><em>68%<small>Prob.</small></em><button type="button" aria-label="Más opciones">•••</button></p>
            <p><CalendarDays /><span><strong>Reordena la agenda de mañana</strong><small><i>Agenda</i><b>Hoy</b></small></span><em>1,5 h<small>Tiempo</small></em><em>80%<small>Prob.</small></em><button type="button" aria-label="Más opciones">•••</button></p>
          </div>
        </div>
      </div>
      <footer>
        <span><ShieldCheck /><strong>Datos aislados</strong><small>Tu información siempre<br />protegida y separada.</small></span>
        <span><LockKeyhole /><strong>Acceso seguro</strong><small>Cifrado y controles de acceso<br />empresariales.</small></span>
        <span><RefreshCw /><strong>Sincronizado</strong><small>Información consistente<br />en todos tus dispositivos.</small></span>
      </footer>
    </section>

    <section className="auth-portal-form">
      <div className="auth-portal-form__card">
        <div className="auth-portal-form__brand" aria-hidden="true"><span><BrandMark /></span><span><Box /></span></div>
        <h1>{title}</h1>
        <p>{description}</p>
        <div className="auth-portal-form__content">{children}</div>
        <p className="auth-portal-form__trust"><LockKeyhole />Acceso seguro para clientes y equipos</p>
      </div>
    </section>
  </main>;
}

export function AuthMessage({ state }: { state: { status: string; message?: string } }) {
  if (!state.message) return null;
  return <p role="status" className={`rounded-lg border p-3 text-sm ${state.status === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{state.message}</p>;
}
