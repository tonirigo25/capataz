import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");
const files = {
  ui: read("components/ui-primitives.tsx"),
  dialog: read("components/accessible-dialog.tsx"),
  payment: read("components/confirmed-payment-form.tsx"),
  agendaControls: read("components/agenda-event-controls.tsx"),
  clients: read("app/(app)/clientes/page.tsx"),
  client: read("app/(app)/clientes/[id]/page.tsx"),
  works: read("app/(app)/obras/page.tsx"),
  work: read("app/(app)/obras/[id]/page.tsx"),
  budgets: read("app/(app)/presupuestos/page.tsx"),
  budget: read("app/(app)/presupuestos/[id]/page.tsx"),
  invoices: read("app/(app)/dinero/page.tsx"),
  invoice: read("app/(app)/dinero/[id]/page.tsx"),
  agenda: read("app/(app)/agenda/page.tsx"),
  form: read("app/(app)/gestion/page.tsx")
};

const cases = [
  ["componentes operativos compartidos", ["FilterBar", "ResultSummary", "MetricStrip", "DetailSection", "StickyFormActions", "ActionMenu"].every((name) => files.ui.includes(`function ${name}`))],
  ["clientes comparte búsqueda, filtros y resumen", ["FilterBar", "SearchInput", "ResultSummary"].every((name) => files.clients.includes(name))],
  ["clientes distingue vacío de filtros", files.clients.includes("Todavía no hay clientes") && files.clients.includes("No hay clientes para estos filtros")],
  ["ficha de cliente conserva Orqena contextual", files.client.includes("Preguntar a Orqena") && files.client.includes("/capataz")],
  ["obras comparte búsqueda, filtros y resumen", ["FilterBar", "SearchInput", "ResultSummary"].every((name) => files.works.includes(name))],
  ["ficha de obra conserva resumen y Orqena", files.work.includes("EntityWorkflowSummary") && files.work.includes("Preguntar en Orqena")],
  ["presupuestos ofrece tabla y lista móvil", files.budgets.includes("ResponsiveTable") && files.budgets.includes("MobileList")],
  ["presupuestos reduce acciones secundarias", files.budgets.includes("ActionMenu") && files.budget.includes("ActionMenu")],
  ["detalle de presupuesto jerarquizado", files.budget.includes("PageHeader") && files.budget.includes("DetailSection") && files.budget.includes("Partidas editables")],
  ["facturas ofrece tabla y lista móvil", files.invoices.includes("ResponsiveTable") && files.invoices.includes("MobileList")],
  ["facturas prioriza pendiente y vencimiento", files.invoices.includes("Pendiente") && files.invoices.includes("Vencimiento") && files.invoices.includes("StatusPill")],
  ["cobro conserva pagos parciales y fecha", files.payment.includes("pago_parcial") && files.payment.includes('type="date"') && files.payment.includes("nextPending")],
  ["detalle de factura conserva trazabilidad", files.invoice.includes("Cobros registrados") && files.invoice.includes("ConfirmedPaymentForm") && files.invoice.includes("markInvoicePaid")],
  ["agenda expone búsqueda, tipo, vistas y fecha", files.agenda.includes("SearchInput") && files.agenda.includes("Cambiar fecha") && files.agenda.includes("Vistas de agenda")],
  ["diálogos accesibles controlan Escape y foco", files.dialog.includes('role="dialog"') && files.dialog.includes('aria-modal="true"') && files.dialog.includes('event.key === "Escape"') && files.dialog.includes("previousFocus.current?.focus")],
  ["cobro y agenda reutilizan diálogo accesible", files.payment.includes("AccessibleDialog") && files.agendaControls.includes("AccessibleDialog")],
  ["formularios usan acciones persistentes", files.form.includes("StickyFormActions") && files.form.includes("Nada se guarda hasta que confirmes")],
  ["tenant continúa derivado de sesión", [files.clients, files.works, files.budgets, files.invoices].every((source) => source.includes("requireCompanyContext"))]
];

let failed = 0;
for (const [name, ok] of cases) {
  if (ok) console.log(`[core-operational] OK ${name}`);
  else { failed += 1; console.error(`[core-operational] FAIL ${name}`); }
}
if (failed) process.exit(1);
