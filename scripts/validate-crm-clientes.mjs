import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = fs.readFileSync("lib/client-crm-calculations.ts", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020
  }
}).outputText;

const sandbox = { exports: {}, console, Date, Intl, Set, Math, Number };
vm.runInNewContext(compiled, sandbox, { filename: "lib/client-crm-calculations.ts" });

const {
  buildBudgetSummary,
  buildFinancialSummary,
  detectDuplicateClients,
  getClientPendingFields,
  isActiveWorkStatus,
  isBillableInvoiceStatus,
  lastContactDate,
  pendingAmountForInvoice
} = sandbox.exports;

const now = new Date("2026-07-11T12:00:00.000Z");

const invoices = [
  {
    id: "invoice-partial",
    total: 1000,
    pagado: 0,
    pendiente: 1000,
    estado: "pendiente_pago",
    fechaVencimiento: "2026-07-20T10:00:00.000Z",
    payments: [
      { id: "payment-1", importe: 300, fecha: "2026-07-05T10:00:00.000Z" },
      { id: "payment-1", importe: 300, fecha: "2026-07-05T10:00:00.000Z" }
    ]
  },
  {
    id: "invoice-overdue",
    total: 500,
    pagado: 0,
    pendiente: 500,
    estado: "emitida",
    fechaVencimiento: "2026-07-01T10:00:00.000Z",
    payments: []
  },
  {
    id: "invoice-draft",
    total: 9000,
    pagado: 0,
    pendiente: 9000,
    estado: "borrador",
    fechaVencimiento: "2026-07-30T10:00:00.000Z",
    payments: []
  }
];

const invoice4200NoPayments = {
  id: "invoice-4200-none",
  total: 4200,
  pagado: 0,
  pendiente: 4200,
  estado: "pendiente_pago",
  fechaVencimiento: "2026-07-20T10:00:00.000Z",
  payments: []
};

const invoice4200OnePayment = {
  ...invoice4200NoPayments,
  id: "invoice-4200-one",
  payments: [{ id: "payment-1000", importe: 1000, fecha: "2026-07-05T10:00:00.000Z" }]
};

const invoice4200TwoPayments = {
  ...invoice4200NoPayments,
  id: "invoice-4200-two",
  payments: [
    { id: "payment-1000", importe: 1000, fecha: "2026-07-05T10:00:00.000Z" },
    { id: "payment-1200", importe: 1200, fecha: "2026-07-06T10:00:00.000Z" }
  ]
};

const invoice4200Paid = {
  ...invoice4200NoPayments,
  id: "invoice-4200-paid",
  estado: "pagada",
  pendiente: 0,
  payments: [{ id: "payment-4200", importe: 4200, fecha: "2026-07-07T10:00:00.000Z" }]
};

const invoice4200Overpaid = {
  ...invoice4200NoPayments,
  id: "invoice-4200-overpaid",
  payments: [{ id: "payment-5000", importe: 5000, fecha: "2026-07-08T10:00:00.000Z" }]
};

