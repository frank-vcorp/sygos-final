import assert from "node:assert/strict";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { describe, it } from "node:test";

describe("folios", () => {
  it("numera por empresa y comparte solo MOT", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sygos-folio-"));
    process.env.DATABASE_URL = `file:${join(dir, "test.db")}`;
    const { PrismaClient } = await import("@prisma/client");
    const { execSync } = await import("child_process");
    execSync("npx prisma db push --skip-generate", {
      cwd: join(import.meta.dirname, "../.."),
      env: process.env,
      stdio: "ignore",
    });
    const prisma = new PrismaClient();
    const { allocateFolio } = await import("./folios");
    const a = await prisma.company.create({ data: { code: "A", name: "A" } });
    const b = await prisma.company.create({ data: { code: "B", name: "B" } });
    assert.equal(await allocateFolio(a.id, "COT"), "COT-1");
    assert.equal(await allocateFolio(a.id, "COT"), "COT-2");
    assert.equal(await allocateFolio(b.id, "COT"), "COT-1");
    assert.equal(await allocateFolio(a.id, "MOT"), "MOT-1");
    assert.equal(await allocateFolio(b.id, "MOT"), "MOT-2");
    await prisma.$disconnect();
  });

  it("formatServiceFolio usa prefijo visible sin SRV", async () => {
    const { formatServiceFolio } = await import("./folios");
    assert.equal(formatServiceFolio("DX", 102), "DX-102");
    assert.equal(formatServiceFolio("FAC", 102), "FAC-102");
  });

  it("bootstrap SRV continúa después de folio legacy DX-1", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sygos-srv-boot-"));
    process.env.DATABASE_URL = `file:${join(dir, "test.db")}`;
    const { execSync } = await import("child_process");
    execSync("npx prisma db push --skip-generate", {
      cwd: join(import.meta.dirname, "../.."),
      env: process.env,
      stdio: "ignore",
    });

    const { prisma } = await import("./db");
    const { openCase } = await import("./technical");

    const company = await prisma.company.create({ data: { code: "LEG", name: "Legacy" } });
    const user = await prisma.user.create({
      data: {
        username: "legacy-test",
        name: "Test",
        passwordHash: "x",
        role: "CEO",
        companyId: company.id,
      },
    });
    const client = await prisma.client.create({
      data: {
        companyId: company.id,
        name: "Cliente",
        active: true,
        isSystem: false,
        requiresInvoice: true,
        rfc: "XAXX010101000",
        cfdiUse: "G03",
        paymentMethod: "PUE",
      },
    });
    const equipment = await prisma.equipment.create({
      data: {
        folio: "EQUI-legacy-1",
        kind: "EQUI",
        originCompanyId: company.id,
        clientId: client.id,
        model: "M",
        custody: "EN_RESGUARDO",
        holderCompanyId: company.id,
        createdByUserId: user.id,
      },
    });
    const legacyAttention = await prisma.attention.create({
      data: {
        equipmentId: equipment.id,
        originCompanyId: company.id,
        serviceCompanyId: company.id,
        adminClientId: client.id,
        attentionType: "DIAGNOSTICO",
        priorityName: "Normal",
        prioritySlaMaxDays: 5,
        reportedFault: "Previo",
        slaStartedAt: new Date(),
      },
    });
    await prisma.technicalCase.create({
      data: {
        folio: "DX-1",
        attentionId: legacyAttention.id,
        equipmentId: equipment.id,
        serviceCompanyId: company.id,
        kind: "DIAGNOSTICO",
        status: "VALIDADO",
        quotePending: false,
      },
    });

    const equipment2 = await prisma.equipment.create({
      data: {
        folio: "EQUI-legacy-2",
        kind: "EQUI",
        originCompanyId: company.id,
        clientId: client.id,
        model: "M",
        custody: "EN_RESGUARDO",
        holderCompanyId: company.id,
        createdByUserId: user.id,
      },
    });
    const newAttention = await prisma.attention.create({
      data: {
        equipmentId: equipment2.id,
        originCompanyId: company.id,
        serviceCompanyId: company.id,
        adminClientId: client.id,
        attentionType: "DIAGNOSTICO",
        priorityName: "Normal",
        prioritySlaMaxDays: 5,
        reportedFault: "Nueva",
        slaStartedAt: new Date(),
      },
    });

    const opened = await openCase(newAttention.id, new Date());
    assert.ok(opened);
    assert.equal(opened!.folio, "DX-2");
    const osStub = await prisma.technicalCase.findFirst({
      where: { attentionId: newAttention.id, kind: "OS", spawnedFromId: opened!.id },
    });
    assert.ok(osStub);
    assert.equal(osStub!.folio, "OS-2");

    await prisma.$disconnect();
  });

  it("folio unificado SRV, express, una COT y una FAC por servicio", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sygos-srv-all-"));
    process.env.DATABASE_URL = `file:${join(dir, "test.db")}`;
    const { execSync } = await import("child_process");
    execSync("npx prisma db push --skip-generate", {
      cwd: join(import.meta.dirname, "../.."),
      env: process.env,
      stdio: "ignore",
    });

    const { prisma } = await import("./db");
    const {
      allocateServiceNumber,
      serviceFolioForAttention,
      ensureAttentionServiceNumber,
    } = await import("./folios");
    const { openCase } = await import("./technical");
    const { ensureQuoteFromCase } = await import("./quotes");
    const { requestFromQuote } = await import("./billing");

    const company = await prisma.company.create({ data: { code: "SRV", name: "Servicio" } });
    const user = await prisma.user.create({
      data: {
        username: "srv-test",
        name: "Test",
        passwordHash: "x",
        role: "CEO",
        companyId: company.id,
      },
    });
    const client = await prisma.client.create({
      data: {
        companyId: company.id,
        name: "Cliente",
        active: true,
        isSystem: false,
        requiresInvoice: true,
        rfc: "XAXX010101000",
        cfdiUse: "G03",
        paymentMethod: "PUE",
      },
    });
    const equipment = await prisma.equipment.create({
      data: {
        folio: "EQUI-srv-1",
        kind: "EQUI",
        originCompanyId: company.id,
        clientId: client.id,
        model: "M",
        custody: "EN_RESGUARDO",
        holderCompanyId: company.id,
        createdByUserId: user.id,
      },
    });

    const attention = await prisma.attention.create({
      data: {
        equipmentId: equipment.id,
        originCompanyId: company.id,
        serviceCompanyId: company.id,
        adminClientId: client.id,
        attentionType: "DIAGNOSTICO",
        priorityName: "Normal",
        prioritySlaMaxDays: 5,
        reportedFault: "Falla",
        slaStartedAt: new Date(),
      },
    });

    const n = await allocateServiceNumber(company.id);
    assert.equal(n, 1);
    await prisma.attention.update({ where: { id: attention.id }, data: { serviceNumber: n } });

    assert.equal(await serviceFolioForAttention(attention.id, company.id, "DX"), "DX-1");
    assert.equal(await serviceFolioForAttention(attention.id, company.id, "OS"), "OS-1");
    assert.equal(await serviceFolioForAttention(attention.id, company.id, "COT"), "COT-1");
    assert.equal(await serviceFolioForAttention(attention.id, company.id, "FAC"), "FAC-1");

    await prisma.$transaction(async (tx) => {
      assert.equal(await ensureAttentionServiceNumber(attention.id, company.id, tx), 1);
    });

    const expressEquipment = await prisma.equipment.create({
      data: {
        folio: "EQUI-express",
        kind: "EQUI",
        originCompanyId: company.id,
        clientId: client.id,
        model: "M",
        custody: "EN_RESGUARDO",
        holderCompanyId: company.id,
        createdByUserId: user.id,
      },
    });
    const expressAttention = await prisma.attention.create({
      data: {
        equipmentId: expressEquipment.id,
        originCompanyId: company.id,
        serviceCompanyId: company.id,
        adminClientId: client.id,
        attentionType: "REPARACION",
        priorityName: "Express",
        prioritySlaMaxDays: 0,
        reportedFault: "Falla express",
        slaStartedAt: new Date(),
        createdByUserId: user.id,
      },
    });
    const osCase = await openCase(expressAttention.id, new Date());
    assert.ok(osCase);
    assert.match(osCase!.folio, /^OS-2$/);
    const dxLate = await openCase(expressAttention.id, new Date());
    assert.ok(dxLate);
    assert.equal(dxLate!.folio, "DX-2");
    assert.equal(osCase!.folio, "OS-2");

    const dx = await prisma.technicalCase.create({
      data: {
        folio: "DX-7",
        attentionId: attention.id,
        equipmentId: equipment.id,
        serviceCompanyId: company.id,
        kind: "DIAGNOSTICO",
        status: "VALIDADO",
        quotePending: true,
      },
    });
    const osSpawn = await prisma.technicalCase.create({
      data: {
        folio: "OS-7",
        attentionId: attention.id,
        equipmentId: equipment.id,
        serviceCompanyId: company.id,
        kind: "OS",
        status: "EN_ESPERA",
        spawnedFromId: dx.id,
        quotePending: true,
      },
    });
    await prisma.attention.update({ where: { id: attention.id }, data: { serviceNumber: 7 } });

    const actor = { userId: user.id, activeCompanyId: company.id };
    const cot = await ensureQuoteFromCase(actor, dx.id);
    assert.equal((await ensureQuoteFromCase(actor, osSpawn.id)).id, cot.id);
    assert.equal(cot.folio, "COT-7");
    assert.equal(
      await prisma.quote.count({
        where: { companyId: company.id, technicalCaseId: { in: [dx.id, osSpawn.id] } },
      }),
      1,
    );

    const quote = await prisma.quote.create({
      data: {
        folio: "COT-3",
        companyId: company.id,
        clientId: client.id,
        quoteType: "DIAGNOSTICO",
        status: "AUTORIZADA",
        equipmentId: equipment.id,
        technicalCaseId: dx.id,
        lines: { create: [{ concept: "Diagnóstico", quantity: 1, unitPrice: 1000, authorized: true }] },
      },
    });
    await prisma.billingDocument.create({
      data: {
        folio: "FAC-3",
        companyId: company.id,
        kind: "FACTURA",
        status: "SOLICITADA",
        clientId: client.id,
        quoteId: quote.id,
        technicalCaseId: dx.id,
        concept: "Previo",
        subtotal: 862.07,
        iva: 137.93,
        total: 1000,
      },
    });
    const billingActor = { userId: user.id, role: "CEO" as const, activeCompanyId: company.id, activeCompanyCode: "SRV" };
    await assert.rejects(
      () => requestFromQuote(billingActor, quote.id, "FACTURA", 500),
      /ya tiene una factura/i,
    );

    await prisma.$disconnect();
  });

  it("openCase backfill OS stub en atención legacy solo con DX", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sygos-os-backfill-"));
    process.env.DATABASE_URL = `file:${join(dir, "test.db")}`;
    const { execSync } = await import("child_process");
    execSync("npx prisma db push --skip-generate", {
      cwd: join(import.meta.dirname, "../.."),
      env: process.env,
      stdio: "ignore",
    });

    const { prisma } = await import("./db");
    const { openCase } = await import("./technical");

    const company = await prisma.company.create({ data: { code: "BF", name: "Backfill" } });
    const user = await prisma.user.create({
      data: {
        username: "bf-test",
        name: "Test",
        passwordHash: "x",
        role: "CEO",
        companyId: company.id,
      },
    });
    const client = await prisma.client.create({
      data: {
        companyId: company.id,
        name: "Cliente",
        active: true,
        isSystem: false,
        requiresInvoice: true,
        rfc: "XAXX010101000",
        cfdiUse: "G03",
        paymentMethod: "PUE",
      },
    });
    const equipment = await prisma.equipment.create({
      data: {
        folio: "EQUI-bf-1",
        kind: "EQUI",
        originCompanyId: company.id,
        clientId: client.id,
        model: "M",
        custody: "EN_RESGUARDO",
        holderCompanyId: company.id,
        createdByUserId: user.id,
      },
    });
    const legacyAttention = await prisma.attention.create({
      data: {
        equipmentId: equipment.id,
        originCompanyId: company.id,
        serviceCompanyId: company.id,
        adminClientId: client.id,
        attentionType: "DIAGNOSTICO",
        priorityName: "Normal",
        prioritySlaMaxDays: 5,
        reportedFault: "Legacy sin OS",
        slaStartedAt: new Date(),
      },
    });
    const dxOnly = await prisma.technicalCase.create({
      data: {
        folio: "DX-1",
        attentionId: legacyAttention.id,
        equipmentId: equipment.id,
        serviceCompanyId: company.id,
        kind: "DIAGNOSTICO",
        status: "EN_DIAGNOSTICO",
        quotePending: false,
      },
    });

    const result = await openCase(legacyAttention.id, new Date());
    assert.ok(result);
    assert.equal(result!.id, dxOnly.id);

    const osStub = await prisma.technicalCase.findFirst({
      where: { attentionId: legacyAttention.id, kind: "OS", spawnedFromId: dxOnly.id },
    });
    assert.ok(osStub);
    assert.equal(osStub!.folio, "OS-1");

    const synced = await prisma.attention.findUnique({ where: { id: legacyAttention.id } });
    assert.equal(synced!.serviceNumber, 1);

    await prisma.$disconnect();
  });
});
