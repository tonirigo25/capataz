import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const root = new URL("../../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

const css = read("app/globals.css");
const dashboardPage = read("app/(app)/dashboard/page.tsx");
const dashboardOverview = read("lib/portal/dashboard-overview.ts");
const dashboardVisuals = read("components/portal/dashboard-visuals.tsx");
const contextRail = read("components/portal/orqena-context-rail.tsx");

const canonicalKpis = [
  "income",
  "expenses",
  "profit",
  "margin",
  "receivable",
  "cash-forecast",
];

const canonicalCharts = [
  "income-expenses-weekly",
  "margin-top-5",
  "cash-forecast-8-weeks",
  "pipeline-status",
];

test("pasada 1/5: Dashboard conserva seis KPI canónicos y trazables", () => {
  assert.match(dashboardPage, /<section className="dashboard-kpis"[^>]*data-dashboard-kpis>/);
  assert.match(dashboardPage, /dashboard\.kpis\.map\(\(kpi\) => <DashboardKpiCard/);
  assert.match(dashboardPage, /className="dashboard-kpi"[^>]*data-dashboard-kpi/s);

  for (const id of canonicalKpis) {
    assert.match(
      dashboardOverview,
      new RegExp(`(?:id:\\s*|(?:moneyKpi|percentKpi)\\()["']${escapeRegExp(id)}["']`),
      `Falta el KPI ${id}`,
    );
  }

  assert.equal(
    canonicalKpis.filter((id) => new RegExp(`(?:id:\\s*|(?:moneyKpi|percentKpi)\\()["']${escapeRegExp(id)}["']`).test(dashboardOverview)).length,
    6,
  );
});

test("pasada 2/5: el escritorio del propietario mantiene los seis KPI en una fila", () => {
  const kpiRule = firstCssRule(css, ".dashboard-kpis");
  const columns = declaration(kpiRule, "grid-template-columns");
  const explicitColumns = (columns.match(/minmax\(/g) ?? []).length;
  const repeatedColumns = Number(columns.match(/repeat\(\s*(\d+)/)?.[1] ?? 0);

  assert.ok(
    explicitColumns === 6 || repeatedColumns === 6,
    `El grid base debe declarar seis columnas de escritorio; recibido: ${columns}`,
  );

  const desktop = cssAtRule(css, "@media (min-width: 1440px)");
  const workspace = firstCssRule(desktop, ".field-os-workspace");
  const rail = firstCssRule(desktop, ".orqena-context-rail");

  assert.match(declaration(workspace, "grid-template-columns"), /minmax\(0,\s*1fr\).*var\(--fos-layout-record-rail\)/);
  assert.equal(declaration(rail, "align-self"), "stretch");
});

test("pasada 3/5: página y rail comparten el recorrido vertical sin scroll independiente", () => {
  const page = firstCssRule(css, ".dashboard-page");
  assert.equal(declaration(page, "height"), "auto");
  assert.equal(declaration(page, "overflow"), "visible");

  const desktop = cssAtRule(css, "@media (min-width: 1440px)");
  const rail = firstCssRule(desktop, ".orqena-context-rail");
  assert.equal(declaration(rail, "position"), "relative");
  assert.equal(declaration(rail, "height"), "auto");
  assert.equal(declaration(rail, "overflow"), "visible");
  assert.doesNotMatch(rail, /overflow-y\s*:\s*(?:auto|scroll)/i);
  assert.doesNotMatch(rail, /(?:^|;)\s*max-height\s*:\s*(?:100d?vh|calc\(100d?vh)/i);

  const inner = firstCssRule(css, ".orqena-context-rail__inner");
  assert.equal(declaration(inner, "min-height"), "100%");
  assert.doesNotMatch(inner, /overflow-y\s*:\s*(?:auto|scroll)/i);

  const genericCard = lastCssRule(css, ".orqena-context-card");
  assert.equal(declaration(genericCard, "min-height"), "0");
  assert.match(css, /\.orqena-context-card\[data-today="true"\]\s*\{[^}]*min-height\s*:\s*666px/s);
});

test("pasada 4/5: el rail financiero ofrece contexto real y una salida funcional Ver todas", () => {
  assert.match(contextRail, /function DashboardRailContent/);
  assert.match(contextRail, /data-dashboard-ai-recommendation/);
  assert.match(contextRail, /data-dashboard-financial-alerts/);
  assert.match(contextRail, /alerts\.map\(/);
  assert.match(contextRail, /<Link href=\{alert\.href\}>/);
  assert.match(
    contextRail,
    /<Link href="\/recomendaciones"[^>]*>Ver todas(?: las)? recomendaciones(?: en Orqena IA)?/,
    "El rail debe cerrar con un enlace explícito y funcional «Ver todas» hacia /recomendaciones",
  );
  assert.match(dashboardOverview, /pp vs\. periodo anterior/);
  assert.match(dashboardOverview, /withPeriodContext\(comparison\.label\)/);
});

test("pasada 5/5: periodos, filtros, gráficos y detalle siguen siendo interactivos y accesibles", () => {
  assert.match(dashboardPage, /aria-label="Seleccionar periodo del Dashboard"/);
  assert.match(dashboardPage, /dashboard-popover--filters/);
  assert.match(dashboardPage, /Vista completa/);
  assert.match(dashboardPage, /Obras con riesgo/);

  for (const id of canonicalCharts) {
    assert.ok(
      dashboardPage.includes(id) || dashboardVisuals.includes(id),
      `Falta el gráfico/control ${id}`,
    );
  }

  assert.match(dashboardVisuals, /role="(?:img|group)"/);
  assert.match(dashboardVisuals, /<desc>/);
  assert.match(dashboardVisuals, /tabIndex=\{0\}/);
  assert.match(dashboardVisuals, /onFocus=/);
  assert.match(dashboardVisuals, /onMouseEnter=/);
  assert.match(dashboardPage, /<DashboardCardHeading[^>]*href=/);
  assert.match(dashboardPage, /data-dashboard-profitability-row/);
});

function firstCssRule(source, selector) {
  const escaped = escapeRegExp(selector);
  const match = new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{`, "m").exec(source);
  assert.ok(match, `No se encontró la regla CSS ${selector}`);
  return balancedBlock(source, source.indexOf("{", match.index));
}

function lastCssRule(source, selector) {
  const escaped = escapeRegExp(selector);
  const expression = new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{`, "gm");
  const matches = [...source.matchAll(expression)];
  assert.ok(matches.length, `No se encontró la regla CSS ${selector}`);
  const match = matches[matches.length - 1];
  return balancedBlock(source, source.indexOf("{", match.index));
}

function cssAtRule(source, prelude) {
  const index = source.indexOf(prelude);
  assert.notEqual(index, -1, `No se encontró ${prelude}`);
  return balancedBlock(source, source.indexOf("{", index));
}

function balancedBlock(source, openIndex) {
  assert.notEqual(openIndex, -1, "Bloque CSS sin apertura");
  let depth = 0;
  for (let index = openIndex; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(openIndex + 1, index);
  }
  assert.fail("Bloque CSS sin cierre");
}

function declaration(rule, property) {
  const match = new RegExp(`(?:^|;)\\s*${escapeRegExp(property)}\\s*:\\s*([^;]+)`, "i").exec(rule);
  assert.ok(match, `Falta ${property} en la regla: ${rule.slice(0, 160)}`);
  return match[1].trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
