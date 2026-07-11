-- Professional work operations module: additive, backwards-compatible changes.

ALTER TYPE "WorkStatus" ADD VALUE IF NOT EXISTS 'borrador';
ALTER TYPE "WorkStatus" ADD VALUE IF NOT EXISTS 'pendiente_aprobacion';
ALTER TYPE "WorkStatus" ADD VALUE IF NOT EXISTS 'planificada';
ALTER TYPE "WorkStatus" ADD VALUE IF NOT EXISTS 'preparacion';
ALTER TYPE "WorkStatus" ADD VALUE IF NOT EXISTS 'parcialmente_terminada';
ALTER TYPE "WorkStatus" ADD VALUE IF NOT EXISTS 'pendiente_cliente';
ALTER TYPE "WorkStatus" ADD VALUE IF NOT EXISTS 'parada';
ALTER TYPE "WorkStatus" ADD VALUE IF NOT EXISTS 'facturada_parcialmente';
ALTER TYPE "WorkStatus" ADD VALUE IF NOT EXISTS 'facturada';
ALTER TYPE "WorkStatus" ADD VALUE IF NOT EXISTS 'cobrada';
ALTER TYPE "WorkStatus" ADD VALUE IF NOT EXISTS 'archivada';

DO $$ BEGIN
  CREATE TYPE "WorkPriority" AS ENUM ('baja', 'media', 'alta', 'urgente');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "Work"
  ADD COLUMN IF NOT EXISTS "numeroInterno" TEXT,
  ADD COLUMN IF NOT EXISTS "codigo" TEXT,
  ADD COLUMN IF NOT EXISTS "contactoPrincipal" TEXT,
  ADD COLUMN IF NOT EXISTS "contactoTelefono" TEXT,
  ADD COLUMN IF NOT EXISTS "contactoEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "latitud" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "longitud" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "prioridad" "WorkPriority" NOT NULL DEFAULT 'media',
  ADD COLUMN IF NOT EXISTS "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "fechaInicioPrevista" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "fechaInicioReal" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "fechaFinReal" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "responsable" TEXT,
  ADD COLUMN IF NOT EXISTS "comercial" TEXT,
  ADD COLUMN IF NOT EXISTS "jefeObra" TEXT,
  ADD COLUMN IF NOT EXISTS "descripcion" TEXT,
  ADD COLUMN IF NOT EXISTS "observacionesInternas" TEXT,
  ADD COLUMN IF NOT EXISTS "notasPrivadas" TEXT,
  ADD COLUMN IF NOT EXISTS "costePrevisto" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "horasEstimadas" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "horasReales" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "subcontratasCoste" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "archivada" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "archivadaAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS "Work_numeroInterno_key" ON "Work"("numeroInterno");
CREATE UNIQUE INDEX IF NOT EXISTS "Work_codigo_key" ON "Work"("codigo");
CREATE INDEX IF NOT EXISTS "Work_estado_idx" ON "Work"("estado");
CREATE INDEX IF NOT EXISTS "Work_prioridad_idx" ON "Work"("prioridad");
CREATE INDEX IF NOT EXISTS "Work_fechaInicioPrevista_idx" ON "Work"("fechaInicioPrevista");
CREATE INDEX IF NOT EXISTS "Work_fechaFinPrevista_idx" ON "Work"("fechaFinPrevista");
CREATE INDEX IF NOT EXISTS "Work_archivada_idx" ON "Work"("archivada");

CREATE TABLE IF NOT EXISTS "WorkDocument" (
  "id" TEXT NOT NULL,
  "obraId" TEXT NOT NULL,
  "tipo" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "url" TEXT,
  "entityType" TEXT,
  "entityId" TEXT,
  "notas" TEXT,
  "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WorkDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WorkPhoto" (
  "id" TEXT NOT NULL,
  "obraId" TEXT NOT NULL,
  "categoria" TEXT NOT NULL,
  "titulo" TEXT NOT NULL,
  "url" TEXT,
  "notas" TEXT,
  "tomadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WorkPhoto_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "WorkDocument" ADD CONSTRAINT "WorkDocument_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Work"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "WorkPhoto" ADD CONSTRAINT "WorkPhoto_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Work"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "WorkDocument_obraId_idx" ON "WorkDocument"("obraId");
CREATE INDEX IF NOT EXISTS "WorkDocument_tipo_idx" ON "WorkDocument"("tipo");
CREATE INDEX IF NOT EXISTS "WorkDocument_entityType_entityId_idx" ON "WorkDocument"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "WorkPhoto_obraId_idx" ON "WorkPhoto"("obraId");
CREATE INDEX IF NOT EXISTS "WorkPhoto_categoria_idx" ON "WorkPhoto"("categoria");
