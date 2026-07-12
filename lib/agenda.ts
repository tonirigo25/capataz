import { prisma } from "@/lib/prisma";
import { deriveInvoiceStatus } from "@/lib/status";
import { requireCompanyContext } from "@/lib/auth/session";
import { companyCore } from "@/lib/tenant/core";

export type AgendaSource = "evento" | "recordatorio" | "factura" | "obra" | "material" | "presupuesto";

export type AgendaItem = {
  id: string;
  source: AgendaSource;
  titulo: string;
  descripcion: string | null;
  tipo: string;
  estado: string;
  fechaInicio: Date;
  fechaFin: Date | null;
  clienteId: string | null;
  clienteNombre: string | null;
  contactId: string | null;
  contactName: string | null;
  obraId: string | null;
  obraTitulo: string | null;
  presupuestoId: string | null;
  presupuestoNumero: string | null;
  facturaId: string | null;
  facturaNumero: string | null;
  direccion: string | null;
  notas: string | null;
  requiereConfirmacion: boolean;
  confirmadoPorUsuario: boolean;
  editable: boolean;
  href: string;
};

export async function getAgendaItems() {
  const { companyId } = await requireCompanyContext();
  const [events, reminders, invoices, works, materials, budgets] = await companyCore(prisma, companyId).agendaSources();

  const items: AgendaItem[] = [];

  events.forEach((event) => {
    items.push({
      id: event.id,
      source: "evento",
      titulo: event.titulo,
      descripcion: event.descripcion,
      tipo: event.tipo,
      estado: event.estado,
      fechaInicio: event.fechaInicio,
      fechaFin: event.fechaFin,
      clienteId: event.clienteId,
      clienteNombre: event.client?.nombre ?? null,
      contactId: event.contactId,
      contactName: event.contact ? `${event.contact.nombre}${event.contact.apellidos ? ` ${event.contact.apellidos}` : ""}` : null,
      obraId: event.obraId,
      obraTitulo: event.work?.titulo ?? null,
      presupuestoId: event.presupuestoId,
      presupuestoNumero: event.budget?.numero ?? null,
      facturaId: event.facturaId,
      facturaNumero: event.invoice?.numero ?? null,
      direccion: event.direccion,
      notas: event.notas,
      requiereConfirmacion: event.requiereConfirmacion,
      confirmadoPorUsuario: event.confirmadoPorUsuario,
      editable: true,
      href: `/gestion?tipo=eventoAgenda&id=${event.id}&returnTo=/agenda`
    });
  });

  reminders
    .filter((reminder) => reminder.estado !== "cancelado")
    .forEach((reminder) => {
      const tipo = agendaTypeFromReminder(reminder.tipo);
      items.push({
        id: `recordatorio-${reminder.id}`,
        source: "recordatorio",
        titulo: titleFromReminder(reminder),
        descripcion: reminder.mensaje,
        tipo,
        estado: reminder.estado === "programado" ? "confirmado" : "pendiente",
        fechaInicio: reminder.fechaProgramada,
        fechaFin: null,
        clienteId: reminder.clienteId,
        clienteNombre: reminder.client?.nombre ?? null,
        contactId: reminder.contactId,
        contactName: reminder.contact ? `${reminder.contact.nombre}${reminder.contact.apellidos ? ` ${reminder.contact.apellidos}` : ""}` : null,
        obraId: reminder.obraId,
        obraTitulo: reminder.work?.titulo ?? null,
        presupuestoId: reminder.presupuestoId,
        presupuestoNumero: reminder.budget?.numero ?? null,
        facturaId: reminder.facturaId,
        facturaNumero: reminder.invoice?.numero ?? null,
        direccion: reminder.work?.direccion ?? reminder.client?.direccion ?? null,
        notas: "Derivado de recordatorio",
        requiereConfirmacion: reminder.requiereConfirmacion,
        confirmadoPorUsuario: reminder.confirmadoPorUsuario,
        editable: false,
        href: `/gestion?tipo=recordatorio&id=${reminder.id}&returnTo=/agenda`
      });
    });

  invoices
    .filter((invoice) => invoice.pendiente > 0)
    .forEach((invoice) => {
      const liveStatus = deriveInvoiceStatus(invoice.total, invoice.pendiente, invoice.fechaVencimiento);
      items.push({
        id: `factura-${invoice.id}`,
        source: "factura",
        titulo: liveStatus === "vencida" ? `Factura vencida ${invoice.numero}` : `Vence factura ${invoice.numero}`,
        descripcion: invoice.concepto,
        tipo: "vencimiento_factura",
        estado: liveStatus === "vencida" ? "vencida" : "pendiente",
        fechaInicio: invoice.fechaVencimiento,
        fechaFin: null,
        clienteId: invoice.clienteId,
        clienteNombre: invoice.client.nombre,
        contactId: null,
        contactName: null,
        obraId: invoice.obraId,
        obraTitulo: invoice.work?.titulo ?? null,
        presupuestoId: null,
        presupuestoNumero: null,
        facturaId: invoice.id,
        facturaNumero: invoice.numero,
        direccion: invoice.work?.direccion ?? invoice.client.direccion,
        notas: "Derivado de factura",
        requiereConfirmacion: false,
        confirmadoPorUsuario: true,
        editable: false,
        href: `/dinero/${invoice.id}`
      });
    });

  works.forEach((work) => {
    if (work.fechaInicio) {
      items.push(workAgendaItem(work.id, "inicio_obra", `Inicio obra ${work.titulo}`, work.fechaInicio, work));
    }
    if (work.fechaFinPrevista) {
      items.push(workAgendaItem(work.id, "fin_previsto_obra", `Fin previsto ${work.titulo}`, work.fechaFinPrevista, work));
    }
  });

  materials
    .filter((material) => ["pendiente", "falta"].includes(material.estado))
    .forEach((material) => {
      items.push({
        id: `material-${material.id}`,
        source: "material",
        titulo: `Comprar ${material.nombre}`,
        descripcion: `${material.cantidad} · ${material.work.titulo}`,
        tipo: "compra_material",
        estado: material.estado === "falta" ? "pendiente" : material.estado,
        fechaInicio: todayAt(8),
        fechaFin: null,
        clienteId: material.work.clienteId,
        clienteNombre: material.work.client.nombre,
        contactId: null,
        contactName: null,
        obraId: material.obraId,
        obraTitulo: material.work.titulo,
        presupuestoId: null,
        presupuestoNumero: null,
        facturaId: null,
        facturaNumero: null,
        direccion: material.work.direccion,
        notas: material.notas,
        requiereConfirmacion: false,
        confirmadoPorUsuario: true,
        editable: false,
        href: `/gastos-materiales`
      });
    });

  budgets
    .filter((budget) => ["enviado", "visto", "pendiente_respuesta"].includes(budget.estado))
    .forEach((budget) => {
      items.push({
        id: `presupuesto-${budget.id}`,
        source: "presupuesto",
        titulo: `Presupuesto pendiente ${budget.numero}`,
        descripcion: budget.titulo,
        tipo: "presupuesto_pendiente",
        estado: "pendiente",
        fechaInicio: budget.fechaSeguimiento ?? addDays(budget.fechaEnvio ?? budget.fechaCreacion, 3),
        fechaFin: null,
        clienteId: budget.clienteId,
        clienteNombre: budget.client.nombre,
        contactId: null,
        contactName: null,
        obraId: budget.obraId,
        obraTitulo: budget.work?.titulo ?? null,
        presupuestoId: budget.id,
        presupuestoNumero: budget.numero,
        facturaId: null,
        facturaNumero: null,
        direccion: budget.work?.direccion ?? budget.client.direccion,
        notas: "Derivado de presupuesto pendiente de respuesta",
        requiereConfirmacion: false,
        confirmadoPorUsuario: true,
        editable: false,
        href: `/presupuestos`
      });
    });

  return items.sort((a, b) => a.fechaInicio.getTime() - b.fechaInicio.getTime());
}

