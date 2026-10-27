import type { PrismaClient } from "@prisma/client";

/** Catálogo de egresos SYSTRON — fuente: docs/catalogos-systron-compras.md */
export const SYSTRON_EXPENSE_CATALOG: Readonly<Record<string, readonly string[]>> = {
  "Gastos administrativos": [
    "Servicios de contabilidad",
    "Abogados",
    "Papelería",
    "Internet",
    "Productos de limpieza",
    "Limpieza",
    "Suministro comedor",
    "Gastos generales",
  ],
  "Instalaciones y mantenimiento": ["Renta bodega", "Luz", "Mantenimiento bodega", "Mantenimiento maquinaria"],
  "Vehículos y traslados": ["Gasolina", "Servicio de autos", "Renta autos", "Casetas"],
  "Producción y operación": ["Materiales", "Mano de obra", "Importación", "Refacciones y componentes", "Herramientas"],
  Ventas: ["Comisiones", "Suministro ventas", "Gastos de venta"],
  "Impuestos y obligaciones": ["SAT", "IMSS", "Impuestos"],
  Seguros: ["Prima de seguro"],
  "Gastos financieros": ["Financiamiento TC", "Comisiones bancarias", "Diferencia cambiaria"],
  "Otros gastos": ["Otros gastos"],
};

/** Catálogo de ingresos SYSTRON. */
export const SYSTRON_INCOME_CATALOG: readonly string[] = [
  "Servicios",
  "Venta de refacciones y materiales",
  "Venta de equipo",
  "Recuperaciones y reembolsos",
  "Aportaciones de socios",
  "Otros ingresos",
];

export async function seedSystronExpenseCatalog(prisma: PrismaClient, companyId: string) {
  for (const [categoryName, subcategories] of Object.entries(SYSTRON_EXPENSE_CATALOG)) {
    const category = await prisma.expenseCategory.upsert({
      where: { companyId_name: { companyId, name: categoryName } },
      update: { active: true },
      create: { companyId, name: categoryName },
    });
    for (const subName of subcategories) {
      await prisma.expenseSubcategory.upsert({
        where: { categoryId_name: { categoryId: category.id, name: subName } },
        update: { active: true },
        create: { categoryId: category.id, name: subName },
      });
    }
  }
}

export async function seedSystronIncomeCatalog(prisma: PrismaClient, companyId: string) {
  for (const name of SYSTRON_INCOME_CATALOG) {
    await prisma.incomeCategory.upsert({
      where: { companyId_name: { companyId, name } },
      update: { active: true },
      create: { companyId, name },
    });
  }
}

/**
 * Backfills nullable catalog references only when an existing display name exactly
 * matches the SYSTRON catalog. Legacy strings are deliberately retained so old
 * purchases remain readable even if their category was historical or custom.
 */
export async function backfillPurchaseExpenseCatalogReferences(prisma: PrismaClient, companyId: string) {
  const categories = await prisma.expenseCategory.findMany({
    where: { companyId },
    include: { subcategories: true },
  });
  for (const category of categories) {
    await prisma.purchase.updateMany({
      where: { companyId, expenseCategory: category.name, expenseCategoryId: null },
      data: { expenseCategoryId: category.id },
    });
    for (const subcategory of category.subcategories) {
      await prisma.purchase.updateMany({
        where: {
          companyId,
          expenseCategory: category.name,
          expenseSubcategory: subcategory.name,
          expenseSubcategoryId: null,
        },
        data: { expenseSubcategoryId: subcategory.id },
      });
    }
  }
}
