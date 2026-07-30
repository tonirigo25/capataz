"use client";

import {
  AlertTriangle,
  ArrowRight,
  Bot,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileCheck2,
  FilePenLine,
  FileText,
  Landmark,
  LayoutDashboard,
  MessageSquareText,
  Plus,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  WalletCards,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type FocusEvent, type KeyboardEvent, type ReactNode } from "react";
import styles from "./public-home.module.css";
import { InteractiveProductChart } from "./interactive-product-chart";
import { BrandMark } from "@/components/brand/brand-mark";
import { brand } from "@/lib/brand";
import { trackPublicFunnel } from "@/lib/product/public-analytics";

type WorkspaceId = "hoy" | "clientes" | "trabajo" | "dinero" | "ia";

const workspaceTabs: ReadonlyArray<{ id: WorkspaceId; label: string; icon: LucideIcon }> = [
  { id: "hoy", label: "Hoy", icon: LayoutDashboard },
  { id: "clientes", label: "Clientes", icon: Users },
  { id: "trabajo", label: "Trabajo", icon: BriefcaseBusiness },
  { id: "dinero", label: "Dinero", icon: WalletCards },
  { id: "ia", label: brand.assistantName, icon: Bot },
];

const workspaceMeta: Record<WorkspaceId, { greeting: string; title: string; subtitle: string; status: string }> = {
  hoy: { greeting: "Buenos días, Marta", title: "Tu empresa, hoy", subtitle: "Jueves, 30 de julio · 5 prioridades", status: "Todo conectado" },
  clientes: { greeting: "Área comercial", title: "Clientes y oportunidades", subtitle: "Pipeline, presupuestos y seguimientos", status: "3 tareas para hoy" },
  trabajo: { greeting: "Operación", title: "Trabajo en marcha", subtitle: "Obras, equipo, hitos e incidencias", status: "4 obras activas" },
  dinero: { greeting: "Control económico", title: "Caja, margen y vencimientos", subtitle: "Cobros y pagos previstos", status: "Actualizado ahora" },
  ia: { greeting: "Asistente supervisado", title: brand.assistantName, subtitle: "Propuestas listas para revisar", status: "Confirmación humana" },
};

const phoneContent: Record<WorkspaceId, { eyebrow: string; title: string; actions: readonly [LucideIcon, string][] }> = {
  hoy: { eyebrow: "Buenos días, Marta", title: "¿Qué necesita atención?", actions: [[CalendarDays, "Ver prioridades"], [ReceiptText, "Escanear factura"], [Bot, "Preguntar a Orqena IA"]] },
  clientes: { eyebrow: "Clientes", title: "Siguiente paso comercial", actions: [[Users, "Abrir seguimiento"], [FilePenLine, "Preparar presupuesto"], [MessageSquareText, "Registrar llamada"]] },
  trabajo: { eyebrow: "Obra Costa Norte", title: "Actualiza desde la obra", actions: [[BriefcaseBusiness, "Añadir avance"], [AlertTriangle, "Crear incidencia"], [Wrench, "Registrar material"]] },
  dinero: { eyebrow: "Tesorería", title: "Controla los vencimientos", actions: [[WalletCards, "Ver cobros"], [ReceiptText, "Revisar pagos"], [Landmark, "Abrir previsión"]] },
  ia: { eyebrow: brand.assistantName, title: "Tres propuestas preparadas", actions: [[Sparkles, "Revisar recomendación"], [FileCheck2, "Abrir borrador"], [ShieldCheck, "Ver trazabilidad"]] },
};

const HERO_AUTOPLAY_MS = 8200;
const HERO_FIRST_PAUSE_MS = 3000;

