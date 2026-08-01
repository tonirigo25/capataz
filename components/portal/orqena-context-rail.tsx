"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { ChevronRight, ChevronsLeft, ChevronsRight, CircleAlert, ExternalLink, FileText, Info, ShieldCheck, Sparkles, TriangleAlert, X } from "lucide-react";
import type { PortalRailArea, PortalRailRecommendations, TodayRailRecommendation } from "@/lib/application/intelligence/today-recommendation";
import {
  acceptTodayRecommendationAction,
  dismissTodayRecommendationAction,
} from "@/app/(app)/hoy/actions";

type RailContext = {
  eyebrow: string;
  title: string;
  description: string;
  source: string;
  next: string;
  href: string;
};

const contexts: Array<{ match: (pathname: string) => boolean; area: PortalRailArea; value: RailContext }> = [
  { match: (path) => path === "/orqena-ia/comercial", area: "clients", value: contextual("Guía comercial para hoy", "Prioriza clientes, presupuestos y seguimientos registrados. Orqena IA prepara la revisión, pero no contacta ni modifica oportunidades sin confirmación humana.", "Cartera, presupuestos y recomendaciones dentro de tu alcance", "Abrir prioridades comerciales", "/presupuestos") },
  { match: (path) => path === "/orqena-ia/operaciones", area: "work", value: contextual("Enfocado en operaciones", "Contrasta trabajo, tareas, bloqueos e incidencias registradas para coordinar mejor sin reasignar personas o fechas automáticamente.", "Obras y tareas autorizadas para tu perfil", "Abrir prioridades operativas", "/obras") },
  { match: (path) => path === "/orqena-ia/finanzas", area: "finance", value: contextual("Foco financiero para hoy", "Revisa cobros, vencimientos y márgenes sustentados en registros visibles. Ningún pago, factura o ajuste se ejecuta desde esta recomendación.", "Facturas e indicadores financieros autorizados", "Abrir prioridades financieras", "/dinero") },
  { match: (path) => path === "/orqena-ia/documentos", area: "documents", value: contextual("Recomendación enfocada en documentos", "Revisa extracciones, coincidencias y campos dudosos. La clasificación propuesta no sustituye la validación humana del documento.", "Documentos y extracciones dentro de tu alcance", "Abrir revisión documental", "/documentos") },
  { match: (path) => path === "/orqena-ia/equipo", area: "team", value: contextual("Coordinación inteligente del equipo", "Contrasta carga, tareas y permisos registrados sin inferir disponibilidad ni ampliar el acceso de ninguna persona.", "Miembros y tareas autorizados para tu perfil", "Abrir coordinación del equipo", "/equipo") },
  { match: (path) => path === "/orqena-ia", area: "hoy", value: contextual("Recomendación estratégica para hoy", "Revisa las prioridades registradas de tu empresa y confirma cualquier acción sensible antes de ejecutarla.", "Recomendaciones vigentes y contexto autorizado", "Abrir recomendaciones", "/recomendaciones") },
  { match: (path) => /^\/clientes\/[^/]+\/editar$/.test(path), area: "clients", value: contextual("Completar ficha del cliente", "Revisa los datos incompletos, las coincidencias y los próximos pasos antes de guardar. Orqena IA no modifica la ficha por sí sola.", "Cliente seleccionado, campos visibles y permisos vigentes", "Abrir ayuda comercial", "/orqena-ia/comercial") },
  { match: (path) => path.startsWith("/clientes/"), area: "clients", value: contextual("Cliente 360", "Revisa relación, operación, dinero y archivos sin perder el contexto del cliente.", "Cliente seleccionado y permisos vigentes", "Abrir ayuda comercial", "/orqena-ia/comercial") },
  { match: (path) => path === "/clientes", area: "clients", value: contextual("Clientes", "Prioriza seguimientos y oportunidades con la información que tu rol puede consultar.", "Cartera visible para tu perfil", "Analizar cartera", "/orqena-ia/comercial") },
  { match: (path) => path === "/oportunidades", area: "budgets", value: contextual("Contexto comercial verificado", "Prioriza presupuestos y seguimientos según su estado real. No se calcula probabilidad ni se ejecutan cambios sin confirmación humana.", "Presupuestos reales autorizados para tu perfil", "Abrir prioridades comerciales", "/orqena-ia/comercial") },
  { match: (path) => path === "/hoy", area: "hoy", value: contextual("Recomendación para hoy", "No hay recomendaciones activas dentro de tu alcance. Orqena IA volverá a comprobar las señales registradas.", "Datos autorizados de tu empresa", "Revisar prioridades", "/recomendaciones") },
  { match: (path) => path === "/dashboard", area: "dashboard", value: contextual("Lectura ejecutiva", "Explica tendencias y riesgos usando sólo indicadores que tu perfil puede ver.", "Indicadores agregados del periodo", "Analizar indicadores", "/orqena-ia") },
  { match: (path) => /^\/obras\/[^/]+\/planificacion(?:\/|$)/.test(path), area: "work", value: contextual("Planificación de la obra", "Revisa tareas, fechas, responsables y dependencias registradas antes de preparar cualquier ajuste. Orqena IA no reprograma ni asigna recursos por sí sola.", "Obra activa, planificación visible y permisos vigentes", "Abrir ayuda de planificación", "/orqena-ia/operaciones") },
  { match: (path) => /^\/obras\/[^/]+\/costes(?:\/|$)/.test(path), area: "work", value: contextual("Control de costes de la obra", "Contrasta presupuesto, gasto registrado, proveedores y desviaciones sustentadas. Orqena IA no estima costes ni márgenes que no estén persistidos.", "Obra seleccionada, permisos económicos y registros de coste visibles", "Abrir ayuda de costes", "/orqena-ia/finanzas") },
  { match: (path) => /^\/obras\/[^/]+\/partes(?:\/|$)/.test(path), area: "work", value: contextual("Partes y actividad de la obra", "Revisa actividad, horas y evidencias vinculadas antes de preparar un resumen. Orqena IA no atribuye tareas o fotografías a un parte sin una relación persistida.", "Obra seleccionada, actividad y evidencias autorizadas", "Abrir ayuda de actividad", "/orqena-ia/operaciones") },
  { match: (path) => /^\/obras\/[^/]+\/documentos(?:\/|$)/.test(path), area: "documents", value: contextual("Expediente documental de la obra", "Comprueba clasificación, relación y estado de cada archivo sin modificar su contenido ni aprobar extracciones automáticamente.", "Documentos vinculados a la obra y permisos vigentes", "Abrir ayuda documental", "/orqena-ia/documentos") },
  { match: (path) => /^\/obras\/[^/]+\/equipo(?:\/|$)/.test(path), area: "team", value: contextual("Equipo de la obra", "Contrasta responsables, tareas y carga registrada sin ampliar permisos ni inferir disponibilidad.", "Personas y tareas vinculadas dentro de tu alcance", "Abrir ayuda de equipo", "/orqena-ia/equipo") },
  { match: (path) => /^\/obras\/[^/]+\/facturacion(?:\/|$)/.test(path), area: "finance", value: contextual("Facturación de la obra", "Revisa presupuestos, facturas, cobros y vencimientos vinculados a esta obra. Orqena IA no emite ni cambia estados sin confirmación humana.", "Documentos económicos de la obra autorizados para tu perfil", "Abrir ayuda de facturación", "/orqena-ia/finanzas") },
  { match: (path) => /^\/obras\/[^/]+\/incidencias(?:\/|$)/.test(path), area: "work", value: contextual("Incidencias de la obra", "Ordena las evidencias y riesgos registrados sin asignar severidad, impacto o responsable cuando esos datos no existen.", "Incidencias y señales persistidas de la obra", "Abrir ayuda de incidencias", "/orqena-ia/operaciones") },
  { match: (path) => /^\/obras\/[^/]+(?:\/|$)/.test(path), area: "work", value: contextual("Trabajo seleccionado", "Contrasta el estado, el avance registrado, los hitos y las incidencias de esta obra antes de preparar una recomendación.", "Obra activa y datos autorizados para tu perfil", "Abrir ayuda operativa", "/orqena-ia/operaciones") },
  { match: (path) => path === "/obras" || path.startsWith("/obras/"), area: "work", value: contextual("Recomendación para hoy", "Contrasta avance, hitos e incidencias antes de preparar una recomendación.", "Trabajo seleccionado y actividad registrada", "Revisar trabajo", "/orqena-ia/operaciones") },
  { match: (path) => path.startsWith("/presupuestos"), area: "budgets", value: contextual("Presupuesto revisable", "Comprueba partidas, margen y condiciones sin modificar cálculos ni fiscalidad.", "Versión visible del presupuesto", "Preparar revisión", "/orqena-ia/comercial") },
  { match: (path) => path.startsWith("/dinero") || path.startsWith("/tesoreria"), area: "finance", value: contextual("Control financiero", "Ordena vencimientos y riesgos con importes protegidos por permisos financieros.", "Tesorería autorizada para tu perfil", "Preparar plan financiero", "/orqena-ia/finanzas") },
  { match: (path) => path.startsWith("/documentos") || path.startsWith("/gastos-materiales/lector"), area: "documents", value: contextual("Revisión documental", "Señala campos dudosos y relaciones probables; la confirmación siempre es humana.", "Documento seleccionado y extracción autorizada", "Revisar con Orqena IA", "/orqena-ia/documentos") },
  { match: (path) => path.startsWith("/agenda"), area: "agenda", value: contextual("Coordinación de agenda", "Detecta conflictos y prepara alternativas sin mover eventos automáticamente.", "Agenda y equipo dentro de tu alcance", "Preparar alternativas", "/orqena-ia/operaciones") },
  { match: (path) => path === "/equipo" || path.startsWith("/equipos"), area: "team", value: contextual("Coordinación del equipo", "Revisa carga y acceso sin ampliar permisos ni mostrar información fuera de tu alcance.", "Personas y tareas autorizadas", "Analizar coordinación", "/orqena-ia/equipo") },
  { match: (path) => path.startsWith("/configuracion"), area: "settings", value: contextual("Configuración recomendada", "Comprueba plan, consumo, permisos e integraciones antes de proponer cambios.", "Configuración visible para tu rol", "Abrir guía segura", "/orqena-ia") },
  { match: (path) => path === "/capataz" || path.startsWith("/orqena-ia"), area: "orqena", value: contextual("Asistente Orqena IA", "Consulta, prepara y revisa acciones con trazabilidad, límites y confirmación humana.", "Contexto mínimo autorizado", "Continuar en Orqena IA", "/orqena-ia") },
];

