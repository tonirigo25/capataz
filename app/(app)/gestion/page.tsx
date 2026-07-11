import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Save, X } from "lucide-react";
import { saveManualRecord } from "@/app/(app)/gestion/actions";
import { SectionHeader } from "@/components/section-header";
import { Notice } from "@/components/ui-primitives";
import { nextDocumentNumber } from "@/lib/numbering";
import { prisma } from "@/lib/prisma";
import { statusLabel } from "@/lib/status";

export const dynamic = "force-dynamic";

type EntityType = "cliente" | "obra" | "presupuesto" | "factura" | "pago" | "gasto" | "material" | "recordatorio" | "eventoAgenda";

const entityLabels: Record<EntityType, string> = {
  cliente: "cliente",
  obra: "obra",
  presupuesto: "presupuesto",
  factura: "factura",
  pago: "pago",
  gasto: "gasto",
  material: "material",
  recordatorio: "recordatorio",
  eventoAgenda: "evento de agenda"
};

const statusOptions = {
  cliente: [
    "nuevo",
    "pendiente_datos",
    "visita_pendiente",
    "presupuesto_pendiente",
    "presupuesto_enviado",
    "seguimiento_pendiente",
    "aceptado",
    "rechazado",
    "obra_activa",
    "finalizado",
    "pendiente_cobro"
  ],
  obra: ["pendiente_inicio", "en_curso", "pausada", "pendiente_material", "pendiente_remates", "finalizada", "pendiente_cobro", "cerrada"],
  presupuesto: ["borrador", "pendiente_revision", "enviado", "visto", "pendiente_respuesta", "aceptado", "rechazado", "caducado"],
  factura: ["borrador", "enviada", "pendiente", "parcialmente_pagada", "pagada", "vencida", "pendiente_emitir", "emitida", "pendiente_pago", "reclamada"],
  pago: ["senal", "pago_parcial", "pago_final", "regularizacion"],
  gasto: ["material", "mano_obra", "transporte", "herramienta", "gasolina", "subcontrata", "otros"],
  material: ["pendiente", "comprado", "entregado", "falta", "devuelto"],
  recordatorioTipo: [
    "seguimiento_presupuesto",
    "recordatorio_factura",
    "factura_vencida",
    "pedir_fotos",
    "pedir_medidas",
    "confirmar_visita",
    "material_pendiente",
    "recordatorio_interno"
  ],
  recordatorioCanal: ["interno", "whatsapp", "email"],
  recordatorioEstado: ["borrador", "pendiente_confirmacion", "programado", "enviado", "cancelado", "fallido", "realizado"],
  eventoTipo: [
    "visita",
    "llamada",
    "seguimiento_presupuesto",
    "seguimiento_cobro",
    "inicio_obra",
    "fin_previsto_obra",
    "compra_material",
    "recordatorio_interno",
    "vencimiento_factura",
    "presupuesto_pendiente",
    "tarea_obra"
  ],
  eventoEstado: ["pendiente", "confirmado", "realizado", "reprogramado", "cancelado"]
};

