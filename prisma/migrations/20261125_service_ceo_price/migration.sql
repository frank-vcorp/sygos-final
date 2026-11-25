-- Precio de CEO en el DX/OS, aparte de la cotización comercial.
ALTER TABLE "TechnicalCase" ADD COLUMN "ceoPricePending" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "QuoteLine" ADD COLUMN "sourceTechnicalCaseId" TEXT;

CREATE TABLE "ServiceCeoPrice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "technicalCaseId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "concept" TEXT NOT NULL,
    "deliveryBusinessDays" INTEGER,
    "pricedByUserId" TEXT NOT NULL,
    "pricedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ServiceCeoPrice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ServiceCeoPrice_technicalCaseId_fkey" FOREIGN KEY ("technicalCaseId") REFERENCES "TechnicalCase" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ServiceCeoPrice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ServiceCeoPrice_companyId_technicalCaseId_key" ON "ServiceCeoPrice"("companyId", "technicalCaseId");
CREATE INDEX "ServiceCeoPrice_companyId_clientId_idx" ON "ServiceCeoPrice"("companyId", "clientId");
CREATE INDEX "QuoteLine_sourceTechnicalCaseId_idx" ON "QuoteLine"("sourceTechnicalCaseId");
