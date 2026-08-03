import Link from "next/link";
import {
  AlertCircle,
  Bell,
  BellOff,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  FileText,
  Filter,
  Info,
  Search,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import type { NotificationPriority } from "@prisma/client";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/app/(app)/notificaciones/actions";
import { AlertsRailContext, type AlertsRailContextValue } from "@/components/portal/alerts-rail-context";
import { formatDate } from "@/lib/format";
import { getNotificationItems, type NotificationItem } from "@/lib/notifications";
import styles from "./notifications-page.module.css";

export const dynamic = "force-dynamic";

type NotificationTab = "all" | "unread" | "critical" | "clients" | "work" | "money" | "system";
type NotificationQuery = {
  tab?: string;
  prioridad?: string;
  origen?: string;
  estado?: string;
  q?: string;
  seleccion?: string;
  pagina?: string;
};

const PAGE_SIZE = 8;
const tabs: Array<{ value: NotificationTab; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "unread", label: "No leídas" },
  { value: "critical", label: "Críticas" },
  { value: "clients", label: "Clientes" },
  { value: "work", label: "Obras" },
  { value: "money", label: "Dinero" },
  { value: "system", label: "Sistema" },
];

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<NotificationQuery> }) {
  const [notifications, rawQuery] = await Promise.all([getNotificationItems(), searchParams]);
  const query = normalizeQuery(rawQuery);
  const unread = notifications.filter((item) => !item.readAt);
  const critical = notifications.filter((item) => item.priority === "critica");
  const filtered = filterNotifications(notifications, query);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(query.page, totalPages);
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selected = filtered.find((item) => item.sourceKey === query.selected) ?? visible[0] ?? null;
  const today = notifications.filter((item) => isSameLocalDay(item.date, new Date())).length;
  const week = notifications.filter((item) => isWithinCurrentWeek(item.date, new Date())).length;
  const top = unread.find((item) => item.priority === "critica") ?? unread[0] ?? selected;
  const railContext: AlertsRailContextValue = {
    mode: "notifications",
    activeCritical: unread.filter((item) => item.priority === "critica").length,
    activeTotal: unread.length,
    topTitle: top?.title ?? null,
    topDescription: top?.body ?? null,
    topAmount: null,
    topHref: top?.href ?? null,
    actions: unread.slice(0, 4).map((item) => ({ id: item.sourceKey, title: item.title, href: item.href })),
  };

  return (
    <main className={styles.page} data-notifications-center>
      <AlertsRailContext value={railContext} />

      <header className={styles.header}>
        <div>
          <h1>Notificaciones</h1>
          <p>Centro de notificaciones de tu organización.</p>
        </div>
      </header>

      <section className={styles.metrics} aria-label="Resumen de notificaciones">
        <MetricCard
          href={buildUrl(query, { tab: "critical", page: 1 })}
          icon={ShieldAlert}
          label="Pendientes críticas"
          value={critical.filter((item) => !item.readAt).length}
          linkLabel="Ver críticas"
          tone="critical"
        />
        <MetricCard href={buildUrl(query, { tab: "all", page: 1 })} icon={CalendarDays} label="Hoy" value={today} linkLabel="Ver hoy" tone="info" />
        <MetricCard href={buildUrl(query, { tab: "all", page: 1 })} icon={Clock3} label="Esta semana" value={week} linkLabel="Ver semana" tone="success" />
      </section>

      <section className={styles.center} aria-label="Centro de notificaciones">
        <nav className={styles.tabs} aria-label="Categorías de notificaciones">
          {tabs.map((tab) => {
            const count = tab.value === "unread" ? unread.length : tab.value === "critical" ? critical.length : null;
            return (
              <Link key={tab.value} href={buildUrl(query, { tab: tab.value, page: 1, selected: null })} aria-current={query.tab === tab.value ? "page" : undefined}>
                {tab.label}{count != null ? <span>{count}</span> : null}
              </Link>
            );
          })}
        </nav>

        <div className={styles.filterBar}>
          <form className={styles.filters} method="get">
            <input type="hidden" name="tab" value={query.tab} />
            <label>
              <span className="sr-only">Prioridad</span>
              <select name="prioridad" defaultValue={query.priority} aria-label="Filtrar por prioridad">
                <option value="all">Todas las prioridades</option>
                <option value="critica">Críticas</option>
                <option value="alta">Altas</option>
                <option value="media">Medias</option>
                <option value="baja">Bajas</option>
              </select>
              <ChevronRight size={13} aria-hidden="true" />
            </label>
            <label>
              <span className="sr-only">Origen</span>
              <select name="origen" defaultValue={query.origin} aria-label="Filtrar por origen">
                <option value="all">Todos los orígenes</option>
                <option value="clients">Clientes</option>
                <option value="work">Obras</option>
                <option value="money">Dinero</option>
                <option value="system">Sistema</option>
              </select>
              <ChevronRight size={13} aria-hidden="true" />
            </label>
            <label>
              <span className="sr-only">Estado</span>
              <select name="estado" defaultValue={query.state} aria-label="Filtrar por estado">
                <option value="all">Todos los estados</option>
                <option value="unread">No leídas</option>
                <option value="read">Leídas</option>
              </select>
              <ChevronRight size={13} aria-hidden="true" />
            </label>
            <label className={styles.searchField}>
              <Search size={14} aria-hidden="true" />
              <input name="q" defaultValue={query.search} placeholder="Buscar notificación…" aria-label="Buscar notificaciones" />
            </label>
            <button className={styles.filterButton} type="submit"><Filter size={14} aria-hidden="true" />Filtrar</button>
          </form>
          {unread.length ? (
            <form action={markAllNotificationsReadAction}>
              <button className={styles.markAllButton} type="submit"><CheckCheck size={15} aria-hidden="true" />Marcar todo como leído</button>
            </form>
          ) : null}
        </div>

        {filtered.length ? (
          <div className={styles.workspace}>
            <section className={styles.listPanel} aria-labelledby="notification-list-title">
              <header className={styles.panelHeader}>
                <h2 id="notification-list-title">{listHeading(query.tab)}</h2>
                <span>{filtered.length}</span>
              </header>
              <div className={styles.notificationList}>
                {visible.map((item) => (
                  <NotificationRow key={item.sourceKey} item={item} selected={selected?.sourceKey === item.sourceKey} query={query} />
                ))}
              </div>
              <Pagination page={page} totalPages={totalPages} total={filtered.length} query={query} />
            </section>

            <section className={styles.detailPanel} aria-live="polite">
              {selected ? <NotificationDetail item={selected} query={query} /> : null}
            </section>
          </div>
        ) : (
          <div className={styles.empty}>
            <BellOff size={28} aria-hidden="true" />
            <div><h2>Sin coincidencias</h2><p>No hay notificaciones que cumplan los filtros actuales.</p></div>
            <Link href="/notificaciones">Limpiar filtros</Link>
          </div>
        )}
      </section>
    </main>
  );
}