export default async function ManualManagementPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const query = await searchParams;
  const tipo = query.tipo as EntityType | undefined;
  if (!tipo || !(tipo in entityLabels)) notFound();

  const [clients, works, budgets, invoices, reminders, company] = await Promise.all([
    prisma.client.findMany({ orderBy: { nombre: "asc" } }),
    prisma.work.findMany({ orderBy: { titulo: "asc" }, include: { client: true } }),
    prisma.budget.findMany({ orderBy: { numero: "asc" }, include: { client: true } }),
    prisma.invoice.findMany({ orderBy: { numero: "asc" }, include: { client: true } }),
    prisma.reminder.findMany({ orderBy: { fechaProgramada: "asc" }, include: { client: true } }),
    prisma.empresa.findFirst()
  ]);
  const suggestedBudgetNumber = tipo === "presupuesto" && !query.id ? await nextDocumentNumber("budget") : "";
  const suggestedInvoiceNumber = tipo === "factura" && !query.id ? await nextDocumentNumber("invoice") : "";
  const record = query.id ? await fetchRecord(tipo, query.id) : null;
  const duplicateClient =
    tipo === "cliente" && query.duplicateOf
      ? await prisma.client.findUnique({ where: { id: query.duplicateOf }, select: { id: true, nombre: true, telefono: true, email: true, nifCif: true } })
      : null;
  const title = `${record ? "Editar" : "Añadir"} ${entityLabels[tipo]}`;
  const returnTo = query.returnTo ?? defaultReturnTo(tipo);

  return (
    <main className="screen">
      <Link href={returnTo} className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-obra-ink">
        <ArrowLeft size={18} />
        Cancelar
      </Link>

      <SectionHeader
        title={title}
        description="Modo manual: rellena, corrige estados y guarda sin usar el chat."
      />

      <form action={saveManualRecord} className="card grid gap-4 p-4">
        <input type="hidden" name="tipo" value={tipo} />
        <input type="hidden" name="id" value={query.id ?? ""} />
        <input type="hidden" name="returnTo" value={returnTo} />
        {duplicateClient ? <input type="hidden" name="confirmDuplicate" value="true" /> : null}

        {duplicateClient ? (
          <Notice
            tone={query.duplicateStrength === "weak" ? "warning" : "danger"}
            title="Puede que este cliente ya exista"
            description={`${query.duplicateReason ?? "Coincidencia detectada"} con ${duplicateClient.nombre}. Revisa la ficha existente o continúa sólo si quieres crear otro registro.`}
            action={<Link href={`/clientes/${duplicateClient.id}`} className="secondary-button">Ver existente</Link>}
          />
        ) : null}

        {renderFields({ tipo, record, defaults: query, clients, works, budgets, invoices, reminders, company, suggestedBudgetNumber, suggestedInvoiceNumber })}

        <div className="grid grid-cols-2 gap-2 pt-2">
          <Link href={returnTo} className="secondary-button w-full">
            <X size={18} />
            Cancelar
          </Link>
          <button type="submit" className="primary-button w-full">
            <Save size={18} />
            {duplicateClient ? "Continuar creando" : "Guardar"}
          </button>
        </div>
      </form>
    </main>
  );
}

async function fetchRecord(tipo: EntityType, id: string) {
  switch (tipo) {
    case "cliente":
      return prisma.client.findUnique({ where: { id } });
    case "obra":
      return prisma.work.findUnique({ where: { id } });
    case "presupuesto":
      return prisma.budget.findUnique({ where: { id } });
    case "factura":
      return prisma.invoice.findUnique({ where: { id } });
    case "pago":
      return prisma.payment.findUnique({ where: { id } });
    case "gasto":
      return prisma.expense.findUnique({ where: { id } });
    case "material":
      return prisma.material.findUnique({ where: { id } });
    case "recordatorio":
      return prisma.reminder.findUnique({ where: { id } });
    case "eventoAgenda":
      return prisma.eventoAgenda.findUnique({ where: { id } });
  }
}

