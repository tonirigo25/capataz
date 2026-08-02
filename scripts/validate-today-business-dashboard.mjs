import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const today = read("app/(app)/hoy/page.tsx");
const todayOverview = read("lib/portal/today-overview.ts");
const todayActions = read("app/(app)/hoy/actions.ts");
const todayActionUseCases = read("lib/application/intelligence/today-action-use-cases.ts");
const contextRail = read("components/portal/orqena-context-rail.tsx");
const styles = read("app/globals.css");
const dashboard = read("app/(app)/dashboard/page.tsx");
const dashboardOverview = read("lib/portal/dashboard-overview.ts");
const dashboardVisuals = read("components/portal/dashboard-visuals.tsx");
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
check("Hoy conserva confirmación humana e idempotencia", todayActionUseCases.includes("executeRecommendationUseCase") && contextRail.includes('name="confirmed" value="true"') && todayActionUseCases.includes("TODAY_RECOMMENDATION_ACTION_INVALID"));
check("Hoy mantiene rail IA contextual y controles reales", contextRail.includes("TodayRecommendationControls") && contextRail.includes("acceptTodayRecommendationAction") && contextRail.includes("dismissTodayRecommendationAction") && contextRail.includes("Ver todas las recomendaciones"));
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
check("Dashboard soporta cuatro periodos URL", ["this_month", "previous_month", "this_quarter", "this_year"].every((period) => dashboard.includes(`id: "${period}"`)) && dashboard.includes('aria-label="Seleccionar periodo del Dashboard"'));
check("Dashboard reproduce seis KPI canónicos trazables", ["income", "expenses", "profit", "margin", "receivable", "cash-forecast"].every((id) => dashboardOverview.includes(`"${id}"`)) && dashboard.includes("data-dashboard-kpis") && dashboard.includes("data-dashboard-kpi"));
check("Contratos económicos permanecen explícitos", ["Facturas válidas emitidas", "Pagos registrados", "Saldo abierto", "Gastos reales", "Facturado - gastos"].every((token) => metrics.includes(token)));
check("Dashboard incluye cuatro gráficos accesibles", ["income-expenses-weekly", "margin-top-5", "cash-forecast-8-weeks", "pipeline-status"].every((id) => dashboard.includes(id) || dashboardVisuals.includes(id)) && dashboardVisuals.includes('role="img"') && dashboardVisuals.includes("<desc>"));
check("Dashboard incluye pipeline y tabla de rentabilidad", dashboard.includes("Pipeline de trabajos por estado") && dashboard.includes("Rentabilidad por obra") && dashboard.includes("data-dashboard-profitability-row"));
check("Dashboard alimenta el rail financiero sin inventar alertas", contextRail.includes("DashboardRailContent") && contextRail.includes("data-dashboard-financial-alerts") && contextRail.includes("recommendations.dashboardAlerts"));
check("Dashboard no crea un score de salud artificial", !dashboard.includes("buildOperationalHealth") && !dashboard.includes("operationalHealth"));
check("Dashboard no usa datos simulados en runtime", !dashboard.includes("mock") && !dashboard.includes("demoData") && !dashboard.includes("Math.random") && !dashboardOverview.includes("Math.random"));
check("Consultas del Dashboard exigen capacidad y companyId de sesión", dashboard.includes('requireCapability("reports.view")') && dashboard.includes("getDashboardOverview({ companyId: auth.companyId") && dashboardOverview.includes("companyId"));
check("Dashboard preserva caja desconocida y progreso real", dashboardOverview.includes('cashToday === null ? []') && dashboardOverview.includes('task.status === "completed"') && dashboardOverview.includes('task.status !== "cancelled"'));
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
