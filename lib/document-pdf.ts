import { documentTemplates, type DocumentTemplateKind } from "@/lib/document-templates";
import { statusLabel } from "@/lib/status";

export type ProfessionalDocumentLine = {
  descripcion: string;
  cantidad: number;
  unidad: string;
  precioUnitario: number;
  total: number;
  categoria?: string;
};

export type ProfessionalDocumentPdf = {
  kind: DocumentTemplateKind;
  documentNumber: string;
  title: string;
  status: string;
  issueDate: Date | null;
  dueDate?: Date | null;
  validUntil?: Date | null;
  company: {
    name: string;
    legalName?: string | null;
    taxId?: string | null;
    address?: string | null;
    contact?: string | null;
    iban?: string | null;
    logoUrl?: string | null;
    sealUrl?: string | null;
    brandColor?: string | null;
    legalText?: string | null;
  };
  client: {
    name: string;
    taxId?: string | null;
    address?: string | null;
    contact?: string | null;
  };
  work?: {
    title?: string | null;
    address?: string | null;
  } | null;
  lines: ProfessionalDocumentLine[];
  totals: {
    base: number;
    discount?: number;
    ivaPercent: number;
    ivaTotal: number;
    total: number;
    paid?: number;
    pending?: number;
  };
  conditions?: string | null;
  paymentMethod?: string | null;
  observations?: string | null;
  watermark?: string | null;
};

type PdfPage = {
  content: string[];
};

const pageWidth = 595;
const pageHeight = 842;
const margin = 42;

export function createProfessionalDocumentPdf(input: ProfessionalDocumentPdf) {
  const template = documentTemplates[input.kind];
  const brandColor = parseColor(input.company.brandColor || "#f6c945");
  const pages: PdfPage[] = [];
  let current = newPage();
  let y = drawHeader(current, input, brandColor);

  function newPage() {
    const page = { content: [] as string[] };
    pages.push(page);
    if (input.watermark) {
      text(page, 165, 430, input.watermark, 42, true, [0.88, 0.88, 0.88]);
    }
    return page;
  }

  function ensure(height: number) {
    if (y - height >= margin + 38) return;
    current = newPage();
    y = drawContinuationHeader(current, input, brandColor);
  }

  y = drawInfoCards(current, y, input);
  ensure(76);
  y = drawSummary(current, y, input);
  ensure(100);
  y = drawLinesTable(current, y, input, ensure, () => current, (nextY) => {
    y = nextY;
  });
  ensure(130);
  y = drawTotals(current, y, input, brandColor);

  const notes = [
    input.conditions ? `Condiciones: ${input.conditions}` : null,
    input.paymentMethod ? `Forma de pago: ${input.paymentMethod}` : null,
    input.observations ? `Observaciones: ${input.observations}` : null,
    input.company.legalText ? `Texto legal: ${input.company.legalText}` : null
  ].filter(Boolean) as string[];

  for (const note of notes) {
    ensure(34);
    y = paragraph(current, margin, y, note, 95, 9, false, [0.32, 0.36, 0.4]) - 6;
  }

  pages.forEach((page, index) => drawFooter(page, index + 1, pages.length, template.visualLabel));
  return buildPdf(pages);
}

export function documentDate(value: Date | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }).format(value);
}

export function documentMoney(value: number) {
  return `${new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} EUR`;
}

