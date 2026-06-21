ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'borrador';
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'pendiente';

ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "partidas" TEXT;
