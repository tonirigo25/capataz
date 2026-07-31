import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const today = read("app/(app)/hoy/page.tsx");
const todayOverview = read("lib/portal/today-overview.ts");
const todayActions = read("app/(app)/hoy/actions.ts");
const contextRail = read("components/portal/orqena-context-rail.tsx");
const styles = read("app/globals.css");
const dashboard = read("app/(app)/dashboard/page.tsx");
const dashboardLoading = read("app/(app)/dashboard/loading.tsx");
const dashboardError = read("app/(app)/dashboard/error.tsx");
const navigation = read("lib/product-navigation.ts");
const chrome = read("components/app-chrome.tsx");
const intelligence = read("lib/business-intelligence.ts");
const metrics = read("lib/business-metrics.ts");
const reviewFixture = read("scripts/readiness/provision-review-rigo-hoy.ts");
const packageJson = JSON.parse(read("package.json"));

const cases = [];
const check = (name, condition) => cases.push([name, Boolean(condition)]);

check("Hoy no consulta módulos heredados ajenos al contrato", !today.includes("getDashboardData") && !today.includes("getEconomicControl") && !today.includes("getTodayOperationalSignals"));
check("Hoy retira la rejilla heredada de seis KPI", !today.includes("StatCard") && !today.includes("Estado del negocio"));
check("Hoy reproduce cinco prioridades canónicas", ["budget", "invoice", "agenda", "document", "followup"].every((kind) => today.includes(`${kind}: emptyPriority`)) && today.includes("hoy-priority-grid"));
check("Hoy incluye agenda, actividad y trabajo autorizados", today.includes("overview.access.agenda") && today.includes("overview.access.activity") && today.includes("overview.access.work"));
check("Hoy incluye cobros, pagos y resumen sin rutas inexistentes", today.includes("Próximos cobros") && today.includes("Próximos pagos") && today.includes("Resumen del día") && !todayOverview.includes("/documentos/${") && !todayOverview.includes("/gastos-materiales/${"));
check("Hoy aplica autorización y scopes en servidor", todayOverview.includes('resolveAuthorization(context, "sales.budgets.view")') && todayOverview.includes("resolveScopedEntityIds") && todayOverview.includes("relationWhere(purchaseScopes)"));
check("Hoy deriva responsables reales cuando existen", todayOverview.includes("budget.work?.comercial") && todayOverview.includes("document.uploadedBy?.displayName") && todayOverview.includes("responsibleNames.get"));
check("Hoy calcula totales completos sin confundir arrays truncados", todayOverview.includes("prisma.budget.count") && todayOverview.includes("prisma.invoice.count") && todayOverview.includes("prisma.document.count") && todayOverview.includes("prisma.followUp.count"));
check("Hoy conserva confirmación humana e idempotencia", todayActions.includes("executeRecommendationUseCase") && contextRail.includes('name="confirmed" value="true"') && todayActions.includes("TODAY_RECOMMENDATION_ACTION_INVALID"));
check("Hoy mantiene rail IA contextual y controles reales", contextRail.includes("TodayRecommendationControls") && contextRail.includes("acceptTodayRecommendationAction") && contextRail.includes("dismissTodayRecommendationAction") && contextRail.includes("Ver más recomendaciones en Orqena IA"));
check("Hoy fija la geometría contractual 5/3/2", styles.includes("repeat(5, minmax(0, 1fr))") && styles.includes(".hoy-operational-grid") && styles.includes(".hoy-bottom-grid") && styles.includes("--fos-layout-topbar: 67px"));
check("Hoy deriva portal y datos desde autorización", today.includes('requireCapability("company.view")') && today.includes("getTodayOverview(auth)") && todayOverview.includes("companyId = context.companyId"));
check("Hoy tiene carga y error recuperable", fs.existsSync("app/(app)/hoy/loading.tsx") && fs.existsSync("app/(app)/hoy/error.tsx"));
check("Review Rigo usa el plan completo ENTERPRISE", reviewFixture.includes('where: { key: "ENTERPRISE" }') && reviewFixture.includes('plan: "ENTERPRISE"') && reviewFixture.includes('accessMode: "STANDARD"'));
check("Review Rigo mantiene Stripe desconectado", reviewFixture.includes("REVIEW_RIGO_HOY_EXTERNAL_BILLING_CONFLICT") && reviewFixture.includes("stripeObjectsCreated: false") && reviewFixture.includes('provider: "local"'));
check("Review Rigo falla ante restricciones particulares", ["REVIEW_RIGO_HOY_PERMISSION_OVERRIDE_CONFLICT", "REVIEW_RIGO_HOY_SCOPE_RESTRICTION_CONFLICT", "REVIEW_RIGO_HOY_ENTITLEMENT_OVERRIDE_CONFLICT"].every((token) => reviewFixture.includes(token)));
check("Review Rigo aprovisiona todas las áreas de Hoy", ["budget.upsert", "invoice.upsert", "document.upsert", "followUp.upsert", "expense.upsert", "businessRecommendation.upsert"].every((token) => reviewFixture.includes(token)) && reviewFixture.includes("workFixtures"));

