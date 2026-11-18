-- Facturapi Fase 3: Complementos de Pago (REP / CFDI tipo P)
CREATE TABLE "PaymentComplement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "fiscalEnv" TEXT,
    "fiscalStatus" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "fiscalError" TEXT,
    "fiscalIdempotencyKey" TEXT,
    "fiscalExternalId" TEXT,
    "fiscalUuid" TEXT,
    "fiscalSeries" TEXT,
    "fiscalFolioNumber" INTEGER,
    "verificationUrl" TEXT,
    "paymentForm" TEXT NOT NULL,
    "paymentDate" DATETIME NOT NULL,
    "totalAmount" REAL NOT NULL,
    "xmlContent" TEXT,
    "pdfContent" BLOB,
    "cancellationStatus" TEXT,
    "canceledAt" DATETIME,
    "stampedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PaymentComplement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PaymentComplement_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PaymentComplement_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "PaymentComplementItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "complementId" TEXT NOT NULL,
    "billingDocumentId" TEXT NOT NULL,
    "paymentApplicationId" TEXT NOT NULL,
    "installment" INTEGER NOT NULL,
    "lastBalance" REAL NOT NULL,
    "amountPaid" REAL NOT NULL,
    "insoluto" REAL NOT NULL,
    CONSTRAINT "PaymentComplementItem_complementId_fkey" FOREIGN KEY ("complementId") REFERENCES "PaymentComplement" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PaymentComplementItem_billingDocumentId_fkey" FOREIGN KEY ("billingDocumentId") REFERENCES "BillingDocument" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PaymentComplementItem_paymentApplicationId_fkey" FOREIGN KEY ("paymentApplicationId") REFERENCES "PaymentApplication" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PaymentComplement_paymentId_key" ON "PaymentComplement"("paymentId");
CREATE UNIQUE INDEX "PaymentComplement_fiscalIdempotencyKey_key" ON "PaymentComplement"("fiscalIdempotencyKey");
CREATE INDEX "PaymentComplement_companyId_fiscalStatus_idx" ON "PaymentComplement"("companyId", "fiscalStatus");
CREATE UNIQUE INDEX "PaymentComplementItem_paymentApplicationId_key" ON "PaymentComplementItem"("paymentApplicationId");
CREATE INDEX "PaymentComplementItem_complementId_idx" ON "PaymentComplementItem"("complementId");
CREATE INDEX "PaymentComplementItem_billingDocumentId_idx" ON "PaymentComplementItem"("billingDocumentId");
