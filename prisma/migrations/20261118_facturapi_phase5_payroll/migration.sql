-- Facturapi Fase 5: Cierre de Nómina CFDI (type N) con idempotencia y XML/PDF
ALTER TABLE "PayrollPeriod" ADD COLUMN "fiscalEnv" TEXT;

ALTER TABLE "PayrollLine" ADD COLUMN "fiscalEnv" TEXT;
ALTER TABLE "PayrollLine" ADD COLUMN "fiscalError" TEXT;
ALTER TABLE "PayrollLine" ADD COLUMN "fiscalIdempotencyKey" TEXT;
ALTER TABLE "PayrollLine" ADD COLUMN "xmlContent" TEXT;
ALTER TABLE "PayrollLine" ADD COLUMN "pdfContent" BLOB;
ALTER TABLE "PayrollLine" ADD COLUMN "stampedAt" DATETIME;
CREATE UNIQUE INDEX "PayrollLine_fiscalIdempotencyKey_key" ON "PayrollLine"("fiscalIdempotencyKey");
