-- CEO configuration: account bank data, monthly purchase budgets, and commercial peso goals.
ALTER TABLE "Company" ADD COLUMN "partsMonthlyBudget" REAL NOT NULL DEFAULT 100000;
ALTER TABLE "Company" ADD COLUMN "generalMonthlyBudget" REAL NOT NULL DEFAULT 5000;

ALTER TABLE "FinanceAccount" ADD COLUMN "bankName" TEXT;
ALTER TABLE "FinanceAccount" ADD COLUMN "clabe" TEXT;
ALTER TABLE "FinanceAccount" ADD COLUMN "fiscal" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "CommercialMonthlyGoal" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "metric" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "amount" REAL NOT NULL,
  CONSTRAINT "CommercialMonthlyGoal_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CommercialMonthlyGoal_companyId_metric_year_month_key" ON "CommercialMonthlyGoal"("companyId", "metric", "year", "month");
