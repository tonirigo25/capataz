import { Building2, CheckCircle2, Save, Smartphone, UserRound } from "lucide-react";
import { saveCompanySettings, saveUserProfile, uploadCompanyAsset } from "@/app/(app)/configuracion/actions";
import { SectionHeader } from "@/components/section-header";
import { companyCompletion, profileCompletion } from "@/lib/profile-completeness";
import { prisma } from "@/lib/prisma";
import { requireCompanyContext } from "@/lib/auth/session";
import { companySettingsView } from "@/lib/tenant/company-settings";
import { brand } from "@/lib/brand";
import { getEffectiveCapabilities, getEntitlements } from "@/lib/commercial/authorization";
import { planCatalog } from "@/lib/commercial/plans";
import { readRuntimeAiControl } from "@/lib/ai/runtime-gateway";
import { ConfigurationOverview } from "@/components/portal/modules-c/configuration-overview";


export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string }>;
}) {
  const query = await searchParams;
  const area = query.area ?? "perfil";
  const auth = await requireCompanyContext();
  const owner = auth.role === "OWNER";
  const periodStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const [companyRecord, legacyProfile, commercial, capabilities, activeMfa, memberCount, aiUsage, aiPolicy] = await Promise.all([
    owner ? prisma.company.findUniqueOrThrow({ where: { id: auth.companyId } }) : Promise.resolve(null),
    prisma.usuarioPerfil.findUnique({ where: { id: auth.userId } }),
    getEntitlements(auth.companyId),
    getEffectiveCapabilities(auth),
    prisma.mfaFactor.count({ where: { userId: auth.userId, status: "ACTIVE", disabledAt: null } }),
    owner ? prisma.companyMembership.count({ where: { companyId: auth.companyId, status: "active" } }) : Promise.resolve(null),
    owner ? prisma.aiUsageEvent.count({ where: { companyId: auth.companyId, createdAt: { gte: periodStart } } }) : Promise.resolve(null),
    prisma.companyAiPolicy.findUnique({ where: { companyId: auth.companyId }, select: { enabled: true, killSwitch: true } }),
  ]);
  const company = companyRecord ? companySettingsView(companyRecord) : null;
  const profile = legacyProfile ?? {
    id: auth.userId, nombre: auth.displayName, email: auth.email, apellidos: null, tratamiento: null,
    nombrePreferido: null, telefono: null, cargo: null, oficioPrincipal: null, idioma: "es-ES",
    zonaHoraria: "Europe/Madrid", preferenciaVisual: "sistema", notificacionesInternas: true,
    notificacionesEmail: false, tonoPreferido: "directo"
  };
  const profileStatus = profileCompletion(profile);
  const companyStatus = company ? companyCompletion(company) : null;
  const memberLimit = numericLimit(commercial.values.max_members);
  const aiLimit = numericLimit(commercial.values.monthly_orqena_actions);
  const planName = planCatalog[commercial.planKey as keyof typeof planCatalog]?.name ?? commercial.planKey;
  const aiEnabled = aiPolicy?.enabled === true && aiPolicy.killSwitch === false && companyRuntimeAiEnabled(auth.companyId);

  return (
    <main className="screen">
      <SectionHeader title="Configuración" description="Tu trato personal, datos de empresa, app móvil, límites y planes." />
      <div className="mt-5">
        <ConfigurationOverview data={{
          owner,
          companyName: auth.companyName,
          planName,
          accountStatus: companyRecord?.status ?? auth.commercialStatus,
          members: memberCount,
          memberLimit,
          aiUsage,
          aiLimit,
          aiEnabled,
          mfaEnabled: activeMfa > 0,
          profilePercent: profileStatus.percent,
          companyPercent: companyStatus?.percent ?? null,
          capabilityCount: capabilities.length,
        }} />
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]" data-d8-settings-workspace>
        <aside className="card h-fit p-3 lg:sticky lg:top-24">
          <p className="type-label px-2">Áreas</p>
          <nav aria-label="Secciones de configuración" className="mt-2 grid gap-1">
            <a href="/configuracion?area=perfil#perfil" className="rounded-lg px-3 py-2 text-sm font-bold text-obra-ink hover:bg-slate-50">Datos personales</a>
            {owner ? <a href="/configuracion?area=empresa#empresa" className="rounded-lg px-3 py-2 text-sm font-bold text-obra-ink hover:bg-slate-50">Empresa</a> : null}
            {owner ? <a href="/configuracion?area=fiscal-documentos#fiscal-documentos" className="rounded-lg px-3 py-2 text-sm font-bold text-obra-ink hover:bg-slate-50">Fiscal y documentos</a> : null}
            {owner ? <a href="/equipo" className="rounded-lg px-3 py-2 text-sm font-bold text-obra-ink hover:bg-slate-50">Equipo</a> : null}
            <a href="/configuracion?area=integraciones#integraciones" className="rounded-lg px-3 py-2 text-sm font-bold text-obra-ink hover:bg-slate-50">Integraciones</a>
            <a href="/configuracion/seguridad" className="rounded-lg px-3 py-2 text-sm font-bold text-obra-ink hover:bg-slate-50">Seguridad</a>
            {owner ? <a href="/plan-y-uso" className="rounded-lg px-3 py-2 text-sm font-bold text-obra-ink hover:bg-slate-50">Plan y uso</a> : null}
            <a href="/configuracion?area=app#app" className="rounded-lg px-3 py-2 text-sm font-bold text-obra-ink hover:bg-slate-50">App móvil</a>
            <a href="/configuracion?area=legal#legal" className="rounded-lg px-3 py-2 text-sm font-bold text-obra-ink hover:bg-slate-50">Legal y soporte</a>
            {owner ? <a href="/configuracion?area=zona-sensible#zona-sensible" className="rounded-lg px-3 py-2 text-sm font-bold text-red-700 hover:bg-red-50">Zona sensible</a> : null}
          </nav>
        </aside>
        <div className="min-w-0">
          <section className="card mb-5 p-4" data-settings-readiness>
            <p className="type-label">Preparación</p>
            <h2 className="type-section-title mt-2">Checklist de configuración</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <ReadinessItem label="Perfil personal" detail={`${profileStatus.percent}% completo`} ready={profileStatus.missingRequired.length === 0} href="/configuracion?area=perfil#perfil" />
              {owner && companyStatus ? <ReadinessItem label="Datos de empresa" detail={`${companyStatus.percent}% completo`} ready={companyStatus.missingRequired.length === 0} href="/configuracion?area=empresa#empresa" /> : null}
              <ReadinessItem label="Seguridad y MFA" detail={activeMfa > 0 ? "Segundo factor activo" : "Segundo factor pendiente"} ready={activeMfa > 0} href="/configuracion/seguridad" />
              {owner ? <ReadinessItem label="Equipo y permisos" detail="Perfiles, scopes y aprobación" ready href="/equipo" /> : null}
              <ReadinessItem label="Modo manual" detail="Funciona sin providers live" ready href="/configuracion?area=integraciones#integraciones" />
            </div>
          </section>

      {area === "perfil" ? <section id="perfil" className="card mb-5 scroll-mt-24 p-4">
        <div className="mb-4 flex items-start gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-obra-yellow/30 text-obra-yellowDark">
            <UserRound size={22} />
          </span>
          <div>
            <h2 className="text-lg font-black text-obra-ink">Mi perfil</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Datos de tu perfil personal. Se usan para personalizar la experiencia y no sustituyen los datos fiscales.
            </p>
          </div>
        </div>

        <CompletionBar label="Perfil" status={profileStatus} />

        <form action={saveUserProfile} className="mt-4 grid gap-3">
          <input type="hidden" name="id" value={profile?.id ?? "usuario-demo"} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field name="nombre" label="Nombre" value={profile?.nombre ?? ""} />
            <Field name="apellidos" label="Apellidos" value={profile?.apellidos ?? ""} />
            <Field name="tratamiento" label="Tratamiento" value={profile?.tratamiento ?? ""} />
            <Field name="nombrePreferido" label="Nombre preferido" value={profile?.nombrePreferido ?? ""} />
            <Field name="telefono" label="Teléfono personal" value={profile?.telefono ?? ""} />
            <Field name="email" label="Email personal" value={profile?.email ?? ""} type="email" />
            <Field name="cargo" label="Cargo" value={profile?.cargo ?? ""} />
            <Field name="oficioPrincipal" label="Oficio principal" value={profile?.oficioPrincipal ?? ""} />
            <Field name="idioma" label="Idioma" value={profile?.idioma ?? "es-ES"} />
            <Field name="zonaHoraria" label="Zona horaria" value={profile?.zonaHoraria ?? "Europe/Madrid"} />
            <label>
              <span className="label mb-1 block">Preferencia visual</span>
              <select className="field" name="preferenciaVisual" defaultValue={profile?.preferenciaVisual ?? "sistema"}>
                <option value="sistema">Sistema</option>
                <option value="claro">Claro</option>
                <option value="oscuro">Oscuro futuro</option>
              </select>
            </label>
            <label>
              <span className="label mb-1 block">Tono preferido</span>
              <select className="field" name="tonoPreferido" defaultValue={profile?.tonoPreferido ?? "directo"}>
                <option value="cercano">Cercano</option>
                <option value="formal">Formal</option>
                <option value="directo">Directo</option>
                <option value="muy_educado">Muy educado</option>
              </select>
            </label>
          </div>
          <div className="grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-2">
            <Checkbox name="notificacionesInternas" label="Notificaciones internas" checked={profile?.notificacionesInternas ?? true} />
            <Checkbox name="notificacionesEmail" label="Avisos por email cuando exista integración" checked={profile?.notificacionesEmail ?? false} />
          </div>

          <button type="submit" className="primary-button w-full">
            <Save size={18} />
            Guardar mi perfil
          </button>
        </form>
      </section> : null}

      {owner && company && companyStatus && ["empresa", "fiscal-documentos"].includes(area) ? <section id="empresa" className="card mb-5 scroll-mt-24 p-4">
        <div className="mb-4 flex items-start gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-obra-yellow/30 text-obra-yellowDark">
            <Building2 size={22} />
          </span>
          <div>
            <h2 className="text-lg font-black text-obra-ink">Datos de empresa</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Datos fiscales y de marca para presupuestos, facturas, PDFs y comunicaciones futuras.
            </p>
          </div>
        </div>

        <CompletionBar label="Empresa" status={companyStatus} />

        <form action={saveCompanySettings} className="mt-4 grid gap-3">
          <input type="hidden" name="id" value={company?.id ?? "empresa-demo"} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field name="nombreComercial" label="Nombre comercial" value={company?.nombreComercial ?? ""} required />
            <Field name="razonSocial" label="Razón social" value={company?.razonSocial ?? ""} />
            <Field name="telefono" label="Teléfono" value={company?.telefono ?? ""} />
            <Field name="email" label="Email" value={company?.email ?? ""} type="email" />
            <Field name="web" label="Web" value={company?.web ?? ""} />
            <Field name="personaContacto" label="Persona contacto" value={company?.personaContacto ?? ""} />
          </div>

          <details id="fiscal-documentos" className="scroll-mt-24 rounded-xl border border-slate-200 bg-slate-50 p-4" open={area === "fiscal-documentos"}>
            <summary className="cursor-pointer font-black text-obra-ink">Fiscal y documentos</summary>
            <p className="mt-1 text-sm leading-6 text-slate-600">Dirección, impuestos, numeración y textos que aparecen en presupuestos, facturas y PDFs.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field name="nifCif" label="NIF/CIF" value={company?.nifCif ?? ""} />
            <Field name="direccionFiscal" label="Dirección fiscal" value={company?.direccionFiscal ?? ""} />
            <Field name="codigoPostal" label="Código postal" value={company?.codigoPostal ?? ""} />
            <Field name="ciudad" label="Ciudad" value={company?.ciudad ?? ""} />
            <Field name="municipio" label="Municipio" value={company?.municipio ?? ""} />
            <Field name="provincia" label="Provincia" value={company?.provincia ?? ""} />
            <Field name="pais" label="País" value={company?.pais ?? "España"} />
            <Field name="iban" label="IBAN / datos bancarios" value={company?.iban ?? ""} />
            <Field name="ivaDefecto" label="IVA por defecto" value={company?.ivaDefecto ?? 21} type="number" />
            <Field name="moneda" label="Moneda" value={company?.moneda ?? "EUR"} />
            <Field name="validezPresupuestoDias" label="Validez presupuestos (días)" value={company?.validezPresupuestoDias ?? 15} type="number" />
            <Field name="formaPagoDefecto" label="Forma de pago por defecto" value={company?.formaPagoDefecto ?? ""} />
            <Field name="seriePresupuestos" label="Serie presupuestos" value={company?.seriePresupuestos ?? "2026"} />
            <Field name="serieFacturas" label="Serie facturas" value={company?.serieFacturas ?? "2026"} />
            <Field name="serieObras" label="Serie obras" value={company?.serieObras ?? "2026"} />
            <Field name="prefijoPresupuesto" label="Prefijo presupuesto" value={company?.prefijoPresupuesto ?? "P"} />
            <Field name="prefijoFactura" label="Prefijo factura" value={company?.prefijoFactura ?? "F"} />
            <Field name="prefijoObra" label="Prefijo obra" value={company?.prefijoObra ?? "OB"} />
            </div>
            <div className="mt-3 grid gap-3">
              <Textarea name="condicionesPorDefecto" label="Condiciones por defecto" value={company?.condicionesPorDefecto ?? ""} />
              <Textarea name="textoLegal" label="Texto legal" value={company?.textoLegal ?? ""} />
            </div>
          </details>

          <details className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <summary className="cursor-pointer font-black text-obra-ink">Marca</summary>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field name="colorMarca" label="Color marca" value={company?.colorMarca ?? "#f6c945"} type="color" />
            </div>
          </details>

          <div className="rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-600">
            Previsualización documento: {company?.nombreComercial ?? "Mi empresa"} · {company?.nifCif ?? "NIF/CIF pendiente"} · serie presupuesto {company?.prefijoPresupuesto ?? "P"}-{company?.seriePresupuestos ?? "2026"}.
          </div>

          <button type="submit" className="primary-button w-full">
            <Save size={18} />
            Guardar datos de empresa
          </button>
        </form>
        <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <summary className="cursor-pointer font-black text-obra-ink">Archivos privados de marca</summary>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <AssetUpload kind="logo" label="Logo privado" configured={Boolean(company.logoStoredObjectId)} />
            <AssetUpload kind="seal" label="Sello privado" configured={Boolean(company.sealStoredObjectId)} />
          </div>
        </details>
      </section> : null}

      {area === "integraciones" ? <section id="integraciones" className="card mb-5 scroll-mt-24 p-4">
        <h2 className="text-lg font-black text-obra-ink">Privacidad e inteligencia artificial</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">Consulta límites, coste agregado y revisa propuestas sin exponer prompts ni contenido.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href="/configuracion/preferencias" className="secondary-button">Preferencias y opt-ins</a>
          <a href="/configuracion/ia" className="secondary-button">IA, revisión y consumo</a>
          <a href="/configuracion/privacidad" className="secondary-button">Centro de privacidad</a>
          <a href="/configuracion/importar" className="secondary-button">Importar con vista previa</a>
          <a href="/configuracion/soporte" className="secondary-button">Soporte autenticado</a>
        </div>
      </section> : null}

      {area === "app" ? <section id="app" className="card mb-5 scroll-mt-24 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Smartphone size={20} className="text-obra-graphite" />
          <h2 className="text-lg font-black text-obra-ink">Usar Orqena como app</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-slate-50 p-3">
            <h3 className="font-black text-obra-ink">iPhone</h3>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-6 text-slate-600">
              <li>Abre Orqena en Safari.</li>
              <li>Pulsa compartir.</li>
              <li>Pulsa Añadir a pantalla de inicio.</li>
              <li>Abre Orqena desde el icono.</li>
            </ol>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <h3 className="font-black text-obra-ink">Android</h3>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-6 text-slate-600">
              <li>Abre Orqena en Chrome.</li>
              <li>Pulsa el menú.</li>
              <li>Pulsa Instalar app o Añadir a pantalla de inicio.</li>
              <li>Abre Orqena desde el icono.</li>
            </ol>
          </div>
        </div>
      </section> : null}

      {area === "legal" ? <section id="legal" className="card mb-5 scroll-mt-24 p-4">
        <h2 className="text-lg font-black text-obra-ink">Legal y soporte</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          Información necesaria para usuarios, revisores de App Store y Google Play.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <a href="/privacidad" className="secondary-button">Privacidad</a>
          <a href="/terminos" className="secondary-button">Términos</a>
          <a href="/cookies" className="secondary-button">Cookies</a>
          <a href="/politicas" className="secondary-button">Políticas</a>
          <a href="/soporte" className="secondary-button">Soporte</a>
        </div>
      </section> : null}

      {owner && area === "zona-sensible" ? <section id="suscripcion" className="card scroll-mt-24 p-4">
        <h2 className="text-lg font-black text-obra-ink">Administración empresarial</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">Cada área aplica permisos y capacidades comerciales en servidor. No se muestran precios sin aprobación comercial.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <a href="/equipo" className="secondary-button">Equipo y permisos</a><a href="/equipos" className="secondary-button">Equipos</a><a href="/plan-y-uso" className="secondary-button">Plan y uso</a><a href="/configuracion/memoria" className="secondary-button">Memoria de {brand.assistantName}</a><a href="/configuracion/seguridad" className="secondary-button">Seguridad de acceso</a><a href="/configuracion/privacidad" className="secondary-button">Centro de privacidad</a><a href="/auditoria" className="secondary-button">Auditoría</a><a href="#empresa" className="secondary-button">Zona sensible</a>
        </div>
        <div id="zona-sensible" className="mt-5 scroll-mt-24 rounded-xl border border-red-200 bg-red-50 p-4">
          <h3 className="font-black text-red-800">Zona sensible</h3>
          <p className="mt-1 text-sm leading-6 text-red-800">Propiedad, revocaciones, fiscalidad e integraciones requieren sus controles y confirmaciones independientes.</p>
          <div className="mt-3 flex flex-wrap gap-2"><a href="/equipo" className="secondary-button">Revisar accesos</a><a href="/auditoria" className="secondary-button">Abrir auditoría</a></div>
        </div>
      </section> : null}
        </div>
      </div>
    </main>
  );
}

