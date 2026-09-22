-- AlterEnum
BEGIN;
DROP TYPE IF EXISTS "public"."DeliveryStatus_new";
DROP TYPE IF EXISTS "public"."DeliveryStatus_old";
CREATE TYPE "DeliveryStatus_new" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'ERROR');
ALTER TABLE "public"."EmailDeliveryLog" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "EmailDeliveryLog" ALTER COLUMN "status" TYPE "DeliveryStatus_new" USING ("status"::text::"DeliveryStatus_new");
ALTER TYPE "DeliveryStatus" RENAME TO "DeliveryStatus_old";
ALTER TYPE "DeliveryStatus_new" RENAME TO "DeliveryStatus";
DROP TYPE "public"."DeliveryStatus_old";
ALTER TABLE "EmailDeliveryLog" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_createdById_fkey";

-- AlterTable (Idempotent renames)
DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='BranchSequence' AND column_name='lastSequence') THEN
      ALTER TABLE "BranchSequence" RENAME COLUMN "lastSequence" TO "currentValue";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='EmailDeliveryLog' AND column_name='to') THEN
      ALTER TABLE "EmailDeliveryLog" RENAME COLUMN "to" TO "email";
  END IF;
  
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='EmailDeliveryLog' AND column_name='lastError') THEN
      ALTER TABLE "EmailDeliveryLog" RENAME COLUMN "lastError" TO "error";
  END IF;
END $$;

-- Drop removed columns
DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='EmailDeliveryLog' AND column_name='attemptCount') THEN
      ALTER TABLE "EmailDeliveryLog" DROP COLUMN "attemptCount";
  END IF;
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='EmailDeliveryLog' AND column_name='documentType') THEN
      ALTER TABLE "EmailDeliveryLog" DROP COLUMN "documentType";
  END IF;
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='EmailDeliveryLog' AND column_name='sentAt') THEN
      ALTER TABLE "EmailDeliveryLog" DROP COLUMN "sentAt";
  END IF;
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='EmailDeliveryLog' AND column_name='subject') THEN
      ALTER TABLE "EmailDeliveryLog" DROP COLUMN "subject";
  END IF;
END $$;

-- Set NOT NULL
ALTER TABLE "EmailDeliveryLog" ALTER COLUMN "documentId" SET NOT NULL;
ALTER TABLE "Quotation" ALTER COLUMN "portalToken" SET NOT NULL;
ALTER TABLE "Repair" ALTER COLUMN "portalToken" SET NOT NULL;
ALTER TABLE "Sale" ALTER COLUMN "portalToken" SET NOT NULL;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Payment_createdById_fkey') THEN
    ALTER TABLE "Payment" ADD CONSTRAINT "Payment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
