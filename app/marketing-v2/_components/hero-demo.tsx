"use client";

import {
  ArrowRight,
  Bot,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  FileText,
  LayoutDashboard,
  ReceiptText,
  ShieldCheck,
  TrendingUp,
  Users,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState, type KeyboardEvent } from "react";
import styles from "../page.module.css";
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

const workspaceCopy: Record<WorkspaceId, { title: string; detail: string; status: string }> = {
  hoy: { title: "Tu empresa, hoy", detail: "5 prioridades ordenadas", status: "Todo conectado" },
  clientes: { title: "Clientes activos", detail: "3 seguimientos para hoy", status: "Ventas al día" },
  trabajo: { title: "Trabajo en marcha", detail: "4 obras sin bloqueos", status: "Equipo coordinado" },
  dinero: { title: "Control económico", detail: "Margen previsto del 28 %", status: "Caja visible" },
  ia: { title: `${brand.productName} IA`, detail: "2 propuestas para revisar", status: "Confirmación humana" },
};

export function HeroDemo() {
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceId>("hoy");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const active = workspaceCopy[activeWorkspace];

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
            <Link
              className={styles.primaryAction}
              href="/contacto?motivo=demo"
              onClick={() => trackPublicFunnel("funnel.hero_cta", { target: "access_request" })}
            >
              Solicitar demo <ArrowRight aria-hidden="true" />
            </Link>
            <Link
              className={styles.secondaryAction}
              href="#como-funciona"
              onClick={() => trackPublicFunnel("funnel.hero_cta", { target: "how_it_works" })}
            >
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
                <button
                  key={id}
                  ref={(element) => { tabRefs.current[index] = element; }}
                  id={`workspace-tab-${id}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls="workspace-panel"
                  tabIndex={selected ? 0 : -1}
                  onClick={() => selectTab(index)}
                  onKeyDown={(event) => handleTabKey(event, index)}
                >
                  <Icon aria-hidden="true" /><span>{label}</span>
                </button>
              );
            })}
          </div>

          <div id="workspace-panel" role="tabpanel" aria-labelledby={`workspace-tab-${activeWorkspace}`} className={styles.productFrame}>
            <aside className={styles.productSidebar} aria-hidden="true">
              <span className={styles.productBrand}><BrandMark /></span>
              {[LayoutDashboard, Users, BriefcaseBusiness, ReceiptText, CircleDollarSign].map((Icon, index) => (
                <span key={index} data-active={index === 0}><Icon /></span>
              ))}
            </aside>

            <div className={styles.productWorkspace}>
              <div className={styles.productTopbar}>
                <div><span>Buenos días, Toni</span><strong>{active.title}</strong></div>
                <span>{active.status}</span>
              </div>

              <div className={styles.metricGrid}>
                <Metric icon={TrendingUp} label="Ingresos" value="48.260 €" delta="+12,4 %" />
                <Metric icon={CircleDollarSign} label="Gastos" value="31.840 €" delta="Controlados" />
                <Metric icon={WalletCards} label="Beneficio" value="16.420 €" delta="Margen 28 %" />
                <Metric icon={ReceiptText} label="Pendiente" value="8.750 €" delta="4 facturas" />
              </div>

              <div className={styles.productMainGrid}>
                <section className={styles.revenueCard} aria-label="Evolución de ingresos y gastos de ejemplo">
                  <div><span>Evolución del negocio</span><strong>Últimos 6 meses</strong></div>
                  <div className={styles.revenueChart}>
                    {[44, 62, 53, 72, 66, 86].map((height, index) => (
                      <span key={index}><i style={{ height: `${height}%` }} /><b style={{ height: `${Math.max(20, height - 22)}%` }} /></span>
                    ))}
                  </div>
                  <div className={styles.chartLegend}><span>Ingresos</span><span>Gastos</span></div>
                </section>

                <section className={styles.activityCard} aria-label="Actividad reciente de ejemplo">
                  <div><span>Actividad reciente</span><strong>{active.detail}</strong></div>
                  <ul>
                    <li><FileText /><span><strong>Presupuesto PR-104</strong><small>Listo para revisar</small></span><ChevronRight /></li>
                    <li><Building2 /><span><strong>Obra Costa Norte</strong><small>Avance actualizado</small></span><ChevronRight /></li>
                    <li><ReceiptText /><span><strong>Factura F-2031</strong><small>Cobro previsto mañana</small></span><ChevronRight /></li>
                  </ul>
                </section>
              </div>

              <div className={styles.aiRecommendation}>
                <span><Bot aria-hidden="true" /></span>
                <div><strong>{brand.productName} IA ha preparado una recomendación</strong><p>Revisa el margen de la obra Costa Norte antes de confirmar la siguiente compra.</p></div>
                <button type="button">Revisar</button>
              </div>
            </div>
          </div>

          <div className={styles.productPhone} aria-hidden="true">
            <div><span>9:41</span><strong>Capataz</strong></div>
            <p>Hola, Toni</p>
            <h2>¿Qué necesitas hacer?</h2>
            <ul>
              <li><BriefcaseBusiness />Añadir avance</li>
              <li><ReceiptText />Escanear factura</li>
              <li><Bot />Hablar con Capataz</li>
            </ul>
            <span className={styles.phoneAction}>+</span>
          </div>
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

function Metric({ icon: Icon, label, value, delta }: { icon: LucideIcon; label: string; value: string; delta: string }) {
  return (
    <article className={styles.metricCard}>
      <div><span><Icon aria-hidden="true" /></span><small>{label}</small></div>
      <strong>{value}</strong>
      <em>{delta}</em>
    </article>
  );
}