check("Dashboard es una ruta real", dashboard.includes("export default async function DashboardPage"));
const primaryOrder = ['href: "/hoy"', 'href: "/dashboard"', 'href: "/clientes"', 'href: "/obras"', 'href: "/presupuestos"', 'href: "/dinero"'];
const primaryIndexes = primaryOrder.map((token) => navigation.indexOf(token));
check("Dashboard ocupa el segundo destino de escritorio", primaryIndexes.every((value, index) => value >= 0 && (index === 0 || value > primaryIndexes[index - 1])));
check("barra móvil se deriva del PortalManifest", chrome.includes("items={portalManifest.mobileNavigation}") && chrome.includes("portalManifest.quickActions.length"));
check("Dashboard soporta cuatro periodos URL", ["this_month", "previous_month", "this_quarter", "this_year"].every((period) => dashboard.includes(`id: "${period}"`)) && dashboard.includes('aria-label="Seleccionar periodo"'));
check("Dashboard limita la primera vista a cuatro KPI trazables", dashboard.includes('["invoiced", "collected", "profit_invoiced", "overdue"]') && dashboard.includes("data-dashboard-primary-kpis"));
check("Contratos económicos permanecen explícitos", ["Facturas válidas emitidas", "Pagos registrados", "Saldo abierto", "Gastos reales", "Facturado - gastos"].every((token) => metrics.includes(token)));
check("Dashboard incluye tendencia accesible", dashboard.includes('role="img"') && dashboard.includes("<desc") && dashboard.includes("Ver datos del gráfico"));
check("Dashboard coloca excepciones junto a la tendencia", dashboard.includes('title="Excepciones"') && dashboard.includes("summary.alerts.slice(0, 5)"));
check("Dashboard mantiene posición económica en cuatro orígenes", dashboard.includes('title="Posición económica"') && dashboard.includes('xl:grid-cols-4'));
check("Dashboard incluye cobros y liquidez", dashboard.includes('title="Cobros y liquidez"') && dashboard.includes("pendingInvoices.slice(0, 5)"));
check("Dashboard incluye rentabilidad por trabajo", dashboard.includes('title="Rentabilidad por trabajo"') && dashboard.includes("byLowestMargin.slice(0, 5)"));
check("Dashboard incluye presupuestos", dashboard.includes('title="Presupuestos y actividad comercial"') && dashboard.includes("quoteActivity.pending"));
check("Dashboard no crea un score de salud artificial", !dashboard.includes("buildOperationalHealth") && !dashboard.includes("operationalHealth") && dashboard.includes("sin crear un score de salud"));
check("Dashboard no usa datos simulados", !dashboard.includes("mock") && !dashboard.includes("demoData") && !dashboard.includes("Math.random"));
check("Consultas del Dashboard exigen capacidad y companyId de sesión", dashboard.includes('requireCapability("reports.view")') && dashboard.includes("getBusinessIntelligenceSummary({ companyId"));
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
