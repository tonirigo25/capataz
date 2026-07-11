DO $$ BEGIN
  CREATE TYPE "DocumentCategory" AS ENUM ('presupuesto', 'factura', 'contrato', 'albaran', 'ticket', 'fotografia', 'garantia', 'certificado', 'plano', 'informe', 'otro');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "NotificationPriority" AS ENUM ('baja', 'media', 'alta', 'critica');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "Contact" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "apellidos" TEXT,
  "cargo" TEXT,
  "telefono" TEXT,
  "email" TEXT,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "isBillingContact" BOOLEAN NOT NULL DEFAULT false,
  "isSiteContact" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InternalNote" (
  "id" TEXT NOT NULL,
  "clientId" TEXT,
  "workId" TEXT,
  "invoiceId" TEXT,
  "budgetId" TEXT,
  "authorId" TEXT,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "InternalNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Document" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "originalName" TEXT,
  "mimeType" TEXT,
  "size" INTEGER,
  "storageKey" TEXT,
  "url" TEXT,
  "category" "DocumentCategory" NOT NULL DEFAULT 'otro',
  "clientId" TEXT,
  "workId" TEXT,
  "budgetId" TEXT,
  "invoiceId" TEXT,
  "expenseId" TEXT,
  "uploadedById" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Notification" (
  "id" TEXT NOT NULL,
  "sourceKey" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "href" TEXT,
  "priority" "NotificationPriority" NOT NULL DEFAULT 'media',
  "entityType" TEXT,
  "entityId" TEXT,
  "readAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Work" ADD COLUMN IF NOT EXISTS "contactoId" TEXT;
ALTER TABLE "Reminder" ADD COLUMN IF NOT EXISTS "contactId" TEXT;
ALTER TABLE "EventoAgenda" ADD COLUMN IF NOT EXISTS "contactId" TEXT;
ALTER TABLE "WorkPhoto" ADD COLUMN IF NOT EXISTS "documentId" TEXT;
ALTER TABLE "WorkPhoto" ADD COLUMN IF NOT EXISTS "autor" TEXT;
ALTER TABLE "WorkPhoto" ADD COLUMN IF NOT EXISTS "ubicacion" TEXT;

ALTER TABLE "UsuarioPerfil" ADD COLUMN IF NOT EXISTS "tratamiento" TEXT;
ALTER TABLE "UsuarioPerfil" ADD COLUMN IF NOT EXISTS "idioma" TEXT NOT NULL DEFAULT 'es-ES';
ALTER TABLE "UsuarioPerfil" ADD COLUMN IF NOT EXISTS "zonaHoraria" TEXT NOT NULL DEFAULT 'Europe/Madrid';
ALTER TABLE "UsuarioPerfil" ADD COLUMN IF NOT EXISTS "preferenciaVisual" TEXT NOT NULL DEFAULT 'sistema';
ALTER TABLE "UsuarioPerfil" ADD COLUMN IF NOT EXISTS "notificacionesInternas" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "UsuarioPerfil" ADD COLUMN IF NOT EXISTS "notificacionesEmail" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Empresa" ADD COLUMN IF NOT EXISTS "municipio" TEXT;
ALTER TABLE "Empresa" ADD COLUMN IF NOT EXISTS "moneda" TEXT NOT NULL DEFAULT 'EUR';
ALTER TABLE "Empresa" ADD COLUMN IF NOT EXISTS "validezPresupuestoDias" INTEGER NOT NULL DEFAULT 15;
ALTER TABLE "Empresa" ADD COLUMN IF NOT EXISTS "formaPagoDefecto" TEXT;
ALTER TABLE "Empresa" ADD COLUMN IF NOT EXISTS "serieObras" TEXT NOT NULL DEFAULT '2026';
ALTER TABLE "Empresa" ADD COLUMN IF NOT EXISTS "prefijoObra" TEXT NOT NULL DEFAULT 'OB';

CREATE UNIQUE INDEX IF NOT EXISTS "Notification_sourceKey_key" ON "Notification"("sourceKey");
CREATE UNIQUE INDEX IF NOT EXISTS "WorkPhoto_documentId_key" ON "WorkPhoto"("documentId");

CREATE INDEX IF NOT EXISTS "Contact_clientId_idx" ON "Contact"("clientId");
CREATE INDEX IF NOT EXISTS "Contact_email_idx" ON "Contact"("email");
CREATE INDEX IF NOT EXISTS "Contact_telefono_idx" ON "Contact"("telefono");
CREATE INDEX IF NOT EXISTS "Contact_archivedAt_idx" ON "Contact"("archivedAt");

CREATE INDEX IF NOT EXISTS "InternalNote_clientId_idx" ON "InternalNote"("clientId");
CREATE INDEX IF NOT EXISTS "InternalNote_workId_idx" ON "InternalNote"("workId");
CREATE INDEX IF NOT EXISTS "InternalNote_invoiceId_idx" ON "InternalNote"("invoiceId");
CREATE INDEX IF NOT EXISTS "InternalNote_budgetId_idx" ON "InternalNote"("budgetId");
CREATE INDEX IF NOT EXISTS "InternalNote_archivedAt_idx" ON "InternalNote"("archivedAt");

CREATE INDEX IF NOT EXISTS "Document_clientId_idx" ON "Document"("clientId");
CREATE INDEX IF NOT EXISTS "Document_workId_idx" ON "Document"("workId");
CREATE INDEX IF NOT EXISTS "Document_budgetId_idx" ON "Document"("budgetId");
CREATE INDEX IF NOT EXISTS "Document_invoiceId_idx" ON "Document"("invoiceId");
CREATE INDEX IF NOT EXISTS "Document_expenseId_idx" ON "Document"("expenseId");
CREATE INDEX IF NOT EXISTS "Document_category_idx" ON "Document"("category");
CREATE INDEX IF NOT EXISTS "Document_archivedAt_idx" ON "Document"("archivedAt");

CREATE INDEX IF NOT EXISTS "Notification_readAt_idx" ON "Notification"("readAt");
CREATE INDEX IF NOT EXISTS "Notification_archivedAt_idx" ON "Notification"("archivedAt");
CREATE INDEX IF NOT EXISTS "Notification_priority_idx" ON "Notification"("priority");
CREATE INDEX IF NOT EXISTS "Notification_entityType_entityId_idx" ON "Notification"("entityType", "entityId");

CREATE INDEX IF NOT EXISTS "Work_contactoId_idx" ON "Work"("contactoId");
CREATE INDEX IF NOT EXISTS "Reminder_contactId_idx" ON "Reminder"("contactId");
CREATE INDEX IF NOT EXISTS "EventoAgenda_contactId_idx" ON "EventoAgenda"("contactId");

DO $$ BEGIN
  ALTER TABLE "Contact" ADD CONSTRAINT "Contact_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Work" ADD CONSTRAINT "Work_contactoId_fkey" FOREIGN KEY ("contactoId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "EventoAgenda" ADD CONSTRAINT "EventoAgenda_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "InternalNote" ADD CONSTRAINT "InternalNote_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "InternalNote" ADD CONSTRAINT "InternalNote_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "InternalNote" ADD CONSTRAINT "InternalNote_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "InternalNote" ADD CONSTRAINT "InternalNote_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Document" ADD CONSTRAINT "Document_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Document" ADD CONSTRAINT "Document_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Document" ADD CONSTRAINT "Document_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Document" ADD CONSTRAINT "Document_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Document" ADD CONSTRAINT "Document_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "WorkPhoto" ADD CONSTRAINT "WorkPhoto_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
