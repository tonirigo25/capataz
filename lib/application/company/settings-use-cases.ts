import { invalidateActionPath as revalidatePath } from "@/lib/application/action-effects";
import { prisma } from "@/lib/prisma";
import { requireCompanyContext } from "@/lib/auth/session";
import { requireActiveOwner } from "@/lib/commercial/owner-governance";
import { getPrivateStorageService } from "@/lib/private-storage";

const COMPANY_ASSET_MAX_BYTES = 5 * 1024 * 1024;
const COMPANY_ASSET_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const COMPANY_TIMEZONES = new Set(["Europe/Madrid", "Atlantic/Canary", "UTC"]);
const COMPANY_LOCALES = new Set(["es-ES", "ca-ES", "eu-ES", "gl-ES", "en-GB"]);

export async function saveUserProfile(formData: FormData) {
  const auth = await requireCompanyContext();
  const id = auth.userId;
  const data = {
    nombre: optionalText(formData, "nombre"),
    apellidos: optionalText(formData, "apellidos"),
    tratamiento: optionalText(formData, "tratamiento"),
    nombrePreferido: optionalText(formData, "nombrePreferido"),
    telefono: optionalText(formData, "telefono"),
    email: optionalText(formData, "email"),
    cargo: optionalText(formData, "cargo"),
    oficioPrincipal: optionalText(formData, "oficioPrincipal"),
    idioma: text(formData, "idioma") || "es-ES",
    zonaHoraria: text(formData, "zonaHoraria") || "Europe/Madrid",
    preferenciaVisual: text(formData, "preferenciaVisual") || "sistema",
    notificacionesInternas: formData.get("notificacionesInternas") === "on",
    notificacionesEmail: formData.get("notificacionesEmail") === "on",
    tonoPreferido: text(formData, "tonoPreferido") || "directo"
  };

  await prisma.usuarioPerfil.upsert({
    where: { id },
    update: data,
    create: { id, ...data }
  });

  revalidatePath("/configuracion");
  revalidatePath("/capataz");
  revalidatePath("/hoy");
}

export async function saveCompanySettings(formData: FormData) {
  const auth = await requireActiveOwner();
  const data = {
    nombreComercial: text(formData, "nombreComercial") || "Mi empresa",
    razonSocial: optionalText(formData, "razonSocial"),
    nifCif: optionalText(formData, "nifCif"),
    direccionFiscal: optionalText(formData, "direccionFiscal"),
    codigoPostal: optionalText(formData, "codigoPostal"),
    ciudad: optionalText(formData, "ciudad"),
    municipio: optionalText(formData, "municipio"),
    provincia: optionalText(formData, "provincia"),
    pais: text(formData, "pais") || "España",
    telefono: optionalText(formData, "telefono"),
    email: optionalText(formData, "email"),
    web: optionalText(formData, "web"),
    personaContacto: optionalText(formData, "personaContacto"),
    iban: optionalText(formData, "iban"),
    condicionesPorDefecto: optionalText(formData, "condicionesPorDefecto"),
    textoLegal: optionalText(formData, "textoLegal"),
    colorMarca: optionalHexColor(formData, "colorMarca"),
    timezone: optionalAllowedValue(formData, "timezone", COMPANY_TIMEZONES),
    locale: optionalAllowedValue(formData, "locale", COMPANY_LOCALES),
    ivaDefecto: number(formData, "ivaDefecto", 21),
    moneda: text(formData, "moneda") || "EUR",
    validezPresupuestoDias: integer(formData, "validezPresupuestoDias", 15),
    formaPagoDefecto: optionalText(formData, "formaPagoDefecto"),
    seriePresupuestos: text(formData, "seriePresupuestos") || "2026",
    serieFacturas: text(formData, "serieFacturas") || "2026",
    serieObras: text(formData, "serieObras") || "2026",
    prefijoPresupuesto: text(formData, "prefijoPresupuesto") || "P",
    prefijoFactura: text(formData, "prefijoFactura") || "F",
    prefijoObra: text(formData, "prefijoObra") || "OB"
  };

  await prisma.company.update({ where: { id: auth.companyId }, data: {
    nombreComercial: data.nombreComercial, razonSocial: data.razonSocial, taxId: data.nifCif,
    direccion: data.direccionFiscal, codigoPostal: data.codigoPostal, ciudad: data.ciudad,
    provincia: data.provincia, pais: data.pais, telefono: data.telefono, email: data.email,
    web: data.web, contactPerson: data.personaContacto, iban: data.iban,
    defaultConditions: data.condicionesPorDefecto, legalText: data.textoLegal,
    ...(data.colorMarca ? { brandColor: data.colorMarca } : {}),
    ...(data.timezone ? { timezone: data.timezone } : {}),
    ...(data.locale ? { locale: data.locale } : {}),
    defaultVat: data.ivaDefecto,
    currency: data.moneda, budgetValidityDays: data.validezPresupuestoDias,
    defaultPaymentTerms: data.formaPagoDefecto, budgetSeries: data.seriePresupuestos,
    invoiceSeries: data.serieFacturas, workSeries: data.serieObras, budgetPrefix: data.prefijoPresupuesto,
    invoicePrefix: data.prefijoFactura, workPrefix: data.prefijoObra
  } });

  revalidatePath("/configuracion");
  revalidatePath("/capataz");
  revalidatePath("/hoy");
  revalidatePath("/presupuestos");
  revalidatePath("/dinero");
}

