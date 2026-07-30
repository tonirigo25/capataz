"use client";

import { useId, useState, type CSSProperties, type KeyboardEvent } from "react";
import styles from "./public-home.module.css";

export type ProductChartKind = "today" | "clients" | "work" | "money" | "ai";

type ChartDatum = {
  label: string;
  primary: number;
  secondary?: number;
  note: string;
};

const charts: Record<ProductChartKind, {
  title: string;
  unit: string;
  primaryLabel: string;
  secondaryLabel?: string;
  data: readonly ChartDatum[];
}> = {
  today: {
    title: "Ingresos y gastos de las últimas siete semanas",
    unit: "k€",
    primaryLabel: "Ingresos",
    secondaryLabel: "Gastos",
    data: [
      { label: "S1", primary: 34, secondary: 23, note: "+11 k€" },
      { label: "S2", primary: 41, secondary: 28, note: "+13 k€" },
      { label: "S3", primary: 38, secondary: 30, note: "+8 k€" },
      { label: "S4", primary: 47, secondary: 32, note: "+15 k€" },
      { label: "S5", primary: 44, secondary: 31, note: "+13 k€" },
      { label: "S6", primary: 52, secondary: 36, note: "+16 k€" },
      { label: "Hoy", primary: 48, secondary: 32, note: "+16 k€" },
    ],
  },
  clients: {
    title: "Conversión del pipeline comercial",
    unit: "%",
    primaryLabel: "Conversión",
    data: [
      { label: "Nuevo", primary: 100, note: "5 oportunidades" },
      { label: "Visita", primary: 78, note: "4 oportunidades" },
      { label: "Propuesta", primary: 56, note: "3 oportunidades" },
      { label: "Decisión", primary: 34, note: "2 oportunidades" },
    ],
  },
  work: {
    title: "Avance y carga de equipo por obra",
    unit: "%",
    primaryLabel: "Avance",
    secondaryLabel: "Carga",
    data: [
      { label: "Costa", primary: 78, secondary: 82, note: "En plazo" },
      { label: "Centro", primary: 64, secondary: 91, note: "Carga alta" },
      { label: "Albor", primary: 42, secondary: 58, note: "En plazo" },
      { label: "Medina", primary: 31, secondary: 46, note: "Preparación" },
    ],
  },
  money: {
    title: "Entradas, salidas y saldo proyectado",
    unit: "k€",
    primaryLabel: "Entradas",
    secondaryLabel: "Salidas",
    data: [
      { label: "S1", primary: 58, secondary: 32, note: "Saldo 88 k€" },
      { label: "S2", primary: 34, secondary: 49, note: "Saldo 73 k€" },
      { label: "S3", primary: 72, secondary: 38, note: "Saldo 107 k€" },
      { label: "S4", primary: 45, secondary: 57, note: "Saldo 95 k€" },
      { label: "S5", primary: 66, secondary: 42, note: "Saldo 119 k€" },
      { label: "S6", primary: 51, secondary: 46, note: "Saldo 124 k€" },
    ],
  },
  ai: {
    title: "Impacto estimado y confianza de las recomendaciones",
    unit: "h",
    primaryLabel: "Impacto potencial",
    secondaryLabel: "Confianza",
    data: [
      { label: "Compras", primary: 4.2, secondary: 86, note: "480 € potenciales" },
      { label: "Cobros", primary: 2.8, secondary: 92, note: "2 seguimientos" },
      { label: "Agenda", primary: 1.6, secondary: 78, note: "3 tareas agrupadas" },
      { label: "Docs", primary: 3.4, secondary: 95, note: "4 borradores" },
    ],
  },
};

export function InteractiveProductChart({ kind }: { kind: ProductChartKind }) {
  const chart = charts[kind];
  const [activeIndex, setActiveIndex] = useState(chart.data.length - 1);
  const descriptionId = useId();
  const active = chart.data[activeIndex] ?? chart.data[0];

  const activate = (index: number) => setActiveIndex(Math.max(0, Math.min(chart.data.length - 1, index)));
  const handleKey = (event: KeyboardEvent<SVGElement>, index: number) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft" && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    if (event.key === "Home") return activate(0);
    if (event.key === "End") return activate(chart.data.length - 1);
    activate(index + (event.key === "ArrowRight" ? 1 : -1));
  };

  return (
    <div className={styles.professionalChart} data-kind={kind}>
      <svg viewBox="0 0 560 190" role="img" aria-labelledby={`${descriptionId}-title ${descriptionId}-desc`}>
        <title id={`${descriptionId}-title`}>{chart.title}</title>
        <desc id={`${descriptionId}-desc`}>Gráfico interactivo. Usa las flechas para recorrer los datos y leer su alternativa textual.</desc>
        <ChartGrid />
        {kind === "clients" ? <FunnelSeries data={chart.data} activeIndex={activeIndex} activate={activate} onKey={handleKey} /> : null}
        {kind === "today" ? <LineSeries data={chart.data} activeIndex={activeIndex} activate={activate} onKey={handleKey} /> : null}
        {kind === "work" || kind === "money" || kind === "ai" ? <BarSeries kind={kind} data={chart.data} activeIndex={activeIndex} activate={activate} onKey={handleKey} /> : null}
      </svg>
      <div className={styles.chartReadout} role="status" aria-live="polite">
        <span><strong>{active.label}</strong><small>{chart.primaryLabel}: {active.primary}{chart.unit}</small></span>
        {active.secondary !== undefined ? <span><strong>{chart.secondaryLabel}</strong><small>{active.secondary}{kind === "ai" || kind === "work" ? "%" : chart.unit}</small></span> : null}
        <em>{active.note}</em>
      </div>
      <div className={styles.chartLegend} aria-hidden="true">
        <span data-series="primary">{chart.primaryLabel}</span>
        {chart.secondaryLabel ? <span data-series="secondary">{chart.secondaryLabel}</span> : null}
        <strong>Interactivo</strong>
      </div>
    </div>
  );
}

