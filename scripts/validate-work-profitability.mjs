import fs from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = fs.readFileSync("lib/works.ts", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText;
const sandbox = { exports: {}, require, console };
vm.runInNewContext(compiled, sandbox);

const {
  calculateWorkFinancials,
  buildWorkRisks,
  buildWorkTimeline,
  buildWorkDocuments
} = sandbox.exports;

function expect(condition, message, details) {
  if (!condition) {
    console.error("[work-profitability] FAIL", message);
    if (details !== undefined) console.error(details);
    process.exit(1);
  }
}

const fixture = {
  id: "work-1",
  titulo: "Reforma integral",
  estado: "en_curso",
  presupuestoAprobado: 12000,
  costePrevisto: 7000,
  gastoReal: 0,
  fechaCreacion: new Date("2026-07-01T10:00:00Z"),
  budgets: [{ id: "budget-1", numero: "P-1", titulo: "Reforma", total: 12000, estado: "aceptado", fechaCreacion: new Date("2026-07-01T10:00:00Z") }],
  invoices: [
    {
      id: "invoice-1",
      numero: "F-1",
      concepto: "Primer hito",
      total: 8000,
      estado: "parcialmente_pagada",
      fechaEmision: new Date("2026-07-05T10:00:00Z"),
      payments: [{ id: "payment-1", importe: 3000, fecha: new Date("2026-07-06T10:00:00Z"), metodo: "transferencia" }]
    }
  ],
  expenses: [
    { id: "expense-1", proveedor: "Proveedor", concepto: "Material", importe: 2500, categoria: "material", fecha: new Date("2026-07-03T10:00:00Z") },
    { id: "expense-2", proveedor: "Sub", concepto: "Ayuda", importe: 1000, categoria: "subcontrata", fecha: new Date("2026-07-04T10:00:00Z") }
  ],
  materials: [{ id: "material-1", nombre: "Azulejo", estado: "falta", notas: null }],
  reminders: [],
  agendaEvents: [],
  documents: [],
  photos: []
};

const financial = calculateWorkFinancials(fixture);
expect(financial.budgeted === 12000, "budgeted total must use approved budget", financial);
expect(financial.invoiced === 8000, "invoiced total must use invoices", financial);
expect(financial.paid === 3000, "paid total must use payments", financial);
expect(financial.pending === 5000, "pending must be invoice total minus payments", financial);
expect(financial.realCost === 3500, "real cost must use registered expenses", financial);
expect(financial.benefit === 4500, "benefit must use revenue base minus cost", financial);
expect(financial.marginPercent === 56.3, "margin percent must be rounded to one decimal", financial);

const risks = buildWorkRisks({ ...fixture, fechaFinPrevista: new Date("2026-06-30T10:00:00Z") }, new Date("2026-07-11T10:00:00Z"));
expect(risks.some((risk) => risk.key === "late"), "late works must produce date risk", risks);
expect(risks.some((risk) => risk.key === "materials"), "missing material must produce material risk", risks);
expect(risks.some((risk) => risk.key === "collection"), "pending collection must produce collection risk", risks);

const timeline = buildWorkTimeline(fixture);
expect(timeline.some((item) => item.title.includes("Presupuesto P-1")), "timeline must include budget", timeline);
expect(timeline.some((item) => item.title.includes("Factura F-1")), "timeline must include invoice", timeline);
expect(timeline.some((item) => item.title.includes("Cobro recibido")), "timeline must include payment", timeline);

const docs = buildWorkDocuments(fixture);
expect(docs.some((doc) => doc.type === "Presupuesto"), "documents must include budget PDF", docs);
expect(docs.some((doc) => doc.type === "Factura"), "documents must include invoice PDF", docs);

console.log("[work-profitability] OK calculations, risks, timeline and documents");