function renderFields({
  tipo,
  record,
  defaults,
  clients,
  works,
  budgets,
  invoices,
  reminders,
  company,
  suggestedBudgetNumber,
  suggestedInvoiceNumber
}: {
  tipo: EntityType;
  record: Record<string, any> | null;
  defaults: Record<string, string | undefined>;
  clients: Array<{ id: string; nombre: string }>;
  works: Array<{ id: string; titulo: string; client: { nombre: string } }>;
  budgets: Array<{ id: string; numero: string; titulo: string; client: { nombre: string } }>;
  invoices: Array<{ id: string; numero: string; concepto: string; client: { nombre: string } }>;
  reminders: Array<{ id: string; tipo: string; mensaje: string; client: { nombre: string } | null }>;
  company: { ivaDefecto: number; condicionesPorDefecto: string | null; iban: string | null } | null;
  suggestedBudgetNumber: string;
  suggestedInvoiceNumber: string;
}) {
  switch (tipo) {
    case "cliente":
      return (
        <>
          <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-black text-obra-ink">Identidad del cliente</p>
            <Field name="nombre" label="Nombre visible" value={valueFor(record, defaults, "nombre")} />
            <Field name="nombreComercial" label="Nombre comercial" value={valueFor(record, defaults, "nombreComercial")} />
            <Field name="razonSocial" label="Razón social" value={valueFor(record, defaults, "razonSocial")} />
            <Field name="nifCif" label="NIF/CIF" value={valueFor(record, defaults, "nifCif")} />
            <ClientTypeSelect value={record?.tipo ?? defaults.tipoCliente ?? "Particular"} />
            <Select name="estado" label="Estado" options={statusOptions.cliente} value={record?.estado ?? defaults.estado ?? "pendiente_datos"} />
            <Field name="origen" label="Origen" value={valueFor(record, defaults, "origen", "Manual")} />
          </div>

          <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-black text-obra-ink">Contacto operativo</p>
            <Field name="telefono" label="Teléfono del cliente" value={valueFor(record, defaults, "telefono")} />
            <Field name="email" label="Email del cliente" type="email" value={valueFor(record, defaults, "email")} />
            <Field name="contactoPrincipalNombre" label="Contacto principal" value={valueFor(record, defaults, "contactoPrincipalNombre")} />
            <Field name="contactoPrincipalCargo" label="Cargo o relación" value={valueFor(record, defaults, "contactoPrincipalCargo")} />
            <Field name="contactoPrincipalTelefono" label="Teléfono contacto principal" value={valueFor(record, defaults, "contactoPrincipalTelefono")} />
            <Field name="contactoPrincipalEmail" label="Email contacto principal" type="email" value={valueFor(record, defaults, "contactoPrincipalEmail")} />
          </div>

          <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-black text-obra-ink">Datos fiscales y facturación</p>
            <Field name="direccionFiscal" label="Dirección fiscal" value={valueFor(record, defaults, "direccionFiscal")} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field name="codigoPostal" label="Código postal" value={valueFor(record, defaults, "codigoPostal")} />
              <Field name="municipio" label="Municipio" value={valueFor(record, defaults, "municipio")} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field name="provincia" label="Provincia" value={valueFor(record, defaults, "provincia")} />
              <Field name="pais" label="País" value={valueFor(record, defaults, "pais", "España")} />
            </div>
            <Field name="emailFacturacion" label="Email de facturación" type="email" value={valueFor(record, defaults, "emailFacturacion")} />
            <Field name="telefonoFacturacion" label="Teléfono de facturación" value={valueFor(record, defaults, "telefonoFacturacion")} />
            <Field name="contactoFacturacionNombre" label="Persona de facturación" value={valueFor(record, defaults, "contactoFacturacionNombre")} />
          </div>

          <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-black text-obra-ink">Dirección y notas internas</p>
            <Field name="direccion" label="Dirección principal o postal" value={valueFor(record, defaults, "direccion")} />
            <Field name="ultimaInteraccion" label="Última interacción" type="datetime-local" value={dateTimeValue(record?.ultimaInteraccion ?? defaults.ultimaInteraccion)} />
            <Textarea name="notas" label="Notas internas" value={record?.notas ?? defaults.notas} />
          </div>
        </>
      );
    case "obra":
      return (
        <>
          <RelationSelect name="clienteId" label="Cliente" options={clients.map((client) => [client.id, client.nombre])} value={record?.clienteId ?? defaults.clienteId} />
          <Field name="titulo" label="Título" required value={record?.titulo} />
          <Field name="direccion" label="Dirección" required value={record?.direccion} />
          <Field name="tipoTrabajo" label="Tipo de trabajo" required value={record?.tipoTrabajo} />
          <Select name="estado" label="Estado" options={statusOptions.obra} value={record?.estado ?? "pendiente_inicio"} />
          <Field name="fechaInicio" label="Fecha inicio" type="datetime-local" value={dateTimeValue(record?.fechaInicio)} />
          <Field name="fechaFinPrevista" label="Fin previsto" type="datetime-local" value={dateTimeValue(record?.fechaFinPrevista)} />
          <Field name="presupuestoAprobado" label="Presupuesto aprobado" type="number" value={record?.presupuestoAprobado ?? 0} />
          <Field name="gastoReal" label="Gasto real" type="number" value={record?.gastoReal ?? 0} />
          <Field name="margenEstimado" label="Margen estimado" type="number" value={record?.margenEstimado ?? 0} />
          <Textarea name="notas" label="Notas" value={record?.notas} />
        </>
      );
    case "presupuesto":
      return (
        <>
          <RelationSelect name="clienteId" label="Cliente" options={clients.map((client) => [client.id, client.nombre])} value={record?.clienteId ?? defaults.clienteId} />
          <RelationSelect name="obraId" label="Obra" optional options={works.map((work) => [work.id, `${work.titulo} · ${work.client.nombre}`])} value={record?.obraId ?? defaults.obraId} />
          <Field name="numero" label="Número" value={record?.numero ?? suggestedBudgetNumber} />
          <Field name="titulo" label="Título" required value={record?.titulo} />
          <Select name="estado" label="Estado" options={statusOptions.presupuesto} value={record?.estado ?? "borrador"} />
          <input type="hidden" name="ivaPercent" value={company?.ivaDefecto ?? 21} />
          <Textarea name="partidas" label="Partidas editables (JSON o texto)" value={record?.partidas ?? defaultBudgetLines()} />
          <Field name="subtotal" label="Subtotal" type="number" value={record?.subtotal ?? 0} />
          <Field name="iva" label="IVA" type="number" value={record?.iva ?? 0} />
          <Field name="descuento" label="Descuento" type="number" value={record?.descuento ?? 0} />
          <Field name="total" label="Total" type="number" value={record?.total ?? 0} />
          <Field name="margenEstimado" label="Margen estimado" type="number" value={record?.margenEstimado ?? 0} />
          <Field name="fechaValidez" label="Fecha validez" type="datetime-local" value={dateTimeValue(record?.fechaValidez) || dateTimeValue(addDays(new Date(), 15))} />
          <Field name="fechaEnvio" label="Fecha envío" type="datetime-local" value={dateTimeValue(record?.fechaEnvio)} />
          <Field name="fechaSeguimiento" label="Fecha seguimiento" type="datetime-local" value={dateTimeValue(record?.fechaSeguimiento)} />
          <Textarea name="condiciones" label="Condiciones" value={record?.condiciones ?? company?.condicionesPorDefecto} />
          <Textarea name="observaciones" label="Observaciones" value={record?.observaciones} />
          <Field name="formaPago" label="Forma de pago" value={record?.formaPago ?? "Transferencia / según acuerdo"} />
        </>
      );
    case "factura":
      return (
        <>
          <RelationSelect name="clienteId" label="Cliente" options={clients.map((client) => [client.id, client.nombre])} value={record?.clienteId ?? defaults.clienteId} />
          <RelationSelect name="obraId" label="Obra" optional options={works.map((work) => [work.id, `${work.titulo} · ${work.client.nombre}`])} value={record?.obraId ?? defaults.obraId} />
          <Field name="numero" label="Número" value={record?.numero ?? suggestedInvoiceNumber} />
          <Field name="concepto" label="Concepto" required value={record?.concepto} />
          <Select name="estado" label="Estado" options={statusOptions.factura} value={record?.estado ?? "borrador"} />
          <input type="hidden" name="ivaPercent" value={company?.ivaDefecto ?? 21} />
          <Textarea name="partidas" label="Partidas editables (JSON o texto)" value={record?.partidas ?? defaultInvoiceLines()} />
          <Field name="importeBase" label="Base imponible" type="number" value={record?.importeBase ?? 0} />
          <Field name="iva" label="IVA" type="number" value={record?.iva ?? 0} />
          <Field name="total" label="Total" type="number" value={record?.total ?? 0} />
          <Field name="pagado" label="Pagado" type="number" value={record?.pagado ?? 0} />
          <Field name="pendiente" label="Pendiente" type="number" value={record?.pendiente ?? 0} />
          <Field name="fechaEmision" label="Fecha emisión" type="datetime-local" value={dateTimeValue(record?.fechaEmision) ?? dateTimeValue(new Date())} />
          <Field name="fechaVencimiento" label="Fecha vencimiento" type="datetime-local" value={dateTimeValue(record?.fechaVencimiento) ?? dateTimeValue(new Date())} />
          <Textarea name="observaciones" label="Observaciones" value={record?.observaciones} />
          <Field name="metodoPago" label="Método de pago" value={record?.metodoPago ?? "transferencia"} />
          <Textarea name="datosBancarios" label="Datos bancarios" value={record?.datosBancarios ?? company?.iban} />
        </>
      );
    case "pago":
      return (
        <>
          <RelationSelect name="facturaId" label="Factura" options={invoices.map((invoice) => [invoice.id, `${invoice.numero} · ${invoice.client.nombre} · ${invoice.concepto}`])} value={record?.facturaId ?? defaults.facturaId} />
          <Field name="importe" label="Importe" type="number" required value={record?.importe ?? 0} />
          <Field name="metodo" label="Método" required value={record?.metodo ?? "transferencia"} />
          <Select name="tipoPago" label="Tipo" options={statusOptions.pago} value={record?.tipo ?? "pago_parcial"} />
          <Field name="fecha" label="Fecha" type="datetime-local" value={dateTimeValue(record?.fecha) ?? dateTimeValue(new Date())} />
          <Textarea name="notas" label="Notas" value={record?.notas} />
        </>
      );
    case "gasto":
      return (
        <>
          <RelationSelect name="obraId" label="Obra" options={works.map((work) => [work.id, `${work.titulo} · ${work.client.nombre}`])} value={record?.obraId ?? defaults.obraId} />
          <Field name="proveedor" label="Proveedor" required value={record?.proveedor} />
          <Field name="concepto" label="Concepto" required value={record?.concepto} />
          <Select name="categoria" label="Categoría" options={statusOptions.gasto} value={record?.categoria ?? "material"} />
          <Field name="importe" label="Importe" type="number" required value={record?.importe ?? 0} />
          <Field name="fecha" label="Fecha" type="datetime-local" value={dateTimeValue(record?.fecha) ?? dateTimeValue(new Date())} />
          <Field name="fotoTicketUrl" label="Foto ticket URL" value={record?.fotoTicketUrl} />
          <Textarea name="notas" label="Notas" value={record?.notas} />
        </>
      );
    case "material":
      return (
        <>
          <RelationSelect name="obraId" label="Obra" options={works.map((work) => [work.id, `${work.titulo} · ${work.client.nombre}`])} value={record?.obraId ?? defaults.obraId} />
          <Field name="nombre" label="Nombre" required value={record?.nombre} />
          <Field name="cantidad" label="Cantidad" required value={record?.cantidad} />
          <Select name="estado" label="Estado" options={statusOptions.material} value={record?.estado ?? "pendiente"} />
          <Textarea name="notas" label="Notas" value={record?.notas} />
        </>
      );
    case "recordatorio":
      return (
        <>
          <RelationSelect name="clienteId" label="Cliente" optional options={clients.map((client) => [client.id, client.nombre])} value={record?.clienteId ?? defaults.clienteId} />
          <RelationSelect name="obraId" label="Obra" optional options={works.map((work) => [work.id, `${work.titulo} · ${work.client.nombre}`])} value={record?.obraId ?? defaults.obraId} />
          <RelationSelect name="facturaId" label="Factura" optional options={invoices.map((invoice) => [invoice.id, `${invoice.numero} · ${invoice.client.nombre}`])} value={record?.facturaId ?? defaults.facturaId} />
          <RelationSelect name="presupuestoId" label="Presupuesto" optional options={budgets.map((budget) => [budget.id, `${budget.numero} · ${budget.client.nombre}`])} value={record?.presupuestoId ?? defaults.presupuestoId} />
          <Select name="tipoRecordatorio" label="Tipo" options={statusOptions.recordatorioTipo} value={record?.tipo ?? defaults.tipoRecordatorio ?? "recordatorio_interno"} />
          <Select name="canal" label="Canal" options={statusOptions.recordatorioCanal} value={record?.canal ?? "interno"} />
          <Select name="estado" label="Estado" options={statusOptions.recordatorioEstado} value={record?.estado ?? "borrador"} />
          <Field name="fechaProgramada" label="Fecha programada" type="datetime-local" value={dateTimeValue(record?.fechaProgramada) ?? dateTimeValue(tomorrowAtTen())} />
          <Textarea name="mensaje" label="Mensaje" required value={record?.mensaje} />
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
            <input name="requiereConfirmacion" type="checkbox" defaultChecked={record?.requiereConfirmacion ?? true} />
            Requiere confirmación
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
            <input name="confirmadoPorUsuario" type="checkbox" defaultChecked={record?.confirmadoPorUsuario ?? false} />
            Confirmado por usuario
          </label>
        </>
      );
    case "eventoAgenda":
      return (
        <>
          <Field name="titulo" label="Título" required value={record?.titulo ?? defaults.titulo} />
          <Textarea name="descripcion" label="Descripción" value={record?.descripcion ?? defaults.descripcion} />
          <Select name="tipoEvento" label="Tipo" options={statusOptions.eventoTipo} value={record?.tipo ?? defaults.tipoEvento ?? "recordatorio_interno"} />
          <Select name="estado" label="Estado" options={statusOptions.eventoEstado} value={record?.estado ?? defaults.estado ?? "pendiente"} />
          <Field name="fechaInicio" label="Fecha inicio" type="datetime-local" required value={record?.fechaInicio ? dateTimeValue(record.fechaInicio) : defaults.fechaInicio} />
          <Field name="fechaFin" label="Fecha fin" type="datetime-local" value={record?.fechaFin ? dateTimeValue(record.fechaFin) : defaults.fechaFin} />
          <div className="grid grid-cols-2 gap-3">
            <Field name="horaInicio" label="Hora inicio" type="time" value={record?.horaInicio ?? defaults.horaInicio} />
            <Field name="horaFin" label="Hora fin" type="time" value={record?.horaFin ?? defaults.horaFin} />
          </div>
          <RelationSelect name="clienteId" label="Cliente" optional options={clients.map((client) => [client.id, client.nombre])} value={record?.clienteId ?? defaults.clienteId} />
          <RelationSelect name="obraId" label="Obra" optional options={works.map((work) => [work.id, `${work.titulo} · ${work.client.nombre}`])} value={record?.obraId ?? defaults.obraId} />
          <RelationSelect name="presupuestoId" label="Presupuesto" optional options={budgets.map((budget) => [budget.id, `${budget.numero} · ${budget.client.nombre}`])} value={record?.presupuestoId ?? defaults.presupuestoId} />
          <RelationSelect name="facturaId" label="Factura" optional options={invoices.map((invoice) => [invoice.id, `${invoice.numero} · ${invoice.client.nombre}`])} value={record?.facturaId ?? defaults.facturaId} />
          <RelationSelect name="recordatorioId" label="Recordatorio" optional options={reminders.map((reminder) => [reminder.id, `${statusLabel(reminder.tipo)} · ${reminder.client?.nombre ?? "Interno"}`])} value={record?.recordatorioId ?? defaults.recordatorioId} />
          <Field name="direccion" label="Dirección" value={record?.direccion ?? defaults.direccion} />
          <Textarea name="notas" label="Notas" value={record?.notas ?? defaults.notas} />
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
            <input name="requiereConfirmacion" type="checkbox" defaultChecked={record?.requiereConfirmacion ?? defaults.requiereConfirmacion === "true"} />
            Requiere confirmación antes de notificar o modificar algo sensible
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
            <input name="confirmadoPorUsuario" type="checkbox" defaultChecked={record?.confirmadoPorUsuario ?? defaults.confirmadoPorUsuario === "true"} />
            Confirmado por usuario
          </label>
        </>
      );
  }
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
  value?: string | number | null;
  type?: string;
  required?: boolean;
}) {
  return (
    <label>
      <span className="label mb-1 block">{label}</span>
      <input className="field" name={name} type={type} step={type === "number" ? "0.01" : undefined} required={required} defaultValue={value ?? ""} />
    </label>
  );
}

