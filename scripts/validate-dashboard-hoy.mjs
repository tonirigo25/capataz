import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = fs.readFileSync("lib/dashboard-hoy.ts", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020
  }
}).outputText;

const sandbox = { exports: {}, console, Intl, Date, encodeURIComponent, Number };
vm.runInNewContext(compiled, sandbox, { filename: "lib/dashboard-hoy.ts" });

const {
  buildTodayDashboard,
  greetingForDate,
  invoiceLiveStatus,
  isBillableInvoice
} = sandbox.exports;

const now = new Date("2026-07-11T12:30:00.000Z");

const baseInput = {
  clients: [
    { id: "client-1", nombre: "Cliente incompleto", estado: "pendiente_datos", fechaCreacion: "2026-07-09T10:00:00.000Z" }
  ],
  works: [
    {
      id: "work-1",
      titulo: "Reforma cocina",
      direccion: "Calle Mayor 1",
      tipoTrabajo: "Reforma",
      estado: "pendiente_material",
      fechaInicio: "2026-07-10T09:00:00.000Z",
      fechaFinPrevista: "2026-07-20T09:00:00.000Z",
      presupuestoAprobado: 8000,
      gastoReal: 1200,
      margenEstimado: 2500,
      client: { nombre: "Cliente incompleto" },
      invoices: [{ pendiente: 1000 }],
      materials: [{ estado: "pendiente" }]
    }
  ],
  budgets: [
    {
      id: "budget-1",
      numero: "P-1",
      titulo: "Presupuesto alto que no es facturacion",
      total: 100000,
      estado: "pendiente_respuesta",
      fechaCreacion: "2026-07-05T10:00:00.000Z",
      fechaEnvio: "2026-07-06T10:00:00.000Z",
      fechaSeguimiento: "2026-07-10T10:00:00.000Z",
      client: { nombre: "Cliente incompleto" },
      work: { titulo: "Reforma cocina" }
    }
  ],
  invoices: [
    {
      id: "invoice-overdue",
      numero: "F-1",
      concepto: "Factura vencida",
      total: 1000,
      pendiente: 1000,
      pagado: 0,
      estado: "emitida",
      fechaEmision: "2026-07-02T10:00:00.000Z",
      fechaVencimiento: "2026-07-01T10:00:00.000Z",
      client: { nombre: "Cliente incompleto" },
      payments: []
    },
    {
      id: "invoice-paid",
      numero: "F-2",
      concepto: "Factura pagada",
      total: 2000,
      pendiente: 0,
      pagado: 2000,
      estado: "pagada",
      fechaEmision: "2026-07-03T10:00:00.000Z",
      fechaVencimiento: "2026-07-20T10:00:00.000Z",
      client: { nombre: "Cliente incompleto" },
      payments: [{ id: "payment-1", importe: 2000, fecha: "2026-07-05T10:00:00.000Z" }]
    },
    {
      id: "invoice-draft",
      numero: "F-DRAFT",
      concepto: "Borrador",
      total: 5000,
      pendiente: 5000,
      pagado: 0,
      estado: "borrador",
      fechaEmision: "2026-07-04T10:00:00.000Z",
      fechaVencimiento: "2026-07-25T10:00:00.000Z",
      client: { nombre: "Cliente incompleto" },
      payments: []
    }
  ],
  materials: [{ id: "mat-1", nombre: "Azulejos", cantidad: "10", estado: "pendiente" }],
  reminders: [],
  expenses: [
    {
      id: "expense-1",
      proveedor: "Proveedor",
      concepto: "Material",
      importe: 300,
      fecha: "2026-07-04T10:00:00.000Z",
      work: { titulo: "Reforma cocina", client: { nombre: "Cliente incompleto" } }
    }
  ],
  agendaItems: [
    {
      id: "no-time",
      source: "evento",
      titulo: "Sin hora",
      descripcion: null,
      tipo: "recordatorio_interno",
      estado: "pendiente",
      fechaInicio: new Date(2026, 6, 11, 0, 0, 0),
      fechaFin: null,
      clienteId: null,
      clienteNombre: null,
      obraId: null,
      obraTitulo: null,
      presupuestoId: null,
      presupuestoNumero: null,
      facturaId: null,
      facturaNumero: null,
      direccion: null,
      notas: null,
      editable: true,
      href: "/agenda"
    },
    {
      id: "visit",
      source: "evento",
      titulo: "Visita",
      descripcion: null,
      tipo: "visita",
      estado: "confirmado",
      fechaInicio: new Date("2026-07-11T09:00:00.000Z"),
      fechaFin: null,
      clienteId: "client-1",
      clienteNombre: "Cliente incompleto",
      obraId: "work-1",
      obraTitulo: "Reforma cocina",
      presupuestoId: null,
      presupuestoNumero: null,
      facturaId: null,
      facturaNumero: null,
      direccion: "Calle Mayor 1",
      notas: null,
      editable: true,
      href: "/agenda"
    },
    {
      id: "follow-up",
      source: "evento",
      titulo: "Seguimiento",
      descripcion: null,
      tipo: "seguimiento_presupuesto",
      estado: "pendiente",
      fechaInicio: new Date("2026-07-11T10:00:00.000Z"),
      fechaFin: null,
      clienteId: "client-1",
      clienteNombre: "Cliente incompleto",
      obraId: "work-1",
      obraTitulo: "Reforma cocina",
      presupuestoId: "budget-1",
      presupuestoNumero: "P-1",
      facturaId: null,
      facturaNumero: null,
      direccion: null,
      notas: null,
      editable: true,
      href: "/agenda"
    }
  ]
};