const fallbackContext = contextual("Ayuda contextual", "Orqena IA puede preparar un análisis con los datos autorizados de esta vista.", "Módulo actual y permisos vigentes", "Abrir Orqena IA", "/orqena-ia");

function contextual(eyebrow: string, description: string, source: string, next: string, href: string): RailContext {
  return { eyebrow, title: next, description, source, next, href };
}

export function OrqenaContextRail({
  pathname,
  recommendations,
  canUse,
  canExecute,
  collapsed,
  onToggleCollapsed,
}: {
  pathname: string;
  recommendations: PortalRailRecommendations;
  canUse: boolean;
  canExecute: boolean;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const matched = contexts.find((entry) => entry.match(pathname));
  const context = matched?.value ?? fallbackContext;
  const areaRecommendation = matched ? recommendations[matched.area] ?? null : null;
  const selectedWorkId = pathname.match(/^\/obras\/([^/?]+)/)?.[1] ?? null;
  const recommendationMatchesSelectedWork = selectedWorkId != null && areaRecommendation?.href === `/obras/${selectedWorkId}`;
  const contextOnly = pathname.endsWith("/editar") || (selectedWorkId != null && !recommendationMatchesSelectedWork);
  const recommendation =
    canUse && matched && !contextOnly
      ? areaRecommendation
      : null;
  const dashboardAlerts = canUse && pathname === "/dashboard" ? recommendations.dashboardAlerts ?? [] : [];

  useEffect(() => setMobileOpen(false), [pathname]);
  useEffect(() => {
    if (!mobileOpen) return;
    const frame = requestAnimationFrame(() => {
      sheetRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      sheetRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
      triggerRef.current?.focus();
    };
  }, [mobileOpen]);

  return (
    <>
      <aside className="orqena-context-rail" aria-label="Ayuda contextual de Orqena IA" data-collapsed={collapsed ? "true" : "false"} data-context-variant={pathname === "/dashboard" ? "dashboard" : undefined}>
        {collapsed ? <button type="button" className="orqena-context-expand" aria-label="Mostrar Orqena IA" onClick={onToggleCollapsed}><ChevronsRight size={18} aria-hidden="true" /><Sparkles size={18} aria-hidden="true" /><span>Orqena IA</span></button> : <RailContent context={context} titleId={`${titleId}-desktop`} recommendation={recommendation} dashboardAlerts={dashboardAlerts} canUse={canUse} canExecute={canExecute} isToday={pathname === "/hoy"} isDashboard={pathname === "/dashboard"} onToggleCollapsed={onToggleCollapsed} />}
      </aside>

      <button ref={triggerRef} type="button" className="orqena-context-trigger" aria-expanded={mobileOpen} aria-controls={`${titleId}-panel`} onClick={() => setMobileOpen(true)}>
        <Sparkles size={18} aria-hidden="true" /><span>Ayuda IA</span>
      </button>

      {mobileOpen ? (
        <aside ref={sheetRef} id={`${titleId}-panel`} className="orqena-context-sheet orqena-context-sheet--inline" role="region" aria-labelledby={`${titleId}-mobile`}>
          <button data-autofocus type="button" className="icon-button absolute right-4 top-4" aria-label="Cerrar ayuda contextual" onClick={() => setMobileOpen(false)}><X size={19} aria-hidden="true" /></button>
          <RailContent context={context} titleId={`${titleId}-mobile`} recommendation={recommendation} dashboardAlerts={dashboardAlerts} canUse={canUse} canExecute={canExecute} isToday={pathname === "/hoy"} isDashboard={pathname === "/dashboard"} />
        </aside>
      ) : null}
    </>
  );
}

function RailContent({ context, titleId, recommendation, dashboardAlerts, canUse, canExecute, isToday, isDashboard, onToggleCollapsed }: { context: RailContext; titleId: string; recommendation: TodayRailRecommendation | null; dashboardAlerts: TodayRailRecommendation[]; canUse: boolean; canExecute: boolean; isToday: boolean; isDashboard: boolean; onToggleCollapsed?: () => void }) {
  if (isDashboard) {
    return <DashboardRailContent context={context} titleId={titleId} recommendation={recommendation} alerts={dashboardAlerts} canUse={canUse} onToggleCollapsed={onToggleCollapsed} />;
  }
  const title = canUse ? recommendation?.title ?? context.title : "Orqena IA no disponible";
  const description = canUse ? recommendation?.description ?? context.description : "Esta ayuda permanece visible, pero tu plan o permisos actuales no autorizan el acceso a Orqena IA.";
  const source = recommendation?.source ?? context.source;
  const evidence = recommendation ? recommendation.evidence : [];
  const todayEvidence = isToday ? evidence.filter((item) => item.label !== "Confianza") : evidence;

  return (
    <div className="orqena-context-rail__inner">
      <header className="orqena-context-rail__header"><span className="orqena-context-rail__spark"><Sparkles size={17} aria-hidden="true" /></span><span>Orqena IA</span>{onToggleCollapsed ? <button type="button" className="orqena-context-collapse" aria-label="Ocultar Orqena IA" onClick={onToggleCollapsed}><ChevronsLeft size={18} aria-hidden="true" /></button> : null}</header>
      <p className="orqena-context-eyebrow">{context.eyebrow}</p>
      <div className="orqena-context-card" data-today={isToday ? "true" : "false"}>
        <span className="orqena-context-card__icon"><FileText size={22} aria-hidden="true" /><Sparkles className="orqena-context-card__spark" size={13} aria-hidden="true" /></span>
        <h2 id={titleId}>{title}</h2>
        <p className="orqena-context-description">{description}</p>
        {!isToday ? <p className="orqena-context-source"><strong>Origen</strong><span>{source}</span></p> : null}

        <dl className="orqena-context-impact">
          <div className="orqena-context-impact__title"><dt>Impacto estimado</dt>{!recommendation ? <dd>{!canUse ? "Acceso no autorizado" : "Sin recomendación activa"}</dd> : null}</div>
          {isToday ? <>
            {todayEvidence.filter((item) => item.label === "Probabilidad").map((item) => <div key={item.label}><dt>{item.label} de cierre</dt><dd>{item.value}</dd></div>)}
            {recommendation?.amount != null ? <div><dt>Importe</dt><dd>{formatCurrency(recommendation.amount, true)}</dd></div> : null}
            {todayEvidence.filter((item) => item.label !== "Probabilidad").map((item) => <div key={item.label}><dt>{item.label === "Ciclo" ? "Ciclo de venta" : item.label}</dt><dd>{item.value}</dd></div>)}
          </> : <>
            {recommendation?.amount != null ? <div><dt>Importe</dt><dd>{formatCurrency(recommendation.amount)}</dd></div> : null}
            {recommendation?.dueAt ? <div><dt>Vencimiento</dt><dd>{formatDate(recommendation.dueAt)}</dd></div> : null}
            {evidence.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
          </>}
          {!recommendation ? <>
            <div><dt>Estado</dt><dd>Sin cambios aplicados</dd></div>
            <div><dt>Confianza</dt><dd>Sin señal activa</dd></div>
            <div><dt>Control</dt><dd>Revisión humana</dd></div>
          </> : null}
        </dl>

        <div className="orqena-context-safeguard"><ShieldCheck size={17} aria-hidden="true" /><p>La recomendación no ejecuta cambios por sí sola. Tu equipo revisa y confirma cada acción.</p></div>

        {!canUse ? <span aria-disabled="true" className="orqena-context-primary orqena-context-primary--disabled">No disponible en tu acceso</span> : recommendation && canExecute && isToday ? <TodayRecommendationControls recommendation={recommendation} /> : isToday && !recommendation ? <NoRecommendationControls /> : (
          <Link href={recommendation?.href ?? context.href} className="orqena-context-primary">{recommendation ? "Abrir origen" : context.next}<ChevronRight size={16} aria-hidden="true" /></Link>
        )}
      </div>
      {canUse ? <Link href="/recomendaciones" className="orqena-context-more">Ver todas las recomendaciones <ExternalLink size={13} aria-hidden="true" /></Link> : null}
    </div>
  );
}

function DashboardRailContent({ context, titleId, recommendation, alerts, canUse, onToggleCollapsed }: { context: RailContext; titleId: string; recommendation: TodayRailRecommendation | null; alerts: TodayRailRecommendation[]; canUse: boolean; onToggleCollapsed?: () => void }) {
  const title = canUse ? recommendation?.title ?? "Sin recomendación financiera activa" : "Orqena IA no disponible";
  const description = canUse ? recommendation?.description ?? "No hay una señal financiera activa dentro de tu alcance. El Dashboard seguirá mostrando únicamente datos registrados." : "Tu plan o permisos actuales no autorizan recomendaciones de Orqena IA.";
  return <div className="orqena-context-rail__inner">
    <header className="orqena-context-rail__header"><span className="orqena-context-rail__spark"><Sparkles size={17} aria-hidden="true" /></span><span>Orqena IA</span>{onToggleCollapsed ? <button type="button" className="orqena-context-collapse" aria-label="Ocultar Orqena IA" onClick={onToggleCollapsed}><ChevronsLeft size={18} aria-hidden="true" /></button> : null}</header>
    <p className="orqena-context-eyebrow">Recomendación para ti</p>
    <article className="orqena-context-card dashboard-rail-recommendation" data-dashboard-ai-recommendation>
      <span className="orqena-context-card__icon"><FileText size={22} aria-hidden="true" /><Sparkles className="orqena-context-card__spark" size={13} aria-hidden="true" /></span>
      <h2 id={titleId}>{title}</h2>
      <p className="orqena-context-description">{description}</p>
      {canUse ? <Link href={recommendation?.href ?? context.href} className="orqena-context-primary">Ver detalle</Link> : <span aria-disabled="true" className="orqena-context-primary orqena-context-primary--disabled">No disponible en tu acceso</span>}
    </article>
    <section className="dashboard-rail-alerts" aria-labelledby={`${titleId}-alerts`} data-dashboard-financial-alerts>
      <h2 id={`${titleId}-alerts`}>Alertas financieras</h2>
      {alerts.length ? <ul>{alerts.map((alert, index) => <li key={alert.fingerprint} data-dashboard-financial-alert>
        <Link href={alert.href}>
          <span className="dashboard-rail-alert-icon" data-tone={index === 0 ? "risk" : index === 1 ? "attention" : "info"}>{index === 0 ? <TriangleAlert size={16} aria-hidden="true" /> : index === 1 ? <CircleAlert size={16} aria-hidden="true" /> : <Info size={16} aria-hidden="true" />}</span>
          <span><strong>{alert.title}</strong><small>{alert.description}</small></span>
        </Link>
      </li>)}</ul> : <p className="dashboard-rail-empty">No hay alertas financieras activas dentro de tu alcance.</p>}
    </section>
    {canUse ? <Link href="/recomendaciones" className="orqena-context-more">Ver todas las recomendaciones <ExternalLink size={13} aria-hidden="true" /></Link> : null}
  </div>;
}

function NoRecommendationControls() {
  return <div className="orqena-context-controls">
    <button type="button" className="orqena-context-primary orqena-context-primary--disabled" disabled title="No hay una recomendación activa">Confirmar acción</button>
    <button type="button" className="orqena-context-secondary" disabled title="No hay una recomendación activa">Descartar</button>
  </div>;
}

function TodayRecommendationControls({ recommendation }: { recommendation: TodayRailRecommendation }) {
  return <div className="orqena-context-controls">
    <form action={acceptTodayRecommendationAction}>
      <input type="hidden" name="fingerprint" value={recommendation.fingerprint} />
      {recommendation.preferredActionId ? <input type="hidden" name="actionId" value={recommendation.preferredActionId} /> : null}
      <input type="hidden" name="confirmed" value="true" />
      <SubmitButton className="orqena-context-primary" pending="Confirmando…">Confirmar acción<ChevronRight size={16} aria-hidden="true" /></SubmitButton>
    </form>
    <form action={dismissTodayRecommendationAction}>
      <input type="hidden" name="fingerprint" value={recommendation.fingerprint} />
      <input type="hidden" name="reason" value="Descartada desde Hoy" />
      <SubmitButton className="orqena-context-secondary" pending="Descartando…">Descartar</SubmitButton>
    </form>
  </div>;
}

function SubmitButton({ children, pending, className }: { children: React.ReactNode; pending: string; className: string }) {
  const status = useFormStatus();
  return <button type="submit" className={className} disabled={status.pending}>{status.pending ? pending : children}</button>;
}

function formatCurrency(value: number, exact = false) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: exact ? 2 : 0, maximumFractionDigits: exact ? 2 : 0 }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" }).format(new Date(value));
}
