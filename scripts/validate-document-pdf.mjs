import fs from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = fs.readFileSync("lib/document-pdf.ts", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020
  }
}).outputText;

const sandbox = { exports: {}, require, console, Buffer, Intl };
vm.runInNewContext(compiled, sandbox);

const { createProfessionalDocumentPdf } = sandbox.exports;

const pdf = createProfessionalDocumentPdf({
  kind: "budget",
  documentNumber: "P-TEST-001",
  title: "Reforma integral de cocina",
  status: "borrador",
  issueDate: new Date("2026-07-11T10:00:00Z"),
  validUntil: new Date("2026-07-31T10:00:00Z"),
  company: {
    name: "Empresa Demo",
    legalName: "Empresa Demo SL",
    taxId: "B00000000",
    address: "Calle Fiscal 1, Palma",
    contact: "600000000 · demo@example.com · example.com",
    brandColor: "#f6c945",
    legalText: "Garantía según condiciones particulares."
  },
  client: {
    name: "Cliente Demo",
    taxId: "00000000T",
    address: "Calle Cliente 2",
    contact: "cliente@example.com"
  },
  work: {
    title: "Obra cocina",
    address: "Calle Obra 3"
  },
  lines: [
    {
      codigo: "MAT-001",
      descripcion: "Suministro e instalación de mobiliario de cocina con descripción larga para validar multilínea",
      cantidad: 1,
      unidad: "lote",
      precioUnitario: 1000,
      descuento: 50,
      ivaPercent: 21,
      total: 950,
      categoria: "Materiales"
    }
  ],
  totals: {
    base: 950,
    discount: 50,
    ivaPercent: 21,
    ivaTotal: 199.5,
    total: 1149.5
  },
  conditions: "Forma de pago por transferencia.",
  paymentMethod: "50% inicio, 50% final.",
  observations: "Observación comercial visible."
});

const text = pdf.toString("latin1");
const required = ["PRESUPUESTO", "Empresa", "Cliente", "Obra", "Partidas", "Cod.", "P. unit.", "Dto.", "IVA", "Total", "Condiciones", "Forma de pago", "P-TEST-001"];
const forbidden = ["borrador interno", "plantilla", "creado desde chat", "revisar datos", "pendingFields", "ActionLog", "instrucciones internas", "no enviar sin confirmacion", "Documento generado por Capataz"];

const missing = required.filter((item) => !text.includes(item));
const foundForbidden = forbidden.filter((item) => text.toLowerCase().includes(item.toLowerCase()));

const longPdf = createProfessionalDocumentPdf({
  kind: "invoice",
  documentNumber: "F-TEST-002",
  title: "Certificación completa de obra",
  status: "emitida",
  issueDate: new Date("2026-07-11T10:00:00Z"),
  dueDate: new Date("2026-08-11T10:00:00Z"),
  company: {
    name: "Empresa Demo",
    legalName: "Empresa Demo SL",
    taxId: "B00000000",
    address: "Calle Fiscal 1, Palma",
    contact: "600000000 · demo@example.com",
    iban: "ES00 0000 0000 0000 0000 0000",
    brandColor: "#f6c945"
  },
  client: {
    name: "Cliente Demo",
    taxId: "00000000T",
    address: "Calle Cliente 2",
    contact: "cliente@example.com"
  },
  work: {
    title: "Obra completa",
    address: "Calle Obra 3"
  },
  lines: Array.from({ length: 36 }, (_, index) => ({
    codigo: `LIN-${String(index + 1).padStart(3, "0")}`,
    descripcion: `Partida profesional ${index + 1} con descripción suficiente para validar salto de página sin cortar textos ni perder columnas`,
    cantidad: 1,
    unidad: "ud",
    precioUnitario: 100 + index,
    descuento: index % 3 === 0 ? 5 : 0,
    ivaPercent: 21,
    total: 95 + index,
    categoria: "Obra"
  })),
  totals: {
    base: 4050,
    discount: 60,
    ivaPercent: 21,
    ivaTotal: 837.9,
    total: 4827.9,
    paid: 1200,
    pending: 3627.9
  },
  conditions: "Condiciones profesionales visibles.",
  paymentMethod: "Transferencia bancaria."
});

const longText = longPdf.toString("latin1");
const pageCount = (longText.match(/\/Type \/Page\b/g) ?? []).length;
const longFoundForbidden = forbidden.filter((item) => longText.toLowerCase().includes(item.toLowerCase()));

if (missing.length || foundForbidden.length || pageCount < 2 || longFoundForbidden.length) {
  console.error("[document-pdf] FAIL", { missing, foundForbidden, pageCount, longFoundForbidden });
  process.exit(1);
}

console.log("[document-pdf] OK presupuesto/factura profesional sin textos internos y multipágina");
