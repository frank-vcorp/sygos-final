import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

describe("intercompanyReferenceAmount", () => {
  it("prefiere línea base con precio sobre prioridad de atención", async () => {
    const { intercompanyReferenceAmount } = await import("./quotes");
    assert.equal(
      intercompanyReferenceAmount(
        { lines: [{ unitPrice: 15000, basePrice: 10000 }] },
        { priorityPrice: 8000 },
      ),
      10000,
    );
    assert.equal(intercompanyReferenceAmount(null, { priorityPrice: 8000 }), 8000);
    assert.equal(intercompanyReferenceAmount({ lines: [{ unitPrice: null, basePrice: null }] }, null), null);
  });
});

describe("cotización espejo MOT Servomotores → SYSTRON", () => {
  it("ensureQuoteFromCase crea espejo con prioridad congelada y referencia de línea base", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sygos-ic-mirror-"));
    process.env.DATABASE_URL = `file:${join(dir, "test.db")}`;
    const { execSync } = await import("child_process");
    execSync("npx prisma db push --skip-generate", {
      cwd: join(import.meta.dirname, "../.."),
      env: process.env,
      stdio: "ignore",
    });
    const { prisma } = await import("./db");
    const { ensureQuoteFromCase, setPrices, intercompanyReferenceAmount, intercompanyDeliveryDaysDefault } = await import("./quotes");

    const systron = await prisma.company.create({ data: { code: "SYSTRON", name: "Systron" } });
    const servomotores = await prisma.company.create({ data: { code: "SERVOMOTORES", name: "Servomotores" } });
    const diego = await prisma.user.create({
      data: { username: "diego-ic", name: "Diego", passwordHash: "x", role: "GERENTE_OPERATIVO_SERVOMOTORES", companyId: servomotores.id },
    });
    const systronClient = await prisma.client.create({
      data: {
        companyId: systron.id,
        name: "Cliente final",
        active: true,
        isSystem: false,
        requiresInvoice: true,
        rfc: "XAXX010101000",
        cfdiUse: "G03",
        paymentMethod: "PUE",
      },
    });
    const adminClient = await prisma.client.create({
      data: {
        id: "client-ic-systron",
        companyId: servomotores.id,
        name: "SYSTRON interco",
        active: true,
        isSystem: true,
        requiresInvoice: true,
        rfc: "XAXX010101001",
        cfdiUse: "G03",
        paymentMethod: "PUE",
      },
    });
    const motor = await prisma.equipment.create({
      data: {
        folio: "MOT-IC-1",
        kind: "MOT",
        originCompanyId: systron.id,
        clientId: systronClient.id,
        model: "M",
        custody: "EN_RESGUARDO",
        holderCompanyId: servomotores.id,
        createdByUserId: diego.id,
      },
    });
    const attention = await prisma.attention.create({
      data: {
        equipmentId: motor.id,
        originCompanyId: systron.id,
        serviceCompanyId: servomotores.id,
        adminClientId: adminClient.id,
        attentionType: "DIAGNOSTICO",
        priorityName: "Alta",
        priorityPrice: 8000,
        priorityIncrementPct: 10,
        priorityTargetMin: 3,
        priorityTargetMax: 5,
        prioritySlaMaxDays: 7,
        reportedFault: "Falla motor",
        status: "EN_PROCESO",
        slaStartedAt: new Date(),
      },
    });
    const dx = await prisma.technicalCase.create({
      data: {
        folio: "DX-IC-1",
        attentionId: attention.id,
        equipmentId: motor.id,
        serviceCompanyId: servomotores.id,
        kind: "DIAGNOSTICO",
        status: "VALIDADO",
        quotePending: true,
      },
    });

    const servQuote = await ensureQuoteFromCase(
      { userId: diego.id, activeCompanyId: servomotores.id },
      dx.id,
    );
    assert.equal(servQuote.companyId, servomotores.id);

    const mirror = await prisma.quote.findFirst({
      where: { companyId: systron.id, technicalCaseId: dx.id },
      include: { lines: true },
    });
    assert.ok(mirror);
    assert.equal(mirror!.linkedQuoteId, servQuote.id);
    assert.equal(mirror!.priorityName, "Alta");
    assert.equal(mirror!.prioritySlaMaxDays, 7);
    assert.equal(mirror!.deliveryBusinessDays, 7);
    assert.equal(mirror!.quoteType, "DIAGNOSTICO");
    assert.equal(intercompanyDeliveryDaysDefault(mirror!), 7);

    const again = await ensureQuoteFromCase(
      { userId: diego.id, activeCompanyId: servomotores.id },
      dx.id,
    );
    assert.equal(again.id, servQuote.id);
    assert.equal(
      await prisma.quote.count({ where: { companyId: systron.id, technicalCaseId: dx.id } }),
      1,
    );

    const unpricedBase = await prisma.quote.findUnique({ where: { id: servQuote.id }, include: { lines: true } });
    assert.equal(intercompanyReferenceAmount(unpricedBase, null), null);

    const servWithLines = await prisma.quote.findUnique({ where: { id: servQuote.id }, include: { lines: true } });
    await setPrices(
      { userId: diego.id, role: "GERENTE_OPERATIVO_SERVOMOTORES", activeCompanyId: servomotores.id, activeCompanyCode: "SERVOMOTORES" },
      servQuote.id,
      1,
      [{ lineId: servWithLines!.lines[0]!.id, amount: 10000 }],
      10,
    );
    const pricedBase = await prisma.quote.findUnique({ where: { id: servQuote.id }, include: { lines: true } });
    assert.equal(intercompanyReferenceAmount(pricedBase, attention), 10000);
    const mirrorAfterPrice = await prisma.quote.findFirst({ where: { companyId: systron.id, linkedQuoteId: servQuote.id } });
    assert.equal(mirrorAfterPrice!.deliveryBusinessDays, 10);

    const os = await prisma.technicalCase.create({
      data: {
        folio: "OS-IC-1",
        attentionId: attention.id,
        equipmentId: motor.id,
        serviceCompanyId: servomotores.id,
        kind: "OS",
        status: "EN_ESPERA",
        spawnedFromId: dx.id,
        quotePending: true,
      },
    });
    await ensureQuoteFromCase({ userId: diego.id, activeCompanyId: servomotores.id }, os.id);
    const mirrorAfterOs = await prisma.quote.findFirst({ where: { companyId: systron.id, technicalCaseId: dx.id } });
    assert.ok(mirrorAfterOs);
    assert.equal(mirrorAfterOs!.quoteType, "DIAGNOSTICO");
  });

  it("con el DX ya abierto, cotizar aparta el siguiente SRV de Servomotores", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sygos-ic-folio-"));
    process.env.DATABASE_URL = `file:${join(dir, "test.db")}`;
    const { execSync } = await import("child_process");
    execSync("npx prisma db push --skip-generate", {
      cwd: join(import.meta.dirname, "../.."),
      env: process.env,
      stdio: "ignore",
    });
    const { prisma } = await import("./db");
    const { ensureQuoteFromCase } = await import("./quotes");
    const { openCase } = await import("./technical");

    const systron = await prisma.company.create({ data: { code: "SYFOL", name: "Systron folio" } });
    const servomotores = await prisma.company.create({ data: { code: "SMFOL", name: "Servomotores folio" } });
    const diego = await prisma.user.create({
      data: { username: "diego-folio", name: "Diego", passwordHash: "x", role: "GERENTE_OPERATIVO_SERVOMOTORES", companyId: servomotores.id },
    });
    const client = await prisma.client.create({
      data: {
        companyId: systron.id,
        name: "Cliente",
        active: true,
        isSystem: false,
        requiresInvoice: true,
        rfc: "XAXX010101000",
        cfdiUse: "G03",
        paymentMethod: "PUE",
      },
    });
    const adminClient = await prisma.client.create({
      data: {
        companyId: servomotores.id,
        name: "SYSTRON",
        active: true,
        isSystem: true,
        requiresInvoice: true,
        rfc: "XAXX010101001",
        cfdiUse: "G03",
        paymentMethod: "PUE",
      },
    });
    await prisma.folioSequence.create({
      data: { companyId: servomotores.id, series: "SRV", nextNumber: 10 },
    });
    const motor = await prisma.equipment.create({
      data: {
        folio: "MOT-F-10",
        kind: "MOT",
        originCompanyId: systron.id,
        clientId: client.id,
        model: "M",
        custody: "EN_RESGUARDO",
        holderCompanyId: servomotores.id,
        createdByUserId: diego.id,
      },
    });
    const attention = await prisma.attention.create({
      data: {
        equipmentId: motor.id,
        originCompanyId: systron.id,
        serviceCompanyId: servomotores.id,
        adminClientId: adminClient.id,
        attentionType: "DIAGNOSTICO",
        priorityName: "Alta",
        prioritySlaMaxDays: 7,
        reportedFault: "Falla",
        status: "EN_PROCESO",
        slaStartedAt: new Date(),
      },
    });
    const dx = await openCase(attention.id, new Date());
    assert.equal(dx!.folio, "DX-10");
    await prisma.technicalCase.update({ where: { id: dx!.id }, data: { status: "VALIDADO", quotePending: true } });

    const quote = await ensureQuoteFromCase({ userId: diego.id, activeCompanyId: servomotores.id }, dx!.id);
    assert.equal(quote.folio, "COT-10");
    assert.equal((await prisma.quote.findUnique({ where: { id: quote.id } }))!.reservedServiceNumber, 11);

    const again = await ensureQuoteFromCase({ userId: diego.id, activeCompanyId: servomotores.id }, dx!.id);
    assert.equal(again.id, quote.id);
    assert.equal((await prisma.quote.findUnique({ where: { id: quote.id } }))!.reservedServiceNumber, 11);

    const other = await prisma.equipment.create({
      data: {
        folio: "MOT-F-NEXT",
        kind: "MOT",
        originCompanyId: servomotores.id,
        clientId: adminClient.id,
        model: "M",
        custody: "EN_RESGUARDO",
        holderCompanyId: servomotores.id,
        createdByUserId: diego.id,
      },
    });
    const nextAttention = await prisma.attention.create({
      data: {
        equipmentId: other.id,
        originCompanyId: servomotores.id,
        serviceCompanyId: servomotores.id,
        adminClientId: adminClient.id,
        attentionType: "DIAGNOSTICO",
        priorityName: "Normal",
        prioritySlaMaxDays: 5,
        reportedFault: "Otro",
        status: "EN_PROCESO",
        slaStartedAt: new Date(),
      },
    });
    const nextDx = await openCase(nextAttention.id, new Date());
    assert.equal(nextDx!.folio, "DX-12");
  });
});
