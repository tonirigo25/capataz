import type { CompanyRole, MembershipAccessMode } from "@prisma/client";
import Link from "next/link";
import { LockKeyhole, Mail, Search, ShieldCheck, UserPlus, UsersRound } from "lucide-react";
import { getEntitlements, requireCapability, resolveAuthorization } from "@/lib/commercial/authorization";
import { functionalProfileLabels, resolveFunctionalProfile, type FunctionalProfileKey } from "@/lib/commercial/functional-profiles";
import { prisma } from "@/lib/prisma";
import styles from "./users-permissions.module.css";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;
const pendingInvitationStates = ["PENDING", "PENDING_EMPLOYEE", "EMPLOYEE_ACCEPTED", "PENDING_OWNER_APPROVAL"] as const;
const baseTabs = [
  ["/configuracion?area=empresa", "Empresa"], ["/configuracion?area=identidad-marca", "Identidad y marca"],
  ["/configuracion?area=fiscal-documentos", "Facturación y fiscalidad"], ["/configuracion/sucursales", "Sucursales"],
  ["/configuracion/usuarios-permisos", "Usuarios y permisos"], ["/configuracion/integraciones", "Integraciones"],
  ["/configuracion/seguridad", "Seguridad"],
] as const;

type Query = { buscar?: string; rol?: string; estado?: string; pagina?: string };
type Member = Awaited<ReturnType<typeof loadMembers>>[number];

