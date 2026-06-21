-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('nuevo', 'pendiente_datos', 'visita_pendiente', 'presupuesto_pendiente', 'presupuesto_enviado', 'seguimiento_pendiente', 'aceptado', 'rechazado', 'obra_activa', 'finalizado', 'pendiente_cobro');

-- CreateEnum
CREATE TYPE "WorkStatus" AS ENUM ('pendiente_inicio', 'en_curso', 'pausada', 'pendiente_material', 'pendiente_remates', 'finalizada', 'pendiente_cobro', 'cerrada');

-- CreateEnum
CREATE TYPE "BudgetStatus" AS ENUM ('borrador', 'pendiente_revision', 'enviado', 'visto', 'pendiente_respuesta', 'aceptado', 'rechazado', 'caducado');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('pendiente_emitir', 'emitida', 'enviada', 'pendiente_pago', 'parcialmente_pagada', 'pagada', 'vencida', 'reclamada');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('senal', 'pago_parcial', 'pago_final', 'regularizacion');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('material', 'mano_obra', 'transporte', 'herramienta', 'gasolina', 'subcontrata', 'otros');

-- CreateEnum
CREATE TYPE "MaterialStatus" AS ENUM ('pendiente', 'comprado', 'entregado', 'falta', 'devuelto');

-- CreateEnum
CREATE TYPE "ReminderType" AS ENUM ('seguimiento_presupuesto', 'recordatorio_factura', 'factura_vencida', 'pedir_fotos', 'pedir_medidas', 'confirmar_visita', 'material_pendiente', 'recordatorio_interno');

-- CreateEnum
CREATE TYPE "ReminderChannel" AS ENUM ('interno', 'whatsapp', 'email');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('borrador', 'pendiente_confirmacion', 'programado', 'enviado', 'cancelado', 'fallido', 'realizado');

-- CreateEnum
CREATE TYPE "EventoAgendaTipo" AS ENUM ('visita', 'llamada', 'seguimiento_presupuesto', 'seguimiento_cobro', 'inicio_obra', 'fin_previsto_obra', 'compra_material', 'recordatorio_interno', 'vencimiento_factura', 'presupuesto_pendiente', 'tarea_obra');

