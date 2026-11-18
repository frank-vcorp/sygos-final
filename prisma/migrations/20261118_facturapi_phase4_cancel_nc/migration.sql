-- Facturapi Fase 4: Cancelación SAT y Notas de Crédito (CFDI tipo E)
ALTER TABLE "BillingDocument" ADD COLUMN "cancelRequestedAt" DATETIME;
ALTER TABLE "BillingDocument" ADD COLUMN "cancelRequestedByUserId" TEXT;
ALTER TABLE "BillingDocument" ADD COLUMN "cancelAuthorizedByUserId" TEXT;
ALTER TABLE "BillingDocument" ADD COLUMN "cancelMotive" TEXT;
ALTER TABLE "BillingDocument" ADD COLUMN "cancelSubstitutionDocId" TEXT;
ALTER TABLE "BillingDocument" ADD COLUMN "cancellationStatus" TEXT;
ALTER TABLE "BillingDocument" ADD COLUMN "canceledAt" DATETIME;
ALTER TABLE "BillingDocument" ADD COLUMN "cancelReceiptXml" TEXT;
ALTER TABLE "BillingDocument" ADD COLUMN "cancelReceiptPdf" BLOB;
ALTER TABLE "BillingDocument" ADD COLUMN "relatedDocumentId" TEXT;
ALTER TABLE "BillingDocument" ADD COLUMN "satRelationType" TEXT;
CREATE INDEX "BillingDocument_relatedDocumentId_idx" ON "BillingDocument"("relatedDocumentId");

ALTER TABLE "PaymentComplement" ADD COLUMN "cancelRequestedAt" DATETIME;
ALTER TABLE "PaymentComplement" ADD COLUMN "cancelRequestedByUserId" TEXT;
ALTER TABLE "PaymentComplement" ADD COLUMN "cancelAuthorizedByUserId" TEXT;
ALTER TABLE "PaymentComplement" ADD COLUMN "cancelMotive" TEXT;
ALTER TABLE "PaymentComplement" ADD COLUMN "cancelSubstitutionRepId" TEXT;
ALTER TABLE "PaymentComplement" ADD COLUMN "cancelReceiptXml" TEXT;
ALTER TABLE "PaymentComplement" ADD COLUMN "cancelReceiptPdf" BLOB;
