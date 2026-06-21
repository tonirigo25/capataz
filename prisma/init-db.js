const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const statements = [
  `PRAGMA foreign_keys = ON`,
  `CREATE TABLE IF NOT EXISTS "Client" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "email" TEXT,
    "direccion" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'nuevo',
    "origen" TEXT NOT NULL,
    "notas" TEXT,
    "fechaCreacion" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimaInteraccion" DATETIME
  )`,
  `CREATE TABLE IF NOT EXISTS "Work" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clienteId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "tipoTrabajo" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendiente_inicio',
    "fechaInicio" DATETIME,
    "fechaFinPrevista" DATETIME,
    "presupuestoAprobado" REAL NOT NULL,
    "gastoReal" REAL NOT NULL DEFAULT 0,
    "margenEstimado" REAL NOT NULL DEFAULT 0,
    "notas" TEXT,
    CONSTRAINT "Work_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "Budget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clienteId" TEXT NOT NULL,
    "obraId" TEXT,
    "numero" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "partidas" TEXT NOT NULL,
    "subtotal" REAL NOT NULL,
    "iva" REAL NOT NULL,
    "descuento" REAL NOT NULL DEFAULT 0,
    "total" REAL NOT NULL,
    "margenEstimado" REAL NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'borrador',
    "fechaCreacion" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaEnvio" DATETIME,
    "fechaValidez" DATETIME,
    "fechaSeguimiento" DATETIME,
    "condiciones" TEXT,
    "observaciones" TEXT,
    "formaPago" TEXT,
    CONSTRAINT "Budget_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Budget_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Work" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clienteId" TEXT NOT NULL,
    "obraId" TEXT,
    "numero" TEXT NOT NULL,
    "concepto" TEXT NOT NULL,
    "importeBase" REAL NOT NULL,
    "iva" REAL NOT NULL,
    "total" REAL NOT NULL,
    "pagado" REAL NOT NULL DEFAULT 0,
    "pendiente" REAL NOT NULL,
    "fechaEmision" DATETIME NOT NULL,
    "fechaVencimiento" DATETIME NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendiente_pago',
    "observaciones" TEXT,
    "metodoPago" TEXT,
    "datosBancarios" TEXT,
    CONSTRAINT "Invoice_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Invoice_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Work" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "facturaId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "obraId" TEXT,
    "importe" REAL NOT NULL,
    "metodo" TEXT NOT NULL,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo" TEXT NOT NULL,
    "notas" TEXT,
    CONSTRAINT "Payment_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Payment_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Payment_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Work" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "Expense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "obraId" TEXT NOT NULL,
    "clienteId" TEXT,
    "proveedor" TEXT NOT NULL,
    "concepto" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "importe" REAL NOT NULL,
    "fecha" DATETIME NOT NULL,
    "fotoTicketUrl" TEXT,
    "notas" TEXT,
    CONSTRAINT "Expense_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Expense_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Work" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "Material" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "obraId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "cantidad" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "notas" TEXT,
    CONSTRAINT "Material_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Work" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "Reminder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clienteId" TEXT,
    "obraId" TEXT,
    "facturaId" TEXT,
    "presupuestoId" TEXT,
    "tipo" TEXT NOT NULL,
    "canal" TEXT NOT NULL DEFAULT 'interno',
    "mensaje" TEXT NOT NULL,
    "fechaProgramada" DATETIME NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'borrador',
    "requiereConfirmacion" BOOLEAN NOT NULL DEFAULT true,
    "confirmadoPorUsuario" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Reminder_presupuestoId_fkey" FOREIGN KEY ("presupuestoId") REFERENCES "Budget" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Reminder_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Reminder_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "Invoice" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Reminder_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Work" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "EventoAgenda" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "tipo" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "fechaInicio" DATETIME NOT NULL,
    "fechaFin" DATETIME,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventoAgenda_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EventoAgenda_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Work" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EventoAgenda_presupuestoId_fkey" FOREIGN KEY ("presupuestoId") REFERENCES "Budget" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EventoAgenda_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "Invoice" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EventoAgenda_recordatorioId_fkey" FOREIGN KEY ("recordatorioId") REFERENCES "Reminder" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "UsuarioPerfil" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT,
    "apellidos" TEXT,
    "nombrePreferido" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "cargo" TEXT,
    "oficioPrincipal" TEXT,
    "tonoPreferido" TEXT NOT NULL DEFAULT 'directo',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "Empresa" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "ivaDefecto" REAL NOT NULL DEFAULT 21,
    "seriePresupuestos" TEXT NOT NULL DEFAULT '2026',
    "serieFacturas" TEXT NOT NULL DEFAULT '2026',
    "prefijoPresupuesto" TEXT NOT NULL DEFAULT 'P',
    "prefijoFactura" TEXT NOT NULL DEFAULT 'F',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Budget_numero_key" ON "Budget"("numero")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_numero_key" ON "Invoice"("numero")`
];

const migrations = [
  `ALTER TABLE "Budget" ADD COLUMN "descuento" REAL NOT NULL DEFAULT 0`,
  `ALTER TABLE "Budget" ADD COLUMN "fechaValidez" DATETIME`,
  `ALTER TABLE "Budget" ADD COLUMN "observaciones" TEXT`,
  `ALTER TABLE "Budget" ADD COLUMN "formaPago" TEXT`,
  `ALTER TABLE "Invoice" ADD COLUMN "observaciones" TEXT`,
  `ALTER TABLE "Invoice" ADD COLUMN "metodoPago" TEXT`,
  `ALTER TABLE "Invoice" ADD COLUMN "datosBancarios" TEXT`,
  `ALTER TABLE "UsuarioPerfil" ADD COLUMN "apellidos" TEXT`,
  `ALTER TABLE "UsuarioPerfil" ADD COLUMN "nombrePreferido" TEXT`,
  `ALTER TABLE "UsuarioPerfil" ADD COLUMN "telefono" TEXT`,
  `ALTER TABLE "UsuarioPerfil" ADD COLUMN "email" TEXT`,
  `ALTER TABLE "UsuarioPerfil" ADD COLUMN "cargo" TEXT`,
  `ALTER TABLE "UsuarioPerfil" ADD COLUMN "oficioPrincipal" TEXT`,
  `ALTER TABLE "UsuarioPerfil" ADD COLUMN "tonoPreferido" TEXT NOT NULL DEFAULT 'directo'`
];

async function main() {
  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }
  for (const statement of migrations) {
    try {
      await prisma.$executeRawUnsafe(statement);
    } catch (error) {
      if (!String(error?.message ?? error).includes("duplicate column name")) throw error;
    }
  }
  console.log("SQLite schema ready");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
