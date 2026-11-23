import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { formatMexicoDateTimeLocalValue, parseMexicoDateTimeInput } from "./form";
import { can } from "./permissions";
import { addBusinessDays } from "./sla";

describe("fecha local CDMX para formularios de órdenes", () => {
  it("parsea y formatea datetime-local en hora de Ciudad de México", () => {
    const parsed = parseMexicoDateTimeInput("2026-10-02T15:30");
    assert.ok(parsed);
    assert.equal(parsed.toISOString(), new Date("2026-10-02T15:30:00-06:00").toISOString());
    assert.equal(formatMexicoDateTimeLocalValue(parsed), "2026-10-02T15:30");
  });

  it("GERENTE_OPERATIVO_SYSTRON mantiene client.create deshabilitado", () => {
    assert.equal(can("GERENTE_OPERATIVO_SYSTRON", "client.create", "SYSTRON"), false);
    assert.equal(can("GERENTE_OPERATIVO_SYSTRON", "attention.create", "SYSTRON"), true);
    assert.equal(can("GERENTE_OPERATIVO_SYSTRON", "custody.confirm", "SYSTRON"), true);
  });
});

describe("órdenes desde Gerente Operativo SYSTRON: vendedor, folio anterior y misma fecha", () => {
  it("asigna sellerUserId sin alterar cliente, conserva folios consecutivos y propaga la fecha al ingreso y SLA", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sygos-samuel-order-"));
    process.env.DATABASE_URL = `file:${join(dir, "test.db")}`;
    const { execSync } = await import("child_process");
    execSync("npx prisma db push --skip-generate", {
      cwd: join(import.meta.dirname, "../.."),
      env: process.env,
      stdio: "ignore",
    });

    const { prisma } = await import("./db");
    const { createAttention, createEqui, registerMovement, startService } = await import("./equipment-service");
    const { listActiveServicios } = await import("./servicios-supervisor");
    const { ensureQuoteFromCase } = await import("./quotes");

    const systron = await prisma.company.create({ data: { code: "SYSTRON", name: "SYSTRON", inventoryEnabled: true } });
    const servomotores = await prisma.company.create({ data: { code: "SERVOMOTORES", name: "Servomotores" } });

    const samuel = await prisma.user.create({
      data: { username: "samuel", name: "Samuel", passwordHash: "x", role: "GERENTE_OPERATIVO_SYSTRON", companyId: systron.id },
    });
    const sellerA = await prisma.user.create({
      data: { username: "ventas-a", name: "Vendedor A", passwordHash: "x", role: "VENTAS", companyId: systron.id },
    });
    const sellerB = await prisma.user.create({
      data: { username: "ventas-b", name: "Vendedor B", passwordHash: "x", role: "VENTAS", companyId: systron.id },
    });
    const tech = await prisma.user.create({
      data: { username: "tec-1", name: "Técnico 1", passwordHash: "x", role: "TECNICO", companyId: systron.id },
    });
    const gerenteSm = await prisma.user.create({
      data: { username: "gerente-sm", name: "Gerente SM", passwordHash: "x", role: "GERENTE_OPERATIVO_SERVOMOTORES", companyId: servomotores.id },
    });

    const client = await prisma.client.create({
      data: { companyId: systron.id, name: "Industrias Alpha", ownerUserId: sellerA.id, active: true, isSystem: false },
    });
    const priority = await prisma.priority.create({
      data: { companyId: systron.id, attentionType: "DIAGNOSTICO", equipmentKind: "EQUI", name: "Normal", slaMaxDays: 3, active: true },
    });

    const actor = {
      userId: samuel.id,
      role: "GERENTE_OPERATIVO_SYSTRON",
      activeCompanyId: systron.id,
      activeCompanyCode: "SYSTRON",
    };

    await assert.rejects(
      () =>
        startService(actor, {
          attentionType: "DIAGNOSTICO",
          clientId: client.id,
          newClientName: null,
          contactName: null,
          equipmentId: null,
          equipmentKind: "EQUI",
          model: "ATV320",
          typeName: "Variador",
          brandName: "Schneider",
          serial: "SER-1",
          priorityId: priority.id,
          reportedFault: "Falla de prueba",
          antecedent: null,
          originalCaseId: null,
          initialLog: null,
          sellerUserId: tech.id,
        }),
      /vendedor activo válido/,
    );

    await assert.rejects(
      () =>
        startService(actor, {
          attentionType: "DIAGNOSTICO",
          clientId: client.id,
          newClientName: null,
          contactName: null,
          equipmentId: null,
          equipmentKind: "EQUI",
          model: "ATV320",
          typeName: "Variador",
          brandName: "Schneider",
          serial: "SER-1",
          priorityId: priority.id,
          reportedFault: "Falla de prueba",
          antecedent: null,
          originalCaseId: null,
          initialLog: null,
          sellerUserId: gerenteSm.id,
        }),
      /vendedor activo válido/,
    );

    const customDate = parseMexicoDateTimeInput("2026-10-02T15:30")!;
    const att1 = await startService(actor, {
      attentionType: "DIAGNOSTICO",
      clientId: client.id,
      newClientName: null,
      contactName: null,
      equipmentId: null,
      equipmentKind: "EQUI",
      model: "ATV320",
      typeName: "Variador",
      brandName: "Schneider",
      serial: "SER-001",
      priorityId: priority.id,
      reportedFault: "No enciende",
      antecedent: null,
      originalCaseId: null,
      initialLog: "Migrado del sistema previo",
      sellerUserId: sellerB.id,
      legacyFolio: "SYS-ANT-450",
      createdAt: customDate,
      confirmPhysicalReceipt: true,
    });

    const refreshedClient = await prisma.client.findUnique({ where: { id: client.id } });
    assert.equal(refreshedClient!.ownerUserId, sellerA.id);

    const storedAtt1 = await prisma.attention.findUnique({
      where: { id: att1.id },
      include: { equipment: true, technicalCases: true, movements: true },
    });
    assert.ok(storedAtt1);
    assert.equal(storedAtt1.sellerUserId, sellerB.id);
    assert.equal(storedAtt1.legacyFolio, "SYS-ANT-450");
    assert.equal(storedAtt1.createdAt.toISOString(), customDate.toISOString());
    assert.equal(storedAtt1.slaStartedAt?.toISOString(), customDate.toISOString());
    assert.equal(storedAtt1.equipment.folio, "EQUI-1");
    assert.equal(storedAtt1.equipment.custody, "EN_RESGUARDO");
    assert.equal(storedAtt1.movements.length, 1);
    assert.equal(storedAtt1.movements[0]!.folio, "ENT-1");
    assert.equal(storedAtt1.movements[0]!.occurredAt.toISOString(), customDate.toISOString());

    const dx1 = storedAtt1.technicalCases.find((c) => c.kind === "DIAGNOSTICO")!;
    const os1 = storedAtt1.technicalCases.find((c) => c.kind === "OS")!;
    assert.equal(dx1.folio, "DX-1");
    assert.equal(os1.folio, "OS-1");
    assert.equal(dx1.createdAt.toISOString(), customDate.toISOString());
    assert.equal(os1.createdAt.toISOString(), customDate.toISOString());
    assert.equal(dx1.slaDueAt?.toISOString(), addBusinessDays(customDate, 3).toISOString());

    const attHistory = await prisma.functionalHistory.findMany({
      where: { entityType: "ATENCION", entityId: att1.id },
      orderBy: { createdAt: "asc" },
    });
    assert.ok(attHistory.some((h) => h.action === "ALTA" && h.createdAt.toISOString() === customDate.toISOString()));
    assert.ok(attHistory.some((h) => h.action === "ENTRADA_FISICA" && h.createdAt.toISOString() === customDate.toISOString()));

    // La cotización derivada toma el sellerUserId elegido en la atención
    await prisma.technicalCase.update({ where: { id: dx1.id }, data: { status: "VALIDADO", quotePending: true } });
    const quote = await ensureQuoteFromCase({ userId: samuel.id, activeCompanyId: systron.id }, dx1.id);
    assert.equal(quote.sellerUserId, sellerB.id);

    // La bandeja muestra sellerName y legacyFolio, y busca por legacyFolio
    const bandeja = await listActiveServicios(systron.id, "SYS-ANT-450", { hideMotors: true });
    assert.equal(bandeja.length, 1);
    const row = bandeja[0]!;
    assert.equal(row.kind, "servicio");
    if (row.kind === "servicio") {
      assert.equal(row.sellerName, "Vendedor B");
      assert.equal(row.legacyFolio, "SYS-ANT-450");
      assert.equal(row.diagnosisFolio, "DX-1");
    }

    // Segunda orden sin ingreso inmediato; el ingreso físico desde equipo usa la hora del servidor (no la de captura)
    const secondDate = parseMexicoDateTimeInput("2026-10-08T09:15")!;
    const att2 = await startService(actor, {
      attentionType: "DIAGNOSTICO",
      clientId: client.id,
      newClientName: null,
      contactName: null,
      equipmentId: null,
      equipmentKind: "EQUI",
      model: "SINAMICS G120",
      typeName: "Variador",
      brandName: "Siemens",
      serial: "SER-002",
      priorityId: priority.id,
      reportedFault: "Sobrecorriente",
      antecedent: null,
      originalCaseId: null,
      initialLog: null,
      sellerUserId: sellerA.id,
      legacyFolio: "SYS-ANT-451",
      createdAt: secondDate,
      confirmPhysicalReceipt: false,
    });
    const eq2 = await prisma.equipment.findUniqueOrThrow({ where: { id: att2.equipmentId } });
    assert.equal(eq2.folio, "EQUI-2");
    assert.equal(eq2.custody, "SIN_CUSTODIA");

    const movementStartMs = Date.now();
    await registerMovement(actor, {
      equipmentId: eq2.id,
      version: eq2.version,
      kind: "ENTRADA",
      reason: "Diagnóstico",
      occurredAt: secondDate,
      receiverName: null,
      deliveryMode: null,
      contact: null,
      enablingDocument: null,
      supplierId: null,
      notes: null,
    });

    const storedAtt2 = await prisma.attention.findUniqueOrThrow({
      where: { id: att2.id },
      include: { technicalCases: true, movements: true },
    });
    const dx2 = storedAtt2.technicalCases.find((c) => c.kind === "DIAGNOSTICO")!;
    const entrada2 = storedAtt2.movements[0]!;
    assert.equal(dx2.folio, "DX-2");
    assert.equal(entrada2.folio, "ENT-2");
    assert.equal(storedAtt2.createdAt.toISOString(), secondDate.toISOString());
    assert.notEqual(storedAtt2.slaStartedAt?.toISOString(), secondDate.toISOString());
    assert.equal(storedAtt2.slaStartedAt?.toISOString(), entrada2.occurredAt.toISOString());
    assert.ok(entrada2.occurredAt.getTime() >= movementStartMs - 2000);
    assert.ok(entrada2.occurredAt.getTime() <= Date.now() + 2000);
    assert.equal(dx2.slaDueAt?.toISOString(), addBusinessDays(entrada2.occurredAt, 3).toISOString());

    const admin = await prisma.user.create({
      data: { username: "admin-lf", name: "Admin LF", passwordHash: "x", role: "ADMINISTRADOR", companyId: systron.id },
    });
    const adminActor = {
      userId: admin.id,
      role: "ADMINISTRADOR",
      activeCompanyId: systron.id,
      activeCompanyCode: "SYSTRON",
    };
    const legacyBase = {
      attentionType: "DIAGNOSTICO" as const,
      clientId: client.id,
      newClientName: null,
      contactName: null,
      equipmentId: null,
      equipmentKind: "EQUI" as const,
      model: "ATV320",
      typeName: "Variador",
      brandName: "Schneider",
      priorityId: priority.id,
      reportedFault: "Prueba restricción legacy",
      antecedent: null,
      originalCaseId: null,
      initialLog: null,
    };
    await assert.rejects(
      () => startService(adminActor, { ...legacyBase, serial: "SER-LF-TAMPER", legacyFolio: "SYS-TAMPER" }),
      /folio del sistema anterior/,
    );
    const adminAtt = await startService(adminActor, { ...legacyBase, serial: "SER-LF-OK" });
    const adminStored = await prisma.attention.findUniqueOrThrow({ where: { id: adminAtt.id } });
    assert.equal(adminStored.legacyFolio, null);

    const equiSoloFecha = await createEqui(adminActor, {
      clientId: client.id,
      typeName: "Variador",
      brandName: "ABB",
      model: "ACS580",
      description: null,
      serial: "SER-DATE",
    });
    const tamperedCapture = parseMexicoDateTimeInput("2015-06-01T12:00")!;
    await assert.rejects(
      () =>
        createAttention(adminActor, {
          equipmentId: equiSoloFecha.id,
          attentionType: "DIAGNOSTICO",
          priorityId: priority.id,
          reportedFault: "Prueba fecha",
          antecedent: null,
          originalCaseId: null,
          createdAt: tamperedCapture,
          version: equiSoloFecha.version,
        }),
      /automáticamente/,
    );
  });
});