function MetricCard({ href, icon: Icon, label, value, linkLabel, tone }: { href: string; icon: typeof Bell; label: string; value: number; linkLabel: string; tone: "critical" | "info" | "success" }) {
  return <Link href={href} className={styles.metricCard} data-tone={tone}><span className={styles.metricIcon}><Icon size={18} aria-hidden="true" /></span><span><small>{label}</small><strong>{value}</strong><em>{linkLabel}</em></span></Link>;
}

function NotificationRow({ item, selected, query }: { item: NotificationItem; selected: boolean; query: NormalizedQuery }) {
  const meta = notificationMeta(item);
  const Icon = meta.icon;
  return (
    <Link
      href={buildUrl(query, { selected: item.sourceKey })}
      className={styles.notificationRow}
      data-selected={selected ? "true" : "false"}
      data-read={item.readAt ? "true" : "false"}
      aria-current={selected ? "true" : undefined}
    >
      <span className={styles.rowIcon} data-tone={meta.tone}><Icon size={16} aria-hidden="true" /></span>
      <span className={styles.rowCopy}>
        <strong>{item.title}</strong>
        <span>{item.body}</span>
        <small>{meta.originLabel}<i aria-hidden="true">·</i>{relativeDate(item.date)}</small>
      </span>
      <span className={styles.priority} data-priority={item.priority}>{priorityLabel(item.priority)}</span>
      {!item.readAt ? <i className={styles.unreadDot}><span className="sr-only">No leída</span></i> : null}
    </Link>
  );
}

