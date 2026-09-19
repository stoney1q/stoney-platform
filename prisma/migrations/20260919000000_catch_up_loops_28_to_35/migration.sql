-- ============================================================
-- Catch-up migration: Loops 28–35
-- Applied via `prisma db push` across multiple loops.
-- This migration documents the accumulated schema changes that
-- are already present in the live database.
-- Marked as applied via: prisma migrate resolve --applied
-- ============================================================

-- PaymentMethod enum: add PAYSTACK variant
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'PAYSTACK';

-- DeliveryStatus enum (for email delivery)
DO $$ BEGIN
    CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'BOUNCED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- BranchSequence table (document numbering per branch)
CREATE TABLE IF NOT EXISTS "BranchSequence" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "lastSequence" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BranchSequence_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BranchSequence_branchId_prefix_key" ON "BranchSequence"("branchId", "prefix");
DO $$ BEGIN
    ALTER TABLE "BranchSequence" ADD CONSTRAINT "BranchSequence_branchId_fkey"
        FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- EmailDeliveryLog table
CREATE TABLE IF NOT EXISTS "EmailDeliveryLog" (
    "id" TEXT NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "documentId" TEXT,
    "documentType" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailDeliveryLog_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "EmailDeliveryLog_idempotencyKey_key" ON "EmailDeliveryLog"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "EmailDeliveryLog_documentId_status_idx" ON "EmailDeliveryLog"("documentId", "status");
CREATE INDEX IF NOT EXISTS "EmailDeliveryLog_status_createdAt_idx" ON "EmailDeliveryLog"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "EmailDeliveryLog_status_updatedAt_idx" ON "EmailDeliveryLog"("status", "updatedAt");

-- Payment table: new gateway columns, make createdById nullable
ALTER TABLE "Payment"
    ADD COLUMN IF NOT EXISTS "gatewayId" TEXT,
    ADD COLUMN IF NOT EXISTS "gatewayStatus" TEXT,
    ADD COLUMN IF NOT EXISTS "receiptUrl" TEXT;
ALTER TABLE "Payment" ALTER COLUMN "createdById" DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_gatewayId_key" ON "Payment"("gatewayId");

-- Quotation table: portal and document columns
ALTER TABLE "Quotation"
    ADD COLUMN IF NOT EXISTS "documentMediaId" TEXT,
    ADD COLUMN IF NOT EXISTS "documentNumber" TEXT,
    ADD COLUMN IF NOT EXISTS "portalToken" TEXT,
    ADD COLUMN IF NOT EXISTS "snapshotData" JSONB,
    ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
CREATE UNIQUE INDEX IF NOT EXISTS "Quotation_documentNumber_key" ON "Quotation"("documentNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "Quotation_portalToken_key" ON "Quotation"("portalToken");

-- Repair table: portal and document columns
ALTER TABLE "Repair"
    ADD COLUMN IF NOT EXISTS "documentMediaId" TEXT,
    ADD COLUMN IF NOT EXISTS "documentNumber" TEXT,
    ADD COLUMN IF NOT EXISTS "portalToken" TEXT,
    ADD COLUMN IF NOT EXISTS "snapshotData" JSONB;
CREATE UNIQUE INDEX IF NOT EXISTS "Repair_documentNumber_key" ON "Repair"("documentNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "Repair_portalToken_key" ON "Repair"("portalToken");

-- Sale table: portal and document columns
ALTER TABLE "Sale"
    ADD COLUMN IF NOT EXISTS "documentMediaId" TEXT,
    ADD COLUMN IF NOT EXISTS "documentNumber" TEXT,
    ADD COLUMN IF NOT EXISTS "portalToken" TEXT,
    ADD COLUMN IF NOT EXISTS "snapshotData" JSONB,
    ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
CREATE UNIQUE INDEX IF NOT EXISTS "Sale_documentNumber_key" ON "Sale"("documentNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "Sale_portalToken_key" ON "Sale"("portalToken");

-- RateLimit table (loop 35 rate limiting)
CREATE TABLE IF NOT EXISTS "RateLimit" (
    "key" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);
CREATE INDEX IF NOT EXISTS "RateLimit_expiresAt_idx" ON "RateLimit"("expiresAt");
