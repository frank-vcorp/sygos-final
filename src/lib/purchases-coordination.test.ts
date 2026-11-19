import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { isCoordinationGeneralOnlyPurchases } from "./purchases";

describe("reglas de compras no técnicas para Coordinación de Administración", () => {
  it("aplica solo GENERAL únicamente en SYSTRON y deja SERVOMOTORES sin cambio", () => {
    assert.equal(isCoordinationGeneralOnlyPurchases("COORDINACION_ADMINISTRACION", "SYSTRON"), true);
    assert.equal(isCoordinationGeneralOnlyPurchases("COORDINACION_ADMINISTRACION", "SERVOMOTORES"), false);
    assert.equal(isCoordinationGeneralOnlyPurchases("GERENTE_OPERATIVO_SYSTRON", "SYSTRON"), false);
    assert.equal(isCoordinationGeneralOnlyPurchases("CEO", "SYSTRON"), false);
  });

  it("en SYSTRON restringe creación a GENERAL, procesa compras directas a Finanzas/CxP y permite procesar REFACCION de taller", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sygos-coord-compras-"));
    process.env.DATABASE_URL = `file:${join(dir, "test.db")}`;
    const { execSync } = await import("child_process");
    execSync("npx prisma db push --skip-generate", {
      cwd: join(import.meta.dirname, "../.."),
      env: process.env,
      stdio: "ignore",
    });

    const { prisma } = await import("./db");
    const {
      createPhaseOnePurchase,
      createRequirement,
      createShoppingList,
      processPurchase,
      purchaseRequirement,
    } = await import("./purchases");

    const systron = await prisma.company.create({ data: { code: "SYSTRON", name: "SYSTRON", inventoryEnabled: true } });
    const servomotores = await prisma.company.create({ data: { code: "SERVOMOTORES", name: "Servomotores" } });

    const ale = await prisma.user.create({
      data: { username: "ale-coord", name: "Ale", passwordHash: "x", role: "COORDINACION_ADMINISTRACION", companyId: null },
    });
    const almacen = await prisma.user.create({
      data: { username: "almacen-sy", name: "Almacén", passwordHash: "x", role: "ALMACEN", companyId: systron.id },
    });

    const supplierSy = await prisma.supplier.create({
      data: { companyId: systron.id, name: "Papelería Centro", creditDays: 15, currency: "MXN", active: true },
    });
    const supplierSm = await prisma.supplier.create({
      data: { companyId: servomotores.id, name: "Proveedor SM", creditDays: 0, currency: "MXN", active: true },
    });

    const catAdminSy = await prisma.expenseCategory.create({
      data: { companyId: systron.id, name: "Gastos administrativos", active: true },
    });
    const subPapeleriaSy = await prisma.expenseSubcategory.create({
      data: { categoryId: catAdminSy.id, name: "Papelería", active: true },
    });
    const catProdSy = await prisma.expenseCategory.create({
      data: { companyId: systron.id, name: "Producción y operación", active: true },
    });
    await prisma.expenseSubcategory.create({
      data: { categoryId: catProdSy.id, name: "Refacciones y componentes", active: true },
    });

    const catAdminSm = await prisma.expenseCategory.create({
      data: { companyId: servomotores.id, name: "Gastos administrativos", active: true },
    });
    const catProdSm = await prisma.expenseCategory.create({
      data: { companyId: servomotores.id, name: "Producción y operación", active: true },
    });
    await prisma.expenseSubcategory.create({
      data: { categoryId: catProdSm.id, name: "Refacciones y componentes", active: true },
    });

    const bancoSy = await prisma.financeAccount.create({
      data: { companyId: systron.id, name: "Banco SY", kind: "BANCARIA", bankName: "BBVA", balance: 10000, active: true },
    });
    const cajaSm = await prisma.financeAccount.create({
      data: { companyId: servomotores.id, name: "Caja SM", kind: "EFECTIVO", balance: 5000, active: true },
    });

    const aleSy = {
      userId: ale.id,
      role: "COORDINACION_ADMINISTRACION" as const,
      activeCompanyId: systron.id,
      activeCompanyCode: "SYSTRON",
    };
    const aleSm = {
      userId: ale.id,
      role: "COORDINACION_ADMINISTRACION" as const,
      activeCompanyId: servomotores.id,
      activeCompanyCode: "SERVOMOTORES",
    };
    const almacenSy = {
      userId: almacen.id,
      role: "ALMACEN" as const,
      activeCompanyId: systron.id,
      activeCompanyCode: "SYSTRON",
    };

    // 1. Ale en SYSTRON no puede crear compras, OC, listas ni requerimientos REFACCION
    await assert.rejects(
      () =>
        createPhaseOnePurchase(aleSy, {
          supplierId: supplierSy.id,
          paymentType: "TRANSFERENCIA",
          accountId: bancoSy.id,
          purchaseDate: new Date("2026-11-10T12:00:00-06:00"),
          amount: 500,
          lines: [{ partNumber: "P-1", description: "Sensor", quantity: 1 }],
          purchaseKind: "REFACCION",
        }),
      /generales \(no técnicas\)/,
    );

    await assert.rejects(
      () =>
        createPhaseOnePurchase(aleSy, {
          supplierId: supplierSy.id,
          paymentType: "TRANSFERENCIA",
          accountId: bancoSy.id,
          amount: 500,
          lines: [{ partNumber: "P-1", description: "Sensor", quantity: 1, unitPrice: 500 }],
          order: true,
          purchaseKind: "REFACCION",
        }),
      /generales \(no técnicas\)/,
    );

    await assert.rejects(
      () => createShoppingList(aleSy, { kind: "REFACCION", supplierId: supplierSy.id }),
      /listas generales/,
    );

    await assert.rejects(
      () => createRequirement(aleSy, { partNumber: "P-1", description: "Sensor", quantity: 1, kind: "REFACCION" }),
      /requerimientos generales/,
    );

    // 2. Compra no técnica directa de contado (TRANSFERENCIA) pasa directo a PROCESADA y descuenta banco
    const cashPurchase = await createPhaseOnePurchase(aleSy, {
      supplierId: supplierSy.id,
      expenseCategoryId: catAdminSy.id,
      expenseSubcategoryId: subPapeleriaSy.id,
      paymentType: "TRANSFERENCIA",
      accountId: bancoSy.id,
      purchaseDate: new Date("2026-11-10T12:00:00-06:00"),
      amount: 1200,
      lines: [],
      concept: "Tóner y papelería",
      purchaseKind: "GENERAL",
    });
    assert.equal(cashPurchase.kind, "COMPRA");
    assert.equal(cashPurchase.status, "PROCESADA");
    assert.equal(cashPurchase.settlement, "CONTADO");
    assert.ok(cashPurchase.movementId);
    assert.equal(cashPurchase.payableId, null);

    const bancoAfter = await prisma.financeAccount.findUniqueOrThrow({ where: { id: bancoSy.id } });
    assert.equal(bancoAfter.balance, 8800);
    const movement = await prisma.financeMovement.findUniqueOrThrow({ where: { id: cashPurchase.movementId! } });
    assert.equal(movement.direction, "EGRESO");
    assert.equal(movement.originType, "COMPRA");
    assert.equal(movement.originId, cashPurchase.id);
    assert.equal(movement.category, "Gastos administrativos · Papelería");

    // 3. Compra no técnica directa a crédito pasa directo a PROCESADA y crea Payable (CxP)
    const creditPurchase = await createPhaseOnePurchase(aleSy, {
      supplierId: supplierSy.id,
      expenseCategoryId: catAdminSy.id,
      expenseSubcategoryId: subPapeleriaSy.id,
      paymentType: "CREDITO",
      purchaseDate: new Date("2026-11-10T12:00:00-06:00"),
      amount: 2500,
      lines: [],
      concept: "Insumos mensuales",
      purchaseKind: "GENERAL",
    });
    assert.equal(creditPurchase.kind, "COMPRA");
    assert.equal(creditPurchase.status, "PROCESADA");
    assert.equal(creditPurchase.settlement, "CREDITO");
    assert.ok(creditPurchase.payableId);
    assert.equal(creditPurchase.movementId, null);

    const payable = await prisma.payable.findUniqueOrThrow({ where: { id: creditPurchase.payableId! } });
    assert.equal(payable.amount, 2500);
    assert.equal(payable.balance, 2500);
    assert.equal(payable.status, "ABIERTA");

    // 4. OC de Ale en SYSTRON sigue requiriendo autorización del CEO
    const oc = await createPhaseOnePurchase(aleSy, {
      supplierId: supplierSy.id,
      expenseCategoryId: catAdminSy.id,
      expenseSubcategoryId: subPapeleriaSy.id,
      paymentType: "TRANSFERENCIA",
      accountId: bancoSy.id,
      amount: 3000,
      lines: [{ partNumber: "", description: "Sillas oficina", quantity: 2, unitPrice: 1500 }],
      order: true,
      purchaseKind: "GENERAL",
    });
    assert.equal(oc.kind, "OC");
    assert.equal(oc.status, "PENDIENTE_AUTORIZACION");
    assert.equal(oc.movementId, null);
    assert.equal(oc.payableId, null);

    // 5. Requerimiento REFACCION generado por Almacén sigue visible y Ale puede comprarlo y procesarlo a Finanzas
    const techReq = await createRequirement(almacenSy, {
      partNumber: "IGBT-700",
      description: "Módulo IGBT",
      quantity: 2,
      kind: "REFACCION",
      sourceType: "OS",
      sourceId: "pr-os-1",
    });
    assert.equal(techReq.kind, "REFACCION");

    const refPurchase = await purchaseRequirement(aleSy, techReq.id, {
      supplierId: supplierSy.id,
      paymentType: "TRANSFERENCIA",
      accountId: bancoSy.id,
      purchaseDate: new Date("2026-11-11T12:00:00-06:00"),
      amount: 1800,
      concept: "Compra de refacciones para OS",
    });
    assert.equal(refPurchase.kind, "COMPRA");
    assert.equal(refPurchase.status, "PENDIENTE_VALIDAR");

    await processPurchase(aleSy, refPurchase.id, refPurchase.version, "CONTADO", bancoSy.id);
    const refProcessed = await prisma.purchase.findUniqueOrThrow({ where: { id: refPurchase.id } });
    assert.equal(refProcessed.status, "PROCESADA");
    assert.ok(refProcessed.movementId);
    const bancoAfterRef = await prisma.financeAccount.findUniqueOrThrow({ where: { id: bancoSy.id } });
    assert.equal(bancoAfterRef.balance, 7000);

    // 6. SERVOMOTORES no cambia su flujo previo
    const smGeneral = await createPhaseOnePurchase(aleSm, {
      supplierId: supplierSm.id,
      expenseCategoryId: catAdminSm.id,
      paymentType: "EFECTIVO",
      accountId: cajaSm.id,
      purchaseDate: new Date("2026-11-11T12:00:00-06:00"),
      amount: 400,
      lines: [],
      concept: "Gasto Servomotores",
      purchaseKind: "GENERAL",
    });
    assert.equal(smGeneral.status, "PENDIENTE_VALIDAR");
    assert.equal(smGeneral.movementId, null);

    const smRefList = await createShoppingList(aleSm, { kind: "REFACCION", supplierId: supplierSm.id });
    assert.equal(smRefList.kind, "REFACCION");
  });
});
