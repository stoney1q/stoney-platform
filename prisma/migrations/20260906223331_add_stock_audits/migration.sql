-- CreateEnum
CREATE TYPE "StockAuditStatus" AS ENUM ('IN_PROGRESS', 'REVIEW', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "StockAudit" (
    "id" TEXT NOT NULL,
    "sequence" SERIAL NOT NULL,
    "status" "StockAuditStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "name" TEXT,
    "branchId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "completedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "StockAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockAuditItem" (
    "id" TEXT NOT NULL,
    "stockAuditId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "systemQuantity" INTEGER NOT NULL,
    "countedQuantity" INTEGER NOT NULL,
    "variance" INTEGER,

    CONSTRAINT "StockAuditItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StockAudit_sequence_key" ON "StockAudit"("sequence");

-- CreateIndex
CREATE INDEX "StockAudit_branchId_status_createdAt_idx" ON "StockAudit"("branchId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StockAuditItem_stockAuditId_productId_key" ON "StockAuditItem"("stockAuditId", "productId");

-- AddForeignKey
ALTER TABLE "StockAudit" ADD CONSTRAINT "StockAudit_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAudit" ADD CONSTRAINT "StockAudit_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAudit" ADD CONSTRAINT "StockAudit_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAuditItem" ADD CONSTRAINT "StockAuditItem_stockAuditId_fkey" FOREIGN KEY ("stockAuditId") REFERENCES "StockAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAuditItem" ADD CONSTRAINT "StockAuditItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
