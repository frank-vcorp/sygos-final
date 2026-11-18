-- Facturapi Fase 2: persistencia XML/PDF y eventos webhook idempotentes
ALTER TABLE "BillingDocument" ADD COLUMN "xmlContent" TEXT;
ALTER TABLE "BillingDocument" ADD COLUMN "pdfContent" BLOB;

CREATE TABLE "FacturapiWebhookEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "livemode" BOOLEAN NOT NULL,
    "resourceId" TEXT,
    "payloadJson" TEXT NOT NULL,
    "processedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "error" TEXT
);

CREATE INDEX "FacturapiWebhookEvent_companyId_processedAt_idx" ON "FacturapiWebhookEvent"("companyId", "processedAt");
