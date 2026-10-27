-- Persist the SYSTRON income catalog and link new purchases to their expense catalog rows.
-- Existing purchases retain their legacy display names and receive null references until
-- they are edited or backfilled from a matching catalog row.
CREATE TABLE "IncomeCategory" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "IncomeCategory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "IncomeCategory_companyId_name_key" ON "IncomeCategory" ("companyId", "name");

-- Nullable foreign keys make this additive migration safe for existing string-based
-- records, while all new purchase writes select catalog IDs.
ALTER TABLE "Purchase" ADD COLUMN "expenseCategoryId" TEXT REFERENCES "ExpenseCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Purchase" ADD COLUMN "expenseSubcategoryId" TEXT REFERENCES "ExpenseSubcategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Purchase_expenseCategoryId_idx" ON "Purchase"("expenseCategoryId");
CREATE INDEX "Purchase_expenseSubcategoryId_idx" ON "Purchase"("expenseSubcategoryId");
