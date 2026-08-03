"use client";

import { useState } from "react";
import Link from "next/link";
import type { DashboardOverview } from "@/lib/portal/dashboard-overview";

type Tooltip = { x: number; y: number; title: string; value: string } | null;

const money = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export function IncomeExpensesChart({ points }: { points: DashboardOverview["weeklyTrend"] }) {
  const [tooltip, setTooltip] = useState<Tooltip>(null);
  const width = 330;
  const height = 184;
  const plot = { left: 42, right: 16, top: 24, bottom: 34 };
  const values = points.flatMap((point) => [point.income, point.expenses]);
  const max = niceMax(Math.max(1, ...values));
  const x = (index: number) => plot.left + index * ((width - plot.left - plot.right) / Math.max(1, points.length - 1));
  const y = (value: number) => plot.top + (height - plot.top - plot.bottom) * (1 - value / max);
  const series = [
    { key: "income" as const, label: "Ingresos", color: "#55b665" },
    { key: "expenses" as const, label: "Gastos", color: "#f15868" },
  ];

  return (
    <ChartFrame tooltip={tooltip}>
      <div className="dashboard-chart-legend" aria-hidden="true">
        {series.map((item) => <span key={item.key}><i style={{ background: item.color }} />{item.label}</span>)}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="group" aria-label="Ingresos y gastos semanales" data-dashboard-chart-summary="income-expenses-weekly">
        <title>Ingresos vs. gastos por semana</title>
        <desc>Comparación de importes registrados durante las últimas ocho semanas.</desc>
        {Array.from({ length: 5 }, (_, index) => {
          const value = max * (1 - index / 4);
          const py = y(value);
          return <g key={index}><line x1={plot.left} x2={width - plot.right} y1={py} y2={py} className="dashboard-chart-grid" /><text x={plot.left - 8} y={py + 4} textAnchor="end" className="dashboard-chart-axis">{axisMoney(value)}</text></g>;
        })}
        {series.map((item) => {
          const path = points.map((point, index) => `${x(index)},${y(point[item.key])}`).join(" ");
          const lastPoint = points.at(-1);
          const lastIndex = Math.max(0, points.length - 1);
          return <g key={item.key}>
            <polyline points={path} fill="none" stroke={item.color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            {points.map((point, index) => <circle
              key={`${item.key}-${point.label}`}
              cx={x(index)} cy={y(point[item.key])} r="3.5"
              fill="#fff" stroke={item.color} strokeWidth="2"
              tabIndex={0}
              aria-label={`${item.label}, ${point.label}: ${money.format(point[item.key])}`}
              onFocus={() => setTooltip({ x: x(index), y: y(point[item.key]), title: `${item.label} · ${point.label}`, value: money.format(point[item.key]) })}
              onBlur={() => setTooltip(null)}
              onMouseEnter={() => setTooltip({ x: x(index), y: y(point[item.key]), title: `${item.label} · ${point.label}`, value: money.format(point[item.key]) })}
              onMouseLeave={() => setTooltip(null)}
            />)}
            {lastPoint ? <text x={x(lastIndex) - 3} y={y(lastPoint[item.key]) + (item.key === "income" ? -8 : 13)} textAnchor="end" className="dashboard-chart-label">{money.format(lastPoint[item.key])}</text> : null}
          </g>;
        })}
        {points.map((point, index) => <text key={point.label} x={x(index)} y={height - 11} textAnchor="middle" className="dashboard-chart-axis">{point.label}</text>)}
      </svg>
    </ChartFrame>
  );
}

export function MarginBars({ rows }: { rows: DashboardOverview["marginWorks"] }) {
  const [tooltip, setTooltip] = useState<Tooltip>(null);
  if (!rows.length) return <div className="dashboard-chart-empty" role="status">No hay obras con margen calculable dentro del filtro actual.</div>;
  const width = 280;
  const height = 184;
  const left = 102;
  const right = 22;
  const max = Math.max(60, ...rows.map((row) => Math.max(0, row.value)));
  const barHeight = 13;
  const gap = 19;

  return (
    <ChartFrame tooltip={tooltip}>
      <svg viewBox={`0 0 ${width} ${height}`} role="group" aria-label="Margen por obra, cinco obras con mayor margen" data-dashboard-chart-summary="margin-top-5">
        <title>Margen por obra, Top 5</title>
        <desc>Ranking de margen calculado con ingresos y costes registrados.</desc>
        {[0, 15, 30, 45, 60].map((tick) => {
          const px = left + tick / max * (width - left - right);
          return <g key={tick}><line x1={px} x2={px} y1="20" y2={height - 26} className="dashboard-chart-grid" /><text x={px} y={height - 8} textAnchor="middle" className="dashboard-chart-axis">{tick}%</text></g>;
        })}
        {rows.map((row, index) => {
          const py = 29 + index * (barHeight + gap);
          const barWidth = Math.max(2, Math.max(0, row.value) / max * (width - left - right));
          return <a key={row.workId} href={row.href}
              tabIndex={0}
              aria-label={`${row.label}: ${formatPercent(row.value)}`}
              onFocus={() => setTooltip({ x: left + barWidth, y: py, title: row.label, value: formatPercent(row.value) })}
              onBlur={() => setTooltip(null)}
              onMouseEnter={() => setTooltip({ x: left + barWidth, y: py, title: row.label, value: formatPercent(row.value) })}
              onMouseLeave={() => setTooltip(null)}
            >
            <g>
              <text x={left - 8} y={py + 10} textAnchor="end" className="dashboard-chart-label">{truncate(row.label, 22)}</text>
              <rect x={left} y={py} width={barWidth} height={barHeight} rx="2" fill="#8a69e8" />
              <text x={Math.min(width - 2, left + barWidth + 7)} y={py + 10} className="dashboard-chart-label">{formatPercent(row.value)}</text>
            </g>
          </a>;
        })}
      </svg>
    </ChartFrame>
  );
}

export function CashForecastChart({ points }: { points: DashboardOverview["cashForecast"] }) {
  const [tooltip, setTooltip] = useState<Tooltip>(null);
  if (!points.length) {
    return <div className="dashboard-chart-empty" role="status">Añade una cuenta con saldo registrado para calcular la previsión de caja.</div>;
  }
  const width = 280;
  const height = 184;
  const plot = { left: 42, right: 12, top: 24, bottom: 34 };
  const minValue = Math.min(0, ...points.map((point) => point.value));
  const maxValue = niceMax(Math.max(1, ...points.map((point) => point.value)));
  const range = Math.max(1, maxValue - minValue);
  const x = (index: number) => plot.left + index * ((width - plot.left - plot.right) / Math.max(1, points.length - 1));
  const y = (value: number) => plot.top + (height - plot.top - plot.bottom) * (1 - (value - minValue) / range);
  const line = points.map((point, index) => `${x(index)},${y(point.value)}`).join(" ");
  const area = `${plot.left},${height - plot.bottom} ${line} ${width - plot.right},${height - plot.bottom}`;

  return (
    <ChartFrame tooltip={tooltip}>
      <svg viewBox={`0 0 ${width} ${height}`} role="group" aria-label="Caja prevista durante las próximas ocho semanas" data-dashboard-chart-summary="cash-forecast-8-weeks">
        <title>Caja prevista, próximas ocho semanas</title>
        <desc>Saldo previsto a partir de saldos y vencimientos documentados.</desc>
        {Array.from({ length: 5 }, (_, index) => {
          const value = maxValue * (1 - index / 4);
          const py = y(value);
          return <g key={index}><line x1={plot.left} x2={width - plot.right} y1={py} y2={py} className="dashboard-chart-grid" /><text x={plot.left - 8} y={py + 4} textAnchor="end" className="dashboard-chart-axis">{axisMoney(value)}</text></g>;
        })}
        <defs><linearGradient id="dashboard-cash-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2d6de5" stopOpacity=".22" /><stop offset="100%" stopColor="#2d6de5" stopOpacity=".02" /></linearGradient></defs>
        <polygon points={area} fill="url(#dashboard-cash-fill)" />
        <polyline points={line} fill="none" stroke="#2d6de5" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point, index) => <circle
          key={point.label}
          cx={x(index)} cy={y(point.value)} r="3.4"
          fill="#fff" stroke="#2d6de5" strokeWidth="2"
          tabIndex={0}
          aria-label={`${point.label}: ${money.format(point.value)}`}
          onFocus={() => setTooltip({ x: x(index), y: y(point.value), title: point.label, value: money.format(point.value) })}
          onBlur={() => setTooltip(null)}
          onMouseEnter={() => setTooltip({ x: x(index), y: y(point.value), title: point.label, value: money.format(point.value) })}
          onMouseLeave={() => setTooltip(null)}
        />)}
        {points.map((point, index) => {
          const lines = weekLabelLines(point.label);
          return <text key={point.label} x={x(index)} y={height - 16} textAnchor="middle" className="dashboard-chart-axis dashboard-chart-axis--cash"><tspan x={x(index)}>{lines[0]}</tspan>{lines[1] ? <tspan x={x(index)} dy="8">{lines[1]}</tspan> : null}</text>;
        })}
      </svg>
    </ChartFrame>
  );
}

