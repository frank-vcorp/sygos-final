-- Requerimientos → listas de compras → compras, with traceable source links.
ALTER TABLE "Purchase" ADD COLUMN "shoppingListId" TEXT;
ALTER TABLE "PurchaseLine" ADD COLUMN "requirementId" TEXT;
ALTER TABLE "PurchaseLine" ADD COLUMN "shoppingListLineId" TEXT;
ALTER TABLE "Requirement" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'GENERAL';
ALTER TABLE "Requirement" ADD COLUMN "shoppingListId" TEXT;
ALTER TABLE "Requirement" ADD COLUMN "purchaseId" TEXT;

CREATE TABLE "ShoppingList" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "folio" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ABIERTA',
  "supplierId" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ShoppingList_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ShoppingList_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ShoppingList_companyId_folio_key" ON "ShoppingList" ("companyId", "folio");
CREATE INDEX "ShoppingList_companyId_status_idx" ON "ShoppingList" ("companyId", "status");

CREATE TABLE "ShoppingListLine" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "shoppingListId" TEXT NOT NULL,
  "requirementId" TEXT NOT NULL,
  "partNumber" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "sourceType" TEXT,
  "sourceId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ShoppingListLine_shoppingListId_fkey" FOREIGN KEY ("shoppingListId") REFERENCES "ShoppingList" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ShoppingListLine_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ShoppingListLine_requirementId_key" ON "ShoppingListLine" ("requirementId");
CREATE INDEX "ShoppingListLine_shoppingListId_idx" ON "ShoppingListLine" ("shoppingListId");
CREATE INDEX "ShoppingListLine_sourceType_sourceId_idx" ON "ShoppingListLine" ("sourceType", "sourceId");

CREATE UNIQUE INDEX "Purchase_shoppingListId_key" ON "Purchase" ("shoppingListId");
CREATE INDEX "PurchaseLine_requirementId_idx" ON "PurchaseLine" ("requirementId");
CREATE UNIQUE INDEX "PurchaseLine_shoppingListLineId_key" ON "PurchaseLine" ("shoppingListLineId");
CREATE INDEX "Requirement_shoppingListId_idx" ON "Requirement" ("shoppingListId");
CREATE INDEX "Requirement_purchaseId_idx" ON "Requirement" ("purchaseId");
CREATE UNIQUE INDEX "Requirement_companyId_sourceType_sourceId_key" ON "Requirement" ("companyId", "sourceType", "sourceId");
