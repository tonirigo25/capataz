import Image from "next/image";
import Link from "next/link";
import {
  Activity,
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  FileCheck2,
  FileText,
  Gauge,
  Home,
  LayoutGrid,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  UsersRound,
  WalletCards
} from "lucide-react";
import styles from "@/components/auth/auth-shell.module.css";

const OFFICIAL_LOCKUP = "/brand/orqena/orqena-logo-oficial-sobre-oscuro.png";
const OFFICIAL_SYMBOL = "/brand/orqena/orqena-simbolo-oficial-v2.png";

export function LoginShell({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <main className={styles.shell}>
    <section className={styles.story} aria-label="Presentación de Orqena">
      <div className={styles.storyFrame}>
        <Link href="/" aria-label="Volver al inicio de Orqena" className={styles.brandLink}>
          <Image src={OFFICIAL_LOCKUP} alt="Orqena Tech" width={290} height={103} priority unoptimized />
        </Link>
        <div className={styles.storyCopy}>
          <p className={styles.eyebrow}>Plataforma empresarial</p>
          <h2>Automatiza. Optimiza.<br />Toma el control.</h2>
          <p>Orqena centraliza procesos, datos y equipos para impulsar decisiones más rápidas y seguras.</p>
          <ul>
            <li><ShieldCheck aria-hidden="true" /><span><strong>Automatización inteligente</strong><small>Reduce tareas manuales y errores.</small></span></li>
            <li><BarChart3 aria-hidden="true" /><span><strong>Visibilidad en tiempo real</strong><small>Métricas y procesos siempre actualizados.</small></span></li>
            <li><UsersRound aria-hidden="true" /><span><strong>Colaboración segura</strong><small>Equipos alineados en una única plataforma.</small></span></li>
          </ul>
        </div>
        <div className={styles.preview} aria-label="Vista previa de Orqena IA">
          <aside className={styles.previewRail} aria-hidden="true">
            <LayoutGrid />
            <Home />
            <BarChart3 />
            <UsersRound />
            <FileText />
            <FileCheck2 />
            <WalletCards />
            <span><UsersRound /></span>
            <Home />
          </aside>
          <div className={styles.previewWorkspace}>
            <header><strong>Orqena IA</strong><span className={styles.period}>Este mes <span aria-hidden="true">⌄</span></span></header>
            <p className={styles.previewSectionTitle}>Acciones confirmadas</p>
            <div className={styles.previewMetrics}>
              <article><small>Acciones confirmadas</small><div><CheckCircle2 /><strong>9</strong></div><span>+2 vs ayer</span></article>
              <article><small>Impacto estimado</small><div><Activity /><strong>24.850,00 €</strong></div><span>+8.250,00 € vs ayer</span></article>
              <article><small>Nivel de confianza</small><div><ShieldCheck /><strong>92%</strong></div><span>+4% vs ayer</span></article>
            </div>
            <div className={styles.recommendationsTitle}><strong>Recomendaciones hoy</strong><span>18</span></div>
            <div className={styles.previewRows}>
              <p><BriefcaseBusiness /><span><strong>Revisar presupuestos P-0247 antes del mediodía</strong><small><i>Comercial</i><b>Alta prioridad</b></small></span><em>€ 24.600,00<small>Impacto</small></em><em>76%<small>Prob.</small></em><span aria-hidden="true">•••</span></p>
              <p><Gauge /><span><strong>Optimiza el cobro en 3 días</strong><small><i>Finanzas</i><b>Hoy</b></small></span><em>€ 3.520,00<small>Impacto</small></em><em>68%<small>Prob.</small></em><span aria-hidden="true">•••</span></p>
              <p><CalendarDays /><span><strong>Reordena la agenda de mañana</strong><small><i>Agenda</i><b>Hoy</b></small></span><em>1,5 h<small>Tiempo</small></em><em>80%<small>Prob.</small></em><span aria-hidden="true">•••</span></p>
            </div>
          </div>
        </div>
        <footer className={styles.trustStrip}>
          <span><ShieldCheck /><strong>Datos aislados</strong><small>Tu información siempre<br />protegida y separada.</small></span>
          <span><LockKeyhole /><strong>Acceso seguro</strong><small>Cifrado y controles de acceso<br />empresariales.</small></span>
          <span><RefreshCw /><strong>Sincronizado</strong><small>Información consistente<br />en todos tus dispositivos.</small></span>
        </footer>
      </div>
    </section>

    <section className={styles.formSide}>
      <div className={styles.formStack}>
      <div className={styles.formCard}>
        <div className={styles.formBrand} aria-hidden="true">
          <Image src={OFFICIAL_SYMBOL} alt="" width={70} height={70} priority unoptimized />
        </div>
        <h1>{title}</h1>
        <p>{description}</p>
        <div className={styles.formContent}>{children}</div>
        <p className={styles.formTrust}><LockKeyhole />Acceso seguro para clientes y equipos</p>
      </div>
      <ul className={styles.mobileBenefits} aria-label="Beneficios de Orqena">
        <li><ShieldCheck aria-hidden="true" /><span><strong>Datos aislados</strong><small>Tu empresa, protegida.</small></span></li>
        <li><LockKeyhole aria-hidden="true" /><span><strong>Acceso seguro</strong><small>Controles empresariales.</small></span></li>
        <li><RefreshCw aria-hidden="true" /><span><strong>Sincronizado</strong><small>En todos tus dispositivos.</small></span></li>
      </ul>
      </div>
    </section>
  </main>;
}
