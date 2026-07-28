import type { InvoiceStatus } from "@prisma/client";

export const statusLabels: Record<string, string> = {
  DRAFT: "Borrador",
  PREPARED: "Preparado",
  ISSUED: "Emitido",
  SENT: "Enviado",
  TRANSMITTED: "Transmitido",
  ACCEPTED: "Aceptado",
  REJECTED: "Rechazado",
  OVERDUE: "Vencido",
  PARTIAL: "Parcial",
  PARTIALLY_PAID: "Parcialmente pagado",
  PAID: "Pagado",
  VOID: "Anulado",
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
  borrador_obra: "Borrador obra",
  pendiente_aprobacion: "Pendiente aprobación",
  planificada: "Planificada",
  preparacion: "Preparación",
  pendiente_cobro: "Pendiente cobro",
  pendiente_inicio: "Pendiente inicio",
  en_curso: "En curso",
  pausada: "Pausada",
  parada: "Parada",
  parcialmente_terminada: "Parcialmente terminada",
  pendiente_material: "Pendiente material",
  pendiente_cliente: "Pendiente cliente",
  pendiente_remates: "Pendiente remates",
  cerrada: "Cerrada",
  facturada_parcialmente: "Facturada parcialmente",
  facturada: "Facturada",
  cobrada: "Cobrada",
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
  reprogramado: "Reprogramado",
  unknown: "Sin clasificar",
  paid: "Pagado",
  fixed: "Fijo",
  variable: "Variable",
  bank: "Cuenta bancaria",
  cash: "Caja",
  other: "Otra cuenta",
  inflow: "Entrada",
  outflow: "Salida",
  transfer_in: "Transferencia entrada",
  transfer_out: "Transferencia salida",
  adjustment: "Ajuste",
  weekly: "Semanal",
  monthly: "Mensual",
  quarterly: "Trimestral",
  yearly: "Anual",
  custom: "Personalizada",
  inbox: "Entrada",
  planned: "Planificada",
  in_progress: "En curso",
  blocked: "Bloqueada",
  waiting: "En espera",
  waiting_response: "Esperando respuesta",
  promised: "Promesa registrada",
  completed: "Completada",
  cancelled: "Cancelada",
  archived: "Archivada",
  due: "Pendiente",
  unsuccessful: "Sin éxito",
  low: "Baja",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
  manual: "Manual",
  recurring: "Recurrente",
  general: "General",
  budget_followup: "Seguimiento de presupuesto",
  collection_followup: "Seguimiento de cobro",
  client_contact: "Contacto con cliente",
  work_followup: "Seguimiento de obra",
  internal: "Interno",
  phone: "Teléfono",
  telefono: "Teléfono",
  email_manual: "Email manual",
  whatsapp_manual: "WhatsApp manual",
  in_person: "Presencial",
  responded: "Respondió",
  no_response: "No respondió",
  requested_information: "Pidió información",
  promised_payment: "Prometió pago",
  rescheduled: "Reprogramado",
  promise: "Promesa",
  payment_reported_external: "Pago comunicado externamente",
  budget_accepted_reported: "Presupuesto aceptado comunicado",
  budget_rejected_reported: "Presupuesto rechazado comunicado",
  resolved: "Resuelto",
  unresolved: "No resuelto",
  baja: "Baja",
  media: "Media",
  alta: "Alta",
  urgente: "Urgente"
};

export const statusDescriptions: Record<string, string> = {
  DRAFT: "Editable. Aún no acredita emisión, envío ni aceptación.",
  borrador: "Editable. Aún no acredita emisión, envío ni aceptación.",
  PREPARED: "Preparado para revisión. Todavía no consta como emitido.",
  pendiente_revision: "Preparado para revisión. Todavía no consta como emitido.",
  ISSUED: "Emitido en Orqena. La entrega, transmisión y aceptación se prueban por separado.",
  emitida: "Emitida en Orqena. La entrega, transmisión y aceptación se prueban por separado.",
  SENT: "Envío registrado. No acredita recepción, aceptación ni pago.",
  enviado: "Envío registrado. No acredita recepción, aceptación ni pago.",
  enviada: "Envío registrado. No acredita recepción, aceptación ni pago.",
  TRANSMITTED: "Transmitido al proveedor o canal. No equivale a aceptación.",
  ACCEPTED: "Aceptación registrada para este flujo. No equivale a pago salvo evidencia de cobro.",
  aceptado: "Aceptación registrada. No equivale a factura emitida ni cobrada.",
  REJECTED: "Rechazo registrado; el documento no se anula automáticamente.",
  rechazado: "Rechazo registrado; el documento no se anula automáticamente.",
  OVERDUE: "La fecha ha vencido y queda saldo según los registros actuales.",
  vencida: "La fecha ha vencido y queda saldo según los registros actuales.",
  PARTIAL: "Existe cumplimiento parcial; consulta el importe o alcance pendiente.",
  PARTIALLY_PAID: "Existe un pago parcial y permanece saldo pendiente.",
  parcialmente_pagada: "Existe un pago parcial y permanece saldo pendiente.",
  PAID: "El saldo registrado es cero; no afirma conciliación bancaria externa.",
  pagada: "El saldo registrado es cero; no afirma conciliación bancaria externa.",
  VOID: "Anulado en Orqena; conserva su trazabilidad histórica.",
};

export function statusLabel(status: string) {
  return statusLabels[status] ?? status.replaceAll("_", " ");
}

export function statusDescription(status: string) {
  return statusDescriptions[status] ?? "Estado operativo según los registros actuales.";
}

export function statusClass(status: string) {
  if (["archivado", "archivada"].includes(status)) {
    return "bg-content/[0.08] text-content-secondary";
  }
  if (["pagada", "aceptado", "finalizada", "cerrada", "cobrada", "entregado", "comprado", "programado", "confirmado", "realizado"].includes(status)) {
    return "bg-success/10 text-success";
  }
  if (["vencida", "rechazado", "fallido", "falta", "reclamada", "cancelado", "pausada", "parada"].includes(status)) {
    return "bg-danger/10 text-danger";
  }
  if ([
    "pendiente_cobro",
    "pendiente",
    "pendiente_pago",
    "parcialmente_pagada",
    "pendiente_confirmacion",
    "pendiente_respuesta",
    "seguimiento_pendiente",
    "pendiente_material",
    "pendiente_cliente",
    "pendiente_remates",
    "pendiente_datos",
    "pendiente_aprobacion",
    "facturada_parcialmente",
    "reprogramado",
    "seguimiento_cobro",
    "vencimiento_factura"
  ].includes(status)) {
    return "bg-warning/10 text-content";
  }
  if (["borrador", "pendiente_revision", "emitida", "enviada", "en_curso", "planificada", "preparacion", "parcialmente_terminada", "facturada", "visita", "compra_material"].includes(status)) {
    return "bg-brand-soft text-brand-strong";
  }
  return "bg-subtle text-content-secondary";
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