function drawHeader(page: PdfPage, input: ProfessionalDocumentPdf, brandColor: number[]) {
  const template = documentTemplates[input.kind];
  rect(page, 0, pageHeight - 124, pageWidth, 124, lighten(brandColor, 0.77));
  rect(page, margin, pageHeight - 92, 56, 56, brandColor);
  text(page, margin + 18, pageHeight - 70, "C", 22, true, [0.12, 0.14, 0.16]);
  text(page, margin + 72, pageHeight - 56, input.kind === "budget" ? "PRESUPUESTO" : "FACTURA", 25, true, [0.12, 0.14, 0.16]);
  text(page, margin + 72, pageHeight - 76, template.visualLabel, 9, false, [0.32, 0.36, 0.4]);
  text(page, margin + 72, pageHeight - 92, `Base documental: ${template.sourceDocx}`, 7, false, [0.45, 0.49, 0.54]);

  strokeRect(page, pageWidth - 205, pageHeight - 96, 163, 64, [0.75, 0.67, 0.33]);
  text(page, pageWidth - 192, pageHeight - 55, `N. ${input.documentNumber}`, 12, true, [0.12, 0.14, 0.16]);
  text(page, pageWidth - 192, pageHeight - 73, `Fecha: ${documentDate(input.issueDate)}`, 9, false, [0.32, 0.36, 0.4]);
  text(page, pageWidth - 192, pageHeight - 90, `Estado: ${statusLabel(input.status)}`, 9, false, [0.32, 0.36, 0.4]);
  return pageHeight - 148;
}

function drawContinuationHeader(page: PdfPage, input: ProfessionalDocumentPdf, brandColor: number[]) {
  rect(page, 0, pageHeight - 72, pageWidth, 72, lighten(brandColor, 0.84));
  text(page, margin, pageHeight - 44, `${input.kind === "budget" ? "Presupuesto" : "Factura"} ${input.documentNumber}`, 14, true, [0.12, 0.14, 0.16]);
  text(page, pageWidth - 190, pageHeight - 44, input.client.name, 10, false, [0.32, 0.36, 0.4]);
  return pageHeight - 98;
}

function drawInfoCards(page: PdfPage, y: number, input: ProfessionalDocumentPdf) {
  const cardWidth = (pageWidth - margin * 2 - 16) / 2;
  drawCard(page, margin, y, cardWidth, "Empresa", [
    input.company.name,
    input.company.legalName || "Razón social pendiente",
    input.company.taxId ? `NIF/CIF: ${input.company.taxId}` : "NIF/CIF pendiente",
    input.company.address || "Dirección fiscal pendiente",
    input.company.contact || "Contacto pendiente",
    input.company.iban ? `IBAN: ${input.company.iban}` : ""
  ]);
  drawCard(page, margin + cardWidth + 16, y, cardWidth, "Cliente", [
    input.client.name,
    input.client.taxId ? `NIF/CIF: ${input.client.taxId}` : "NIF/CIF no informado",
    input.client.address || "Dirección no informada",
    input.client.contact || "Contacto no informado"
  ]);
  return y - 116;
}

function drawSummary(page: PdfPage, y: number, input: ProfessionalDocumentPdf) {
  rect(page, margin, y - 66, pageWidth - margin * 2, 66, [0.97, 0.98, 0.99]);
  strokeRect(page, margin, y - 66, pageWidth - margin * 2, 66, [0.86, 0.88, 0.91]);
  text(page, margin + 14, y - 20, input.title, 13, true, [0.12, 0.14, 0.16]);
  const detail = [
    input.work?.title ? `Obra: ${input.work.title}` : "Obra: sin asociar",
    input.work?.address ? `Dirección obra: ${input.work.address}` : input.client.address ? `Dirección: ${input.client.address}` : null,
    input.validUntil ? `Validez: ${documentDate(input.validUntil)}` : null,
    input.dueDate ? `Vencimiento: ${documentDate(input.dueDate)}` : null
  ].filter(Boolean).join(" · ");
  paragraph(page, margin + 14, y - 40, detail || "Documento preparado desde Capataz.", 94, 9, false, [0.32, 0.36, 0.4]);
  return y - 88;
}

