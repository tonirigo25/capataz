import Link from "next/link";
import {
  Activity,
  Banknote,
  Bell,
  BriefcaseBusiness,
  CalendarClock,
  FileText,
  Files,
  Receipt,
  UserRound,
  Users,
  WalletCards
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { CompactFilterBar, EmptyState, ResultCount } from "@/components/ui-primitives";
import {
  ACTIVITY_KIND_OPTIONS,
  ACTIVITY_PERIOD_OPTIONS,
  getActivityFeed,
  type ActivityKind,
  type ActivityPeriod
} from "@/lib/activity";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const iconByKind: Record<ActivityKind, LucideIcon> = {
  cliente: Users,
  contacto: UserRound,
  obra: BriefcaseBusiness,
  presupuesto: FileText,
  factura: Receipt,
  pago: WalletCards,
  gasto: Banknote,
  agenda: CalendarClock,
  nota: Bell,
  documento: Files
};

export default async function ActivityPage({
  searchParams
}: {
  searchParams: Promise<{ tipo?: string; periodo?: string }>;
}) {
  const query = await searchParams;
  const selectedKind = parseKind(query.tipo);
  const selectedPeriod = parsePeriod(query.periodo);
  const items = await getActivityFeed({ kind: selectedKind, period: selectedPeriod });

  return (
    <main className="screen">
      <SectionHeader
        title="Actividad"
        description="Cambios recientes de clientes, obras, documentos, agenda y cobros. No muestra logs técnicos internos."
      />

      <CompactFilterBar className="mb-4"><section className="grid gap-3 lg:grid-cols-[1fr_auto]">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {ACTIVITY_KIND_OPTIONS.map((option) => (
            <Link
              key={option.id}
              href={`/actividad?tipo=${option.id}&periodo=${selectedPeriod}`}
              className={`shrink-0 rounded-lg px-3 py-2 text-sm font-black ${selectedKind === option.id ? "bg-obra-ink text-white" : "border border-slate-200 bg-white text-obra-ink"}`}
            >
              {option.label}
            </Link>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {ACTIVITY_PERIOD_OPTIONS.map((option) => (
            <Link
              key={option.id}
              href={`/actividad?tipo=${selectedKind}&periodo=${option.id}`}
              className={`shrink-0 rounded-lg px-3 py-2 text-sm font-black ${selectedPeriod === option.id ? "bg-obra-yellow text-obra-ink" : "border border-slate-200 bg-white text-obra-ink"}`}
            >
              {option.label}
            </Link>
          ))}
        </div>
      </section></CompactFilterBar>

      <ResultCount shown={items.length} total={items.length} noun="movimientos" />

      {items.length ? (
        <section className="grid gap-3" aria-label="Actividad reciente">
          {items.map((item) => {
            const Icon = iconByKind[item.kind];
            return (
              <article key={item.id} className="card p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-xs font-black uppercase text-slate-500">
                      <Icon size={16} className="shrink-0 text-obra-yellowDark" aria-hidden="true" />
                      {item.label} · {formatDate(item.date)}
                    </p>
                    <h2 className="mt-1 text-base font-black text-obra-ink">{item.title}</h2>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{item.detail}</p>
                    <p className="mt-2 text-xs font-bold text-slate-500">
                      {item.entity}
                      {item.actor ? ` · Autor ${item.actor}` : ""}
                    </p>
                  </div>
                  <Link href={item.href} className="secondary-button shrink-0">
                    Abrir
                  </Link>
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <EmptyState title="Sin actividad en este filtro" description="Prueba con otro periodo o tipo. La actividad se deriva de entidades reales del sistema." icon={Activity} />
      )}
    </main>
  );
}

function parseKind(value?: string): ActivityKind | "todos" {
  const match = ACTIVITY_KIND_OPTIONS.find((option) => option.id === value);
  return match?.id ?? "todos";
}

function parsePeriod(value?: string): ActivityPeriod {
  const match = ACTIVITY_PERIOD_OPTIONS.find((option) => option.id === value);
  return match?.id ?? "30d";
}
