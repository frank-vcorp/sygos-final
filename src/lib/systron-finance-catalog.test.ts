import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PrismaClient } from "@prisma/client";
import {
  SYSTRON_EXPENSE_CATALOG,
  SYSTRON_INCOME_CATALOG,
  seedSystronExpenseCatalog,
  seedSystronIncomeCatalog,
} from "../../prisma/seed-systron-finance-catalog";

describe("semilla de catálogos financieros SYSTRON", () => {
  it("persiste exactamente 9 grupos, 32 subcategorías y 6 ingresos de forma idempotente", async () => {
    const expenseCalls: string[] = [];
    const subcategoryCalls: string[] = [];
    const incomeCalls: string[] = [];
    const prisma = {
      expenseCategory: {
        upsert: async ({ where }: { where: { companyId_name: { name: string } } }) => {
          expenseCalls.push(where.companyId_name.name);
          return { id: `category-${expenseCalls.length}` };
        },
      },
      expenseSubcategory: {
        upsert: async ({ where }: { where: { categoryId_name: { name: string } } }) => {
          subcategoryCalls.push(where.categoryId_name.name);
        },
      },
      incomeCategory: {
        upsert: async ({ where }: { where: { companyId_name: { name: string } } }) => {
          incomeCalls.push(where.companyId_name.name);
        },
      },
    } as unknown as PrismaClient;

    await seedSystronExpenseCatalog(prisma, "systron");
    await seedSystronIncomeCatalog(prisma, "systron");

    assert.equal(expenseCalls.length, 9);
    assert.equal(subcategoryCalls.length, 32);
    assert.deepEqual(SYSTRON_EXPENSE_CATALOG, {
      "Gastos administrativos": ["Servicios de contabilidad", "Abogados", "Papelería", "Internet", "Productos de limpieza", "Limpieza", "Suministro comedor", "Gastos generales"],
      "Instalaciones y mantenimiento": ["Renta bodega", "Luz", "Mantenimiento bodega", "Mantenimiento maquinaria"],
      "Vehículos y traslados": ["Gasolina", "Servicio de autos", "Renta autos", "Casetas"],
      "Producción y operación": ["Materiales", "Mano de obra", "Importación", "Refacciones y componentes", "Herramientas"],
      Ventas: ["Comisiones", "Suministro ventas", "Gastos de venta"],
      "Impuestos y obligaciones": ["SAT", "IMSS", "Impuestos"],
      Seguros: ["Prima de seguro"],
      "Gastos financieros": ["Financiamiento TC", "Comisiones bancarias", "Diferencia cambiaria"],
      "Otros gastos": ["Otros gastos"],
    });
    assert.deepEqual(SYSTRON_INCOME_CATALOG, [
      "Servicios",
      "Venta de refacciones y materiales",
      "Venta de equipo",
      "Recuperaciones y reembolsos",
      "Aportaciones de socios",
      "Otros ingresos",
    ]);
    assert.deepEqual(expenseCalls, Object.keys(SYSTRON_EXPENSE_CATALOG));
    assert.deepEqual(incomeCalls, [...SYSTRON_INCOME_CATALOG]);
  });
});
