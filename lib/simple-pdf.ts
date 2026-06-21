type PdfLine = {
  text: string;
  size?: number;
  bold?: boolean;
  gap?: number;
};

export function createSimplePdf(title: string, lines: PdfLine[], watermark?: string | null) {
  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 48;
  const content: string[] = ["BT"];
  let y = pageHeight - margin;

  if (watermark) {
    content.push("q");
    content.push("0.88 0.88 0.88 rg");
    content.push("BT /F2 54 Tf 110 430 Td 20 Tr");
    content.push(`(${escapeText(watermark)}) Tj`);
    content.push("ET");
    content.push("Q");
    content.push("BT");
  }

  addText(content, margin, y, title, 22, true);
  y -= 34;
  addRule(content, margin, y, pageWidth - margin * 2);
  y -= 24;

  for (const line of lines) {
    const wrapped = wrap(line.text, line.size && line.size > 13 ? 64 : 88);
    for (const item of wrapped) {
      if (y < margin + 24) break;
      addText(content, margin, y, item, line.size ?? 10, line.bold);
      y -= line.gap ?? (line.size && line.size > 13 ? 20 : 15);
    }
  }

  content.push("ET");
  const stream = content.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    `<< /Length ${byteLength(stream)} >>\nstream\n${stream}\nendstream`
  ];

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

export function pdfDate(value: Date | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }).format(value);
}

function addText(content: string[], x: number, y: number, value: string, size: number, bold = false) {
  content.push(`/${bold ? "F2" : "F1"} ${size} Tf ${x} ${y} Td (${escapeText(value)}) Tj ${-x} ${-y} Td`);
}

function addRule(content: string[], x: number, y: number, width: number) {
  content.push("ET");
  content.push(`0.82 0.82 0.82 RG ${x} ${y} m ${x + width} ${y} l S`);
  content.push("BT");
}

function escapeText(value: string) {
  return ascii(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function ascii(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "-");
}

function wrap(value: string, max: number) {
  const words = ascii(value).split(/\s+/);
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
  return lines;
}

function byteLength(value: string) {
  return Buffer.byteLength(value, "latin1");
}