export function HeroDemo() {
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceId>("hoy");
  const [paused, setPaused] = useState(false);
  const [inViewport, setInViewport] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [cycle, setCycle] = useState(0);
  const [autoplayStarted, setAutoplayStarted] = useState(false);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const showcaseRef = useRef<HTMLDivElement>(null);
  const active = workspaceMeta[activeWorkspace];

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const target = showcaseRef.current;
    if (!target || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setInViewport(Boolean(entry?.isIntersecting)), { threshold: 0.3 });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (paused || reducedMotion || !inViewport) return;
    const delay = autoplayStarted ? HERO_AUTOPLAY_MS : HERO_FIRST_PAUSE_MS;
    const timer = window.setTimeout(() => {
      const currentIndex = workspaceTabs.findIndex(({ id }) => id === activeWorkspace);
      setActiveWorkspace(workspaceTabs[(currentIndex + 1) % workspaceTabs.length].id);
      setAutoplayStarted(true);
      setCycle((current) => current + 1);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [activeWorkspace, autoplayStarted, cycle, inViewport, paused, reducedMotion]);

  const selectTab = (index: number, focus = false, manual = false) => {
    const next = workspaceTabs[index];
    if (!next) return;
    setActiveWorkspace(next.id);
    if (manual) {
      setAutoplayStarted(true);
      setCycle((current) => current + 1);
    }
    if (focus) tabRefs.current[index]?.focus();
  };

  const handleTabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % workspaceTabs.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + workspaceTabs.length) % workspaceTabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = workspaceTabs.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    selectTab(nextIndex, true, true);
  };

  const handleShowcaseBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false);
  };

  return (
    <section className={styles.hero} aria-labelledby="public-hero-title">
      <div className={styles.heroGrid}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}><span className={styles.eyebrowDesktop}>ORQENA · GESTIÓN INTELIGENTE PARA CONSTRUCCIÓN Y SERVICIOS</span><span className={styles.eyebrowMobile}>ORQENA · GESTIÓN INTELIGENTE</span></p>
          <h1 id="public-hero-title">
            <span>Gestiona tu empresa.</span>
            <strong>Ahorra tiempo.</strong>
            <strong>Toma el control.</strong>
          </h1>
          <p className={styles.heroSubtitle}>
            Clientes, presupuestos, obras, costes, documentos, facturas, cobros e IA conectados en un único sistema. Orqena prepara; tú revisas y confirmas.
          </p>
          <div className={styles.heroActions} aria-label="Acciones principales">
            <Link className={styles.primaryAction} href="/contacto?motivo=demo" onClick={() => trackPublicFunnel("funnel.hero_cta", { target: "access_request" })}>
              Solicitar demo <ArrowRight aria-hidden="true" />
            </Link>
            <Link className={styles.secondaryAction} href="#como-funciona" onClick={() => trackPublicFunnel("funnel.hero_cta", { target: "how_it_works" })}>
              Ver cómo funciona
            </Link>
          </div>
          <ul className={styles.heroTrust} aria-label="Condiciones de la demo">
            <li><CheckCircle2 aria-hidden="true" />Sin tarjeta</li>
            <li><CheckCircle2 aria-hidden="true" />Demo privada de 7 días</li>
            <li><ShieldCheck aria-hidden="true" />Datos aislados</li>
          </ul>
        </div>

        <div ref={showcaseRef} className={styles.productShowcase} aria-label="Vista interactiva de Orqena con datos de ejemplo" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocusCapture={() => setPaused(true)} onBlurCapture={handleShowcaseBlur}>
          <div className={styles.productTabs} role="tablist" aria-label="Áreas de Orqena">
            {workspaceTabs.map(({ id, label, icon: Icon }, index) => {
              const selected = activeWorkspace === id;
              return (
                <button key={id} ref={(element) => { tabRefs.current[index] = element; }} id={`workspace-tab-${id}`} type="button" role="tab" aria-selected={selected} aria-controls={`workspace-panel-${id}`} tabIndex={selected ? 0 : -1} onClick={() => selectTab(index, false, true)} onKeyDown={(event) => handleTabKey(event, index)}>
                  <Icon aria-hidden="true" /><span>{label}</span>{selected && !reducedMotion ? <i key={`${id}-${cycle}`} className={styles.tabProgress} aria-hidden="true" style={{ "--hero-progress-duration": `${autoplayStarted ? HERO_AUTOPLAY_MS : HERO_FIRST_PAUSE_MS}ms` } as CSSProperties} /> : null}
                </button>
              );
            })}
          </div>

          <div id={`workspace-panel-${activeWorkspace}`} role="tabpanel" aria-labelledby={`workspace-tab-${activeWorkspace}`} className={styles.productFrame}>
            <aside className={styles.productSidebar} aria-hidden="true">
              <span className={styles.productBrand}><BrandMark /></span>
              {workspaceTabs.map(({ id, icon: Icon }) => <span key={id} data-active={activeWorkspace === id}><Icon /></span>)}
            </aside>
            <div className={styles.productWorkspace} key={activeWorkspace}>
              <div className={styles.productTopbar}>
                <div><span>{active.greeting}</span><strong>{active.title}</strong><small>{active.subtitle}</small></div>
                <span>{active.status}</span>
              </div>
              <WorkspacePanel id={activeWorkspace} />
            </div>
          </div>

          <PhonePreview workspace={activeWorkspace} />
        </div>
      </div>

      <ul className={styles.heroValueBand} aria-label="Beneficios principales">
        <li><strong>Todo conectado</strong><span>Cliente, trabajo, documentos y dinero.</span></li>
        <li><strong>IA con control humano</strong><span>Orqena prepara; tú confirmas.</span></li>
        <li><strong>Datos aislados y seguros</strong><span>Cada empresa trabaja en su espacio.</span></li>
        <li><strong>Acceso web y móvil</strong><span>Oficina y obra siempre coordinadas.</span></li>
      </ul>
    </section>
  );
}

