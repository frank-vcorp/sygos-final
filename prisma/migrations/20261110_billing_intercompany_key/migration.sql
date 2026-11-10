-- Una factura de Servomotores a SYSTRON por atención.
ALTER TABLE "BillingDocument" ADD COLUMN "intercompanyKey" TEXT;
CREATE UNIQUE INDEX "BillingDocument_intercompanyKey_key" ON "BillingDocument"("intercompanyKey");
