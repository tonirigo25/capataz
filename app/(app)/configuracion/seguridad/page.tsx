import Image from "next/image";
import Link from "next/link";
import QRCode from "qrcode";
import { AlertTriangle, CheckCircle2, Cloud, DatabaseBackup, FileClock, KeyRound, Laptop, LockKeyhole, MonitorSmartphone, ShieldCheck } from "lucide-react";
import { confirmMfaEnrollment, startMfaEnrollment, verifyMfaChallenge } from "./actions";
import { requireCompanyContext } from "@/lib/auth/session";
import { resolveAuthorization } from "@/lib/commercial/authorization";
import { prisma } from "@/lib/prisma";
import { readPendingTotpEnrollment, isSecondFactorFresh } from "@/lib/security/mfa";
import styles from "./security-workspace.module.css";

export const dynamic = "force-dynamic";

const baseTabs = [
  ["/configuracion?area=empresa", "Empresa"], ["/configuracion?area=identidad-marca", "Identidad y marca"],
  ["/configuracion?area=fiscal-documentos", "Facturación y fiscalidad"], ["/configuracion/sucursales", "Sucursales"],
  ["/configuracion/usuarios-permisos", "Usuarios y permisos"], ["/configuracion/integraciones", "Integraciones"],
  ["/configuracion/seguridad", "Seguridad"],
] as const;

