-- CreateEnum
CREATE TYPE "MediaState" AS ENUM ('PENDING', 'READY', 'ERROR');

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "state" "MediaState" NOT NULL DEFAULT 'PENDING',
    "bucket" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "url" TEXT,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "branchId" TEXT,
    "productId" TEXT,
    "repairId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MediaAsset_state_createdAt_idx" ON "MediaAsset"("state", "createdAt");

-- CreateIndex
CREATE INDEX "MediaAsset_productId_idx" ON "MediaAsset"("productId");

-- CreateIndex
CREATE INDEX "MediaAsset_repairId_idx" ON "MediaAsset"("repairId");

-- CreateIndex
CREATE INDEX "MediaAsset_branchId_idx" ON "MediaAsset"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_bucket_path_key" ON "MediaAsset"("bucket", "path");

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_repairId_fkey" FOREIGN KEY ("repairId") REFERENCES "Repair"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