function ChartGrid() {
  return <g className={styles.chartGrid} aria-hidden="true">{[30, 70, 110, 150].map((y) => <line key={y} x1="18" x2="542" y1={y} y2={y} />)}</g>;
}

type SeriesProps = {
  data: readonly ChartDatum[];
  activeIndex: number;
  activate: (index: number) => void;
  onKey: (event: KeyboardEvent<SVGElement>, index: number) => void;
};

function LineSeries({ data, activeIndex, activate, onKey }: SeriesProps) {
  const primary = points(data.map((item) => item.primary), 560, 190, 56);
  const secondary = points(data.map((item) => item.secondary ?? 0), 560, 190, 56);
  return (
    <g>
      <path className={styles.chartArea} d={`${linePath(primary)} L ${primary.at(-1)?.x ?? 0} 160 L ${primary[0]?.x ?? 0} 160 Z`} />
      <path className={styles.chartLine} d={linePath(primary)} />
      <path className={styles.chartLineSecondary} d={linePath(secondary)} />
      {primary.map((point, index) => <ChartPoint key={data[index]?.label} point={point} label={`${data[index]?.label}: ${data[index]?.primary} k€`} active={activeIndex === index} onActivate={() => activate(index)} onKey={(event) => onKey(event, index)} />)}
      {data.map((item, index) => <text key={item.label} x={primary[index]?.x} y="180" textAnchor="middle">{item.label}</text>)}
    </g>
  );
}

function FunnelSeries({ data, activeIndex, activate, onKey }: SeriesProps) {
  return (
    <g className={styles.funnelSeries}>
      {data.map((item, index) => {
        const width = 420 * (item.primary / 100);
        const x = 70 + (420 - width) / 2;
        const y = 18 + index * 40;
        return (
          <g key={item.label} tabIndex={0} role="button" aria-label={`${item.label}: ${item.primary}% · ${item.note}`} data-active={activeIndex === index} onFocus={() => activate(index)} onMouseEnter={() => activate(index)} onKeyDown={(event) => onKey(event, index)}>
            <rect className={styles.funnelBar} x={x} y={y} width={width} height="27" rx="8" style={{ "--chart-delay": `${index * 70}ms` } as CSSProperties} />
            <text x="86" y={y + 18}>{item.label}</text><text x="474" y={y + 18} textAnchor="end">{item.primary}%</text>
          </g>
        );
      })}
    </g>
  );
}

function BarSeries({ kind, data, activeIndex, activate, onKey }: SeriesProps & { kind: "work" | "money" | "ai" }) {
  const maxPrimary = Math.max(...data.map((item) => item.primary), 1);
  const step = 500 / data.length;
  return (
    <g className={styles.barSeries}>
      {data.map((item, index) => {
        const height = 118 * (item.primary / maxPrimary);
        const secondaryHeight = item.secondary === undefined ? 0 : 118 * (item.secondary / 100);
        const x = 35 + index * step + step / 2;
        return (
          <g key={item.label} tabIndex={0} role="button" aria-label={`${item.label}: ${item.primary}${kind === "ai" ? " horas" : kind === "work" ? "%" : " k€"}; ${item.note}`} data-active={activeIndex === index} onFocus={() => activate(index)} onMouseEnter={() => activate(index)} onKeyDown={(event) => onKey(event, index)}>
            <rect className={styles.chartBar} x={x - 22} y={154 - height} width="20" height={height} rx="5" style={{ "--chart-delay": `${index * 65}ms` } as CSSProperties} />
            {item.secondary !== undefined ? <rect className={styles.chartBarSecondary} x={x + 4} y={154 - secondaryHeight} width="20" height={secondaryHeight} rx="5" style={{ "--chart-delay": `${index * 65 + 40}ms` } as CSSProperties} /> : null}
            <text x={x} y="178" textAnchor="middle">{item.label}</text>
          </g>
        );
      })}
    </g>
  );
}

function ChartPoint({ point, label, active, onActivate, onKey }: { point: Point; label: string; active: boolean; onActivate: () => void; onKey: (event: KeyboardEvent<SVGElement>) => void }) {
  return <circle className={styles.chartPoint} data-active={active} cx={point.x} cy={point.y} r={active ? 6 : 4} tabIndex={0} role="img" aria-label={label} onFocus={onActivate} onMouseEnter={onActivate} onKeyDown={onKey} />;
}

type Point = { x: number; y: number };

function points(values: readonly number[], width: number, height: number, max: number): Point[] {
  const usableWidth = width - 64;
  return values.map((value, index) => ({
    x: 32 + (usableWidth * index) / Math.max(1, values.length - 1),
    y: height - 38 - ((height - 72) * value) / max,
  }));
}

function linePath(series: readonly Point[]) {
  return series.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}
