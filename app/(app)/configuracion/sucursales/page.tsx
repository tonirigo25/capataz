import Link from "next/link";
import {
  Building2,
  CheckCircle2,
  CircleAlert,
  Map,
  MapPin,
  Package,
  Plus,
  Search,
  TrendingUp,
  UserRound,
  UsersRound,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireCapability, resolveAuthorization } from "@/lib/commercial/authorization";
import styles from "./branches.module.css";

export const dynamic = "force-dynamic";

type Query = { buscar?: string; estado?: string };

const baseTabs = [
  ["/configuracion?area=empresa", "Empresa"],
  ["/configuracion?area=identidad-marca", "Identidad y marca"],
  ["/configuracion?area=fiscal-documentos", "Facturación y fiscalidad"],
  ["/configuracion/sucursales", "Sucursales"],
  ["/configuracion/usuarios-permisos", "Usuarios y permisos"],
  ["/configuracion/integraciones", "Integraciones"],
  ["/configuracion/seguridad", "Seguridad"],
] as const;

export default async function BranchesPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const auth = await requireCapability("company.view");
  const [company, updateDecision, billingDecision, activeMembers, ownerMembership] = await Promise.all([
    prisma.company.findUnique({
      where: { id: auth.companyId },
      select: {
        id: true,
        nombreComercial: true,
        razonSocial: true,
        taxId: true,
        direccion: true,
        codigoPostal: true,
        ciudad: true,
        provincia: true,
        pais: true,
        contactPerson: true,
        status: true,
        updatedAt: true,
      },
    }),
    resolveAuthorization(auth, "company.update"),
    resolveAuthorization(auth, "company.billing.manage"),
    prisma.companyMembership.count({ where: { companyId: auth.companyId, status: "active" } }),
    prisma.companyMembership.findFirst({
      where: { companyId: auth.companyId, role: "OWNER", status: "active" },
      orderBy: { createdAt: "asc" },
      select: { user: { select: { displayName: true } } },
    }),
  ]);
  const tabs = billingDecision.allowed ? [...baseTabs, ["/plan-y-uso", "Plan y uso"] as const] : baseTabs;
  if (!company) return null;

  const addressParts = [company.direccion, company.codigoPostal, company.ciudad, company.provincia, company.pais].filter(Boolean);
  const hasAddress = Boolean(company.direccion && (company.ciudad || company.provincia));
  const hasFiscalData = Boolean(company.taxId && company.razonSocial && hasAddress);
  const responsible = company.contactPerson || ownerMembership?.user.displayName || null;
  const search = normalize(query.buscar ?? "");
  const matchesSearch = !search || normalize(`${company.nombreComercial} ${company.razonSocial ?? ""} ${addressParts.join(" ")} ${responsible ?? ""}`).includes(search);
  const matchesState = !query.estado || query.estado === "todos" || (query.estado === "completa" ? hasFiscalData : !hasFiscalData);
  const showRegisteredOffice = matchesSearch && matchesState;
  const canUpdate = updateDecision.allowed && updateDecision.scope === "COMPANY";

  return (
    <main className={`screen ${styles.workspace}`} data-branches-workspace data-branch-persistence="unavailable">
      <header className={styles.heading}>
        <h1>Configuración de empresa</h1>
        <p>Define la estructura corporativa, fiscal y operativa de Orqena para trabajar con menos fricción.</p>
      </header>

      <nav className={styles.tabs} aria-label="Configuración de empresa">
        {tabs.map(([href, label]) => <Link key={href} href={href} className={styles.tab} data-active={href === "/configuracion/sucursales" ? "true" : "false"}>{label}</Link>)}
      </nav>

      <section className={styles.sectionHead}>
        <div className={styles.sectionIntro}>
          <h2>Sucursales</h2>
          <p>Consulta la sede fiscal real del tenant. Las sucursales operativas todavía no disponen de persistencia propia.</p>
        </div>
        <div className={styles.buttonRow}>
          <button type="button" className={styles.disabledButton} disabled title="No existen coordenadas ni una entidad de sucursal persistida."><Map size={15} /> Vista mapa</button>
          <button type="button" className={styles.disabledButton} disabled title="La aplicación aún no dispone de un modelo persistente de sucursales."><Plus size={15} /> Añadir sucursal</button>
        </div>
      </section>

      <form className={styles.toolbar} method="get">
        <label className={styles.search}>
          <Search size={15} aria-hidden="true" />
          <span className="sr-only">Buscar sede registrada</span>
          <input name="buscar" defaultValue={query.buscar} placeholder="Buscar sede, ciudad o responsable..." />
        </label>
        <div className={styles.toolbarActions}>
          <label>
            <span className="sr-only">Filtrar por integridad de datos</span>
            <select className={styles.select} name="estado" defaultValue={query.estado ?? "todos"}>
              <option value="todos">Todos los estados</option>
              <option value="completa">Datos fiscales completos</option>
              <option value="incompleta">Datos fiscales incompletos</option>
            </select>
          </label>
          <button type="submit" className="secondary-button">Aplicar</button>
          <Link href="/configuracion/sucursales" className="secondary-button">Limpiar</Link>
        </div>
      </form>

      <section className={styles.metrics} aria-label="Resumen real de sedes y estructura">
        <Metric icon={Building2} label="Sucursales persistidas" value="0" detail="Entidad aún no disponible" />
        <Metric icon={CheckCircle2} label="Sede fiscal" value={hasFiscalData ? "Completa" : "Pendiente"} detail="Perfil de empresa" />
        <Metric icon={UsersRound} label="Miembros activos" value={String(activeMembers)} detail="En todo el tenant" />
        <Metric icon={UserRound} label="Responsable registrado" value={responsible ? "Sí" : "No"} detail={responsible ?? "Sin responsable"} />
        <Metric icon={TrendingUp} label="Ventas por sucursal" value="—" detail="Sin atribución persistida" />
        <Metric icon={Package} label="Stock por sucursal" value="—" detail="Sin inventario por sede" />
      </section>

      <section className={styles.contentGrid}>
        <div className={styles.panel}>
          {showRegisteredOffice ? (
            <>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <caption className="sr-only">Sede fiscal registrada en el perfil de empresa</caption>
                  <thead><tr><th>Sede registrada</th><th>Dirección</th><th>Responsable</th><th>Datos fiscales</th><th>Uso operativo</th><th>Estado</th><th>Acción</th></tr></thead>
                  <tbody><tr>
                    <td><span className={styles.identity}><span className={styles.identityIcon}><Building2 size={15} /></span><span><span className={styles.primary}>{company.nombreComercial}</span><span className={styles.secondary}>Perfil de empresa · no es una sucursal operativa</span></span></span></td>
                    <td><span className={styles.primary}>{addressParts.length ? addressParts.join(", ") : "Sin dirección registrada"}</span><span className={styles.secondary}>{hasAddress ? "Dirección fiscal del tenant" : "Requiere completar empresa"}</span></td>
                    <td><span className={styles.primary}>{responsible ?? "Sin responsable"}</span><span className={styles.secondary}>{company.contactPerson ? "Contacto de empresa" : ownerMembership ? "Propietario del tenant" : "No asignado"}</span></td>
                    <td><span className={styles.primary}>{company.razonSocial ?? "Razón social pendiente"}</span><span className={styles.secondary}>{company.taxId ?? "NIF/CIF pendiente"}</span></td>
                    <td><span className={styles.primary}>No atribuible</span><span className={styles.secondary}>Sin modelo de sucursales</span></td>
                    <td><span className={styles.badge}>{hasFiscalData ? "Perfil completo" : "Datos pendientes"}</span></td>
                    <td>{canUpdate ? <Link href="/configuracion?area=empresa&edit=1" className="secondary-button">Editar sede fiscal</Link> : <span className={styles.secondary}>Sólo lectura</span>}</td>
                  </tr></tbody>
                </table>
              </div>
              <article className={styles.mobileCard}>
                <div className={styles.identity}><span className={styles.identityIcon}><Building2 size={15} /></span><span><span className={styles.primary}>{company.nombreComercial}</span><span className={styles.secondary}>Sede fiscal del perfil de empresa</span></span></div>
                <dl>
                  <div><dt>Dirección</dt><dd>{addressParts.length ? addressParts.join(", ") : "Pendiente"}</dd></div>
                  <div><dt>Responsable</dt><dd>{responsible ?? "Pendiente"}</dd></div>
                  <div><dt>NIF/CIF</dt><dd>{company.taxId ?? "Pendiente"}</dd></div>
                  <div><dt>Uso operativo</dt><dd>No atribuible</dd></div>
                </dl>
                {canUpdate ? <Link href="/configuracion?area=empresa&edit=1" className="secondary-button">Editar sede fiscal</Link> : null}
              </article>
              <footer className={styles.tableFooter}><span>Mostrando 1 sede registral · 0 sucursales operativas</span><span>Actualizado {dateTime(company.updatedAt)}</span></footer>
            </>
          ) : (
            <div className={styles.empty}><Building2 size={28} /><h3>No hay resultados con estos filtros</h3><p>La búsqueda sólo consulta los datos reales de empresa. No se generan sucursales a partir de obras, clientes o direcciones no vinculadas.</p></div>
          )}
        </div>

        <aside className={styles.workspace} aria-label="Cobertura y disponibilidad de datos">
          <section className={`${styles.panel} ${styles.territory}`}>
            <h3>Cobertura y territorio</h3>
            <p>Disponibilidad real de datos geográficos y operativos.</p>
            <div className={styles.mapUnavailable}>
              <span><MapPin size={25} /><strong>Mapa no disponible</strong><span>No hay coordenadas ni sucursales persistidas que puedan representarse sin inventar ubicaciones.</span></span>
            </div>
            <div className={styles.qualityList}>
              <Quality label="Dirección fiscal" value={hasAddress ? "Registrada" : "Pendiente"} />
              <Quality label="Coordenadas" value="No disponibles" />
              <Quality label="Área operativa" value="No persistida" />
              <Quality label="Ventas por sede" value="No atribuibles" />
              <Quality label="Stock por sede" value="No disponible" />
            </div>
          </section>
          <section className={styles.notice}>
            <h3><CircleAlert size={15} className="mr-2 inline" />Límite funcional actual</h3>
            <p>La sede fiscal pertenece al perfil de empresa. No se puede crear, borrar o convertir en sucursal hasta que exista un modelo con permisos, auditoría y aislamiento tenant.</p>
            {canUpdate ? <Link href="/configuracion?area=empresa&edit=1" className="secondary-button mt-3">Completar datos de empresa</Link> : null}
          </section>
        </aside>
      </section>
    </main>
  );
}

function Metric({ icon: Icon, label, value, detail }: { icon: React.ComponentType<{ size?: number }>; label: string; value: string; detail: string }) {
  return <article className={styles.metric}><div className={styles.metricTop}><span className={styles.metricIcon}><Icon size={15} /></span><p className={styles.metricLabel}>{label}</p></div><p className={styles.metricValue}>{value}</p><p className={styles.metricDetail}>{detail}</p></article>;
}

function Quality({ label, value }: { label: string; value: string }) { return <div className={styles.qualityRow}><span>{label}</span><strong>{value}</strong></div>; }
function normalize(value: string) { return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
function dateTime(value: Date) { return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(value); }
