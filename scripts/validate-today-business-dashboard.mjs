import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const today = read("app/(app)/hoy/page.tsx");
const dashboard = read("app/(app)/dashboard/page.tsx");
const dashboardLoading = read("app/(app)/dashboard/loading.tsx");
const dashboardError = read("app/(app)/dashboard/error.tsx");
const navigation = read("lib/product-navigation.ts");
const chrome = read("components/app-chrome.tsx");
const intelligence = read("lib/business-intelligence.ts");
const metrics = read("lib/business-metrics.ts");
const packageJson = JSON.parse(read("package.json"));

const cases = [];
const check = (name, condition) => cases.push([name, Boolean(condition)]);

check("Hoy limita la vista a tres prioridades", today.includes("dashboard.priorities.slice(0, 3)"));
check("Hoy retira la rejilla heredada de seis KPI", !today.includes("StatCard") && !today.includes("Estado del negocio"));
check("Hoy retira acciones rápidas globales", !today.includes("quickActions") && !today.includes("Acciones rápidas"));
check("Hoy incluye agenda inmediata", today.includes('title="Agenda inmediata"') && today.includes("tomorrowFirst"));
check("Hoy mantiene pulso compacto", today.includes('title="Pulso del día"') && today.includes("MetricGroup"));
check("Hoy limita actividad reciente", today.includes("recentActivity.slice(0, 5)"));
check("Hoy enlaza al Dashboard", today.includes('href="/dashboard"'));
check("Hoy tiene una única acción primaria estable", (today.match(/className="primary-button"/g) ?? []).length === 1 && today.includes("Hablar con Capataz"));
check("Hoy deriva empresa desde sesión", today.includes("requireCompanyContext") && today.includes("companyId: auth.companyId"));
check("Hoy tiene carga y error recuperable", fs.existsSync("app/(app)/hoy/loading.tsx") && fs.existsSync("app/(app)/hoy/error.tsx"));

check("Dashboard es una ruta real", dashboard.includes("export default async function DashboardPage"));
const primaryOrder = ['href: "/hoy"', 'href: "/dashboard"', 'href: "/clientes"', 'href: "/obras"', 'href: "/presupuestos"', 'href: "/dinero"'];
const primaryIndexes = primaryOrder.map((token) => navigation.indexOf(token));
check("Dashboard ocupa el segundo destino de escritorio", primaryIndexes.every((value, index) => value >= 0 && (index === 0 || value > primaryIndexes[index - 1])));
check("Dashboard no entra en la barra móvil", chrome.includes('item.href === "/hoy"') && chrome.includes('item.href === "/clientes"') && chrome.includes('item.href === "/obras"') && !chrome.includes('item.href === "/dashboard")!'));
check("Dashboard soporta cuatro periodos URL", ["this_month", "previous_month", "this_quarter", "this_year"].every((period) => dashboard.includes(`id: "${period}"`)) && dashboard.includes('aria-label="Seleccionar periodo"'));
check("Dashboard limita KPI a cinco fuentes fiables", dashboard.includes('["invoiced", "collected", "outstanding", "expenses", "profit_invoiced"]'));
check("Contratos económicos permanecen explícitos", ["Facturas válidas emitidas", "Pagos registrados", "Saldo abierto", "Gastos reales", "Facturado - gastos"].every((token) => metrics.includes(token)));
check("Dashboard incluye tendencia accesible", dashboard.includes('role="img"') && dashboard.includes("<desc") && dashboard.includes("Ver datos del gráfico"));
check("Dashboard incluye cobros y liquidez", dashboard.includes('title="Cobros y liquidez"') && dashboard.includes("pendingInvoices.slice(0, 5)"));
check("Dashboard incluye rentabilidad por obra", dashboard.includes('title="Rentabilidad por obra"') && dashboard.includes("byLowestMargin.slice(0, 5)"));
check("Dashboard incluye presupuestos", dashboard.includes('title="Presupuestos y actividad comercial"') && dashboard.includes("quoteActivity.pending"));
check("Dashboard limita riesgos", dashboard.includes("summary.alerts.slice(0, 5)"));
check("Dashboard no usa datos simulados", !dashboard.includes("mock") && !dashboard.includes("demoData") && !dashboard.includes("Math.random"));
check("Consultas del Dashboard aceptan companyId de sesión", dashboard.includes("const { companyId } = await requireCompanyContext()") && dashboard.includes("getBusinessIntelligenceSummary({ companyId"));
check("Agregaciones económicas aplican tenant", intelligence.includes("const tenant = params.companyId ? { companyId: params.companyId } : {}") && intelligence.includes("where: { ...tenant"));
check("Dashboard tiene carga y error recuperable", dashboardLoading.includes("LoadingState") && dashboardError.includes("Reintentar"));
check("Suite específica está registrada", packageJson.scripts["test:today-business-dashboard"] === "node scripts/validate-today-business-dashboard.mjs");

let failed = 0;
for (const [name, ok] of cases) {
  if (ok) console.log("[today-business-dashboard] OK", name);
  else {
    failed += 1;
    console.error("[today-business-dashboard] FAIL", name);
  }
}

if (failed) process.exit(1);
