"use client";

import {
  AlertTriangle,
  ArrowRight,
  Bot,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
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
import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import styles from "./public-home.module.css";
import { BrandMark } from "@/components/brand/brand-mark";
import { brand } from "@/lib/brand";
import { trackPublicFunnel } from "@/lib/product/public-analytics";

type WorkspaceId = "hoy" | "clientes" | "trabajo" | "dinero" | "ia";

const workspaceTabs: ReadonlyArray<{ id: WorkspaceId; label: string; icon: LucideIcon }> = [
  { id: "hoy", label: "Hoy", icon: LayoutDashboard },
  { id: "clientes", label: "Clientes", icon: Users },
  { id: "trabajo", label: "Trabajo", icon: BriefcaseBusiness },
  { id: "dinero", label: "Dinero", icon: WalletCards },
  { id: "ia", label: `${brand.productName} IA`, icon: Bot },
];

const workspaceMeta: Record<WorkspaceId, { greeting: string; title: string; subtitle: string; status: string }> = {
  hoy: { greeting: "Buenos días, Toni", title: "Tu empresa, hoy", subtitle: "Jueves, 30 de julio · 5 prioridades", status: "Todo conectado" },
  clientes: { greeting: "Área comercial", title: "Clientes y oportunidades", subtitle: "Pipeline, presupuestos y seguimientos", status: "3 tareas para hoy" },
  trabajo: { greeting: "Operación", title: "Trabajo en marcha", subtitle: "Obras, equipo, hitos e incidencias", status: "4 obras activas" },
  dinero: { greeting: "Control económico", title: "Caja, margen y vencimientos", subtitle: "Cobros y pagos previstos", status: "Actualizado ahora" },
  ia: { greeting: "Asistente supervisado", title: `${brand.productName} IA`, subtitle: "Propuestas listas para revisar", status: "Confirmación humana" },
};

const phoneContent: Record<WorkspaceId, { eyebrow: string; title: string; actions: readonly [LucideIcon, string][] }> = {
  hoy: { eyebrow: "Buenos días, Toni", title: "¿Qué necesita atención?", actions: [[CalendarDays, "Ver prioridades"], [ReceiptText, "Escanear factura"], [Bot, "Preguntar a Capataz"]] },
  clientes: { eyebrow: "Clientes", title: "Siguiente paso comercial", actions: [[Users, "Abrir seguimiento"], [FilePenLine, "Preparar presupuesto"], [MessageSquareText, "Registrar llamada"]] },
  trabajo: { eyebrow: "Obra Costa Norte", title: "Actualiza desde la obra", actions: [[BriefcaseBusiness, "Añadir avance"], [AlertTriangle, "Crear incidencia"], [Wrench, "Registrar material"]] },
  dinero: { eyebrow: "Tesorería", title: "Controla los vencimientos", actions: [[WalletCards, "Ver cobros"], [ReceiptText, "Revisar pagos"], [Landmark, "Abrir previsión"]] },
  ia: { eyebrow: `${brand.productName} IA`, title: "Tres propuestas preparadas", actions: [[Sparkles, "Revisar recomendación"], [FileCheck2, "Abrir borrador"], [ShieldCheck, "Ver trazabilidad"]] },
};

export function HeroDemo() {
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceId>("hoy");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const active = workspaceMeta[activeWorkspace];

  const selectTab = (index: number, focus = false) => {
    const next = workspaceTabs[index];
    if (!next) return;
    setActiveWorkspace(next.id);
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
    selectTab(nextIndex, true);
  };

  return (
    <section className={styles.hero} aria-labelledby="public-hero-title">
      <div className={styles.heroGrid}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>CAPATAZ · GESTIÓN INTELIGENTE PARA CONSTRUCCIÓN Y SERVICIOS</p>
          <h1 id="public-hero-title">
            <span>Gestiona tu empresa.</span>
            <strong>Ahorra tiempo.</strong>
            <strong>Toma el control.</strong>
          </h1>
          <p className={styles.heroSubtitle}>
            Clientes, presupuestos, obras, costes, documentos, facturas, cobros e IA conectados en un único sistema. Capataz prepara; tú revisas y confirmas.
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

        <div className={styles.productShowcase} aria-label="Vista interactiva del producto con datos de ejemplo">
          <div className={styles.productTabs} role="tablist" aria-label="Áreas de Capataz">
            {workspaceTabs.map(({ id, label, icon: Icon }, index) => {
              const selected = activeWorkspace === id;
              return (
                <button key={id} ref={(element) => { tabRefs.current[index] = element; }} id={`workspace-tab-${id}`} type="button" role="tab" aria-selected={selected} aria-controls={`workspace-panel-${id}`} tabIndex={selected ? 0 : -1} onClick={() => selectTab(index)} onKeyDown={(event) => handleTabKey(event, index)}>
                  <Icon aria-hidden="true" /><span>{label}</span>
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
        <li><strong>IA con control humano</strong><span>Capataz prepara; tú confirmas.</span></li>
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
          <GroupedBarChart primary={[54, 68, 61, 78, 71, 88, 82]} secondary={[36, 44, 48, 50, 47, 58, 55]} labels={["S1", "S2", "S3", "S4", "S5", "S6", "Hoy"]} />
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
        <section className={styles.pipelineCard} aria-label="Pipeline comercial de ejemplo">
          <CardHeading title="Pipeline comercial" detail="128.400 € abiertos" />
          <div className={styles.pipelineStages}>
            {[
              ["Nuevo", "42.600 €", 86, "5"],
              ["Visita", "36.800 €", 70, "4"],
              ["Presupuesto", "31.500 €", 54, "3"],
              ["Decisión", "17.500 €", 34, "2"],
            ].map(([label, value, width, count]) => (
              <div key={String(label)}><span><strong>{label}</strong><small>{count} oportunidades</small></span><i><b style={{ width: `${width}%` }} /></i><em>{value}</em></div>
            ))}
          </div>
        </section>
        <ActionList title="Próximos seguimientos" items={[
          [Building2, "Reformas Medina", "Llamada · 10:30", "Hoy"],
          [Users, "Grupo Norte", "Visita técnica · 16:00", "Hoy"],
          [FilePenLine, "Estudio Abril", "Enviar propuesta", "Mañana"],
        ]} />
      </div>
      <Insight tone="neutral" icon={Target} title="La oportunidad con más potencial está parada" text="Grupo Norte lleva 5 días sin siguiente paso. Capataz ha preparado un recordatorio." action="Revisar seguimiento" />
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
        <section className={styles.workProgressCard} aria-label="Progreso de obras de ejemplo">
          <CardHeading title="Progreso de obra" detail="Actualizado hace 8 min" />
          <div className={styles.workRows}>
            {[
              ["Costa Norte", "Instalaciones", 78, "En plazo"],
              ["Reforma Centro", "Acabados", 64, "Revisar"],
              ["Nave Albor", "Estructura", 42, "En plazo"],
            ].map(([name, stage, progress, state]) => (
              <div key={String(name)}><span><strong>{name}</strong><small>{stage}</small></span><i><b style={{ width: `${progress}%` }} /></i><em data-alert={state === "Revisar"}>{progress}% · {state}</em></div>
            ))}
          </div>
        </section>
        <ActionList title="Agenda de equipo" items={[
          [CheckCircle2, "Certificar mediciones", "Marta · 09:30", "Hecho"],
          [Wrench, "Entrega de material", "Iván · 12:00", "En curso"],
          [AlertTriangle, "Resolver incidencia", "Toni · 16:30", "Alta"],
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
          <CashflowChart incoming={[58, 34, 72, 45, 66, 51]} outgoing={[32, 49, 38, 57, 42, 46]} labels={["S1", "S2", "S3", "S4", "S5", "S6"]} />
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
  return (
    <>
      <MetricGrid items={[
        [Sparkles, "Recomendaciones", "3", "2 nuevas"],
        [AlertTriangle, "Advertencias", "1", "Margen"],
        [FileCheck2, "Borradores", "4", "Sin enviar"],
        [Clock3, "Tiempo estimado", "4 h", "Esta semana"],
      ]} />
      <div className={styles.workspaceMainGrid}>
        <section className={styles.aiDecisionCard} aria-label="Recomendaciones de inteligencia artificial de ejemplo">
          <CardHeading title="Centro de decisiones" detail="Preparado, nunca ejecutado" />
          <div className={styles.aiDecisionList}>
            <article data-tone="warning"><AlertTriangle /><span><small>Advertencia</small><strong>El margen de Costa Norte baja al 18 %</strong><p>Dos compras no previstas explican la desviación.</p></span><ChevronRight /></article>
            <article data-tone="good"><Sparkles /><span><small>Recomendación</small><strong>Agrupa tres pedidos al mismo proveedor</strong><p>Ahorro estimado de 480 € antes de confirmar.</p></span><ChevronRight /></article>
          </div>
        </section>
        <section className={styles.aiDraftCard} aria-label="Borrador preparado por inteligencia artificial">
          <span><FilePenLine /> Borrador preparado</span>
          <strong>Seguimiento a Grupo Norte</strong>
          <p>Hola, Ana. Te escribo para cerrar la visita técnica y resolver las dos dudas pendientes…</p>
          <div><button type="button">Editar</button><button type="button">Revisar</button></div>
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

function GroupedBarChart({ primary, secondary, labels }: { primary: readonly number[]; secondary: readonly number[]; labels: readonly string[] }) {
  return (
    <div className={styles.barChart}>
      <div className={styles.chartScale}><span>60k</span><span>40k</span><span>20k</span><span>0</span></div>
      <div className={styles.chartBars}>{labels.map((label, index) => <div key={label}><span><i style={{ height: `${primary[index]}%` }} /><b style={{ height: `${secondary[index]}%` }} /></span><small>{label}</small></div>)}</div>
      <div className={styles.chartLegend}><span data-series="primary">Ingresos</span><span data-series="secondary">Gastos</span><strong>+18,6 %</strong></div>
    </div>
  );
}

function CashflowChart({ incoming, outgoing, labels }: { incoming: readonly number[]; outgoing: readonly number[]; labels: readonly string[] }) {
  return (
    <div className={styles.cashflowChart}>
      <div className={styles.cashflowBars}>{labels.map((label, index) => <div key={label}><span><i style={{ height: `${incoming[index]}%` }} /><b style={{ height: `${outgoing[index]}%` }} /></span><small>{label}</small></div>)}</div>
      <div className={styles.chartLegend}><span data-series="primary">Entradas</span><span data-series="danger">Salidas</span><strong>Saldo +82.410 €</strong></div>
    </div>
  );
}

function ActionList({ title, items }: { title: string; items: readonly (readonly [LucideIcon, string, string, string])[] }) {
  return (
    <section className={styles.actionCard}><CardHeading title={title} detail="Ordenado por impacto" /><ul>{items.map(([Icon, name, detail, state]) => <li key={name}><Icon /><span><strong>{name}</strong><small>{detail}</small></span><em>{state}</em></li>)}</ul></section>
  );
}

function Insight({ tone, icon: Icon, title, text, action }: { tone: "good" | "warning" | "neutral"; icon: LucideIcon; title: string; text: string; action: string }) {
  return <div className={styles.workspaceInsight} data-tone={tone}><span><Icon /></span><div><strong>{title}</strong><p>{text}</p></div><button type="button">{action}</button></div>;
}

function PhonePreview({ workspace }: { workspace: WorkspaceId }) {
  const content = phoneContent[workspace];
  return (
    <div className={styles.productPhone} aria-hidden="true" key={`phone-${workspace}`}>
      <div><span>9:41</span><strong>Capataz</strong></div><p>{content.eyebrow}</p><h2>{content.title}</h2>
      <ul>{content.actions.map(([Icon, label]) => <li key={label}><Icon />{label}</li>)}</ul>
      <span className={styles.phoneAction}><Plus /></span>
    </div>
  );
}
