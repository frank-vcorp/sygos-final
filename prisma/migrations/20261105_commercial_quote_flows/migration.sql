-- Cotizaciones comerciales (COTDX/COTOS/COTSC/COTVT) y módulo SCA

ALTER TABLE "Quote" ADD COLUMN "priorityName" TEXT;
ALTER TABLE "Quote" ADD COLUMN "priorityPrice" REAL;
ALTER TABLE "Quote" ADD COLUMN "priorityIncrementPct" REAL;
ALTER TABLE "Quote" ADD COLUMN "priorityTargetMinDays" INTEGER;
ALTER TABLE "Quote" ADD COLUMN "priorityTargetMaxDays" INTEGER;
ALTER TABLE "Quote" ADD COLUMN "prioritySlaMaxDays" INTEGER;
ALTER TABLE "Quote" ADD COLUMN "fieldServiceHours" REAL;
ALTER TABLE "Quote" ADD COLUMN "fieldServiceUnitPrice" REAL;

CREATE TABLE "FieldServiceCase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "folio" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "concept" TEXT NOT NULL DEFAULT 'Servicio de Campo',
    "description" TEXT NOT NULL,
    "hours" REAL NOT NULL DEFAULT 4,
    "unitPrice" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ABIERTO',
    "sellerUserId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FieldServiceCase_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FieldServiceCase_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FieldServiceCase_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "FieldServiceCase_companyId_folio_key" ON "FieldServiceCase"("companyId", "folio");
CREATE UNIQUE INDEX "FieldServiceCase_quoteId_key" ON "FieldServiceCase"("quoteId");
CREATE INDEX "FieldServiceCase_companyId_status_idx" ON "FieldServiceCase"("companyId", "status");