export default async function UsersPermissionsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const auth = await requireCapability("company.members.view");
  const [inviteDecision, updateDecision, reportsDecision, billingDecision, commercial] = await Promise.all([
    resolveAuthorization(auth, "company.members.invite"), resolveAuthorization(auth, "company.members.update"),
    resolveAuthorization(auth, "reports.view"), resolveAuthorization(auth, "company.billing.manage"), getEntitlements(auth.companyId),
  ]);
  const tabs = billingDecision.allowed ? [...baseTabs, ["/plan-y-uso", "Plan y uso"] as const] : baseTabs;
  const owner = auth.role === "OWNER";
  const canInvite = owner && inviteDecision.allowed && inviteDecision.scope === "COMPANY";
  const canUpdate = owner && updateDecision.allowed && updateDecision.scope === "COMPANY";
  const canSeeInvitations = canInvite || canUpdate;
  const canSeeAudit = reportsDecision.allowed && reportsDecision.scope === "COMPANY" && commercial.values.audit_log === true;
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000);
  const now = new Date();
  const [members, invitations, permissionChanges, recentExports] = await Promise.all([
    loadMembers(auth.companyId),
    canSeeInvitations ? prisma.invitation.findMany({ where: { companyId: auth.companyId, status: { in: [...pendingInvitationStates] }, expiresAt: { gt: now } }, orderBy: { createdAt: "desc" }, take: 100 }) : Promise.resolve([]),
    canSeeAudit ? prisma.auditLog.count({ where: { companyId: auth.companyId, createdAt: { gte: sevenDaysAgo }, OR: [{ action: { startsWith: "membership." } }, { action: { startsWith: "invitation." } }] } }) : Promise.resolve(null),
    canSeeAudit ? prisma.companyDataExport.count({ where: { companyId: auth.companyId, createdAt: { gte: sevenDaysAgo } } }) : Promise.resolve(null),
  ]);
  const activeMembers = members.filter((member) => member.status === "active");
  const mfaActive = activeMembers.filter((member) => member.user.mfaFactors.length > 0).length;
  const profiles = Array.from(new Set(members.map((member) => resolveFunctionalProfile(member.functionalProfileKey, member.role))));
  const memberLimit = numeric(commercial.values.max_members);
  const search = normalize(query.buscar ?? "");
  const filtered = members.filter((member) => {
    const profile = resolveFunctionalProfile(member.functionalProfileKey, member.role);
    const textMatch = !search || normalize(`${member.user.displayName} ${member.user.email} ${functionalProfileLabels[profile]} ${scopeLabel(member)}`).includes(search);
    const roleMatch = !query.rol || query.rol === "todos" || profile === query.rol;
    const stateMatch = !query.estado || query.estado === "todos" || member.status === query.estado;
    return textMatch && roleMatch && stateMatch;
  });
  const requestedPage = Math.max(1, Number(query.pagina) || 1);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, pageCount);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const recentAccesses = members.filter((member) => member.user.lastLoginAt && member.user.lastLoginAt >= sevenDaysAgo).length;
  const reachedLimit = memberLimit != null && activeMembers.length >= memberLimit;
  const roleSummary = profiles.map((profile) => ({ profile, count: members.filter((member) => resolveFunctionalProfile(member.functionalProfileKey, member.role) === profile).length })).sort((a, b) => b.count - a.count);

  return <main className={`screen ${styles.workspace}`} data-users-permissions-workspace>
    <header className={styles.heading}><h1>Configuración de empresa</h1><p>Define la estructura corporativa, fiscal y operativa de Orqena para trabajar con menos fricción.</p></header>
    <nav className={styles.tabs} aria-label="Configuración de empresa">{tabs.map(([href, label]) => <Link key={href} href={href} className={styles.tab} data-active={href === "/configuracion/usuarios-permisos" ? "true" : "false"}>{label}</Link>)}</nav>

    <section className={styles.metrics} aria-label="Resumen de usuarios y permisos">
      <Metric icon={UsersRound} label="Usuarios activos" value={String(activeMembers.length)} detail={memberLimit == null ? "Límite no disponible" : `de ${memberLimit} permitidos`} href="#directorio" linkLabel="Ver usuarios" />
      <Metric icon={Mail} label="Invitaciones pendientes" value={canSeeInvitations ? String(invitations.length) : "—"} detail={canSeeInvitations ? "Invitaciones vigentes" : "Sin permiso para verlas"} href={canSeeInvitations ? "#invitaciones" : undefined} linkLabel="Ver invitaciones" />
      <Metric icon={ShieldCheck} label="Perfiles configurados" value={String(profiles.length)} detail="Perfiles efectivos en uso" href="#roles" linkLabel="Ver perfiles" />
      <Metric icon={LockKeyhole} label="Acceso y seguridad" value={`${mfaActive} MFA`} detail={`${mfaActive} de ${activeMembers.length} usuarios activos`} href="/configuracion/seguridad" linkLabel="Ver configuración" />
    </section>

    <section id="directorio" className={styles.panel} aria-labelledby="directory-title">
      <header className={styles.panelHead}><h2 id="directory-title">Directorio de usuarios</h2><form method="get" className={styles.filters}>
        <label className={styles.search}><Search size={14} /><span className="sr-only">Buscar usuario</span><input name="buscar" defaultValue={query.buscar} placeholder="Buscar por nombre, email o rol" /></label>
        <div className={styles.filterActions}>
          <select className={styles.select} name="rol" defaultValue={query.rol ?? "todos"} aria-label="Filtrar por perfil"><option value="todos">Todos los perfiles</option>{profiles.map((profile) => <option key={profile} value={profile}>{functionalProfileLabels[profile]}</option>)}</select>
          <select className={styles.select} name="estado" defaultValue={query.estado ?? "todos"} aria-label="Filtrar por estado"><option value="todos">Todos los estados</option><option value="active">Activos</option><option value="suspended">Suspendidos</option><option value="invited">Invitados</option><option value="pending_owner_approval">Pendientes</option></select>
          <button type="submit" className="secondary-button">Aplicar</button><Link href="/configuracion/usuarios-permisos" className="secondary-button">Limpiar</Link>
          {canInvite && !reachedLimit ? <Link href="/equipo?invitar=1#invitar" className="primary-button"><UserPlus size={14} /> Invitar usuario</Link> : <button type="button" className={styles.disabledButton} disabled title={reachedLimit ? "El plan ha alcanzado su límite de miembros activos." : "No tienes permiso para crear invitaciones."}><UserPlus size={14} /> Invitar usuario</button>}
        </div>
      </form></header>
      {visible.length ? <><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Usuario</th><th>Perfil</th><th>Ámbito de permisos</th><th>Restricciones</th><th>Estado</th><th>Último acceso</th><th>Acciones</th></tr></thead><tbody>{visible.map((member) => <MemberRow key={member.id} member={member} currentUserId={auth.userId} canUpdate={canUpdate} />)}</tbody></table></div><div className={styles.mobileList}>{visible.map((member) => <MemberCard key={member.id} member={member} currentUserId={auth.userId} canUpdate={canUpdate} />)}</div><Pager query={query} current={currentPage} pages={pageCount} total={filtered.length} /></> : <p className={styles.empty}>No hay usuarios que coincidan con estos filtros. El directorio sólo muestra membresías persistidas del tenant.</p>}
    </section>

    <section className={styles.bottomGrid}>
      <article id="invitaciones" className={styles.subpanel}><header className={styles.panelTitle}><h2>Invitaciones pendientes</h2>{canSeeInvitations ? <Link href="/equipo#invitation-approvals">Gestionar</Link> : null}</header>{canSeeInvitations ? invitations.length ? <div className={styles.list}>{invitations.slice(0, 5).map((item) => <div key={item.id} className={styles.listRow}><span><strong>{item.emailNormalized}</strong><span>{invitationProfile(item.functionalProfileKey, item.role)} · {invitationStatus(item.status)}</span></span><span>Caduca {shortDate(item.expiresAt)}</span></div>)}</div> : <p className={styles.empty}>No hay invitaciones vigentes pendientes.</p> : <p className={styles.empty}>Tu perfil no puede consultar invitaciones.</p>}</article>
      <article className={styles.subpanel}><header className={styles.panelTitle}><h2>Actividad verificable</h2><span className={styles.secondary}>Últimos 7 días</span></header><div className={styles.list}><Activity label="Usuarios con acceso reciente" value={String(recentAccesses)} /><Activity label="Cambios de acceso auditados" value={permissionChanges == null ? "No autorizado" : String(permissionChanges)} /><Activity label="Invitaciones creadas" value={canSeeInvitations ? String(invitations.filter((item) => item.createdAt >= sevenDaysAgo).length) : "No autorizado"} /><Activity label="Exportaciones registradas" value={recentExports == null ? "No autorizado" : String(recentExports)} /></div>{canSeeAudit ? <Link href="/configuracion/seguridad" className="secondary-button m-3">Revisar seguridad</Link> : null}</article>
      <article id="roles" className={styles.subpanel}><header className={styles.panelTitle}><h2>Perfiles efectivos</h2><Link href="/equipo">Abrir gestión</Link></header><div className={styles.list}>{roleSummary.map(({ profile, count }) => <div key={profile} className={styles.listRow}><span><strong><span className={styles.role} data-tone={roleTone(profile, "STANDARD")}>{functionalProfileLabels[profile]}</span></strong><span>{profileArea(profile)}</span></span><strong>{count} {count === 1 ? "usuario" : "usuarios"}</strong></div>)}</div></article>
    </section>
  </main>;
}