export function itemsForDay(items: AgendaItem[], day: Date) {
  const start = startOfDay(day);
  const end = addDays(start, 1);
  return items.filter((item) => item.fechaInicio >= start && item.fechaInicio < end);
}

export function itemsBetween(items: AgendaItem[], start: Date, end: Date) {
  return items.filter((item) => item.fechaInicio >= start && item.fechaInicio < end);
}

export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function startOfWeek(date: Date) {
  const start = startOfDay(date);
  const day = start.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + offset);
  return start;
}

export function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function toDateInputValue(date: Date) {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function agendaTypeFromReminder(tipo: string) {
  if (tipo === "confirmar_visita") return "visita";
  if (tipo === "seguimiento_presupuesto") return "seguimiento_presupuesto";
  if (["recordatorio_factura", "factura_vencida"].includes(tipo)) return "seguimiento_cobro";
  if (tipo === "material_pendiente") return "compra_material";
  return "recordatorio_interno";
}

function titleFromReminder(reminder: {
  tipo: string;
  client: { nombre: string } | null;
  invoice: { numero: string } | null;
  budget: { numero: string } | null;
}) {
  if (reminder.tipo === "confirmar_visita") return `Visita ${reminder.client?.nombre ?? ""}`.trim();
  if (reminder.tipo === "seguimiento_presupuesto") return `Seguimiento ${reminder.budget?.numero ?? "presupuesto"}`;
  if (["recordatorio_factura", "factura_vencida"].includes(reminder.tipo)) return `Seguimiento cobro ${reminder.invoice?.numero ?? ""}`.trim();
  return reminder.client?.nombre ? `Recordatorio ${reminder.client.nombre}` : "Recordatorio interno";
}

function workAgendaItem(
  id: string,
  tipo: "inicio_obra" | "fin_previsto_obra",
  titulo: string,
  date: Date,
  work: { clienteId: string; titulo: string; direccion: string; client: { nombre: string } }
): AgendaItem {
  return {
    id: `obra-${tipo}-${id}`,
    source: "obra",
    titulo,
    descripcion: work.titulo,
    tipo,
    estado: "confirmado",
    fechaInicio: date,
    fechaFin: null,
    clienteId: work.clienteId,
    clienteNombre: work.client.nombre,
    contactId: null,
    contactName: null,
    obraId: id,
    obraTitulo: work.titulo,
    presupuestoId: null,
    presupuestoNumero: null,
    facturaId: null,
    facturaNumero: null,
    direccion: work.direccion,
    notas: "Derivado de fechas de obra",
    requiereConfirmacion: false,
    confirmadoPorUsuario: true,
    editable: false,
    href: "/obras"
  };
}

function todayAt(hour: number) {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  return date;
}
