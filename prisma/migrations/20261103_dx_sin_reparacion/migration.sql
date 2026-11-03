-- AlterTable
ALTER TABLE "TechnicalCase" ADD COLUMN "noRepairAt" TIMESTAMP(3),
ADD COLUMN "noRepairReason" TEXT,
ADD COLUMN "noRepairByUserId" TEXT;