async function loadMembers(companyId: string) { return prisma.companyMembership.findMany({ where: { companyId }, include: { user: { select: { id:true, displayName:true, email:true, lastLoginAt:true, mfaFactors:{ where:{ status:"ACTIVE", disabledAt:null }, select:{ id:true } } } }, scopeAssignments:{ select:{ scope:true } }, permissionOverrides:{ select:{ effect:true } }, accessPackages:{ select:{ packageKey:true, config:true } } }, orderBy:{ createdAt:"asc" } }); }
function MemberRow({ member, currentUserId, canUpdate }: { member:Member; currentUserId:string; canUpdate:boolean }) { const profile=resolveFunctionalProfile(member.functionalProfileKey,member.role); const protectedOwner=member.role==="OWNER"; const manage=canUpdate&&!protectedOwner&&member.userId!==currentUserId; return <tr><td><Person member={member} current={member.userId===currentUserId} /></td><td><span className={styles.role} data-tone={roleTone(profile,member.accessMode)}>{functionalProfileLabels[profile]}</span></td><td><span className={styles.primary}>{scopeLabel(member)}</span><span className={styles.secondary}>{profileArea(profile)}</span></td><td><span className={styles.primary}>{restrictionLabel(member)}</span><span className={styles.secondary}>{member.permissionOverrides.length ? `${member.permissionOverrides.length} ajustes explícitos` : "Sin ajustes excepcionales"}</span></td><td><span className={styles.status} data-state={membershipTone(member.status)}>{membershipStatus(member.status)}</span></td><td><span className={styles.primary}>{memberActivity(member.user.lastLoginAt)}</span><span className={styles.secondary}>{member.user.mfaFactors.length ? "MFA activo" : "MFA no activo"}</span></td><td>{protectedOwner ? <span className={styles.protected}><ShieldCheck size={13} /> Propiedad protegida</span> : <Link href={`/equipo?persona=${member.id}${manage?"#ajustes-persona":""}`} className={styles.actionLink}>{manage?"Revisar permisos":"Ver acceso"}</Link>}</td></tr>; }
function MemberCard({ member, currentUserId, canUpdate }: { member:Member; currentUserId:string; canUpdate:boolean }) { const profile=resolveFunctionalProfile(member.functionalProfileKey,member.role); const protectedOwner=member.role==="OWNER"; const manage=canUpdate&&!protectedOwner&&member.userId!==currentUserId; return <article className={styles.mobileCard}><Person member={member} current={member.userId===currentUserId} /><div className={styles.mobileMeta}><div><span>Perfil</span><strong>{functionalProfileLabels[profile]}</strong></div><div><span>Ámbito</span><strong>{scopeLabel(member)}</strong></div><div><span>Restricciones</span><strong>{restrictionLabel(member)}</strong></div><div><span>Último acceso</span><strong>{memberActivity(member.user.lastLoginAt)}</strong></div></div>{protectedOwner?<span className={styles.protected}><ShieldCheck size={13}/> Propiedad protegida</span>:<Link href={`/equipo?persona=${member.id}${manage?"#ajustes-persona":""}`} className={styles.actionLink}>{manage?"Revisar permisos":"Ver acceso"}</Link>}</article>; }
function Person({ member,current }:{ member:Member; current:boolean }){return <span className={styles.person}><span className={styles.avatar}>{initials(member.user.displayName)}</span><span><span className={styles.primary}>{member.user.displayName}{current?" · Tú":""}</span><span className={styles.secondary}>{member.user.email}</span></span></span>}
function Metric({icon:Icon,label,value,detail,href,linkLabel}:{icon:React.ComponentType<{size?:number}>;label:string;value:string;detail:string;href?:string;linkLabel:string}){return <article className={styles.metric}><div className={styles.metricTop}><span className={styles.metricIcon}><Icon size={15}/></span><p className={styles.metricLabel}>{label}</p></div><p className={styles.metricValue}>{value}</p><p className={styles.metricDetail}>{detail}</p>{href?<Link href={href} className={styles.metricLink}>{linkLabel}</Link>:null}</article>}
function Activity({label,value}:{label:string;value:string}){return <div className={styles.listRow}><span>{label}</span><span className={styles.activityValue}>{value}</span></div>}
function Pager({query,current,pages,total}:{query:Query;current:number;pages:number;total:number}){return <nav className={styles.pager} aria-label="Paginación de usuarios"><span>Mostrando {total?((current-1)*PAGE_SIZE+1):0}–{Math.min(current*PAGE_SIZE,total)} de {total}</span><span className={styles.pages}>{Array.from({length:pages},(_,i)=>i+1).map(page=><Link key={page} href={pageHref(query,page)} className={styles.page} data-active={page===current?"true":"false"} aria-current={page===current?"page":undefined}>{page}</Link>)}</span></nav>}
function pageHref(query:Query,page:number){const params=new URLSearchParams();for(const [key,value] of Object.entries(query))if(value&&key!=="pagina")params.set(key,value);params.set("pagina",String(page));return `/configuracion/usuarios-permisos?${params}`}
function scopeLabel(member:{role:CompanyRole;scopeAssignments:Array<{scope:string}>}){if(member.role==="OWNER")return"Toda la empresa";const scopes=new Set(member.scopeAssignments.map(item=>item.scope));if(scopes.size>1)return"Ámbito mixto";if(scopes.has("COMPANY"))return"Toda la empresa";if(scopes.has("SELECTED_WORKS"))return"Trabajos seleccionados";if(scopes.has("SELECTED_CLIENTS"))return"Clientes seleccionados";if(scopes.has("TEAM"))return"Equipo asignado";if(scopes.has("ASSIGNED"))return"Intervenciones asignadas";if(scopes.has("OWN"))return"Registros propios";return"Según perfil"}
function restrictionLabel(member:{accessMode:MembershipAccessMode;accessPackages:Array<{packageKey:string;config:unknown}>}){if(member.accessMode==="READ_ONLY")return"Solo lectura";const disabled=member.accessPackages.filter(item=>item.config&&typeof item.config==="object"&&!Array.isArray(item.config)&&"enabled" in item.config&&(item.config as {enabled?:unknown}).enabled===false).length;return disabled?`${disabled} paquetes desactivados`:"Acceso estándar del plan"}
function roleTone(profile:FunctionalProfileKey,mode:string){if(mode==="READ_ONLY"||profile==="ADVISOR_AUDITOR")return"read";if(["PROJECT_MANAGER","TEAM_SUPERVISOR","WORKER","EXTERNAL_COLLABORATOR"].includes(profile))return"field";if(["ADMINISTRATIVE","FINANCE","PROCUREMENT_MANAGER"].includes(profile))return"office";return"owner"}
function profileArea(profile:FunctionalProfileKey){const labels:Record<FunctionalProfileKey,string>={OWNER:"Dirección y gobierno",GENERAL_MANAGER:"Dirección",SALES_MANAGER:"Comercial",SALES:"Comercial",ADMINISTRATIVE:"Administración",FINANCE:"Finanzas",PROCUREMENT_MANAGER:"Compras",PROJECT_MANAGER:"Ejecución",TEAM_SUPERVISOR:"Ejecución",WORKER:"Ejecución",EXTERNAL_COLLABORATOR:"Colaboración",ADVISOR_AUDITOR:"Asesoría y lectura"};return labels[profile]}
function membershipStatus(value:string){const labels:Record<string,string>={active:"Activo",suspended:"Suspendido",invited:"Invitado",pending_owner_approval:"Pendiente aprobación",pending_employee:"Pendiente persona",archived:"Archivado",revoked:"Revocado"};return labels[value]??value.replaceAll("_"," ")}
function membershipTone(value:string){return value==="active"?"active":value.startsWith("pending")||value==="invited"?"pending":"inactive"}
function invitationProfile(value:string|null,role:CompanyRole){return functionalProfileLabels[resolveFunctionalProfile(value,role)]}
function invitationStatus(value:string){const labels:Record<string,string>={PENDING:"Pendiente",PENDING_EMPLOYEE:"Pendiente de la persona",EMPLOYEE_ACCEPTED:"Aceptada por la persona",PENDING_OWNER_APPROVAL:"Pendiente de aprobación"};return labels[value]??value.replaceAll("_"," ")}
function memberActivity(value:Date|null){if(!value)return"Sin acceso";const diff=Math.floor((Date.now()-value.getTime())/86_400_000);if(diff<=0)return`Hoy, ${new Intl.DateTimeFormat("es-ES",{hour:"2-digit",minute:"2-digit"}).format(value)}`;if(diff===1)return"Ayer";if(diff<7)return`Hace ${diff} días`;return shortDate(value)}
function shortDate(value:Date){return new Intl.DateTimeFormat("es-ES",{day:"2-digit",month:"short",year:"numeric"}).format(value)}
function initials(value:string){return value.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]?.toUpperCase()).join("")||"?"}
function normalize(value:string){return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"")}
function numeric(value:boolean|number|string|undefined){const parsed=typeof value==="number"?value:Number(value);return Number.isFinite(parsed)?parsed:null}