function NotificationDetail({ item, query }: { item: NotificationItem; query: NormalizedQuery }) {
  const meta = notificationMeta(item);
  const Icon = meta.icon;
  return (
    <article className={styles.detail}>
      <header>
        <div>
          <span className={styles.detailIcon} data-tone={meta.tone}><Icon size={17} aria-hidden="true" /></span>
          <div><h2>{item.title}</h2><span className={styles.priority} data-priority={item.priority}>{priorityLabel(item.priority)}</span></div>
        </div>
        <Link href={buildUrl(query, { selected: null })} aria-label="Cerrar detalle">×</Link>
      </header>

      <p className={styles.detailLead}>{item.body}</p>
      <dl className={styles.metadata}>
        <div><dt>Origen</dt><dd>{meta.originLabel}</dd></div>
        <div><dt>Estado</dt><dd><span className={item.readAt ? styles.readState : styles.unreadState}>{item.readAt ? "Leída" : "Pendiente"}</span></dd></div>
        <div><dt>Fecha / Hora</dt><dd>{formatDate(item.date)}</dd></div>
        <div><dt>Prioridad</dt><dd>{priorityLabel(item.priority)}</dd></div>
        <div><dt>Tipo</dt><dd>{humanize(item.type)}</dd></div>
        <div><dt>Entidad</dt><dd>{humanize(item.entityType)}</dd></div>
      </dl>

      <section className={styles.impact} aria-labelledby="notification-impact">
        <h3 id="notification-impact">Contexto</h3>
        <div>
          <article data-tone={meta.tone}><Icon size={16} aria-hidden="true" /><span><small>Afecta a</small><strong>{meta.originLabel}</strong></span></article>
          <article data-tone={item.priority === "critica" || item.priority === "alta" ? "critical" : "info"}><AlertCircle size={16} aria-hidden="true" /><span><small>Atención</small><strong>{attentionLabel(item.priority)}</strong></span></article>
        </div>
      </section>

      <section className={styles.description}>
        <h3>Descripción</h3>
        <p>Este aviso se ha generado a partir de datos reales visibles para tu perfil. Revisa la entidad de origen antes de ejecutar cualquier cambio.</p>
      </section>

      <section className={styles.related}>
        <h3>Elemento relacionado</h3>
        <Link href={item.href}><FileText size={14} aria-hidden="true" /><span><strong>{item.title}</strong><small>{meta.originLabel} · {humanize(item.entityType)}</small></span><ChevronRight size={14} aria-hidden="true" /></Link>
      </section>

      <footer className={styles.actions}>
        <Link className={styles.primaryAction} href={item.href}>Abrir origen<ChevronRight size={15} aria-hidden="true" /></Link>
        {!item.readAt ? <form action={markNotificationReadAction}><input type="hidden" name="sourceKey" value={item.sourceKey} /><button type="submit"><CheckCheck size={15} aria-hidden="true" />Marcar como leída</button></form> : <span><CheckCheck size={15} aria-hidden="true" />Notificación leída</span>}
      </footer>
    </article>
  );
}

function Pagination({ page, totalPages, total, query }: { page: number; totalPages: number; total: number; query: NormalizedQuery }) {
  const first = total ? (page - 1) * PAGE_SIZE + 1 : 0;
  const last = Math.min(total, page * PAGE_SIZE);
  return (
    <footer className={styles.pagination}>
      <span>{first}–{last} de {total} notificaciones</span>
      <nav aria-label="Paginación de notificaciones">
        <Link href={buildUrl(query, { page: Math.max(1, page - 1), selected: null })} aria-disabled={page === 1}><ChevronLeft size={14} aria-hidden="true" /></Link>
        {Array.from({ length: Math.min(totalPages, 4) }, (_, index) => index + 1).map((value) => <Link key={value} href={buildUrl(query, { page: value, selected: null })} aria-current={page === value ? "page" : undefined}>{value}</Link>)}
        {totalPages > 4 ? <span>…</span> : null}
        {totalPages > 4 ? <Link href={buildUrl(query, { page: totalPages, selected: null })} aria-current={page === totalPages ? "page" : undefined}>{totalPages}</Link> : null}
        <Link href={buildUrl(query, { page: Math.min(totalPages, page + 1), selected: null })} aria-disabled={page === totalPages}><ChevronRight size={14} aria-hidden="true" /></Link>
      </nav>
    </footer>
  );
}

type NormalizedQuery = { tab: NotificationTab; priority: string; origin: string; state: string; search: string; selected: string | null; page: number };

