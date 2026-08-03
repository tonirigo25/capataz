"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bot, BriefcaseBusiness, Calculator, FileCheck2, Landmark, ShieldCheck, Users, WalletCards } from "lucide-react";
import { comparisonGroups, priceFor, pricingPlans, recommendPlan, type BillingInterval } from "@/lib/marketing/pricing-catalog";
import styles from "./r4-pages.module.css";

const productAreas = [
  { key: "clientes", label: "Clientes", title: "Oportunidades que conservan su historia", text: "Contacto, visita, seguimiento y presupuesto siguen conectados.", icon: Users, metrics: [["Activos", "28"], ["Oportunidades", "12"], ["Por seguir", "7"]], items: ["Reforma Oficina Centro · propuesta lista", "Grupo Norte Demo · visita mañana", "Marta Ruiz · seguimiento pendiente"] },
  { key: "trabajo", label: "Trabajo", title: "Obras y servicios con un siguiente paso", text: "Hitos, equipo, agenda e incidencias dentro del trabajo correcto.", icon: BriefcaseBusiness, metrics: [["En curso", "8"], ["Avance medio", "67 %"], ["Bloqueos", "2"]], items: ["Instalación completada", "Material pendiente de llegada", "Revisión de acabados el viernes"] },
  { key: "dinero", label: "Dinero", title: "Margen, vencimientos y caja explicables", text: "Cobros y pagos parten de documentos y trabajos relacionados.", icon: WalletCards, metrics: [["Cobrado", "31.800 €"], ["Pendiente", "6.400 €"], ["Margen", "27,6 %"]], items: ["Cobro parcial conciliado", "Factura vence en 4 días", "Coste de material asociado"] },
  { key: "documentos", label: "Documentos", title: "Cada archivo termina en su contexto", text: "La extracción propone; una persona revisa y confirma.", icon: FileCheck2, metrics: [["Recibidos", "24"], ["Revisados", "19"], ["Con dudas", "5"]], items: ["Factura preparada para revisar", "Albarán relacionado con compra", "Importe pendiente de confirmar"] },
  { key: "ia", label: "Orqena IA", title: "Asistencia que muestra fuentes y efecto", text: "Borradores y recomendaciones permanecen bajo control humano.", icon: Bot, metrics: [["Sugerencias", "6"], ["Por revisar", "3"], ["Confirmadas", "2"]], items: ["Seguimiento preparado", "Riesgo de vencimiento explicado", "Cambio descartado sin tocar datos"] },
  { key: "equipo", label: "Equipo", title: "Responsabilidad, agenda y permisos claros", text: "Cada persona ve el trabajo que necesita para avanzar.", icon: Users, metrics: [["Personas", "5"], ["Tareas hoy", "11"], ["Completadas", "7"]], items: ["Visita asignada a Marta Ruiz", "Agenda actualizada", "Responsable de hito confirmado"] },
  { key: "seguridad", label: "Seguridad", title: "Aislamiento y trazabilidad por diseño", text: "Empresa activa, rol y confirmación protegen cada operación.", icon: ShieldCheck, metrics: [["Accesos", "Controlados"], ["Cambios", "Trazables"], ["Datos", "Aislados"]], items: ["Permiso comprobado en servidor", "Acción sensible pendiente de confirmar", "Actividad registrada sin contenido sensible"] },
] as const;

export function ProductTour() {
  const [active, setActive] = useState<(typeof productAreas)[number]["key"]>(productAreas[0].key);
  const area = productAreas.find((item) => item.key === active) ?? productAreas[0];
  const Icon = area.icon;
  return (
    <div className={styles.tour}>
      <div className={styles.tourTabs} role="tablist" aria-label="Áreas de Orqena">{productAreas.map((item) => <button key={item.key} type="button" role="tab" aria-selected={item.key === active} onClick={() => setActive(item.key)}>{item.label}</button>)}</div>
      <div className={styles.tourPanel} role="tabpanel" aria-live="polite">
        <div className={styles.tourCopy}><Icon aria-hidden="true" /><p className={styles.eyebrow}>{area.label}</p><h3>{area.title}</h3><p>{area.text}</p><Link href={productAreaHref(area.key)}>Explorar esta área<ArrowRight aria-hidden="true" /></Link></div>
        <div className={styles.tourUi}><header><span>ORQENA</span><em>Datos sintéticos</em></header><div>{area.metrics.map(([label, value]) => <article key={label}><small>{label}</small><strong>{value}</strong></article>)}</div><ul>{area.items.map((item, index) => <li key={item}><i>{index + 1}</i><span>{item}</span><b>{index === 0 ? "Revisar" : "Ver"}</b></li>)}</ul></div>
      </div>
    </div>
  );
}

function productAreaHref(key: (typeof productAreas)[number]["key"]) {
  if (key === "ia") return "/producto/orqena";
  if (key === "dinero") return "/producto/finanzas";
  if (key === "seguridad") return "/seguridad";
  return `/producto/${key}`;
}

