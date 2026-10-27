-- Compras Fase 1: supplier currency, purchase metadata/lines, requirements and expense catalog.
ALTER TABLE "Supplier" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'MXN';
ALTER TABLE "Purchase" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'MXN';
ALTER TABLE "Purchase" ADD COLUMN "expenseCategory" TEXT;
ALTER TABLE "Purchase" ADD COLUMN "expenseSubcategory" TEXT;
ALTER TABLE "Purchase" ADD COLUMN "paymentType" TEXT;
ALTER TABLE "Purchase" ADD COLUMN "purchaseDate" DATETIME;

CREATE TABLE "PurchaseLine" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "purchaseId" TEXT NOT NULL,
  "partNumber" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "sourceType" TEXT,
  "sourceId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "PurchaseLine_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "PurchaseLine_purchaseId_idx" ON "PurchaseLine" ("purchaseId");
CREATE INDEX "PurchaseLine_sourceType_sourceId_idx" ON "PurchaseLine" ("sourceType", "sourceId");

CREATE TABLE "Requirement" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "partNumber" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "quantity" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDIENTE',
  "requesterUserId" TEXT NOT NULL,
  "sourceType" TEXT,
  "sourceId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "Requirement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "Requirement_companyId_status_idx" ON "Requirement" ("companyId", "status");
CREATE INDEX "Requirement_companyId_requesterUserId_idx" ON "Requirement" ("companyId", "requesterUserId");

CREATE TABLE "ExpenseCategory" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ExpenseCategory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ExpenseCategory_companyId_name_key" ON "ExpenseCategory" ("companyId", "name");

CREATE TABLE "ExpenseSubcategory" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "categoryId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExpenseSubcategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ExpenseSubcategory_categoryId_name_key" ON "ExpenseSubcategory" ("categoryId", "name");
