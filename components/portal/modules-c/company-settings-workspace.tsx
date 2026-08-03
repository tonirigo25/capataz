import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import {
  Building2,
  CheckCircle2,
  ImageIcon,
  Palette,
  Pencil,
  PlugZap,
  Save,
  ShieldCheck,
  Stamp,
  Upload,
  UserRoundPlus,
  UsersRound,
} from "lucide-react";
import { saveCompanySettings, uploadCompanyAsset } from "@/app/(app)/configuracion/actions";
import styles from "./company-settings-workspace.module.css";

type Completion = {
  percent: number;
  completed: number;
  total: number;
  missingRequired: string[];
  missingRecommended: string[];
};

export type CompanySettingsWorkspaceData = {
  id: string;
  nombreComercial: string;
  razonSocial: string | null;
  nifCif: string | null;
  email: string | null;
  telefono: string | null;
  web: string | null;
  personaContacto: string | null;
  direccionFiscal: string | null;
  codigoPostal: string | null;
  ciudad: string | null;
  provincia: string | null;
  pais: string;
  iban: string | null;
  timezone: string;
  locale: string;
  moneda: string;
  ivaDefecto: number;
  validezPresupuestoDias: number;
  formaPagoDefecto: string | null;
  seriePresupuestos: string;
  serieFacturas: string;
  serieObras: string;
  prefijoPresupuesto: string;
  prefijoFactura: string;
  prefijoObra: string;
  condicionesPorDefecto: string | null;
  textoLegal: string | null;
  colorMarca: string;
  logoConfigured: boolean;
  sealConfigured: boolean;
  status: string;
  updatedAt: Date;
  completion: Completion;
  memberCount: number;
  adminCount: number;
  activeIntegrationCount: number;
  mfaEnabled: boolean;
};

const previewKinds = ["email", "presupuesto", "factura", "documento"] as const;
type PreviewKind = (typeof previewKinds)[number];

export function CompanySettingsWorkspace({
  activeView,
  editMode,
  preview,
  data,
}: {
  activeView: "empresa" | "identidad-marca" | "fiscal-documentos";
  editMode: boolean;
  preview?: string;
  data: CompanySettingsWorkspaceData;
}) {
  const selectedPreview = previewKinds.includes(preview as PreviewKind) ? preview as PreviewKind : "email";

  return (
    <div className={styles.workspace} data-company-settings-workspace data-company-settings-view={activeView}>
      <header className={styles.header}>
        <h1>Configuración de empresa</h1>
        <p>Define la estructura corporativa, fiscal y operativa de Orqena para trabajar con menos fricción.</p>
      </header>
      <SettingsTabs activeView={activeView} />
      {activeView === "empresa" ? <CompanyGeneralView data={data} editMode={editMode} /> : null}
      {activeView === "identidad-marca" ? <CompanyIdentityView data={data} preview={selectedPreview} /> : null}
      {activeView === "fiscal-documentos" ? <CompanyFiscalView data={data} editMode={editMode} /> : null}
    </div>
  );
}