export function PricingExplorer() {
  const [interval, setInterval] = useState<BillingInterval>("monthly");
  const [team, setTeam] = useState(2);
  const [useAi, setUseAi] = useState(false);
  const [volume, setVolume] = useState<"normal" | "high">("normal");
  const recommendationKey = recommendPlan({ teamSize: team, needsAi: useAi, workload: volume === "high" ? "high" : "standard" });
  const recommendation = pricingPlans.find((plan) => plan.key === recommendationKey) ?? pricingPlans[0];
  return (
    <>
      <div className={styles.priceToggle} role="group" aria-label="Periodicidad"><button type="button" aria-pressed={interval === "monthly"} onClick={() => setInterval("monthly")}>Mensual</button><button type="button" aria-pressed={interval === "annual"} onClick={() => setInterval("annual")}>Anual <span>Dos meses incluidos</span></button></div>
      <div className={styles.planGrid}>{pricingPlans.map((plan) => { const amount = priceFor(plan, interval); return <article key={plan.key} data-featured={plan.key === "professional" || undefined}><header><p className={styles.eyebrow}>{plan.key === "professional" ? "Más equilibrado" : "Plan"}</p><h2>{plan.name}</h2><p>{plan.audience}</p></header><div className={styles.price}><strong>{amount.toLocaleString("es-ES")} €</strong><span>+ IVA / {interval === "monthly" ? "mes" : "año"}</span></div><dl><div><dt>Usuarios</dt><dd>{plan.users}</dd></div><div><dt>Operaciones IA</dt><dd>{plan.aiOperations ? `${plan.aiOperations.toLocaleString("es-ES")}/mes` : "No incluidas"}</dd></div></dl><ul>{plan.features.map((feature) => <li key={feature}><ShieldCheck aria-hidden="true" />{feature}</li>)}</ul><Link href={`/contacto?motivo=acceso&plan=${plan.key}`}>Solicitar acceso<ArrowRight aria-hidden="true" /></Link></article>; })}</div>
      <div className={styles.recommender}>
        <div><p className={styles.eyebrow}>RECOMENDADOR NO TRANSACCIONAL</p><h2>Encuentra un punto de partida.</h2><p>La recomendación orienta la conversación. No crea una compra ni una suscripción.</p></div>
        <form onSubmit={(event) => event.preventDefault()}><label>Personas que usarán Orqena<input type="range" min="1" max="20" value={team} onChange={(event) => setTeam(Number(event.target.value))} /><strong>{team}</strong></label><label className={styles.check}><input type="checkbox" checked={useAi} onChange={(event) => setUseAi(event.target.checked)} />Necesitamos asistencia de Orqena IA</label><label>Volumen de trabajos y documentos<select value={volume} onChange={(event) => setVolume(event.target.value as "normal" | "high")}><option value="normal">Normal</option><option value="high">Alto</option></select></label></form>
        <aside><span>Recomendación orientativa</span><strong>{recommendation.name}</strong><p>{recommendation.outcome}</p><Link href={`/contacto?motivo=acceso&plan=${recommendation.key}`}>Comentar esta opción<ArrowRight aria-hidden="true" /></Link></aside>
      </div>
    </>
  );
}

export function PriceComparison() {
  const rows: Array<readonly [string, string, string, string]> = [];
  comparisonGroups.forEach((group) => group.rows.forEach((row) => rows.push(row)));
  return <div className={styles.comparison} role="region" aria-label="Comparación de planes" tabIndex={0}><table><thead><tr><th>Capacidad</th><th>Starter</th><th>Professional</th><th>Business</th></tr></thead><tbody>{rows.map(([label, ...values]) => <tr key={label}><th>{label}</th>{values.map((value, index) => <td key={`${label}-${index}`}>{value}</td>)}</tr>)}</tbody></table></div>;
}

export function ResourceCalculators() {
  const [revenue, setRevenue] = useState(30000); const [cost, setCost] = useState(21000);
  const [cash, setCash] = useState(12000); const [inflow, setInflow] = useState(18000); const [outflow, setOutflow] = useState(15500);
  const margin = revenue - cost; const marginPercent = revenue > 0 ? (margin / revenue) * 100 : 0;
  const cashSeries = useMemo(() => Array.from({ length: 4 }, (_, index) => cash + (inflow - outflow) * (index + 1)), [cash, inflow, outflow]);
  return <div className={styles.toolGrid}>
    <article id="calculadora-margen"><header><Calculator aria-hidden="true" /><div><span>Calculadora</span><h3>Margen de trabajo</h3></div></header><label>Ingreso previsto (€)<input type="number" min="0" value={revenue} onChange={(event) => setRevenue(Math.max(0, Number(event.target.value) || 0))} /></label><label>Costes previstos (€)<input type="number" min="0" value={cost} onChange={(event) => setCost(Math.max(0, Number(event.target.value) || 0))} /></label><div className={styles.toolResult}><span>Margen orientativo</span><strong>{money(margin)} · {number(marginPercent)} %</strong><i style={{ width: `${Math.min(100, Math.max(0, marginPercent))}%` }} /></div><p>Resultado aritmético con los importes introducidos. No es una previsión.</p><Link href="/recursos/calculadora-margen-obra">Abrir calculadora completa<ArrowRight aria-hidden="true" /></Link></article>
    <article id="simulador-caja"><header><Landmark aria-hidden="true" /><div><span>Simulador</span><h3>Caja a cuatro meses</h3></div></header><label>Saldo inicial (€)<input type="number" value={cash} onChange={(event) => setCash(Number(event.target.value) || 0)} /></label><div className={styles.twoFields}><label>Entradas/mes<input type="number" min="0" value={inflow} onChange={(event) => setInflow(Math.max(0, Number(event.target.value) || 0))} /></label><label>Salidas/mes<input type="number" min="0" value={outflow} onChange={(event) => setOutflow(Math.max(0, Number(event.target.value) || 0))} /></label></div><div className={styles.cashChart}>{cashSeries.map((value, index) => <span key={index}><i style={{ height: `${Math.max(8, Math.min(100, 28 + value / 500))}%` }} data-negative={value < 0 || undefined} /><small>M{index + 1}</small><b>{money(value)}</b></span>)}</div><p>Escenario lineal sin impuestos, financiación ni variaciones futuras.</p></article>
  </div>;
}

function money(value: number) { return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value); }
function number(value: number) { return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(value); }