export default async function SecuritySettingsPage() {
  const auth = await requireCompanyContext();
  const now = new Date();
  const companyWide = auth.role === "OWNER" || auth.role === "ADMIN";
  const [account, factors, pending, sessions, auditEvents, memberCount, mfaMemberCount, billingDecision] = await Promise.all([
    prisma.platformAccount.findUnique({ where: { userId: auth.userId }, select: { role: true } }),
    prisma.mfaFactor.findMany({ where: { userId: auth.userId, status: { in: ["ACTIVE", "PENDING"] } }, orderBy: { createdAt: "desc" } }),
    readPendingTotpEnrollment({ prisma, userId: auth.userId, email: auth.email }),
    prisma.session.findMany({ where: { userId: auth.userId, revokedAt: null, expiresAt: { gt: now } }, orderBy: { lastSeenAt: "desc" }, take: 8, select: { id: true, userAgent: true, createdAt: true, lastSeenAt: true, secondFactorVerifiedAt: true } }),
    prisma.auditLog.findMany({ where: { companyId: auth.companyId, ...(companyWide ? {} : { userActorId: auth.userId }), OR: [{ action: { contains: "auth" } }, { action: { contains: "session" } }, { action: { contains: "mfa" } }, { action: { contains: "security" } }] }, orderBy: { createdAt: "desc" }, take: 8, select: { id: true, action: true, createdAt: true, targetType: true } }),
    prisma.companyMembership.count({ where: { companyId: auth.companyId, status: "active" } }),
    prisma.companyMembership.count({ where: { companyId: auth.companyId, status: "active", user: { mfaFactors: { some: { status: "ACTIVE", disabledAt: null } } } } }),
    resolveAuthorization(auth, "company.billing.manage"),
  ]);
  const tabs = billingDecision.allowed ? [...baseTabs, ["/plan-y-uso", "Plan y uso"] as const] : baseTabs;
  const active = factors.find((factor) => factor.status === "ACTIVE");
  const qr = pending ? await QRCode.toDataURL(pending.uri, { errorCorrectionLevel: "M", margin: 1, width: 220 }) : null;
  const platformRequired = Boolean(account && ["PLATFORM_OWNER", "PLATFORM_ADMIN"].includes(account.role));
  const verified = isSecondFactorFresh(auth.secondFactorVerifiedAt);
  const securityScore = scoreSecurity({ mfa: Boolean(active), verified, sessions: sessions.length, auditEvents: auditEvents.length });

  return <main className={`screen ${styles.workspace}`} data-security-workspace>
    <header className={styles.header}><h1>Configuración de empresa</h1><p>Protege accesos y operaciones sensibles sin exponer secretos, IP reales ni credenciales.</p></header>
    <nav className={styles.tabs} aria-label="Configuración de empresa">{tabs.map(([href,label]) => <Link key={href} href={href} aria-current={href === "/configuracion/seguridad" ? "page" : undefined}>{label}</Link>)}</nav>

    <section className={styles.metrics} aria-label="Estado de seguridad">
      <Metric icon={ShieldCheck} label="Estado de seguridad" value={securityScore >= 80 ? "Sólido" : "Requiere atención"} detail={`${securityScore}% de controles visibles`} />
      <Metric icon={KeyRound} label="Riesgo de acceso" value={active ? "Bajo" : "Medio"} detail={active ? "MFA configurado" : "MFA pendiente"} />
      <Metric icon={AlertTriangle} label="Eventos detectados" value={String(auditEvents.length)} detail="Registros de seguridad visibles" />
      <Metric icon={LockKeyhole} label="Cobertura MFA" value={`${mfaMemberCount}/${memberCount}`} detail="Miembros activos con segundo factor" />
      <Metric icon={DatabaseBackup} label="Backups" value="Control externo" detail="Sin afirmar estado no consultado" />
    </section>

    <section className={styles.grid}>
      <article className={styles.card} id="mfa"><CardTitle number="1" title="Autenticación en dos pasos (2FA)" action={active ? "Activada" : "Pendiente"} /><div className={styles.iconIntro}><span><LockKeyhole size={20}/></span><p>Protege tu acceso con una segunda verificación. La configuración es personal y no cambia la política del resto de la empresa.</p></div>
        <KeyValue label="Método" value={active ? active.label : "Sin método activo"}/><KeyValue label="Requisito" value={platformRequired ? "Obligatorio para cuenta de plataforma" : "Recomendado"}/>
        {!pending && !active ? <form action={startMfaEnrollment}><input type="hidden" name="label" value="Autenticador principal"/><button className={styles.primary}>Preparar autenticador</button></form> : null}
        {pending && qr ? <div className={styles.enrollment}><Image src={qr} alt="Código QR de configuración TOTP" width={160} height={160} unoptimized/><form action={confirmMfaEnrollment}><input type="hidden" name="factorId" value={pending.factorId}/><label>Código de seis cifras<input name="token" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required/></label><button className={styles.primary}>Confirmar segundo factor</button></form></div> : null}
        {active && !verified ? <form action={verifyMfaChallenge} className={styles.verify}><input aria-label="Código de seis cifras" name="token" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required/><button className={styles.primary}>Verificar esta sesión</button></form> : null}
        {active && verified ? <p className={styles.success}><CheckCircle2 size={14}/>Segundo factor verificado en esta sesión.</p> : null}
      </article>

      <article className={styles.card}><CardTitle number="2" title="Sesiones activas" action={`${sessions.length} visibles`} />{sessions.length ? <div className={styles.list}>{sessions.slice(0,4).map((session,index)=><div key={session.id}><MonitorSmartphone size={16}/><span><strong>{deviceLabel(session.userAgent)}</strong><small>{index===0?"Sesión más reciente":relativeDate(session.lastSeenAt)} · {session.secondFactorVerifiedAt?"MFA verificado":"Sin MFA reciente"}</small></span></div>)}</div>:<p className={styles.empty}>No hay sesiones activas adicionales registradas.</p>}<p className={styles.note}>Por privacidad se omiten IP, tokens y huellas completas.</p></article>

      <article className={styles.card}><CardTitle number="3" title="Política de contraseñas" action="Protegida"/><Status label="Longitud mínima" value="12 caracteres"/><Status label="Mayúsculas y minúsculas" value="Obligatorias"/><Status label="Número" value="Obligatorio"/><Status label="Símbolo" value="Obligatorio"/><p className={styles.note}>Ni siquiera el propietario puede rebajar esta política desde la interfaz.</p></article>

      <article className={styles.card}><CardTitle number="4" title="Alertas de inicio de sesión" action="Sin canal configurable"/><div className={styles.iconIntro}><span><AlertTriangle size={19}/></span><p>Los eventos quedan auditados. La aplicación no afirma que email o SMS estén activos sin un canal persistido.</p></div><Link className={styles.secondary} href="/notificaciones">Abrir notificaciones</Link></article>

      <article className={styles.card}><CardTitle number="5" title="Dispositivos de acceso" action={`${sessions.length} sesiones`}/><div className={styles.list}>{sessions.slice(0,5).map((session)=><div key={session.id}><Laptop size={15}/><span><strong>{deviceLabel(session.userAgent)}</strong><small>Última actividad {relativeDate(session.lastSeenAt)}</small></span></div>)}</div>{sessions.length===0?<p className={styles.empty}>Sin dispositivos activos registrados.</p>:null}</article>

      <article className={styles.card}><CardTitle number="6" title="Restricciones de red" action="No configuradas"/><div className={styles.iconIntro}><span><Cloud size={19}/></span><p>No existe una lista de rangos IP persistida para este tenant. El control permanece cerrado para evitar bloqueos accidentales.</p></div><button className={styles.disabled} disabled>Requiere configuración de plataforma</button></article>

      <article className={styles.card}><CardTitle number="7" title="Registro de auditoría" action={companyWide?"Empresa":"Personal"}/>{auditEvents.length?<div className={styles.audit}>{auditEvents.slice(0,5).map((event)=><div key={event.id}><FileClock size={14}/><span><strong>{eventLabel(event.action)}</strong><small>{relativeDate(event.createdAt)} · {event.targetType}</small></span></div>)}</div>:<p className={styles.empty}>No hay eventos de seguridad recientes dentro de tu alcance.</p>}<Link className={styles.secondary} href="/auditoria">Ver auditoría permitida</Link></article>

      <article className={styles.card}><CardTitle number="8" title="Copias de seguridad" action="Operación de plataforma"/><div className={styles.iconIntro}><span><DatabaseBackup size={19}/></span><p>Las copias no se gestionan desde el perfil del cliente. Esta pantalla no declara una copia correcta sin consultar la evidencia operativa.</p></div><Link className={styles.secondary} href="/configuracion/soporte?tema=backups">Solicitar evidencia</Link></article>

      <article className={styles.card}><CardTitle number="9" title="Protección de datos" action="Controles activos"/><Status label="Cifrado en tránsito" value="TLS"/><Status label="Credenciales" value="Cifradas y no visibles"/><Status label="Aislamiento" value="Por empresa"/><Status label="Datos sensibles" value="Redactados en logs"/><Link className={styles.secondary} href="/configuracion/privacidad">Ver privacidad</Link></article>
    </section>
  </main>;
}