function SettingsTabs({ activeView }: { activeView: "empresa" | "identidad-marca" | "fiscal-documentos" }) {
  const tabs = [
    { label: "Empresa", href: "/configuracion?area=empresa", active: activeView === "empresa" },
    { label: "Identidad y marca", href: "/configuracion?area=identidad-marca", active: activeView === "identidad-marca" },
    { label: "Facturación y fiscalidad", href: "/configuracion?area=fiscal-documentos", active: activeView === "fiscal-documentos" },
    { label: "Sucursales", href: "/configuracion/sucursales" },
    { label: "Usuarios y permisos", href: "/configuracion/usuarios-permisos" },
    { label: "Integraciones", href: "/configuracion?area=integraciones#integraciones" },
    { label: "Seguridad", href: "/configuracion/seguridad" },
  ];

  return (
    <nav className={styles.tabs} aria-label="Configuración de empresa">
      {tabs.map((tab) => (
        <Link key={tab.href} href={tab.href} aria-current={tab.active ? "page" : undefined}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

function CompanyFiscalView({ data, editMode }: { data: CompanySettingsWorkspaceData; editMode: boolean }) {
  const fiscalReady = Boolean(data.razonSocial && data.nifCif && data.direccionFiscal && data.codigoPostal && data.ciudad);
  const paymentReady = Boolean(data.formaPagoDefecto);
  const bankReady = Boolean(data.iban);

  return (
    <div className={styles.view} data-company-fiscal-view>
      <section className={styles.panelGrid} aria-label="Configuración fiscal y de facturación">
        <InfoPanel title="1. Datos fiscales" editHref="/configuracion?area=fiscal-documentos&edit=fiscal#editar-fiscal">
          <DataRows rows={[["Razón social", data.razonSocial], ["CIF / NIF", data.nifCif], ["País fiscal", data.pais], ["Moneda", currencyLabel(data.moneda)]]} />
          <StatusRow label="Identidad fiscal" ready={fiscalReady} readyText="Verificada internamente" missingText="Datos pendientes" />
        </InfoPanel>

        <InfoPanel title="2. Domicilio fiscal" editHref="/configuracion?area=fiscal-documentos&edit=domicilio#editar-fiscal">
          <DataRows rows={[["Dirección", data.direccionFiscal], ["Código postal", data.codigoPostal], ["Ciudad", data.ciudad], ["Provincia", data.provincia], ["País", data.pais]]} />
        </InfoPanel>

        <InfoPanel title="3. Series documentales" editHref="/configuracion?area=fiscal-documentos&edit=series#editar-fiscal">
          <DataRows rows={[["Facturas", `${data.prefijoFactura}-${data.serieFacturas}`], ["Presupuestos", `${data.prefijoPresupuesto}-${data.seriePresupuestos}`], ["Trabajos", `${data.prefijoObra}-${data.serieObras}`]]} />
          <p className={styles.subheading}>La numeración real se asigna por el servicio protegido de cada documento.</p>
        </InfoPanel>

        <InfoPanel title="4. Impuestos por defecto" editHref="/configuracion?area=fiscal-documentos&edit=impuestos#editar-fiscal">
          <DataRows rows={[["IVA general", `${formatNumber(data.ivaDefecto)}%`], ["Impuestos incluidos", "No"], ["Moneda documental", currencyLabel(data.moneda)]]} />
          <p className={styles.subheading}>Los tipos distintos se eligen en cada línea autorizada; esta vista no inventa tipos reducidos.</p>
        </InfoPanel>

        <InfoPanel title="5. Retenciones">
          <StatusRow label="Retención predeterminada" ready={false} readyText="Configurada" missingText="No configurada" />
          <p className={styles.subheading}>Las retenciones sólo se aplican cuando el documento y el perfil fiscal las definen expresamente.</p>
        </InfoPanel>

        <InfoPanel title="6. Condiciones de pago" editHref="/configuracion?area=fiscal-documentos&edit=pago#editar-fiscal">
          <DataRows rows={[["Condición predeterminada", data.formaPagoDefecto], ["Validez de presupuestos", `${data.validezPresupuestoDias} días`]]} />
          <StatusRow label="Condiciones comerciales" ready={paymentReady} readyText="Configuradas" missingText="Pendientes" />
        </InfoPanel>

        <InfoPanel title="7. Cuenta bancaria" editHref="/configuracion?area=fiscal-documentos&edit=banco#editar-fiscal">
          <DataRows rows={[["IBAN de cobro", maskIban(data.iban)]]} />
          <StatusRow label="Cuenta para documentos" ready={bankReady} readyText="Configurada" missingText="Pendiente" />
          <p className={styles.subheading}>El valor completo sólo se procesa en formularios protegidos y no se expone en esta vista.</p>
        </InfoPanel>

        <InfoPanel title="8. Plantillas de documentos" href="/configuracion?area=identidad-marca&preview=factura" linkLabel="Vista previa">
          <StatusRow label="Logo privado" ready={data.logoConfigured} readyText="Configurado" missingText="Pendiente" />
          <StatusRow label="Sello privado" ready={data.sealConfigured} readyText="Configurado" missingText="Pendiente" />
          <DataRows rows={[["Texto legal", data.textoLegal ? "Configurado" : null], ["Condiciones", data.condicionesPorDefecto ? "Configuradas" : null]]} />
        </InfoPanel>

        <InfoPanel title="9. Cumplimiento y proveedores live" href="/auditoria" linkLabel="Abrir auditoría">
          <StatusRow label="Datos fiscales mínimos" ready={fiscalReady} readyText="Completos" missingText="Pendientes" />
          <StatusRow label="Fiscalidad live" ready={false} readyText="Activa" missingText="Desactivada por política" />
          <p className={styles.subheading}>La configuración documental no activa transmisión fiscal, registro público ni cobros.</p>
        </InfoPanel>
      </section>

      <details id="editar-fiscal" className={styles.editPanel} open={editMode}>
        <summary><Pencil size={16} />Editar datos fiscales y documentales</summary>
        <CompanyGeneralForm data={data} />
      </details>
      <div className={styles.savedFooter}><CheckCircle2 size={15} />Último guardado: {formatSavedAt(data.updatedAt)}<Link href="/auditoria">Historial de cambios</Link></div>
    </div>
  );
}

function CompanyGeneralView({ data, editMode }: { data: CompanySettingsWorkspaceData; editMode: boolean }) {
  const requiredReady = data.completion.missingRequired.length === 0;
  const fiscalReady = Boolean(data.nifCif && data.direccionFiscal);
  const contactReady = Boolean(data.email || data.telefono);
  const registeredOfficeCount = data.direccionFiscal && data.ciudad ? 1 : 0;

  return (
    <div className={styles.view} data-company-general-view>
      <section className={styles.metricGrid} aria-label="Estado de configuración">
        <article className={styles.metricCard}>
          <span className={styles.progressRing} style={{ "--progress": `${data.completion.percent * 3.6}deg` } as CSSProperties}>
            <strong>{data.completion.percent}%</strong>
          </span>
          <div><p>Completitud de empresa</p><strong>Perfil corporativo</strong><Link href="#company-checklist">Ver detalles</Link></div>
        </article>
        <MetricCard icon={ShieldCheck} label="Validaciones superadas" value={`${data.completion.completed} de ${data.completion.total}`} href="#company-checklist" linkLabel="Ver checklist" />
        <MetricCard icon={PlugZap} label="Integraciones activas" value={String(data.activeIntegrationCount)} href="/configuracion?area=integraciones#integraciones" linkLabel="Gestionar" />
        <MetricCard icon={UsersRound} label="Usuarios administradores" value={String(data.adminCount)} href="/configuracion/usuarios-permisos" linkLabel="Ver usuarios" />
      </section>

      <section className={styles.panelGrid} aria-label="Resumen de empresa">
        <InfoPanel title="1. Ficha corporativa" editHref="/configuracion?area=empresa&edit=corporativa#editar-empresa">
          <DataRows rows={[
            ["Razón social", data.razonSocial], ["Nombre comercial", data.nombreComercial], ["NIF / CIF", data.nifCif],
            ["Email corporativo", data.email], ["Teléfono", data.telefono], ["Web", data.web],
            ["Dirección", data.direccionFiscal], ["Ciudad", joinNonEmpty([data.codigoPostal, data.ciudad])], ["País", data.pais],
          ]} />
        </InfoPanel>

        <InfoPanel title="2. Datos operativos" editHref="/configuracion?area=empresa&edit=operativa#editar-empresa">
          <DataRows rows={[
            ["Zona horaria", timezoneLabel(data.timezone)], ["Moneda", currencyLabel(data.moneda)],
            ["Idioma principal", localeLabel(data.locale)], ["Validez de presupuestos", `${data.validezPresupuestoDias} días`],
            ["Estado de la cuenta", humanize(data.status)],
          ]} />
          <p className={styles.subheading}>Series documentales activas</p>
          <div className={styles.chipRow}>
            <span>{data.prefijoFactura}-{data.serieFacturas}</span>
            <span>{data.prefijoPresupuesto}-{data.seriePresupuestos}</span>
            <span>{data.prefijoObra}-{data.serieObras}</span>
          </div>
        </InfoPanel>

        <InfoPanel title="3. Facturación y cumplimiento" href="/configuracion?area=fiscal-documentos#fiscal-documentos" linkLabel="Ver detalles">
          <DataRows rows={[["Serie de facturas", `${data.prefijoFactura}-${data.serieFacturas}`]]} />
          <StatusRow label="Datos fiscales" ready={fiscalReady} readyText="Completos" missingText="Pendientes" />
          <StatusRow label="Cuenta bancaria" ready={Boolean(data.iban)} readyText="Configurada" missingText="Pendiente" />
          <StatusRow label="Contacto corporativo" ready={contactReady} readyText="Disponible" missingText="Pendiente" />
          <DataRows rows={[
            ["Condiciones de pago", data.formaPagoDefecto], ["Impuestos por defecto", `${formatNumber(data.ivaDefecto)}% IVA`],
          ]} />
          <StatusRow label="Sello privado" ready={data.sealConfigured} readyText="Configurado" missingText="Sin configurar" />
        </InfoPanel>

        <InfoPanel title="4. Identidad y marca" editHref="/configuracion?area=identidad-marca">
          <div className={styles.identitySummary}>
            <span className={styles.companyMark} style={{ background: data.colorMarca }}><Building2 size={18} aria-hidden="true" /></span>
            <div><strong>{data.nombreComercial}</strong><small>{data.logoConfigured ? "Logo privado configurado" : "Logo privado pendiente"}</small></div>
          </div>
          <div className={styles.colorSummary}>
            <span><i style={{ background: data.colorMarca }} />Color principal<strong>{data.colorMarca.toUpperCase()}</strong></span>
            <span><i className={styles.systemColor} />Sistema Orqena<strong>Interfaz</strong></span>
          </div>
          <StatusRow label="Logo para documentos" ready={data.logoConfigured} readyText="Disponible" missingText="Pendiente" />
          <StatusRow label="Sello corporativo" ready={data.sealConfigured} readyText="Disponible" missingText="Pendiente" />
          <Link href="/configuracion?area=identidad-marca" className={styles.fullWidthLink}>Previsualizar identidad</Link>
        </InfoPanel>

        <InfoPanel title="5. Centros y equipos" href="/configuracion/sucursales" linkLabel="Gestionar sucursales">
          <div className={styles.teamStats}>
            <span><strong>{registeredOfficeCount}</strong> sede fiscal registrada</span>
            <span><strong>{data.memberCount}</strong> miembros activos</span>
          </div>
          <StatusRow label="MFA de tu cuenta" ready={data.mfaEnabled} readyText="Activo" missingText="Pendiente" />
          <div className={styles.quickLinkGrid}>
            <Link href="/configuracion/sucursales"><Building2 size={16} />Gestionar sucursales</Link>
            <Link href="/equipo"><UsersRound size={16} />Asignar responsables</Link>
          </div>
        </InfoPanel>

        <InfoPanel title="6. Acciones rápidas">
          <div className={styles.actionStack}>
            <Link className={styles.primaryAction} href="/configuracion?area=empresa&edit=all#editar-empresa"><Pencil size={16} />Editar configuración</Link>
            <Link href="/configuracion?area=identidad-marca"><Palette size={16} />Identidad y marca</Link>
            <Link href="/equipo"><UserRoundPlus size={16} />Invitar administrador</Link>
            <Link href="/auditoria"><ShieldCheck size={16} />Abrir auditoría de cambios</Link>
          </div>
          <div className={styles.savedState}><CheckCircle2 size={14} />Último guardado: {formatSavedAt(data.updatedAt)}</div>
        </InfoPanel>
      </section>

      <details id="editar-empresa" className={styles.editPanel} open={editMode}>
        <summary><Pencil size={16} />Editar configuración de empresa</summary>
        <CompanyGeneralForm data={data} />
      </details>

      <section id="company-checklist" className={styles.checklist} aria-labelledby="company-checklist-title">
        <div><h2 id="company-checklist-title">Checklist de configuración</h2><p>Datos reales pendientes para completar la ficha corporativa.</p></div>
        <div className={styles.checklistItems}>
          {data.completion.missingRequired.length + data.completion.missingRecommended.length === 0 ? (
            <span className={styles.checkReady}><CheckCircle2 size={16} />Configuración completa</span>
          ) : [...data.completion.missingRequired, ...data.completion.missingRecommended].map((item) => <span key={item}>{item}</span>)}
        </div>
        <StatusRow label="Campos obligatorios" ready={requiredReady} readyText="Completos" missingText="Requieren atención" />
      </section>
    </div>
  );
}

function CompanyIdentityView({ data, preview }: { data: CompanySettingsWorkspaceData; preview: PreviewKind }) {
  return (
    <div className={styles.identityLayout} data-company-identity-view>
      <div className={styles.identityColumn}>
        <section className={styles.formPanel}>
          <div className={styles.panelHeading}><div><h2>1. Información básica</h2><p>Identidad legal y comercial utilizada en comunicaciones y documentos.</p></div></div>
          <form action={saveCompanySettings} className={styles.compactForm}>
            <input type="hidden" name="id" value={data.id} />
            <PreservedIdentityFields data={data} />
            <div className={styles.twoColumnFields}>
              <Field name="razonSocial" label="Razón social" value={data.razonSocial ?? ""} />
              <Field name="nombreComercial" label="Nombre comercial" value={data.nombreComercial} required />
              <Field name="nifCif" label="NIF / CIF" value={data.nifCif ?? ""} />
              <Field name="web" label="Sitio web" value={data.web ?? ""} type="url" />
              <Field name="email" label="Email corporativo" value={data.email ?? ""} type="email" />
              <Field name="telefono" label="Teléfono" value={data.telefono ?? ""} type="tel" />
            </div>
            <label className={styles.paletteField}><span>Color principal</span><span><input type="color" name="colorMarca" defaultValue={normalizeColor(data.colorMarca)} /><strong>{normalizeColor(data.colorMarca).toUpperCase()}</strong></span></label>
            <button type="submit" className={styles.saveButton}><Save size={16} />Guardar identidad</button>
          </form>
        </section>

        <section className={styles.assetsPanel} aria-labelledby="brand-assets-title">
          <div className={styles.panelHeading}><div><h2 id="brand-assets-title">2. Activos de marca</h2><p>Archivos privados, aislados por empresa y usados en documentos autorizados.</p></div></div>
          <div className={styles.assetGrid}>
            <AssetUpload kind="logo" label="Logo principal" configured={data.logoConfigured} />
            <AssetUpload kind="seal" label="Sello corporativo" configured={data.sealConfigured} />
            <article className={styles.assetCard}>
              <span className={styles.assetIcon}><Palette size={20} /></span>
              <div><h3>Paleta corporativa</h3><p>Color principal guardado para documentos.</p></div>
              <span className={styles.palettePreview}><i style={{ background: data.colorMarca }} />{data.colorMarca.toUpperCase()}</span>
            </article>
          </div>
        </section>

        <div className={styles.identitySubgrid}>
          <section className={styles.smallPanel}>
            <h2>3. Tipografía</h2>
            <div className={styles.typographyPreview}><span>Tipografía de interfaz</span><strong>Inter <b>Aa</b></strong></div>
            <p>La interfaz utiliza la tipografía canónica de Orqena para mantener legibilidad y coherencia.</p>
            <span className={styles.managedBadge}>Gestionada por Orqena</span>
          </section>
          <section className={styles.smallPanel}>
            <h2>4. Firma corporativa</h2>
            <BrandSignature data={data} compact />
            <p>Se genera con la información corporativa guardada; no añade datos que no existan.</p>
          </section>
        </div>
      </div>

      <section className={styles.previewPanel} aria-labelledby="brand-preview-title">
        <div className={styles.panelHeading}><div><h2 id="brand-preview-title">5. Vista previa de marca</h2><p>Así se verá la identidad con los datos actualmente configurados.</p></div></div>
        <nav className={styles.previewTabs} aria-label="Tipo de vista previa">
          {previewKinds.map((kind) => <Link key={kind} href={`/configuracion?area=identidad-marca&preview=${kind}`} aria-current={preview === kind ? "page" : undefined}>{previewLabel(kind)}</Link>)}
        </nav>
        <BrandPreview data={data} kind={preview} />
        <div className={styles.savedFooter}><CheckCircle2 size={15} />Último guardado: {formatSavedAt(data.updatedAt)}<Link href="/auditoria">Historial de cambios</Link></div>
      </section>
    </div>
  );
}

function CompanyGeneralForm({ data }: { data: CompanySettingsWorkspaceData }) {
  return (
    <form action={saveCompanySettings} className={styles.generalForm}>
      <input type="hidden" name="id" value={data.id} />
      <input type="hidden" name="colorMarca" value={data.colorMarca} />
      <div className={styles.threeColumnFields}>
        <Field name="nombreComercial" label="Nombre comercial" value={data.nombreComercial} required />
        <Field name="razonSocial" label="Razón social" value={data.razonSocial ?? ""} />
        <Field name="nifCif" label="NIF / CIF" value={data.nifCif ?? ""} />
        <Field name="email" label="Email corporativo" value={data.email ?? ""} type="email" />
        <Field name="telefono" label="Teléfono" value={data.telefono ?? ""} type="tel" />
        <Field name="web" label="Sitio web" value={data.web ?? ""} type="url" />
        <Field name="personaContacto" label="Persona de contacto" value={data.personaContacto ?? ""} />
        <Field name="direccionFiscal" label="Dirección fiscal" value={data.direccionFiscal ?? ""} />
        <Field name="codigoPostal" label="Código postal" value={data.codigoPostal ?? ""} />
        <Field name="ciudad" label="Ciudad" value={data.ciudad ?? ""} />
        <Field name="provincia" label="Provincia" value={data.provincia ?? ""} />
        <Field name="pais" label="País" value={data.pais} />
        <SelectField name="timezone" label="Zona horaria" value={data.timezone} options={[["Europe/Madrid", "Madrid"], ["Atlantic/Canary", "Islas Canarias"], ["UTC", "UTC"]]} />
        <SelectField name="locale" label="Idioma principal" value={data.locale} options={[["es-ES", "Español"], ["ca-ES", "Català"], ["eu-ES", "Euskara"], ["gl-ES", "Galego"], ["en-GB", "English"]]} />
        <Field name="moneda" label="Moneda" value={data.moneda} />
        <Field name="ivaDefecto" label="IVA por defecto" value={data.ivaDefecto} type="number" />
        <Field name="validezPresupuestoDias" label="Validez presupuestos (días)" value={data.validezPresupuestoDias} type="number" />
        <Field name="formaPagoDefecto" label="Condiciones de pago" value={data.formaPagoDefecto ?? ""} />
        <Field name="prefijoPresupuesto" label="Prefijo presupuesto" value={data.prefijoPresupuesto} />
        <Field name="seriePresupuestos" label="Serie presupuestos" value={data.seriePresupuestos} />
        <Field name="prefijoFactura" label="Prefijo factura" value={data.prefijoFactura} />
        <Field name="serieFacturas" label="Serie facturas" value={data.serieFacturas} />
        <Field name="prefijoObra" label="Prefijo trabajo" value={data.prefijoObra} />
        <Field name="serieObras" label="Serie trabajos" value={data.serieObras} />
        <Field name="iban" label="Cuenta bancaria / IBAN" value={data.iban ?? ""} />
      </div>
      <div className={styles.twoColumnFields}>
        <Textarea name="condicionesPorDefecto" label="Condiciones por defecto" value={data.condicionesPorDefecto ?? ""} />
        <Textarea name="textoLegal" label="Texto legal" value={data.textoLegal ?? ""} />
      </div>
      <div className={styles.formActions}>
        <Link href="/configuracion?area=empresa" className={styles.cancelButton}>Cancelar</Link>
        <button type="submit" className={styles.saveButton}><Save size={16} />Guardar cambios</button>
      </div>
    </form>
  );
}

function PreservedIdentityFields({ data }: { data: CompanySettingsWorkspaceData }) {
  const fields: Array<[string, string | number | null]> = [
    ["personaContacto", data.personaContacto], ["direccionFiscal", data.direccionFiscal], ["codigoPostal", data.codigoPostal],
    ["ciudad", data.ciudad], ["provincia", data.provincia], ["pais", data.pais], ["iban", data.iban],
    ["timezone", data.timezone], ["locale", data.locale], ["moneda", data.moneda], ["ivaDefecto", data.ivaDefecto],
    ["validezPresupuestoDias", data.validezPresupuestoDias], ["formaPagoDefecto", data.formaPagoDefecto],
    ["seriePresupuestos", data.seriePresupuestos], ["serieFacturas", data.serieFacturas], ["serieObras", data.serieObras],
    ["prefijoPresupuesto", data.prefijoPresupuesto], ["prefijoFactura", data.prefijoFactura], ["prefijoObra", data.prefijoObra],
    ["condicionesPorDefecto", data.condicionesPorDefecto], ["textoLegal", data.textoLegal],
  ];
  return <>{fields.map(([name, value]) => <input key={name} type="hidden" name={name} value={value ?? ""} />)}</>;
}

function MetricCard({ icon: Icon, label, value, href, linkLabel }: { icon: typeof ShieldCheck; label: string; value: string; href: string; linkLabel: string }) {
  return <article className={styles.metricCard}><span className={styles.metricIcon}><Icon size={20} /></span><div><p>{label}</p><strong>{value}</strong><Link href={href}>{linkLabel}</Link></div></article>;
}

function InfoPanel({ title, children, editHref, href, linkLabel }: { title: string; children: ReactNode; editHref?: string; href?: string; linkLabel?: string }) {
  return <article className={styles.infoPanel}><div className={styles.panelTitle}><h2>{title}</h2>{editHref ? <Link href={editHref}><Pencil size={13} />Editar</Link> : href ? <Link href={href}>{linkLabel ?? "Ver detalles"}</Link> : null}</div>{children}</article>;
}

function DataRows({ rows }: { rows: Array<[string, string | null | undefined]> }) {
  return <dl className={styles.dataRows}>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd className={!value ? styles.pendingValue : undefined}>{value || "Pendiente"}</dd></div>)}</dl>;
}

function StatusRow({ label, ready, readyText, missingText }: { label: string; ready: boolean; readyText: string; missingText: string }) {
  return <div className={styles.statusRow}><span>{ready ? <CheckCircle2 size={13} /> : <span className={styles.statusDot} />}{label}</span><strong data-ready={ready ? "true" : "false"}>{ready ? readyText : missingText}</strong></div>;
}

function Field({ name, label, value, type = "text", required = false }: { name: string; label: string; value: string | number; type?: string; required?: boolean }) {
  return <label className={styles.field}><span>{label}</span><input name={name} type={type} defaultValue={value} required={required} step={type === "number" ? "0.01" : undefined} /></label>;
}

function SelectField({ name, label, value, options }: { name: string; label: string; value: string; options: Array<[string, string]> }) {
  const supported = options.some(([key]) => key === value);
  return <label className={styles.field}><span>{label}</span><select name={name} defaultValue={value}>{!supported ? <option value={value}>{value}</option> : null}{options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>;
}

function Textarea({ name, label, value }: { name: string; label: string; value: string }) {
  return <label className={styles.field}><span>{label}</span><textarea name={name} defaultValue={value} /></label>;
}

function AssetUpload({ kind, label, configured }: { kind: "logo" | "seal"; label: string; configured: boolean }) {
  return (
    <form action={uploadCompanyAsset} className={styles.assetCard}>
      <input type="hidden" name="assetKind" value={kind} />
      <span className={styles.assetIcon}>{kind === "logo" ? <ImageIcon size={20} /> : <Stamp size={20} />}</span>
      <div><h3>{label}</h3><p>{configured ? "Archivo privado configurado." : "Sin archivo configurado."} PNG, JPEG o WebP; máximo 5 MB.</p></div>
      <label className={styles.fileField}><span><Upload size={14} />Seleccionar archivo</span><input aria-label={`Seleccionar ${label.toLowerCase()}`} type="file" name="asset" accept="image/png,image/jpeg,image/webp" required /></label>
      <button type="submit">{configured ? "Cambiar" : "Subir"}</button>
    </form>
  );
}

function BrandSignature({ data, compact = false }: { data: CompanySettingsWorkspaceData; compact?: boolean }) {
  return <div className={styles.signature} data-compact={compact ? "true" : "false"}><span className={styles.signatureMark} style={{ background: data.colorMarca }}>{initials(data.nombreComercial)}</span><div><strong>{data.nombreComercial}</strong><small>{data.personaContacto || "Contacto corporativo"}</small><small>{joinNonEmpty([data.telefono, data.email]) || "Contacto pendiente"}</small>{data.web ? <small>{data.web}</small> : null}</div></div>;
}

function BrandPreview({ data, kind }: { data: CompanySettingsWorkspaceData; kind: PreviewKind }) {
  if (kind === "email") {
    return <div className={styles.emailPreview}><div className={styles.previewSubject}><span>Asunto:</span> Comunicación de {data.nombreComercial}</div><div className={styles.emailBody}><div className={styles.sender}><span>{initials(data.personaContacto || data.nombreComercial)}</span><div><strong>{data.personaContacto || data.nombreComercial}</strong><small>{data.email || "Email corporativo pendiente"}</small></div></div><p>Hola,</p><p>Esta vista previa utiliza únicamente la identidad corporativa guardada para mostrar la estructura de un correo.</p><p>Un saludo,</p><BrandSignature data={data} /></div></div>;
  }

  const documentLabel = kind === "presupuesto" ? "PRESUPUESTO" : kind === "factura" ? "FACTURA" : "DOCUMENTO";
  const reference = kind === "presupuesto" ? `${data.prefijoPresupuesto}-${data.seriePresupuestos}-…` : kind === "factura" ? `${data.prefijoFactura}-${data.serieFacturas}-…` : `${data.prefijoObra}-${data.serieObras}-…`;
  return <div className={styles.documentPreview}><div className={styles.documentTop}><BrandSignature data={data} compact /><div><strong>{documentLabel}</strong><span>Ref.: {reference}</span><span>Vista previa · no emitido</span></div></div><div className={styles.documentIdentity}><span>{data.razonSocial || data.nombreComercial}</span><span>{data.nifCif || "NIF / CIF pendiente"}</span><span>{joinNonEmpty([data.direccionFiscal, data.ciudad]) || "Dirección pendiente"}</span></div><div className={styles.documentRule} style={{ background: data.colorMarca }} /><div className={styles.documentTable}><b>Descripción</b><b>Cantidad</b><b>Precio unitario</b><b>Importe</b>{Array.from({ length: 3 }).map((_, index) => <div key={index} className={styles.documentSkeleton}><i /><i /><i /><i /></div>)}</div><p>{data.condicionesPorDefecto || "Condiciones por defecto pendientes de configurar."}</p></div>;
}

function previewLabel(kind: PreviewKind) {
  return { email: "Email", presupuesto: "Presupuesto", factura: "Factura", documento: "Documento" }[kind];
}

function timezoneLabel(value: string) {
  return { "Europe/Madrid": "(UTC+01:00) Madrid", "Atlantic/Canary": "(UTC+00:00) Islas Canarias", UTC: "UTC" }[value] ?? value;
}

function localeLabel(value: string) {
  return { "es-ES": "Español", "ca-ES": "Català", "eu-ES": "Euskara", "gl-ES": "Galego", "en-GB": "English" }[value] ?? value;
}

function currencyLabel(value: string) {
  return value === "EUR" ? "Euro (EUR)" : value;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(value);
}

function formatSavedAt(value: Date) {
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" }).format(value);
}

function maskIban(value: string | null) {
  if (!value) return null;
  const compact = value.replace(/\s+/g, "");
  if (compact.length < 8) return "Configurado";
  return `${compact.slice(0, 4)} •••• •••• ${compact.slice(-4)}`;
}

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function joinNonEmpty(values: Array<string | null | undefined>) {
  return values.filter((value): value is string => Boolean(value?.trim())).join(" · ");
}

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "OR";
}

function normalizeColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : "#16a34a";
}