const dashboard = buildTodayDashboard(baseInput, now);

const cases = [
  {
    name: "saludo por franja horaria",
    ok: greetingForDate(new Date("2026-07-11T09:00:00")) === "Buenos días" &&
      greetingForDate(new Date("2026-07-11T15:00:00")) === "Buenas tardes" &&
      greetingForDate(new Date("2026-07-11T22:00:00")) === "Buenas noches"
  },
  {
    name: "pendiente de cobro excluye borradores y usa facturas reales",
    ok: dashboard.money.pendingCollection === 1000 && dashboard.counts.pendingInvoices === 1
  },
  {
    name: "facturacion mensual no incluye presupuestos ni facturas borrador",
    ok: dashboard.money.billedThisMonth === 3000
  },
  {
    name: "gastos mensuales salen de gastos reales",
    ok: dashboard.money.expensesThisMonth === 300
  },
  {
    name: "factura vencida se identifica por fecha y pendiente",
    ok: invoiceLiveStatus(baseInput.invoices[0], now) === "vencida" && dashboard.counts.overdueInvoices === 1
  },
  {
    name: "borrador no es factura facturable",
    ok: isBillableInvoice(baseInput.invoices[2]) === false
  },
  {
    name: "prioridades limitadas y vencidas primero",
    ok: dashboard.priorities.length <= 5 && dashboard.priorities[0].type === "Factura vencida"
  },
  {
    name: "agenda ordena eventos con hora antes que sin hora",
    ok: dashboard.agendaToday.map((item) => item.id).join(",") === "visit,follow-up,no-time"
  },
  {
    name: "cuenta vacia no falla y devuelve resumen util",
    ok: (() => {
      const empty = buildTodayDashboard({
        clients: [],
        works: [],
        budgets: [],
        invoices: [],
        materials: [],
        reminders: [],
        expenses: [],
        agendaItems: []
      }, now);
      return empty.dailySummary.includes("no tienes tareas urgentes") && empty.priorities.length === 0;
    })()
  }
];

let failed = 0;
for (const item of cases) {
  if (item.ok) {
    console.log("[dashboard-hoy] OK", item.name);
  } else {
    failed += 1;
    console.error("[dashboard-hoy] FAIL", item.name);
  }
}

if (failed) process.exit(1);
