"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function saveUserProfile(formData: FormData) {
  const id = text(formData, "id") || "usuario-demo";
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
  const id = text(formData, "id") || "empresa-demo";
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
    logoUrl: optionalText(formData, "logoUrl"),
    selloUrl: optionalText(formData, "selloUrl"),
    colorMarca: text(formData, "colorMarca") || "#f6c945",
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

  await prisma.empresa.upsert({
    where: { id },
    update: data,
    create: { id, ...data }
  });

  revalidatePath("/configuracion");
  revalidatePath("/capataz");
  revalidatePath("/hoy");
  revalidatePath("/presupuestos");
  revalidatePath("/dinero");
}

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function optionalText(formData: FormData, key: string) {
  const value = text(formData, key);
  return value || null;
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