const cases = [
  {
    name: "presupuestos no suman como facturacion",
    ok: buildBudgetSummary([{ total: 4000, estado: "aceptado" }]).budgetedTotal === 4000 &&
      buildFinancialSummary([], now).billedTotal === 0
  },
  {
    name: "facturas borrador no suman y estados excluidos son reales del modelo",
    ok: buildFinancialSummary(invoices, now).billedTotal === 1500 &&
      isBillableInvoiceStatus("borrador") === false
  },
  {
    name: "pagos parciales reducen pendiente y no se duplican por id",
    ok: pendingAmountForInvoice(invoices[0]) === 700 && buildFinancialSummary(invoices, now).paidTotal === 300
  },
  {
    name: "facturas vencidas se cuentan por fecha y pendiente real",
    ok: buildFinancialSummary(invoices, now).overdueInvoicesCount === 1
  },
  {
    name: "casos financieros 4200 sin pago parcial completa y sobrepago",
    ok: pendingAmountForInvoice(invoice4200NoPayments) === 4200 &&
      pendingAmountForInvoice(invoice4200OnePayment) === 3200 &&
      pendingAmountForInvoice(invoice4200TwoPayments) === 2000 &&
      pendingAmountForInvoice(invoice4200Paid) === 0 &&
      pendingAmountForInvoice(invoice4200Overpaid) === 0
  },
  {
    name: "varias facturas del mismo cliente suman correctamente",
    ok: buildFinancialSummary([invoice4200NoPayments, invoice4200OnePayment, invoice4200TwoPayments], now).pendingTotal === 9400
  },
  {
    name: "contacto principal no se confunde con cliente fiscal",
    ok: getClientPendingFields({
      tipo: "Empresa",
      nombre: "Reformas Test",
      razonSocial: "Reformas Test SL",
      nifCif: "B12345678",
      direccionFiscal: "Calle Fiscal 1",
      telefono: "600111222",
      email: "admin@example.test",
      contactoPrincipalNombre: "Laura Contacto"
    }).length === 0
  },
  {
    name: "direccion fiscal no se sustituye por direccion de obra",
    ok: getClientPendingFields({
      tipo: "Empresa",
      nombre: "Empresa sin fiscal",
      razonSocial: "Empresa sin fiscal SL",
      nifCif: "B87654321",
      direccion: "Obra 1",
      telefono: "600111222",
      email: "admin@example.test",
      contactoPrincipalNombre: "Laura"
    }).includes("Falta dirección fiscal")
  },
  {
    name: "particular no exige nif cif",
    ok: !getClientPendingFields({
      tipo: "Particular",
      nombre: "Ana",
      telefono: "600111222",
      email: "ana@example.test",
      direccion: "Calle 1"
    }).some((field) => field.includes("NIF"))
  },
  {
    name: "duplicados fuertes por nif y email",
    ok: detectDuplicateClients(
      { nombre: "Cliente nuevo", nifCif: "B12345678" },
      [{ id: "client-1", nombre: "Existente", nifCif: "B12345678", email: "old@example.test", telefono: "600111222" }]
    )?.reason === "Mismo NIF/CIF" &&
      detectDuplicateClients(
        { nombre: "Cliente nuevo", email: "old@example.test" },
        [{ id: "client-1", nombre: "Existente", nifCif: null, email: "old@example.test", telefono: "600111222" }]
      )?.reason === "Mismo email"
  },
  {
    name: "duplicado debil por nombre parecido no bloqueante",
    ok: detectDuplicateClients(
      { nombre: "Reformas Lozano" },
      [{ id: "client-2", nombre: "Reformas Lozano SL", nifCif: null, email: null, telefono: null }]
    )?.strength === "weak"
  },
  {
    name: "duplicado fuerte por telefono normalizado",
    ok: detectDuplicateClients(
      { nombre: "Cliente telefono", telefono: "600111222" },
      [{ id: "client-phone", nombre: "Telefono existente", nifCif: null, email: null, telefono: "+34 600 111 222" }]
    )?.reason === "Mismo teléfono"
  },
  {
    name: "duplicados fuertes usan email y telefono de contacto existentes",
    ok: detectDuplicateClients(
      { nombre: "Cliente contacto", contactoPrincipalEmail: "contacto@example.test" },
      [{ id: "client-contact-email", nombre: "Existente", nifCif: null, email: null, emailFacturacion: null, contactoPrincipalEmail: "contacto@example.test", telefono: null }]
    )?.reason === "Mismo email" &&
      detectDuplicateClients(
        { nombre: "Cliente contacto", contactoPrincipalTelefono: "600111222" },
        [{ id: "client-contact-phone", nombre: "Existente", nifCif: null, email: null, telefono: null, contactoPrincipalTelefono: "+34 600 111 222" }]
      )?.reason === "Mismo teléfono"
  },
  {
    name: "ultimo contacto excluye actividad administrativa",
    ok: lastContactDate([
      { tipo: "visita", estado: "confirmado", fechaInicio: "2026-07-10T10:00:00.000Z" },
      { tipo: "vencimiento_factura", estado: "pendiente", fechaInicio: "2026-07-11T09:00:00.000Z" }
    ], now)?.toISOString() === "2026-07-10T10:00:00.000Z"
  },
  {
    name: "obra activa usa estados operativos reales",
    ok: isActiveWorkStatus("en_curso") === true && isActiveWorkStatus("cerrada") === false
  }
];

let failed = 0;
for (const item of cases) {
  if (item.ok) {
    console.log("[crm-clientes] OK", item.name);
  } else {
    failed += 1;
    console.error("[crm-clientes] FAIL", item.name);
  }
}

if (failed) process.exit(1);