function WorkspacePanel({ id }: { id: WorkspaceId }) {
  if (id === "clientes") return <ClientsWorkspace />;
  if (id === "trabajo") return <WorkWorkspace />;
  if (id === "dinero") return <MoneyWorkspace />;
  if (id === "ia") return <AiWorkspace />;
  return <TodayWorkspace />;
}

function TodayWorkspace() {
  return (
    <>
      <MetricGrid items={[
        [TrendingUp, "Ingresos", "48.260 €", "+12,4 %"],
        [TrendingDown, "Gastos", "31.840 €", "Dentro de plan"],
        [WalletCards, "Beneficio", "16.420 €", "Margen 28 %"],
        [ReceiptText, "Por cobrar", "8.750 €", "4 facturas"],
      ]} />
      <div className={styles.workspaceMainGrid}>
        <ChartCard title="Pulso del negocio" detail="Ingresos y gastos · 7 semanas">
          <InteractiveProductChart kind="today" />
        </ChartCard>
        <ActionList title="Prioridades de hoy" items={[
          [AlertTriangle, "Margen de Costa Norte", "Revisar antes de comprar", "Alta"],
          [FileText, "Presupuesto PR-104", "Listo para confirmar", "Ahora"],
          [Clock3, "Factura F-2031", "Vence mañana", "1 día"],
        ]} />
      </div>
      <Insight tone="good" icon={Sparkles} title="La semana cierra por encima del objetivo" text="El margen previsto mejora 2,8 puntos si confirmas las dos compras negociadas." action="Ver detalle" />
    </>
  );
}