function drawLinesTable(
  page: PdfPage,
  startY: number,
  input: ProfessionalDocumentPdf,
  ensure: (height: number) => void,
  currentPage: () => PdfPage,
  setY: (value: number) => void
) {
  let y = startY;
  const widths = [250, 55, 72, 72, 62];
  const x = margin;

  function header(target: PdfPage) {
    text(target, x, y, "Partidas", 13, true, [0.12, 0.14, 0.16]);
    y -= 22;
    rect(target, x, y - 22, pageWidth - margin * 2, 22, [0.12, 0.14, 0.16]);
    const labels = ["Descripción", "Cant.", "Ud.", "Precio", "Total"];
    let cx = x + 8;
    labels.forEach((label, index) => {
      text(target, cx, y - 15, label, 8, true, [1, 1, 1]);
      cx += widths[index];
    });
    y -= 26;
  }

  header(page);
  const lines = input.lines.length ? input.lines : [{ descripcion: input.title, cantidad: 1, unidad: "servicio", precioUnitario: input.totals.base, total: input.totals.base }];

  for (const line of lines) {
    const description = line.categoria ? `${line.descripcion} (${line.categoria})` : line.descripcion;
    const wrapped = wrap(description, 45);
    const rowHeight = Math.max(28, wrapped.length * 11 + 12);
    ensure(rowHeight + 36);
    let target = currentPage();
    if (y - rowHeight < margin + 38) {
      y = pageHeight - 98;
      target = currentPage();
      header(target);
    }
    strokeRect(target, x, y - rowHeight, pageWidth - margin * 2, rowHeight, [0.88, 0.9, 0.93]);
    wrapped.forEach((item, index) => text(target, x + 8, y - 16 - index * 11, item, 8.5, false, [0.18, 0.21, 0.24]));
    text(target, x + widths[0] + 10, y - 17, String(line.cantidad), 8.5, false, [0.18, 0.21, 0.24]);
    text(target, x + widths[0] + widths[1] + 10, y - 17, line.unidad, 8.5, false, [0.18, 0.21, 0.24]);
    text(target, x + widths[0] + widths[1] + widths[2] + 10, y - 17, documentMoney(line.precioUnitario), 8.5, false, [0.18, 0.21, 0.24]);
    text(target, x + widths[0] + widths[1] + widths[2] + widths[3] + 10, y - 17, documentMoney(line.total), 8.5, true, [0.12, 0.14, 0.16]);
    y -= rowHeight;
    setY(y);
  }

  return y - 20;
}

function drawTotals(page: PdfPage, y: number, input: ProfessionalDocumentPdf, brandColor: number[]) {
  const x = pageWidth - margin - 210;
  const rows = [
    ["Base imponible", documentMoney(input.totals.base)],
    input.totals.discount ? ["Descuento", documentMoney(input.totals.discount)] : null,
    [`IVA ${formatPercent(input.totals.ivaPercent)}`, documentMoney(input.totals.ivaTotal)],
    ["Total", documentMoney(input.totals.total)],
    input.totals.paid !== undefined ? ["Pagado", documentMoney(input.totals.paid)] : null,
    input.totals.pending !== undefined ? ["Pendiente", documentMoney(input.totals.pending)] : null
  ].filter(Boolean) as string[][];
  const height = rows.length * 22 + 18;
  rect(page, x, y - height, 210, height, [0.98, 0.98, 0.97]);
  strokeRect(page, x, y - height, 210, height, brandColor);
  let cy = y - 22;
  rows.forEach(([label, value], index) => {
    const isTotal = label === "Total";
    text(page, x + 12, cy, label, isTotal ? 10 : 9, isTotal, [0.12, 0.14, 0.16]);
    text(page, x + 105, cy, value, isTotal ? 10 : 9, isTotal, [0.12, 0.14, 0.16]);
    if (index < rows.length - 1) line(page, x + 12, cy - 9, x + 198, cy - 9, [0.9, 0.91, 0.93]);
    cy -= 22;
  });
  return y - height - 22;
}

