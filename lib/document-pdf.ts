import type { DocumentTemplateKind } from "@/lib/document-templates";

export type ProfessionalDocumentLine = {
  codigo?: string | null;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precioUnitario: number;
  descuento?: number | null;
  ivaPercent?: number | null;
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
    clientVisibleText(input.conditions) ? `Condiciones: ${clientVisibleText(input.conditions)}` : null,
    clientVisibleText(input.paymentMethod) ? `Forma de pago: ${clientVisibleText(input.paymentMethod)}` : null,
    input.kind === "invoice" && clientVisibleText(input.company.iban) ? `Datos bancarios: ${clientVisibleText(input.company.iban)}` : null,
    clientVisibleText(input.company.legalText) ? clientVisibleText(input.company.legalText) : null
  ].filter(Boolean) as string[];

  for (const note of notes) {
    ensure(34);
    y = paragraph(current, margin, y, note, 95, 9, false, [0.32, 0.36, 0.4]) - 6;
  }

  pages.forEach((page, index) => drawFooter(page, index + 1, pages.length, input));
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
  rect(page, 0, pageHeight - 122, pageWidth, 122, lighten(brandColor, 0.78));
  rect(page, margin, pageHeight - 90, 54, 54, brandColor);
  text(page, margin + 18, pageHeight - 68, "C", 21, true, [0.12, 0.14, 0.16]);
  text(page, margin + 70, pageHeight - 54, input.kind === "budget" ? "PRESUPUESTO" : "FACTURA", 25, true, [0.12, 0.14, 0.16]);
  text(page, margin + 70, pageHeight - 75, `N. ${input.documentNumber}`, 11, true, [0.24, 0.27, 0.31]);
  text(page, margin + 70, pageHeight - 92, `Fecha: ${documentDate(input.issueDate)}`, 9, false, [0.32, 0.36, 0.4]);

  const dates = [
    input.validUntil ? `Validez: ${documentDate(input.validUntil)}` : null,
    input.dueDate ? `Vencimiento: ${documentDate(input.dueDate)}` : null
  ].filter(Boolean);
  if (dates.length) text(page, margin + 70, pageHeight - 108, dates.join(" · "), 8, false, [0.32, 0.36, 0.4]);

  const companyX = pageWidth - 250;
  const companyLines = [
    input.company.name,
    input.company.legalName && input.company.legalName !== input.company.name ? input.company.legalName : null,
    input.company.taxId ? `NIF/CIF: ${input.company.taxId}` : null
  ].filter((line): line is string => Boolean(clientVisibleText(line)));
  let cy = pageHeight - 48;
  for (const item of companyLines.slice(0, 4)) {
    cy = paragraph(page, companyX, cy, item, 46, item === input.company.name ? 9.5 : 7.6, item === input.company.name, [0.18, 0.21, 0.24]) - 1;
  }
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
  drawCard(page, margin, y, cardWidth, 154, "Empresa", [
    input.company.name,
    input.company.legalName,
    input.company.taxId ? `NIF/CIF: ${input.company.taxId}` : "",
    input.company.address,
    ...contactLines(input.company.contact),
    input.kind === "invoice" ? input.company.iban : ""
  ]);
  drawCard(page, margin + cardWidth + 16, y, cardWidth, 154, "Cliente", [
    input.client.name,
    input.client.taxId ? `NIF/CIF: ${input.client.taxId}` : "",
    input.client.address,
    ...contactLines(input.client.contact)
  ]);
  return y - 174;
}

