import Link from "next/link";
import { Bell, BellOff, CheckCheck, ChevronRight } from "lucide-react";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/app/(app)/notificaciones/actions";
import { SectionHeader } from "@/components/section-header";
import { EmptyState } from "@/components/ui-primitives";
import { formatDate } from "@/lib/format";
import { getNotificationItems } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const notifications = await getNotificationItems();
  const unread = notifications.filter((item) => !item.readAt);

  return (
    <main className="screen">
      <SectionHeader
        title="Notificaciones"
        description="Avisos internos derivados de facturas, visitas, recordatorios, presupuestos, obras y datos incompletos. No envía mensajes externos."
        action={
          unread.length ? (
            <form action={markAllNotificationsReadAction}>
              <button className="secondary-button" type="submit">
                <CheckCheck size={18} />
                Marcar todas
              </button>
            </form>
          ) : null
        }
      />

      <section className="mb-4 grid gap-3 sm:grid-cols-3">
        <Metric label="No leídas" value={unread.length} />
        <Metric label="Críticas" value={notifications.filter((item) => item.priority === "critica").length} />
        <Metric label="Total activas" value={notifications.length} />
      </section>

      {notifications.length ? (
        <div className="grid gap-3">
          {notifications.map((notification) => (
            <article key={notification.sourceKey} className={`rounded-xl border bg-white p-4 shadow-soft ${notification.readAt ? "border-slate-200 opacity-75" : toneClass(notification.priority)}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase text-slate-500">{notification.type.replaceAll("_", " ")} · {formatDate(notification.date)}</p>
                  <h2 className="mt-1 text-base font-black text-obra-ink">{notification.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{notification.body}</p>
                </div>
                <span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-black ${priorityClass(notification.priority)}`}>
                  {notification.priority}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={notification.href} className="secondary-button">
                  <ChevronRight size={18} />
                  Abrir
                </Link>
                {!notification.readAt ? (
                  <form action={markNotificationReadAction}>
                    <input type="hidden" name="sourceKey" value={notification.sourceKey} />
                    <button className="secondary-button" type="submit">Marcar leída</button>
                  </form>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Sin notificaciones pendientes"
          description="Cuando existan facturas vencidas, visitas próximas, recordatorios, documentos pendientes o datos importantes incompletos aparecerán aquí."
          icon={BellOff}
        />
      )}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-soft">
      <Bell size={19} className="text-obra-yellowDark" />
      <p className="mt-2 text-sm font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-obra-ink">{value}</p>
    </article>
  );
}

function toneClass(priority: string) {
  if (priority === "critica") return "border-red-300";
  if (priority === "alta") return "border-amber-300";
  return "border-slate-200";
}

function priorityClass(priority: string) {
  if (priority === "critica") return "bg-red-100 text-red-800";
  if (priority === "alta") return "bg-amber-100 text-amber-900";
  if (priority === "baja") return "bg-slate-100 text-slate-600";
  return "bg-blue-50 text-blue-700";
}