function drawCard(page: PdfPage, x: number, y: number, width: number, title: string, lines: string[]) {
  rect(page, x, y - 96, width, 96, [1, 1, 1]);
  strokeRect(page, x, y - 96, width, 96, [0.86, 0.88, 0.91]);
  text(page, x + 12, y - 18, title, 10, true, [0.12, 0.14, 0.16]);
  let cy = y - 36;
  for (const item of lines.filter(Boolean).slice(0, 5)) {
    cy = paragraph(page, x + 12, cy, item, Math.floor(width / 5.1), 8.2, false, [0.32, 0.36, 0.4]) - 2;
  }
}

function drawFooter(page: PdfPage, current: number, total: number, templateName: string) {
  line(page, margin, 34, pageWidth - margin, 34, [0.88, 0.9, 0.93]);
  text(page, margin, 20, `Capataz · ${templateName}`, 7, false, [0.48, 0.52, 0.57]);
  text(page, pageWidth - 92, 20, `Página ${current}/${total}`, 7, false, [0.48, 0.52, 0.57]);
}

function paragraph(page: PdfPage, x: number, y: number, value: string, maxChars: number, size: number, bold: boolean, color: number[]) {
  let cy = y;
  for (const item of wrap(value, maxChars)) {
    text(page, x, cy, item, size, bold, color);
    cy -= size + 3;
  }
  return cy;
}

function text(page: PdfPage, x: number, y: number, value: string, size: number, bold = false, color = [0, 0, 0]) {
  page.content.push(`BT ${rgb(color, "rg")} /${bold ? "F2" : "F1"} ${size} Tf 1 0 0 1 ${num(x)} ${num(y)} Tm (${escapeText(value)}) Tj ET`);
}

function rect(page: PdfPage, x: number, y: number, width: number, height: number, color: number[]) {
  page.content.push(`q ${rgb(color, "rg")} ${num(x)} ${num(y)} ${num(width)} ${num(height)} re f Q`);
}

function strokeRect(page: PdfPage, x: number, y: number, width: number, height: number, color: number[]) {
  page.content.push(`q ${rgb(color, "RG")} ${num(x)} ${num(y)} ${num(width)} ${num(height)} re S Q`);
}

function line(page: PdfPage, x1: number, y1: number, x2: number, y2: number, color: number[]) {
  page.content.push(`q ${rgb(color, "RG")} ${num(x1)} ${num(y1)} m ${num(x2)} ${num(y2)} l S Q`);
}

function buildPdf(pages: PdfPage[]) {
  const pageIds = pages.map((_, index) => 3 + index);
  const fontRegularId = 3 + pages.length;
  const fontBoldId = fontRegularId + 1;
  const contentIds = pages.map((_, index) => fontBoldId + 1 + index);
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`
  ];

  pages.forEach((_, index) => {
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentIds[index]} 0 R >>`
    );
  });

  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");

  pages.forEach((page) => {
    const stream = page.content.join("\n");
    objects.push(`<< /Length ${byteLength(stream)} >>\nstream\n${stream}\nendstream`);
  });

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets[index + 1] = byteLength(pdf);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}

function escapeText(value: string) {
  return ascii(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function ascii(value: string) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "-");
}

function wrap(value: string, max: number) {
  const words = ascii(value).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > max && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function byteLength(value: string) {
  return Buffer.byteLength(value, "latin1");
}

function parseColor(value: string) {
  const match = value.trim().match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!match) return [0.965, 0.788, 0.271];
  return [parseInt(match[1], 16) / 255, parseInt(match[2], 16) / 255, parseInt(match[3], 16) / 255];
}

function lighten(color: number[], amount: number) {
  return color.map((part) => part + (1 - part) * amount);
}

function rgb(color: number[], operator: "rg" | "RG") {
  return `${num(color[0])} ${num(color[1])} ${num(color[2])} ${operator}`;
}

function num(value: number) {
  return Number(value.toFixed(3));
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(value)}%`;
}