function ReadinessItem({
  label,
  detail,
  ready,
  href,
}: {
  label: string;
  detail: string;
  ready: boolean;
  href: string;
}) {
  return (
    <a href={href} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
      <CheckCircle2 className={ready ? "mt-0.5 text-emerald-600" : "mt-0.5 text-slate-400"} size={19} />
      <span>
        <strong className="block text-sm text-obra-ink">{label}</strong>
        <span className="mt-1 block text-xs leading-5 text-slate-500">{detail}</span>
      </span>
    </a>
  );
}

function Field({
  name,
  label,
  value,
  type = "text",
  required = false
}: {
  name: string;
  label: string;
  value: string | number;
  type?: string;
  required?: boolean;
}) {
  return (
    <label>
      <span className="label mb-1 block">{label}</span>
      <input className="field" name={name} type={type} step={type === "number" ? "0.01" : undefined} defaultValue={value} required={required} />
    </label>
  );
}

function Checkbox({ name, label, checked = false }: { name: string; label: string; checked?: boolean }) {
  return (
    <label className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
      <input name={name} type="checkbox" defaultChecked={checked} className="h-4 w-4" />
      {label}
    </label>
  );
}

function CompletionBar({
  label,
  status
}: {
  label: string;
  status: { percent: number; missingRequired: string[]; missingRecommended: string[] };
}) {
  const missing = [...status.missingRequired, ...status.missingRecommended];

  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm font-black text-obra-ink">{label} completo al {status.percent}%</p>
        <span className="text-xs font-bold text-slate-500">{missing.length} pendientes</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white">
        <div className="h-full rounded-full bg-obra-yellowDark" style={{ width: `${status.percent}%` }} />
      </div>
      {missing.length ? (
        <p className="mt-2 text-xs font-semibold leading-5 text-slate-600">
          Falta: {missing.slice(0, 4).join(", ")}{missing.length > 4 ? "..." : ""}.
        </p>
      ) : (
        <p className="mt-2 text-xs font-semibold text-obra-green">Datos listos para trabajar.</p>
      )}
    </div>
  );
}

