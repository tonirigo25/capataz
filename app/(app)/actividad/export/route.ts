import type { ActivityPeriod } from "@/lib/activity";
import { getActivityWorkspace, type ActivitySection } from "@/lib/activity-workspace";
import { requireCapability } from "@/lib/commercial/authorization";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireCapability("reports.view");
  const params = new URL(request.url).searchParams;
  const period = parsePeriod(params.get("periodo"));
  const section = parseSection(params.get("seccion") ?? params.get("tipo"));
  const query = params.get("q")?.trim().toLocaleLowerCase("es") ?? "";
  const workId = params.get("obra");
  const actorId = params.get("equipo");
  const date = params.get("fecha");
  const workspace = await getActivityWorkspace(auth.companyId, period);
  const items = workspace.items.filter((item) => {
    if (section !== "all" && item.section !== section) return false;
    if (workId && item.workId !== workId) return false;
    if (actorId && item.actor !== actorId) return false;
    if (date && localDateKey(item.date) !== date) return false;
    if (query && ![item.label, item.title, item.detail, item.entity, item.workTitle, item.actorName].filter(Boolean).join(" ").toLocaleLowerCase("es").includes(query)) return false;
    return true;
  });

  const rows = [
    ["fecha", "hora", "tipo", "evento", "detalle", "obra", "responsable", "destino"],
    ...items.map((item) => [
      localDateKey(item.date),
      new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit", hour12: false }).format(item.date),
      item.label,
      item.title,
      item.detail,
      item.workTitle ?? "",
      item.actorName ?? "",
      item.href,
    ]),
  ];
  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="actividad-orqena-${localDateKey(new Date())}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function parsePeriod(value: string | null): ActivityPeriod {
  return value === "7d" || value === "90d" || value === "todo" ? value : "30d";
}

function parseSection(value: string | null): ActivitySection {
  const direct: ActivitySection[] = ["all", "operational", "updates", "orders", "incidents", "milestones", "files", "comments"];
  if (value && direct.includes(value as ActivitySection)) return value as ActivitySection;
  return "all";
}

function localDateKey(value: Date) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
}
