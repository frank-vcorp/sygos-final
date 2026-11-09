-- Remove unused fiscal flag on treasury accounts (SG-99).
ALTER TABLE "FinanceAccount" DROP COLUMN IF EXISTS "fiscal";