function ClientsWorkspace() {
  return (
    <>
      <MetricGrid items={[
        [Users, "Clientes activos", "38", "+4 este mes"],
        [Target, "Pipeline", "128.400 €", "14 oportunidades"],
        [FilePenLine, "Presupuestos", "6", "3 por revisar"],
        [CalendarDays, "Seguimientos", "9", "3 para hoy"],
      ]} />
      <div className={styles.workspaceMainGrid}>
        <ChartCard title="Pipeline comercial" detail="128.400 € abiertos">
          <InteractiveProductChart kind="clients" />
        </ChartCard>
        <ActionList title="Próximos seguimientos" items={[
          [Building2, "Reformas Medina", "Llamada · 10:30", "Hoy"],
          [Users, "Grupo Norte", "Visita técnica · 16:00", "Hoy"],
          [FilePenLine, "Estudio Abril", "Enviar propuesta", "Mañana"],
        ]} />
      </div>
      <Insight tone="neutral" icon={Target} title="La oportunidad con más potencial está parada" text="Grupo Norte Demo lleva 5 días sin siguiente paso. Orqena ha preparado un recordatorio." action="Revisar seguimiento" />
    </>
  );
}

function WorkWorkspace() {
  return (
    <>
      <MetricGrid items={[
        [BriefcaseBusiness, "Obras activas", "4", "73 % avance medio"],
        [Users, "Equipo hoy", "12", "10 asignados"],
        [CheckCircle2, "Tareas", "27 / 34", "7 pendientes"],
        [AlertTriangle, "Incidencias", "2", "1 prioritaria"],
      ]} />
      <div className={styles.workspaceMainGrid}>
        <ChartCard title="Progreso y carga" detail="Actualizado hace 8 min">
          <InteractiveProductChart kind="work" />
        </ChartCard>
        <ActionList title="Agenda de equipo" items={[
          [CheckCircle2, "Certificar mediciones", "Marta · 09:30", "Hecho"],
          [Wrench, "Entrega de material", "Iván · 12:00", "En curso"],
          [AlertTriangle, "Resolver incidencia", "Marta · 16:30", "Alta"],
        ]} />
      </div>
      <Insight tone="warning" icon={AlertTriangle} title="Una incidencia puede mover el hito del viernes" text="Falta confirmar el suministro de climatización de Reforma Centro." action="Abrir incidencia" />
    </>
  );
}

function MoneyWorkspace() {
  return (
    <>
      <MetricGrid items={[
        [Landmark, "Caja disponible", "95.690 €", "+8,2 %"],
        [WalletCards, "Por cobrar", "24.350 €", "12 facturas"],
        [ReceiptText, "Por pagar", "13.280 €", "8 vencimientos"],
        [TrendingUp, "Margen previsto", "28,6 %", "+2,1 pt"],
      ]} />
      <div className={styles.workspaceMainGrid}>
        <ChartCard title="Previsión de tesorería" detail="Saldo proyectado · 6 semanas">
          <InteractiveProductChart kind="money" />
        </ChartCard>
        <ActionList title="Próximos vencimientos" items={[
          [TrendingUp, "Cobro · Grupo Norte", "+8.500 €", "31 jul"],
          [TrendingDown, "Pago · Suministros", "−4.280 €", "1 ago"],
          [TrendingUp, "Cobro · Obra Costa", "+5.250 €", "4 ago"],
        ]} />
      </div>
      <Insight tone="good" icon={Landmark} title="La caja se mantiene positiva todo el periodo" text="El punto más bajo previsto es 74.300 € durante la semana 4." action="Ver previsión" />
    </>
  );
}