export async function uploadCompanyAsset(formData: FormData) {
  const auth = await requireActiveOwner();
  const kind = text(formData, "assetKind");
  if (!['logo', 'seal'].includes(kind)) throw new Error("COMPANY_ASSET_KIND_INVALID");
  const file = formData.get("asset");
  if (!(file instanceof File) || file.size === 0) throw new Error("COMPANY_ASSET_REQUIRED");
  if (file.size > COMPANY_ASSET_MAX_BYTES) throw new Error("COMPANY_ASSET_TOO_LARGE");
  if (!COMPANY_ASSET_MIME_TYPES.has(file.type)) throw new Error("COMPANY_ASSET_TYPE_INVALID");
  const storage = getPrivateStorageService();
  const object = await storage.put({ companyId: auth.companyId, bytes: new Uint8Array(await file.arrayBuffer()), originalName: file.name, mimeType: file.type, classification: "COMPANY_BRAND", idempotencyKey: `company-${kind}:${auth.companyId}:${file.name}:${file.size}` });
  await prisma.$transaction(async (transaction) => {
    await transaction.company.update({ where: { id: auth.companyId }, data: kind === "logo" ? { logoStoredObjectId: object.id, logoUrl: null } : { sealStoredObjectId: object.id, sealUrl: null } });
    await transaction.auditLog.create({ data: { companyId: auth.companyId, userActorId: auth.userId, action: `company.${kind}.uploaded`, targetType: "StoredObject", targetId: object.id, metadata: { mimeType: object.mimeType, sizeBytes: object.sizeBytes.toString(), sha256: object.sha256 } } });
  });
  revalidatePath("/configuracion");
}

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function optionalText(formData: FormData, key: string) {
  const value = text(formData, key);
  return value || null;
}

function optionalAllowedValue(formData: FormData, key: string, allowed: Set<string>) {
  const value = text(formData, key);
  return value && allowed.has(value) ? value : null;
}

function optionalHexColor(formData: FormData, key: string) {
  const value = text(formData, key);
  return /^#[0-9a-f]{6}$/i.test(value) ? value : null;
}

function number(formData: FormData, key: string, fallback: number) {
  const value = text(formData, key);
  if (!value) return fallback;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function integer(formData: FormData, key: string, fallback: number) {
  const value = text(formData, key);
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}
