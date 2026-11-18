-- Facturapi Fase 1: configuración multiempresa, claves SAT, línea por línea, idempotencia y forma de pago real
ALTER TABLE "Company" ADD COLUMN "facturapiMode" TEXT NOT NULL DEFAULT 'OFF';
ALTER TABLE "Company" ADD COLUMN "fiscalSeriesPolicy" TEXT NOT NULL DEFAULT 'SYGOS_FAC';
ALTER TABLE "Company" ADD COLUMN "fiscalDefaultSeries" TEXT NOT NULL DEFAULT 'FAC';
ALTER TABLE "Company" ADD COLUMN "fiscalLineMode" TEXT NOT NULL DEFAULT 'LINE_BY_LINE';
ALTER TABLE "Company" ADD COLUMN "fiscalConfigJson" TEXT NOT NULL DEFAULT '{}';

ALTER TABLE "Client" ADD COLUMN "satLegalName" TEXT;
ALTER TABLE "Client" ADD COLUMN "fiscalEmail" TEXT;

ALTER TABLE "BillingDocument" ADD COLUMN "paymentFormSnapshot" TEXT;
ALTER TABLE "BillingDocument" ADD COLUMN "fiscalEnv" TEXT;
ALTER TABLE "BillingDocument" ADD COLUMN "fiscalIdempotencyKey" TEXT;
ALTER TABLE "BillingDocument" ADD COLUMN "fiscalSeries" TEXT;
ALTER TABLE "BillingDocument" ADD COLUMN "fiscalFolioNumber" INTEGER;
ALTER TABLE "BillingDocument" ADD COLUMN "verificationUrl" TEXT;
ALTER TABLE "BillingDocument" ADD COLUMN "stampedAt" DATETIME;
CREATE UNIQUE INDEX "BillingDocument_fiscalIdempotencyKey_key" ON "BillingDocument"("fiscalIdempotencyKey");

ALTER TABLE "BillingLine" ADD COLUMN "discountAmount" REAL NOT NULL DEFAULT 0;
ALTER TABLE "BillingLine" ADD COLUMN "taxIncluded" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BillingLine" ADD COLUMN "satProductKey" TEXT;
ALTER TABLE "BillingLine" ADD COLUMN "satUnitKey" TEXT;
ALTER TABLE "BillingLine" ADD COLUMN "satUnitName" TEXT;
ALTER TABLE "BillingLine" ADD COLUMN "taxability" TEXT NOT NULL DEFAULT '02';
ALTER TABLE "BillingLine" ADD COLUMN "quoteLineId" TEXT;