function drawSummary(page: PdfPage, y: number, input: ProfessionalDocumentPdf) {
  rect(page, margin, y - 66, pageWidth - margin * 2, 66, [0.97, 0.98, 0.99]);
  strokeRect(page, margin, y - 66, pageWidth - margin * 2, 66, [0.86, 0.88, 0.91]);
  const title = clientVisibleText(input.title) || defaultDocumentTitle(input.kind);
  text(page, margin + 14, y - 20, title, 13, true, [0.12, 0.14, 0.16]);
  const workTitle = clientVisibleText(input.work?.title);
  const workAddress = clientVisibleText(input.work?.address);
  const clientAddress = clientVisibleText(input.client.address);
  const detail = [
    workTitle ? `Obra: ${workTitle}` : null,
    workAddress ? `Dirección obra: ${workAddress}` : clientAddress ? `Dirección: ${clientAddress}` : null,
    input.validUntil ? `Validez: ${documentDate(input.validUntil)}` : null,
    input.dueDate ? `Vencimiento: ${documentDate(input.dueDate)}` : null
  ].filter(Boolean).join(" · ");
  paragraph(page, margin + 14, y - 40, detail || "Detalle del trabajo.", 94, 9, false, [0.32, 0.36, 0.4]);
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
  const columns = [
    { label: "Cod.", width: 42 },
    { label: "Descripción", width: 178 },
    { label: "Cant.", width: 35 },
    { label: "Ud.", width: 34 },
    { label: "P. unit.", width: 62 },
    { label: "Dto.", width: 38 },
    { label: "IVA", width: 36 },
    { label: "Total", width: 76 }
  ];
  const x = margin;

  function header(target: PdfPage) {
    text(target, x, y, "Partidas", 13, true, [0.12, 0.14, 0.16]);
    y -= 22;
    rect(target, x, y - 22, pageWidth - margin * 2, 22, [0.12, 0.14, 0.16]);
    let cx = x + 7;
    columns.forEach((column) => {
      text(target, cx, y - 15, column.label, 7.2, true, [1, 1, 1]);
      cx += column.width;
    });
    y -= 26;
  }

  header(page);
  const title = clientVisibleText(input.title) || defaultDocumentTitle(input.kind);
  const lines = input.lines.length ? input.lines : [{ descripcion: title, cantidad: 1, unidad: "servicio", precioUnitario: input.totals.base, total: input.totals.base }];

  for (const line of lines) {
    const lineDescription = clientVisibleText(line.descripcion) || title;
    const description = line.categoria ? `${lineDescription} (${line.categoria})` : lineDescription;
    const wrapped = wrap(description, 34);
    const rowHeight = Math.max(28, wrapped.length * 11 + 12);
    ensure(rowHeight + 36);
    let target = currentPage();
    if (y - rowHeight < margin + 38) {
      y = pageHeight - 98;
      target = currentPage();
      header(target);
    }
    strokeRect(target, x, y - rowHeight, pageWidth - margin * 2, rowHeight, [0.88, 0.9, 0.93]);
    let cx = x + 7;
    text(target, cx, y - 17, clientVisibleText(line.codigo) || "-", 7.2, false, [0.18, 0.21, 0.24]);
    cx += columns[0].width;
    wrapped.forEach((item, index) => text(target, cx, y - 16 - index * 11, item, 7.8, false, [0.18, 0.21, 0.24]));
    cx += columns[1].width;
    text(target, cx, y - 17, String(line.cantidad), 7.6, false, [0.18, 0.21, 0.24]);
    cx += columns[2].width;
    text(target, cx, y - 17, line.unidad, 7.6, false, [0.18, 0.21, 0.24]);
    cx += columns[3].width;
    text(target, cx, y - 17, documentMoney(line.precioUnitario), 7.2, false, [0.18, 0.21, 0.24]);
    cx += columns[4].width;
    text(target, cx, y - 17, line.descuento ? documentMoney(line.descuento) : "-", 7.2, false, [0.18, 0.21, 0.24]);
    cx += columns[5].width;
    text(target, cx, y - 17, formatPercent(line.ivaPercent ?? input.totals.ivaPercent), 7.2, false, [0.18, 0.21, 0.24]);
    cx += columns[6].width;
    text(target, cx, y - 17, documentMoney(line.total), 7.2, true, [0.12, 0.14, 0.16]);
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

function drawCard(page: PdfPage, x: number, y: number, width: number, height: number, title: string, lines: Array<string | null | undefined>) {
  rect(page, x, y - height, width, height, [1, 1, 1]);
  strokeRect(page, x, y - height, width, height, [0.86, 0.88, 0.91]);
  text(page, x + 12, y - 18, title, 10, true, [0.12, 0.14, 0.16]);
  let cy = y - 36;
  for (const item of lines.map(clientVisibleText).filter(Boolean).slice(0, 8)) {
    const nextY = paragraph(page, x + 12, cy, item, Math.floor(width / 5.3), 7.4, false, [0.32, 0.36, 0.4]) - 2;
    if (nextY < y - height + 12) break;
    cy = nextY;
  }
}

function drawFooter(page: PdfPage, current: number, total: number, input: ProfessionalDocumentPdf) {
  line(page, margin, 34, pageWidth - margin, 34, [0.88, 0.9, 0.93]);
  const footerCompany = clientVisibleText(input.company.legalName) || clientVisibleText(input.company.name) || "Empresa";
  text(page, margin, 20, `${footerCompany} · ${input.documentNumber}`, 7, false, [0.48, 0.52, 0.57]);
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

function clientVisibleText(value: string | null | undefined) {
  const textValue = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!textValue) return "";
  const normalized = normalizeForFilter(textValue);
  const forbidden = [
    "creado desde chat",
    "creada desde chat",
    "creado desde presupuesto",
    "creada desde presupuesto",
    "creado desde plantilla",
    "creada desde plantilla",
    "revisar datos fiscales",
    "revisar antes de enviar",
    "no enviar sin confirmacion",
    "sin pagos registrados",
    "documento interno",
    "borrador",
    "estado: borrador",
    "plantilla",
    "instruccion del usuario",
    "gestoria",
    "pendiente de acordar",
    "pendiente de revisar",
    "direccion pendiente",
    "direccion fiscal pendiente",
    "contacto pendiente",
    "nif/cif pendiente",
    "datos pendientes",
    "trabajo pendiente de definir",
    "preparada por capataz",
    "preparado por capataz",
    "provisional"
  ];
  if (normalized === "pendiente" || normalized === "sin informar" || normalized === "no informado") return "";
  return forbidden.some((item) => normalized.includes(item)) ? "" : textValue;
}

function defaultDocumentTitle(kind: DocumentTemplateKind) {
  return kind === "invoice" ? "Trabajos realizados" : "Trabajos presupuestados";
}

function contactLines(value: string | null | undefined) {
  return String(value ?? "")
    .split(/·|\||;/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeForFilter(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function wrap(value: string, max: number) {
  const words = ascii(value)
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((word) => breakLongWord(word, Math.max(8, max)));
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

function breakLongWord(word: string, max: number) {
  if (word.length <= max) return [word];
  const parts: string[] = [];
  for (let index = 0; index < word.length; index += max) {
    parts.push(word.slice(index, index + max));
  }
  return parts;
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
