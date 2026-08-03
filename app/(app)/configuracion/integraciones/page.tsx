import Link from "next/link";
import { Activity, Bot, Clock3, Link2, PlugZap, Search, ShieldCheck } from "lucide-react";
import { requireCompanyContext } from "@/lib/auth/session";
import { getEntitlements, resolveAuthorization } from "@/lib/commercial/authorization";
import { planCatalog } from "@/lib/commercial/plans";
import { prisma } from "@/lib/prisma";
import styles from "./integrations-workspace.module.css";

export const dynamic = "force-dynamic";

type Query = { q?: string; estado?: string };
type CatalogItem = { key: string; name: string; area: string; description: string; benefit: string; entitlement?: "automations" | "exports" | "api_access" };

const catalog: CatalogItem[] = [
  { key: "gmail", name: "Gmail", area: "Correo", description: "Sincronización de correo y adjuntos autorizados.", benefit: "Vincular comunicaciones a clientes y trabajos." },
  { key: "google_calendar", name: "Google Calendar", area: "Calendario", description: "Eventos y tareas con alcance confirmado.", benefit: "Agenda y recordatorios coordinados." },
  { key: "microsoft_365", name: "Microsoft 365", area: "Productividad", description: "Outlook, calendario y documentos empresariales.", benefit: "Trabajo coordinado en el ecosistema Microsoft." },
  { key: "whatsapp_business", name: "WhatsApp Business", area: "Mensajería", description: "Conversaciones de negocio con consentimiento.", benefit: "Seguimientos contextualizados y auditados." },
  { key: "banking", name: "Sincronización bancaria", area: "Finanzas", description: "Importación segura de movimientos bancarios.", benefit: "Conciliación asistida sin ordenar pagos." },
  { key: "holded", name: "Contabilidad (Holded)", area: "Contabilidad", description: "Intercambio controlado de facturas y gastos.", benefit: "Menos duplicidad contable.", entitlement: "exports" },
  { key: "google_drive", name: "Google Drive", area: "Documentos", description: "Acceso delegado a carpetas autorizadas.", benefit: "Documentación centralizada y trazable." },
  { key: "docusign", name: "Firma electrónica", area: "Documentos", description: "Preparación y seguimiento de firmas.", benefit: "Contratos firmados con evidencia." },
  { key: "slack", name: "Slack", area: "Equipo", description: "Avisos operativos en canales autorizados.", benefit: "Notificaciones relevantes para el equipo.", entitlement: "automations" },
  { key: "zapier", name: "Zapier", area: "Automatización", description: "Flujos con aplicaciones externas.", benefit: "Procesos conectados con control humano.", entitlement: "automations" },
];

const baseTabs = [
  ["/configuracion?area=empresa", "Empresa"], ["/configuracion?area=identidad-marca", "Identidad y marca"],
  ["/configuracion?area=fiscal-documentos", "Facturación y fiscalidad"], ["/configuracion/sucursales", "Sucursales"],
  ["/configuracion/usuarios-permisos", "Usuarios y permisos"], ["/configuracion/integraciones", "Integraciones"],
  ["/configuracion/seguridad", "Seguridad"],
] as const;

