import type { InvoiceStatus } from "@prisma/client";
import { clsx } from "clsx";

export const statusLabels: Record<string, string> = {
  nuevo: "Nuevo",
  pendiente_datos: "Pendiente datos",
  visita_pendiente: "Visita pendiente",
  presupuesto_pendiente: "Presupuesto pendiente",
  presupuesto_enviado: "Presupuesto enviado",
  seguimiento_pendiente: "Seguimiento pendiente",
  aceptado: "Aceptado",
  rechazado: "Rechazado",
  obra_activa: "Obra activa",
  finalizado: "Finalizado",
  archivado: "Archivado",
  pendiente_cobro: "Pendiente cobro",
  pendiente_inicio: "Pendiente inicio",
  en_curso: "En curso",
  pausada: "Pausada",
  pendiente_material: "Pendiente material",
  pendiente_remates: "Pendiente remates",
  cerrada: "Cerrada",
  borrador: "Borrador",
  pendiente_revision: "Pendiente revisión",
  enviado: "Enviado",
  visto: "Visto",
  pendiente_respuesta: "Pendiente respuesta",
  caducado: "Caducado",
  pendiente_emitir: "Pendiente emitir",
  emitida: "Emitida",
  enviada: "Enviada",
  pendiente: "Pendiente",
  pendiente_pago: "Pendiente pago",
  parcialmente_pagada: "Parcialmente pagada",
  pagada: "Pagada",
  vencida: "Vencida",
  reclamada: "Reclamada",
  material: "Material",
  mano_obra: "Mano de obra",
  transporte: "Transporte",
  herramienta: "Herramienta",
  gasolina: "Gasolina",
  subcontrata: "Subcontrata",
  otros: "Otros",
  comprado: "Comprado",
  entregado: "Entregado",
  falta: "Falta",
  devuelto: "Devuelto",
  seguimiento_presupuesto: "Seguimiento presupuesto",
  recordatorio_factura: "Recordatorio factura",
  factura_vencida: "Factura vencida",
  pedir_fotos: "Pedir fotos",
  pedir_medidas: "Pedir medidas",
  confirmar_visita: "Confirmar visita",
  material_pendiente: "Material pendiente",
  recordatorio_interno: "Recordatorio interno",
  interno: "Interno",
  whatsapp: "WhatsApp",
  email: "Email",
  pendiente_confirmacion: "Pendiente confirmación",
  programado: "Programado",
  cancelado: "Cancelado",
  fallido: "Fallido",
  realizado: "Realizado",
  senal: "Señal",
  pago_parcial: "Pago parcial",
  pago_final: "Pago final",
  regularizacion: "Regularización",
  visita: "Visita",
  llamada: "Llamada",
  seguimiento_cobro: "Seguimiento cobro",
  inicio_obra: "Inicio obra",
  fin_previsto_obra: "Fin previsto obra",
  compra_material: "Compra material",
  vencimiento_factura: "Vencimiento factura",
  tarea_obra: "Tarea de obra",
  confirmado: "Confirmado",
  reprogramado: "Reprogramado"
};

export function statusLabel(status: string) {
  return statusLabels[status] ?? status.replaceAll("_", " ");
}

export function statusClass(status: string) {
  return clsx("border", {
    "border-obra-green/20 bg-obra-green/10 text-obra-green":
      ["pagada", "aceptado", "finalizada", "cerrada", "entregado", "comprado", "programado", "confirmado", "realizado"].includes(status),
    "border-obra-red/20 bg-obra-red/10 text-obra-red":
      ["vencida", "rechazado", "fallido", "falta", "reclamada", "cancelado", "archivado"].includes(status),
    "border-obra-orange/25 bg-obra-orange/10 text-obra-orange":
      [
        "pendiente_cobro",
        "pendiente",
        "pendiente_pago",
        "parcialmente_pagada",
        "pendiente_confirmacion",
        "pendiente_respuesta",
        "seguimiento_pendiente",
        "pendiente_material",
        "pendiente_remates",
        "pendiente_datos",
        "reprogramado",
        "seguimiento_cobro",
        "vencimiento_factura"
      ].includes(status),
    "border-obra-yellowDark/20 bg-obra-yellow/25 text-obra-yellowDark":
      ["borrador", "pendiente_revision", "emitida", "enviada", "en_curso", "visita", "compra_material"].includes(status),
    "border-slate-200 bg-white text-slate-600":
      ![
        "pagada",
        "aceptado",
        "finalizada",
        "cerrada",
        "entregado",
        "comprado",
        "programado",
        "confirmado",
        "realizado",
        "vencida",
        "rechazado",
        "fallido",
        "falta",
        "reclamada",
        "cancelado",
        "archivado",
        "pendiente_cobro",
        "pendiente",
        "pendiente_pago",
        "parcialmente_pagada",
        "pendiente_confirmacion",
        "pendiente_respuesta",
        "seguimiento_pendiente",
        "pendiente_material",
        "pendiente_remates",
        "pendiente_datos",
        "reprogramado",
        "seguimiento_cobro",
        "vencimiento_factura",
        "borrador",
        "pendiente_revision",
        "emitida",
        "enviada",
        "en_curso",
        "visita",
        "compra_material"
      ].includes(status)
  });
}

export function deriveInvoiceStatus(total: number, pending: number, dueDate: Date): InvoiceStatus {
  if (pending <= 0) return "pagada";
  if (pending < total) return "parcialmente_pagada";
  if (dueDate < startOfToday()) return "vencida";
  return "pendiente";
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}
