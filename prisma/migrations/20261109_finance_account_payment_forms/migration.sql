-- Tipos de cuenta: BANCO→BANCARIA, TARJETA→CREDITO; últimos 4 para identificación.
ALTER TABLE "FinanceAccount" ADD COLUMN IF NOT EXISTS "lastFour" TEXT;

UPDATE "FinanceAccount" SET "kind" = 'BANCARIA' WHERE "kind" = 'BANCO';
UPDATE "FinanceAccount" SET "kind" = 'CREDITO' WHERE "kind" = 'TARJETA';

-- Formas de pago operativas en compras (legacy → unificado).
UPDATE "Purchase" SET "paymentType" = 'EFECTIVO' WHERE "paymentType" = 'CONTADO';
UPDATE "Purchase" SET "paymentType" = 'TC' WHERE "paymentType" = 'TARJETA';