export function PipelineDonut({ rows }: { rows: DashboardOverview["pipeline"] }) {
  const [active, setActive] = useState<string | null>(null);
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const radius = 49;
  const circumference = Math.PI * 2 * radius;
  let offset = 0;

  return (
    <div className="dashboard-pipeline" data-dashboard-chart-summary="pipeline-status">
      <div className="dashboard-donut-wrap">
        <svg viewBox="0 0 132 132" role="img" aria-label={`Pipeline total: ${money.format(total)}`}>
          <title>Pipeline de trabajos por estado</title>
          <desc>Distribución del importe documentado entre cinco estados comerciales y operativos.</desc>
          <circle cx="66" cy="66" r={radius} fill="none" stroke="#eef1f0" strokeWidth="18" />
          {rows.map((row) => {
            const length = total ? row.value / total * circumference : 0;
            const visibleLength = Math.max(0, length - 2.2);
            const element = <circle
              key={row.id}
              cx="66" cy="66" r={radius}
              fill="none" stroke={row.color} strokeWidth={active === row.id ? 21 : 18}
              strokeDasharray={`${visibleLength} ${circumference - visibleLength}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 66 66)"
              tabIndex={0}
              aria-label={`${row.label}: ${money.format(row.value)}, ${formatPercent(total ? row.value / total * 100 : 0)}`}
              onFocus={() => setActive(row.id)} onBlur={() => setActive(null)}
              onMouseEnter={() => setActive(row.id)} onMouseLeave={() => setActive(null)}
            />;
            offset += length;
            return element;
          })}
        </svg>
        <span><strong>{money.format(total)}</strong><small>Total pipeline</small></span>
      </div>
      <ul>
        {rows.map((row) => <li key={row.id} data-active={active === row.id ? "true" : "false"}>
          <Link href={row.href} onFocus={() => setActive(row.id)} onBlur={() => setActive(null)} onMouseEnter={() => setActive(row.id)} onMouseLeave={() => setActive(null)}>
            <i style={{ background: row.color }} /><span>{row.label}</span><strong>{money.format(row.value)}</strong><small>{formatPercent(total ? row.value / total * 100 : 0)}</small>
          </Link>
        </li>)}
      </ul>
    </div>
  );
}

function ChartFrame({ children, tooltip }: { children: React.ReactNode; tooltip: Tooltip }) {
  return <div className="dashboard-chart-canvas">
    {children}
    {tooltip ? <div className="dashboard-chart-tooltip" style={{ left: `${Math.min(82, Math.max(12, tooltip.x / 3.3))}%`, top: `${Math.min(70, Math.max(10, tooltip.y / 1.84))}%` }} role="status"><strong>{tooltip.title}</strong><span>{tooltip.value}</span></div> : null}
  </div>;
}

function niceMax(value: number) {
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / magnitude) * magnitude;
}

function axisMoney(value: number) {
  if (Math.abs(value) >= 1_000_000) return `${Math.round(value / 1_000_000)}M €`;
  if (Math.abs(value) >= 1_000) return `${Math.round(value / 1_000)}k €`;
  return `${Math.round(value)} €`;
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value)}%`;
}

function truncate(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function weekLabelLines(value: string) {
  if (value === "Sem. actual") return ["Sem.", "actual"] as const;
  return [value.replace(" sem.", ""), "sem."] as const;
}
