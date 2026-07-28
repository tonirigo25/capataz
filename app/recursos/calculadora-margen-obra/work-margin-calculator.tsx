"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { trackPublicFunnel } from "@/lib/product/public-analytics";

export function WorkMarginCalculator() {
  const [income, setIncome] = useState(30_000);
  const [directCost, setDirectCost] = useState(18_000);
  const [hours, setHours] = useState(280);
  const [hourlyCost, setHourlyCost] = useState(22);
  const [contingency, setContingency] = useState(5);
  const tracked = useRef(false);
  const result = useMemo(() => {
    const labor = hours * hourlyCost;
    const risk = income * contingency / 100;
    const totalCost = directCost + labor + risk;
    const margin = income - totalCost;
    return { labor, risk, totalCost, margin, percentage: income > 0 ? margin / income * 100 : 0 };
  }, [contingency, directCost, hourlyCost, hours, income]);
  const markUsed = () => {
    if (tracked.current) return;
    tracked.current = true;
    trackPublicFunnel("funnel.resource_used", { resource: "work_margin_calculator" });
  };

  return <section className="marketing-container py-14 lg:py-20" onChange={markUsed}>
    <p className="marketing-eyebrow">Recurso editable · no guarda datos</p>
    <h1 className="marketing-display mt-4 max-w-5xl">Calculadora de margen de obra</h1>
    <p className="marketing-lede mt-5 max-w-3xl">Introduce tus hipótesis para detectar costes omitidos. El resultado es aritmético, no una previsión ni un resultado de cliente.</p>
    <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_.8fr]">
      <form className="card grid gap-5 p-6" onSubmit={(event) => event.preventDefault()}>
        <NumberField label="Ingreso previsto sin IVA (€)" value={income} onChange={setIncome} max={10_000_000} />
        <NumberField label="Materiales, subcontratas y otros costes directos (€)" value={directCost} onChange={setDirectCost} max={10_000_000} />
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField label="Horas internas previstas" value={hours} onChange={setHours} max={100_000} />
          <NumberField label="Coste interno por hora (€)" value={hourlyCost} onChange={setHourlyCost} max={1_000} />
        </div>
        <NumberField label="Contingencia sobre ingreso (%)" value={contingency} onChange={setContingency} max={100} />
      </form>
      <aside className="card grid content-start gap-4 bg-content p-6 text-surface">
        <p className="text-sm font-bold uppercase tracking-widest text-brand-soft">Resultado hipotético</p>
        <Result label="Coste de horas" value={money(result.labor)} />
        <Result label="Contingencia" value={money(result.risk)} />
        <Result label="Coste total estimado" value={money(result.totalCost)} />
        <Result label="Margen estimado" value={`${money(result.margin)} · ${number(result.percentage)} %`} />
        <p className="text-sm leading-6 text-surface/75">No incluye IVA, financiación, desviaciones futuras, cobro efectivo ni costes no introducidos. Un margen positivo no demuestra rentabilidad final.</p>
      </aside>
    </div>
    <details className="mt-8 border-y border-border py-5">
      <summary className="cursor-pointer font-bold">Metodología y exclusiones</summary>
      <p className="mt-3 max-w-4xl text-sm leading-6 text-content-secondary">Coste total = costes directos + horas × coste/hora + ingreso × contingencia. Margen = ingreso − coste total. Contrasta las hipótesis con documentos reales y revisión profesional antes de tomar una decisión.</p>
    </details>
    <PersistentCta resource="work_margin_calculator" />
  </section>;
}

function NumberField({ label, value, onChange, max }: { label: string; value: number; onChange: (value: number) => void; max: number }) {
  return <label className="marketing-field"><span>{label}</span><input type="number" min="0" max={max} step="0.01" value={value} onChange={(event) => onChange(Math.min(max, Math.max(0, Number(event.target.value) || 0)))} /></label>;
}
function Result({ label, value }: { label: string; value: string }) { return <div className="border-t border-surface/20 pt-4"><p className="text-sm text-surface/70">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div>; }
function PersistentCta({ resource }: { resource: "work_margin_calculator" }) {
  return <div className="sticky bottom-4 z-20 mt-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-content bg-surface-raised p-4 shadow-xl"><p className="font-bold">¿Quieres revisar este flujo con tus datos, sin importarlos todavía?</p><Link className="marketing-button" href="/contacto?source=margin-calculator" onClick={() => trackPublicFunnel("funnel.resource_cta", { resource, target: "contact" })}>Solicitar una revisión</Link></div>;
}
function money(value: number) { return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value); }
function number(value: number) { return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(value); }