function Textarea({
  name,
  label,
  value,
  required = false
}: {
  name: string;
  label: string;
  value?: string | null;
  required?: boolean;
}) {
  return (
    <label>
      <span className="label mb-1 block">{label}</span>
      <textarea className="field min-h-28 py-3 leading-6" name={name} required={required} defaultValue={value ?? ""} />
    </label>
  );
}

function Select({ name, label, options, value }: { name: string; label: string; options: string[]; value?: string | null }) {
  return (
    <label>
      <span className="label mb-1 block">{label}</span>
      <select className="field" name={name} defaultValue={value ?? options[0]}>
        {options.map((option) => (
          <option key={option} value={option}>
            {statusLabel(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function ClientTypeSelect({ value }: { value?: string | null }) {
  const options = ["Particular", "Autónomo", "Empresa", "Comunidad de propietarios", "Otro"];
  const allOptions = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <label>
      <span className="label mb-1 block">Tipo</span>
      <select className="field" name="tipoCliente" defaultValue={value ?? "Particular"}>
        {allOptions.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function RelationSelect({
  name,
  label,
  options,
  value,
  optional = false
}: {
  name: string;
  label: string;
  options: string[][];
  value?: string | null;
  optional?: boolean;
}) {
  return (
    <label>
      <span className="label mb-1 block">{label}</span>
      <select className="field" name={name} required={!optional} defaultValue={value ?? ""}>
        {optional ? <option value="">Sin asociar</option> : <option value="">Seleccionar</option>}
        {options.map(([id, labelText]) => (
          <option key={id} value={id}>
            {labelText}
          </option>
        ))}
      </select>
    </label>
  );
}

function valueFor(record: Record<string, any> | null, defaults: Record<string, string | undefined>, key: string, fallback = "") {
  const value = record?.[key];
  if (value !== null && value !== undefined && value !== "") return value;
  return defaults[key] ?? fallback;
}

function dateTimeValue(value?: Date | string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part: number) => part.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function tomorrowAtTen() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(10, 0, 0, 0);
  return date;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function defaultBudgetLines() {
  return JSON.stringify(
    [
      { descripcion: "Partida principal", cantidad: 1, unidad: "servicio", precioUnitario: 0, total: 0, categoria: "General" }
    ],
    null,
    2
  );
}

function defaultInvoiceLines() {
  return JSON.stringify(
    [
      { descripcion: "Servicio realizado", cantidad: 1, unidad: "servicio", precioUnitario: 0, total: 0, categoria: "Factura" }
    ],
    null,
    2
  );
}

function defaultReturnTo(tipo: EntityType) {
  const targets: Record<EntityType, string> = {
    cliente: "/clientes",
    obra: "/obras",
    presupuesto: "/presupuestos",
    factura: "/dinero",
    pago: "/dinero",
    gasto: "/gastos-materiales",
    material: "/gastos-materiales",
    recordatorio: "/recordatorios",
    eventoAgenda: "/agenda"
  };
  return targets[tipo];
}
