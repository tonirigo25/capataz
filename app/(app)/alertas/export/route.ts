import { publicRequestContext } from "@/lib/platform/request-boundary";
import {
  filterBusinessSignalsForAccess,
  resolveBusinessSignalAccess
} from "@/lib/business-signal-access";
import {
  formatSignalLevel,
  getBusinessSignals,
  signalSourceLabel,
  signalStatusLabel,
  type BusinessSignal
} from "@/lib/business-signals";
import { requireCapability, resolveAuthorization } from "@/lib/commercial/authorization";
import { formatCurrency, formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return publicRequestContext("GET /alertas/export", request, async () => {
    const auth = await requireCapability("reports.export");
    const execution = await resolveAuthorization(auth, "orqena.execute");
    if (!execution.allowed) return new Response("No autorizado.", { status: 403 });

    const url = new URL(request.url);
    const result = await getBusinessSignals({ companyId: auth.companyId, status: "all", limit: 1000 });
    const access = await resolveBusinessSignalAccess(auth);
    const authorized = filterBusinessSignalsForAccess(result.signals, access);
    const workIds = [...new Set(authorized.map((signal) => signal.work?.id).filter((value): value is string => Boolean(value)))];
    const works = workIds.length ? await prisma.work.findMany({
      where: { companyId: auth.companyId, id: { in: workIds } },
      select: { id: true, responsable: true }
    }) : [];
    const responsibleByWork = new Map(works.map((work) => [work.id, work.responsable?.trim() || ""]));
    const signals = authorized.filter((signal) => matchesExport(signal, url.searchParams, responsibleByWork));
    const csv = encodeCsv([
      "Alerta",
      "Resumen",
      "Severidad",
      "Estado",
      "Tipo",
      "Proyecto o cliente",
      "Responsable",
      "Importe relacionado",
      "Prioridad",
      "Fecha"
    ], signals.map((signal) => [
      signal.title,
      signal.summary,
      formatSignalLevel(signal.level),
      signalStatusLabel(signal.status),
      signalSourceLabel(signal.source),
      signal.work?.label ?? signal.client?.label ?? signal.entity?.label ?? "",
      signal.work?.id ? responsibleByWork.get(signal.work.id) ?? "" : "",
      signal.relatedAmount == null ? "" : formatCurrency(signal.relatedAmount),
      signal.score,
      signal.fecha ? formatDate(signal.fecha) : ""
    ]));

    return new Response(`\uFEFF${csv}`, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="orqena-alertas.csv"',
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff"
      }
    });
  });
}

function matchesExport(signal: BusinessSignal, params: URLSearchParams, responsibleByWork: Map<string, string>) {
  const status = params.get("estado");
  if (status === "history" && !["dismissed", "resolved", "expired"].includes(signal.status)) return false;
  if (status && status !== "all" && status !== "history" && signal.status !== status) return false;
  const level = params.get("nivel");
  if (level && level !== "all" && signal.level !== level) return false;
  const source = params.get("origen");
  if (source && source !== "all" && signal.source !== source) return false;
  const responsible = params.get("responsable");
  if (responsible && responsible !== "all" && (!signal.work?.id || responsibleByWork.get(signal.work.id) !== responsible)) return false;
  const date = signal.fecha ?? signal.detectedAt;
  const from = parseDate(params.get("desde"), false);
  const to = parseDate(params.get("hasta"), true);
  if (from && date < from) return false;
  if (to && date > to) return false;
  const q = params.get("q")?.trim().toLocaleLowerCase("es-ES");
  if (!q) return true;
  return [signal.title, signal.summary, signal.work?.label, signal.client?.label, signal.entity?.label]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLocaleLowerCase("es-ES")
    .includes(q);
}

function parseDate(value: string | null, endOfDay: boolean) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function encodeCsv(headers: string[], rows: Array<Array<string | number>>) {
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

function csvCell(value: string | number) {
  let text = String(value);
  if (typeof value === "string" && (/^[\t\r\n]/.test(text) || /^[=+\-@]/.test(text.trimStart()))) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