function CardTitle({number,title,action}:{number:string;title:string;action:string}){return <header className={styles.cardTitle}><h2>{number}. {title}</h2><span>{action}</span></header>}
function Metric({icon:Icon,label,value,detail}:{icon:typeof ShieldCheck;label:string;value:string;detail:string}){return <article><span><Icon size={17}/></span><div><p>{label}</p><strong>{value}</strong><small>{detail}</small></div></article>}
function KeyValue({label,value}:{label:string;value:string}){return <div className={styles.keyValue}><span>{label}</span><strong>{value}</strong></div>}
function Status({label,value}:{label:string;value:string}){return <div className={styles.status}><span><CheckCircle2 size={12}/>{label}</span><strong>{value}</strong></div>}
function scoreSecurity(input:{mfa:boolean;verified:boolean;sessions:number;auditEvents:number}){return Math.min(100,45+(input.mfa?25:0)+(input.verified?10:0)+(input.sessions>0?10:0)+(input.auditEvents>0?10:0))}
function deviceLabel(value:string|null){if(!value)return"Dispositivo no identificado";if(/iphone|ipad/i.test(value))return"Safari en iPhone/iPad";if(/android/i.test(value))return"Navegador en Android";if(/windows/i.test(value))return/edge/i.test(value)?"Edge en Windows":"Navegador en Windows";if(/macintosh|mac os/i.test(value))return"Navegador en macOS";return"Navegador registrado"}
function relativeDate(value:Date){const minutes=Math.max(0,Math.round((Date.now()-value.getTime())/60000));if(minutes<2)return"ahora";if(minutes<60)return`hace ${minutes} min`;const hours=Math.round(minutes/60);if(hours<24)return`hace ${hours} h`;return new Intl.DateTimeFormat("es-ES",{dateStyle:"short",timeZone:"Europe/Madrid"}).format(value)}
function eventLabel(value:string){return value.replaceAll("."," · ").replaceAll("_"," ").replace(/\b\w/g,(letter)=>letter.toUpperCase())}