export default async function IntegrationsSettingsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const auth = await requireCompanyContext();
  const [connections, commercial, automationCount, billingDecision] = await Promise.all([
    prisma.integrationConnection.findMany({ where: { companyId: auth.companyId }, orderBy: { provider: "asc" } }),
    getEntitlements(auth.companyId),
    prisma.automationDefinition.count({ where: { companyId: auth.companyId, archivedAt: null, active: true } }),
    resolveAuthorization(auth, "company.billing.manage"),
  ]);
  const tabs = billingDecision.allowed ? [...baseTabs, ["/plan-y-uso", "Plan y uso"] as const] : baseTabs;
  const connectionByKey = new Map(connections.map((item) => [normalizeProvider(item.provider), item]));
  const q = query.q?.trim().toLocaleLowerCase("es") ?? "";
  const state = query.estado ?? "all";
  const rows = catalog.filter((item) => {
    const connection = connectionByKey.get(item.key);
    const connected = isConnected(connection?.status);
    if (state === "connected" && !connected) return false;
    if (state === "available" && connected) return false;
    return !q || `${item.name} ${item.area} ${item.description}`.toLocaleLowerCase("es").includes(q);
  });
  const connected = catalog.filter((item) => isConnected(connectionByKey.get(item.key)?.status));
  const healthy = connected.filter((item) => !connectionByKey.get(item.key)?.lastErrorCode).length;
  const syncedToday = connected.filter((item) => isToday(connectionByKey.get(item.key)?.lastSuccessAt)).length;
  const canManage = auth.role === "OWNER" || auth.role === "ADMIN";
  const planName = planCatalog[commercial.planKey as keyof typeof planCatalog]?.name ?? commercial.planKey;

  return <main className={`screen ${styles.workspace}`} data-integrations-workspace>
    <header className={styles.header}><h1>Configuración de empresa</h1><p>Conecta servicios externos con permisos mínimos, trazabilidad y aislamiento por empresa.</p></header>
    <nav className={styles.tabs} aria-label="Configuración de empresa">{tabs.map(([href,label]) => <Link key={href} href={href} aria-current={href === "/configuracion/integraciones" ? "page" : undefined}>{label}</Link>)}</nav>

    <section className={styles.metrics} aria-label="Estado de integraciones">
      <Metric icon={Link2} label="Integraciones conectadas" value={`${connected.length} de ${catalog.length}`} detail={`${Math.round((connected.length / catalog.length) * 100)}% del catálogo`} />
      <Metric icon={ShieldCheck} label="Estado verificado" value={connected.length ? `${healthy}/${connected.length} saludables` : "Sin conexiones"} detail="Sin ocultar errores del proveedor" />
      <Metric icon={Activity} label="Sincronizaciones hoy" value={String(syncedToday)} detail="Éxitos registrados" />
      <Metric icon={Bot} label="Automatizaciones activas" value={String(automationCount)} detail="Flujos persistidos" />
      <Metric icon={Clock3} label="Plan aplicable" value={planName} detail="Disponibilidad por contrato" />
    </section>

    <section className={styles.panel}>
      <header className={styles.panelHeader}><div><h2>Integraciones</h2><p>Una conexión sólo figura activa cuando existe un registro real y saludable para esta empresa.</p></div><Link href="/automatizaciones" className={styles.secondaryAction}>Gestionar automatizaciones</Link></header>
      <form className={styles.filters} action="/configuracion/integraciones" method="get">
        <label><Search size={14} /><input name="q" defaultValue={query.q} placeholder="Buscar integración…" /></label>
        <select name="estado" defaultValue={state} aria-label="Estado de la integración"><option value="all">Todos los estados</option><option value="connected">Conectadas</option><option value="available">Disponibles</option></select>
        <button type="submit">Aplicar</button><Link href="/configuracion/integraciones">Limpiar</Link>
      </form>
      <div className={styles.table} role="table" aria-label="Catálogo de integraciones">
        <div className={styles.tableHead} role="row"><span>Integración</span><span>Estado</span><span>Última sincronización</span><span>Beneficio</span><span>Acción</span></div>
        {rows.map((item) => {
          const connection = connectionByKey.get(item.key);
          const active = isConnected(connection?.status);
          const entitled = !item.entitlement || Boolean(commercial.values[item.entitlement]);
          return <article key={item.key} className={styles.row} role="row">
            <div className={styles.identity}><span className={styles.logo}>{initials(item.name)}</span><span><strong>{item.name}</strong><small>{item.area} · {item.description}</small></span></div>
            <span className={styles.state} data-connected={active ? "true" : "false"}>{active ? "Conectada" : entitled ? "Disponible" : "No incluida"}</span>
            <span>{active ? formatSync(connection?.lastSuccessAt, connection?.lastErrorCode) : "Sin sincronizaciones"}</span>
            <span>{item.benefit}</span>
            {active ? <Link href={`/configuracion/soporte?tema=integracion-${item.key}`}>Revisar conexión</Link> : entitled && canManage ? <Link href={`/configuracion/soporte?tema=activar-${item.key}`}>Solicitar activación</Link> : <span className={styles.locked}>{entitled ? "Sólo propietario/admin" : "Requiere otro plan"}</span>}
          </article>;
        })}
      </div>
      {rows.length === 0 ? <p className={styles.empty}>No hay integraciones que coincidan con los filtros.</p> : null}
    </section>

    <section className={styles.guidance}><PlugZap size={20} /><div><h2>Activación segura, no conexión ficticia</h2><p>Las credenciales se guardan cifradas y nunca se muestran aquí. Los conectores sin flujo OAuth habilitado se tramitan mediante soporte antes de aparecer como conectados.</p></div><Link href="/configuracion/soporte">Abrir soporte</Link></section>
  </main>;
}

function Metric({ icon: Icon, label, value, detail }: { icon: typeof Link2; label: string; value: string; detail: string }) { return <article><span><Icon size={17} /></span><div><p>{label}</p><strong>{value}</strong><small>{detail}</small></div></article>; }
function normalizeProvider(value: string) { return value.trim().toLocaleLowerCase("en").replaceAll("-", "_").replaceAll(" ", "_"); }
function isConnected(value: string | undefined) { return ["ACTIVE", "CONNECTED", "ENABLED"].includes(value ?? ""); }
function isToday(value: Date | null | undefined) { if (!value) return false; const now = new Date(); return value.getUTCFullYear() === now.getUTCFullYear() && value.getUTCMonth() === now.getUTCMonth() && value.getUTCDate() === now.getUTCDate(); }
function formatSync(value: Date | null | undefined, error: string | null | undefined) { if (error) return `Requiere revisión (${error})`; if (!value) return "Sin éxito registrado"; return new Intl.DateTimeFormat("es-ES", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Madrid" }).format(value); }
function initials(value: string) { return value.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(); }