function AiWorkspace() {
  const [draftMode, setDraftMode] = useState<"idle" | "editing" | "reviewed">("idle");
  return (
    <>
      <MetricGrid items={[
        [Sparkles, "Recomendaciones", "3", "2 nuevas"],
        [AlertTriangle, "Advertencias", "1", "Margen"],
        [FileCheck2, "Borradores", "4", "Sin enviar"],
        [Clock3, "Tiempo estimado", "4 h", "Esta semana"],
      ]} />
      <div className={styles.workspaceMainGrid}>
        <ChartCard title="Impacto de recomendaciones" detail="Estimación y confianza">
          <InteractiveProductChart kind="ai" />
        </ChartCard>
        <section className={styles.aiDraftCard} aria-label="Borrador preparado por inteligencia artificial">
          <span><FilePenLine /> Borrador preparado</span>
          <strong>Seguimiento a Grupo Norte</strong>
          <p>{draftMode === "editing" ? "Hola, Ana. Confirmemos la visita técnica del viernes y las dos dudas pendientes." : "Hola, Ana. Te escribo para cerrar la visita técnica y resolver las dos dudas pendientes…"}</p>
          <div><button type="button" aria-pressed={draftMode === "editing"} onClick={() => setDraftMode("editing")}>Editar</button><button type="button" aria-pressed={draftMode === "reviewed"} onClick={() => setDraftMode("reviewed")}>Revisar</button></div>
          <small role="status">{draftMode === "reviewed" ? "Revisión sintética completada. No se ha enviado nada." : draftMode === "editing" ? "Edición local habilitada." : "Pendiente de revisión humana."}</small>
        </section>
      </div>
      <Insight tone="neutral" icon={ShieldCheck} title="Tú conservas la última palabra" text="Nada se crea, modifica ni envía sin una confirmación explícita y trazable." action="Ver controles" />
    </>
  );
}

type MetricTuple = readonly [LucideIcon, string, string, string];

function MetricGrid({ items }: { items: readonly MetricTuple[] }) {
  return <div className={styles.metricGrid}>{items.map(([Icon, label, value, delta]) => <Metric key={label} icon={Icon} label={label} value={value} delta={delta} />)}</div>;
}

function Metric({ icon: Icon, label, value, delta }: { icon: LucideIcon; label: string; value: string; delta: string }) {
  return <article className={styles.metricCard}><div><span><Icon aria-hidden="true" /></span><small>{label}</small></div><strong>{value}</strong><em>{delta}</em></article>;
}

function ChartCard({ title, detail, children }: { title: string; detail: string; children: ReactNode }) {
  return <section className={styles.chartCard}><CardHeading title={title} detail={detail} />{children}</section>;
}

function CardHeading({ title, detail }: { title: string; detail: string }) {
  return <div className={styles.cardHeading}><strong>{title}</strong><span>{detail}</span></div>;
}

function ActionList({ title, items }: { title: string; items: readonly (readonly [LucideIcon, string, string, string])[] }) {
  return (
    <section className={styles.actionCard}><CardHeading title={title} detail="Ordenado por impacto" /><ul>{items.map(([Icon, name, detail, state]) => <li key={name}><Icon /><span><strong>{name}</strong><small>{detail}</small></span><em>{state}</em></li>)}</ul></section>
  );
}

function Insight({ tone, icon: Icon, title, text, action }: { tone: "good" | "warning" | "neutral"; icon: LucideIcon; title: string; text: string; action: string }) {
  const [expanded, setExpanded] = useState(false);
  return <div className={styles.workspaceInsight} data-tone={tone}><span><Icon /></span><div><strong>{title}</strong><p>{text}</p>{expanded ? <small role="status">Detalle sintético abierto. La acción real requeriría confirmación.</small> : null}</div><button type="button" aria-expanded={expanded} onClick={() => setExpanded((current) => !current)}>{expanded ? "Cerrar" : action}</button></div>;
}

function PhonePreview({ workspace }: { workspace: WorkspaceId }) {
  const content = phoneContent[workspace];
  return (
    <div className={styles.productPhone} aria-hidden="true" key={`phone-${workspace}`}>
      <div><span>9:41</span><strong>Orqena</strong></div><p>{content.eyebrow}</p><h2>{content.title}</h2>
      <ul>{content.actions.map(([Icon, label]) => <li key={label}><Icon />{label}</li>)}</ul>
      <aside><Sparkles aria-hidden="true" /><span><strong>Orqena IA</strong><small>He preparado dos prioridades para revisar.</small></span></aside>
      <nav aria-label="Navegación móvil de muestra"><LayoutDashboard /><Users /><BriefcaseBusiness /><WalletCards /></nav>
      <span className={styles.phoneAction}><Plus /></span>
    </div>
  );
}
