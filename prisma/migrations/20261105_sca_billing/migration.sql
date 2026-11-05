-- Facturación FAC/REM ligada a servicio de campo (SCA)
ALTER TABLE "BillingDocument" ADD COLUMN "fieldServiceCaseId" TEXT;
CREATE INDEX "BillingDocument_fieldServiceCaseId_idx" ON "BillingDocument"("fieldServiceCaseId");