function normalizeQuery(query: NotificationQuery): NormalizedQuery {
  const tab = tabs.some((item) => item.value === query.tab) ? query.tab as NotificationTab : "all";
  const priority = ["all", "critica", "alta", "media", "baja"].includes(query.prioridad ?? "") ? query.prioridad! : "all";
  const origin = ["all", "clients", "work", "money", "system"].includes(query.origen ?? "") ? query.origen! : "all";
  const state = ["all", "unread", "read"].includes(query.estado ?? "") ? query.estado! : "all";
  const parsedPage = Number.parseInt(query.pagina ?? "1", 10);
  return { tab, priority, origin, state, search: query.q?.trim() ?? "", selected: query.seleccion?.trim() || null, page: Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1 };
}

function filterNotifications(items: NotificationItem[], query: NormalizedQuery) {
  const search = query.search.toLocaleLowerCase("es-ES");
  return items.filter((item) => {
    const category = notificationMeta(item).category;
    if (query.tab === "unread" && item.readAt) return false;
    if (query.tab === "critical" && item.priority !== "critica") return false;
    if (["clients", "work", "money", "system"].includes(query.tab) && category !== query.tab) return false;
    if (query.priority !== "all" && item.priority !== query.priority) return false;
    if (query.origin !== "all" && category !== query.origin) return false;
    if (query.state === "unread" && item.readAt) return false;
    if (query.state === "read" && !item.readAt) return false;
    if (search && !`${item.title} ${item.body} ${item.type}`.toLocaleLowerCase("es-ES").includes(search)) return false;
    return true;
  });
}

function buildUrl(query: NormalizedQuery, changes: Partial<{ tab: NotificationTab; priority: string; origin: string; state: string; search: string; selected: string | null; page: number }>) {
  const next = { ...query, ...changes };
  const params = new URLSearchParams();
  if (next.tab !== "all") params.set("tab", next.tab);
  if (next.priority !== "all") params.set("prioridad", next.priority);
  if (next.origin !== "all") params.set("origen", next.origin);
  if (next.state !== "all") params.set("estado", next.state);
  if (next.search) params.set("q", next.search);
  if (next.selected) params.set("seleccion", next.selected);
  if (next.page > 1) params.set("pagina", String(next.page));
  const suffix = params.toString();
  return suffix ? `/notificaciones?${suffix}` : "/notificaciones";
}

function notificationMeta(item: NotificationItem) {
  if (item.entityType === "invoice") return { category: "money" as const, originLabel: "Dinero", icon: CircleDollarSign, tone: "critical" };
  if (item.entityType === "client" || item.entityType === "budget" || item.entityType === "reminder") return { category: "clients" as const, originLabel: item.entityType === "budget" ? "Presupuestos" : "Clientes", icon: item.entityType === "budget" ? BriefcaseBusiness : UserRound, tone: item.entityType === "budget" ? "warning" : "info" };
  if (item.entityType === "work" || item.entityType === "agenda") return { category: "work" as const, originLabel: item.entityType === "agenda" ? "Agenda" : "Obras", icon: item.entityType === "agenda" ? CalendarDays : Building2, tone: "warning" };
  return { category: "system" as const, originLabel: "Sistema", icon: Info, tone: "system" };
}

function priorityLabel(priority: NotificationPriority) { return { critica: "Crítica", alta: "Alta", media: "Media", baja: "Baja" }[priority]; }
function attentionLabel(priority: NotificationPriority) { return priority === "critica" ? "Inmediata" : priority === "alta" ? "Prioritaria" : priority === "media" ? "Programada" : "Informativa"; }
function listHeading(tab: NotificationTab) { return tab === "critical" ? "Notificaciones críticas" : tab === "unread" ? "Pendientes de lectura" : "Notificaciones visibles"; }
function humanize(value: string) { return value.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase()); }

function relativeDate(date: Date) {
  const minutes = Math.round((date.getTime() - Date.now()) / 60_000);
  const formatter = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour");
  return formatter.format(Math.round(hours / 24), "day");
}

function isSameLocalDay(value: Date, reference: Date) { return value.getFullYear() === reference.getFullYear() && value.getMonth() === reference.getMonth() && value.getDate() === reference.getDate(); }
function isWithinCurrentWeek(value: Date, reference: Date) {
  const start = new Date(reference);
  const day = start.getDay() || 7;
  start.setDate(start.getDate() - day + 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return value >= start && value < end;
}
