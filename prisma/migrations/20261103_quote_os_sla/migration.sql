-- Quote-driven OS SLA (repair quotes only)
ALTER TABLE "Quote" ADD COLUMN "deliveryBusinessDays" INTEGER;
ALTER TABLE "Quote" ADD COLUMN "clientAuthorizedAt" TIMESTAMP(3);
ALTER TABLE "Quote" ADD COLUMN "slaStartedAt" TIMESTAMP(3);
ALTER TABLE "Quote" ADD COLUMN "slaDueAt" TIMESTAMP(3);
