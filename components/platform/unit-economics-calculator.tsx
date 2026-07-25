"use client";

import { useMemo, useState } from "react";
import { calculateUnitEconomics, unitEconomicsScenarios, type UnitEconomicsInput } from "@/lib/commercial/unit-economics";

export function UnitEconomicsCalculator() {
  const [scenario, setScenario] = useState<keyof typeof unitEconomicsScenarios>("professional");
  const [input, setInput] = useState<UnitEconomicsInput>(unitEconomicsScenarios.professional);
  const result = useMemo(() => calculateUnitEconomics(input), [input]);
  const update = (key: keyof UnitEconomicsInput, value: number) => setInput((current) => ({ ...current, [key]: value }));
  const changeScenario = (value: keyof typeof unitEconomicsScenarios) => { setScenario(value); setInput(unitEconomicsScenarios[value]); };
  const fields: Array<[keyof UnitEconomicsInput, string, number]> = [
    ["infrastructureBase", "Infraestructura base", 1], ["users", "Usuarios", 1], ["costPerUser", "Coste por usuario", .1],
    ["storageGb", "Almacenamiento GB", 1], ["documents", "Documentos", 10], ["inputTokens", "Input tokens", 100000],
    ["outputTokens", "Output tokens", 100000], ["transcriptionMinutes", "Transcripción min", 10], ["supportHours", "Soporte horas", .5],
    ["targetMargin", "Margen objetivo", .01], ["contingency", "Contingencia", .01], ["includedAiActions", "Allowance IA", 10],
  ];
  return (
    <section className="card mt-8 p-5" aria-labelledby="unit-economics-title">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="type-label">Solo PLATFORM_OWNER</p><h2 id="unit-economics-title" className="type-section-title mt-1">Escenarios internos de unit economics</h2><p className="type-secondary mt-1">Herramienta de decisión. Nunca publica precios.</p></div><label className="field-label">Escenario<select className="field mt-1" value={scenario} onChange={(event) => changeScenario(event.target.value as keyof typeof unitEconomicsScenarios)}><option value="initial">Inicial</option><option value="professional">Profesional</option><option value="business">Empresa</option></select></label></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{fields.map(([key, label, step]) => <label key={key} className="field-label">{label}<input className="field mt-1" type="number" min="0" step={step} value={input[key]} onChange={(event) => update(key, Number(event.target.value))} /></label>)}</div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[
        ["Coste estimado/empresa", result.estimatedCompanyCost], ["Margen estimado", result.estimatedMargin], ["Precio mínimo recomendado", result.priceMinimum], ["Recarga por acción", result.overagePrice],
      ].map(([label, value]) => <article className="rounded-xl bg-subtle p-4" key={label as string}><small className="type-meta">{label as string}</small><strong className="mt-1 block text-lg tabular-nums">{Number(value).toLocaleString("es-ES", { style: "currency", currency: "EUR" })}</strong></article>)}</div>
    </section>
  );
}