-- CreateEnum
CREATE TYPE "EventoAgendaEstado" AS ENUM ('pendiente', 'confirmado', 'realizado', 'reprogramado', 'cancelado');

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "email" TEXT,
    "direccion" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "estado" "ClientStatus" NOT NULL DEFAULT 'nuevo',
    "origen" TEXT NOT NULL,
    "notas" TEXT,
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimaInteraccion" TIMESTAMP(3),

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Work" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "tipoTrabajo" TEXT NOT NULL,
    "estado" "WorkStatus" NOT NULL DEFAULT 'pendiente_inicio',
    "fechaInicio" TIMESTAMP(3),
    "fechaFinPrevista" TIMESTAMP(3),
    "presupuestoAprobado" DOUBLE PRECISION NOT NULL,
    "gastoReal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "margenEstimado" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notas" TEXT,

    CONSTRAINT "Work_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Budget" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "obraId" TEXT,
    "numero" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "partidas" TEXT NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "iva" DOUBLE PRECISION NOT NULL,
    "descuento" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL,
    "margenEstimado" DOUBLE PRECISION NOT NULL,
    "estado" "BudgetStatus" NOT NULL DEFAULT 'borrador',
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaEnvio" TIMESTAMP(3),
    "fechaValidez" TIMESTAMP(3),
    "fechaSeguimiento" TIMESTAMP(3),
    "condiciones" TEXT,
    "observaciones" TEXT,
    "formaPago" TEXT,

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "obraId" TEXT,
    "numero" TEXT NOT NULL,
    "concepto" TEXT NOT NULL,
    "importeBase" DOUBLE PRECISION NOT NULL,
    "iva" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "pagado" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pendiente" DOUBLE PRECISION NOT NULL,
    "fechaEmision" TIMESTAMP(3) NOT NULL,
    "fechaVencimiento" TIMESTAMP(3) NOT NULL,
    "estado" "InvoiceStatus" NOT NULL DEFAULT 'pendiente_pago',
    "observaciones" TEXT,
    "metodoPago" TEXT,
    "datosBancarios" TEXT,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "facturaId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "obraId" TEXT,
    "importe" DOUBLE PRECISION NOT NULL,
    "metodo" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo" "PaymentType" NOT NULL,
    "notas" TEXT,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "obraId" TEXT NOT NULL,
    "clienteId" TEXT,
    "proveedor" TEXT NOT NULL,
    "concepto" TEXT NOT NULL,
    "categoria" "ExpenseCategory" NOT NULL,
    "importe" DOUBLE PRECISION NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "fotoTicketUrl" TEXT,
    "notas" TEXT,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "obraId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "cantidad" TEXT NOT NULL,
    "estado" "MaterialStatus" NOT NULL DEFAULT 'pendiente',
    "notas" TEXT,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT,
    "obraId" TEXT,
    "facturaId" TEXT,
    "presupuestoId" TEXT,
    "tipo" "ReminderType" NOT NULL,
    "canal" "ReminderChannel" NOT NULL DEFAULT 'interno',
    "mensaje" TEXT NOT NULL,
    "fechaProgramada" TIMESTAMP(3) NOT NULL,
    "estado" "ReminderStatus" NOT NULL DEFAULT 'borrador',
    "requiereConfirmacion" BOOLEAN NOT NULL DEFAULT true,
    "confirmadoPorUsuario" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventoAgenda" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "tipo" "EventoAgendaTipo" NOT NULL,
    "estado" "EventoAgendaEstado" NOT NULL DEFAULT 'pendiente',
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3),
    "horaInicio" TEXT,
    "horaFin" TEXT,
    "clienteId" TEXT,
    "obraId" TEXT,
    "presupuestoId" TEXT,
    "facturaId" TEXT,
    "recordatorioId" TEXT,
    "direccion" TEXT,
    "notas" TEXT,
    "requiereConfirmacion" BOOLEAN NOT NULL DEFAULT false,
    "confirmadoPorUsuario" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventoAgenda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsuarioPerfil" (
    "id" TEXT NOT NULL,
    "nombre" TEXT,
    "apellidos" TEXT,
    "nombrePreferido" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "cargo" TEXT,
    "oficioPrincipal" TEXT,
    "tonoPreferido" TEXT NOT NULL DEFAULT 'directo',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsuarioPerfil_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Empresa" (
    "id" TEXT NOT NULL,
    "nombreComercial" TEXT NOT NULL,
    "razonSocial" TEXT,
    "nifCif" TEXT,
    "direccionFiscal" TEXT,
    "codigoPostal" TEXT,
    "ciudad" TEXT,
    "provincia" TEXT,
    "pais" TEXT NOT NULL DEFAULT 'España',
    "telefono" TEXT,
    "email" TEXT,
    "web" TEXT,
    "personaContacto" TEXT,
    "iban" TEXT,
    "condicionesPorDefecto" TEXT,
    "textoLegal" TEXT,
    "logoUrl" TEXT,
    "selloUrl" TEXT,
    "colorMarca" TEXT NOT NULL DEFAULT '#f6c945',
    "ivaDefecto" DOUBLE PRECISION NOT NULL DEFAULT 21,
    "seriePresupuestos" TEXT NOT NULL DEFAULT '2026',
    "serieFacturas" TEXT NOT NULL DEFAULT '2026',
    "prefijoPresupuesto" TEXT NOT NULL DEFAULT 'P',
    "prefijoFactura" TEXT NOT NULL DEFAULT 'F',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Empresa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Budget_numero_key" ON "Budget"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_numero_key" ON "Invoice"("numero");

-- AddForeignKey
ALTER TABLE "Work" ADD CONSTRAINT "Work_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Work"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Work"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Work"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Work"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Work"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_presupuestoId_fkey" FOREIGN KEY ("presupuestoId") REFERENCES "Budget"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Work"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoAgenda" ADD CONSTRAINT "EventoAgenda_presupuestoId_fkey" FOREIGN KEY ("presupuestoId") REFERENCES "Budget"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoAgenda" ADD CONSTRAINT "EventoAgenda_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoAgenda" ADD CONSTRAINT "EventoAgenda_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoAgenda" ADD CONSTRAINT "EventoAgenda_recordatorioId_fkey" FOREIGN KEY ("recordatorioId") REFERENCES "Reminder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoAgenda" ADD CONSTRAINT "EventoAgenda_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Work"("id") ON DELETE SET NULL ON UPDATE CASCADE;