function Textarea({ name, label, value }: { name: string; label: string; value: string }) {
  return (
    <label>
      <span className="label mb-1 block">{label}</span>
      <textarea className="field min-h-24 py-3 leading-6" name={name} defaultValue={value} />
    </label>
  );
}

function AssetUpload({ kind, label, configured }: { kind: "logo" | "seal"; label: string; configured: boolean }) {
  return (
    <form action={uploadCompanyAsset} className="rounded-lg border border-slate-200 bg-white p-3">
      <input type="hidden" name="assetKind" value={kind} />
      <p className="text-sm font-black text-obra-ink">{label}</p>
      <p className="mt-1 text-xs text-slate-600">{configured ? "Archivo privado configurado." : "Sin archivo configurado."} PNG, JPEG o WebP; máximo 5 MB.</p>
      <input aria-label={`Seleccionar ${label.toLowerCase()}`} className="field mt-3" type="file" name="asset" accept="image/png,image/jpeg,image/webp" required />
      <button type="submit" className="secondary-button mt-3 w-full">Subir archivo privado</button>
    </form>
  );
}

function numericLimit(value: boolean | number | string | undefined) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function companyRuntimeAiEnabled(companyId: string) {
  try {
    const runtime = readRuntimeAiControl();
    return runtime.globalEnabled && runtime.liveConfigurationComplete && runtime.companyAllowlist.includes(companyId);
  } catch {
    return false;
  }
}
