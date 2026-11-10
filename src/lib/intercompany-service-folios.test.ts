import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

describe("folios de diagnóstico por empresa", () => {
  it("un motor de Systron ejecutado en Servomotores tiene dos folios distintos", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sygos-ic-dx-"));
    process.env.DATABASE_URL = `file:${join(dir, "test.db")}`;
    const { execSync } = await import("child_process");
    execSync("npx prisma db push --skip-generate", {
      cwd: join(import.meta.dirname, "../.."),
      env: process.env,
      stdio: "ignore",
    });
    const { prisma } = await import("./db");
    const { displayCompanyCaseFolio, ensureOriginCompanyServiceNumber, revealAuthorizedIntercompanyOrders } = await import("./folios");
    const { openCase } = await import("./technical");
    const { ensureQuoteFromCase } = await import("./quotes");
    const { listActiveServicios } = await import("./servicios-supervisor");

    const systron = await prisma.company.create({ data: { code: "SYSTRON", name: "Systron" } });
    const servomotores = await prisma.company.create({ data: { code: "SERVOMOTORES", name: "Servomotores" } });
    await prisma.folioSequence.create({ data: { companyId: systron.id, series: "SRV", nextNumber: 4 } });
    await prisma.folioSequence.create({ data: { companyId: servomotores.id, series: "SRV", nextNumber: 3 } });
    const diego = await prisma.user.create({
      data: { username: "diego-dx", name: "Diego", passwordHash: "x", role: "GERENTE_OPERATIVO_SERVOMOTORES", companyId: servomotores.id },
    });
    const client = await prisma.client.create({
      data: {
        companyId: systron.id,
        name: "Aceros del norte",
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
    const motor = await prisma.equipment.create({
      data: {
        folio: "MOT-3",
        kind: "MOT",
        typeName: "MOTOR",
        brandName: "SEW",
        originCompanyId: systron.id,
        clientId: client.id,
        model: "DRN",
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
        priorityName: "Normal",
        prioritySlaMaxDays: 5,
        reportedFault: "No arranca",
        status: "EN_PROCESO",
        slaStartedAt: new Date(),
      },
    });

    const dx = await openCase(attention.id, new Date());
    assert.ok(dx);
    assert.equal(dx!.folio, "DX-3");
    const stored = await prisma.attention.findUnique({ where: { id: attention.id } });
    assert.equal(stored!.serviceNumber, 3);
    assert.equal(stored!.originServiceNumber, 4);
    assert.equal(displayCompanyCaseFolio(dx!.folio, stored!, servomotores.id), "DX-3");
    assert.equal(displayCompanyCaseFolio(dx!.folio, stored!, systron.id), "DX-4");
    assert.notEqual(
      displayCompanyCaseFolio(dx!.folio, stored!, systron.id),
      displayCompanyCaseFolio(dx!.folio, stored!, servomotores.id),
    );

    const os = await prisma.technicalCase.findFirst({ where: { attentionId: attention.id, kind: "OS" } });
    assert.equal(os!.folio, "OS-3");
    assert.equal(displayCompanyCaseFolio(os!.folio, stored!, systron.id), "OS-4");

    const systronRows = await listActiveServicios(systron.id, "", { originMotors: true, equipmentKind: "MOT" });
    const servRows = await listActiveServicios(servomotores.id, "", { equipmentKind: "MOT" });
    const folioOf = (rows: typeof systronRows, equipmentId: string) => {
      const row = rows.find((item) => item.kind === "servicio" && item.equipmentId === equipmentId);
      return row && row.kind === "servicio" ? row.diagnosisFolio : null;
    };
    assert.equal(folioOf(systronRows, motor.id), "DX-4");
    assert.equal(folioOf(servRows, motor.id), "DX-3");
    const clientOf = (rows: typeof systronRows, equipmentId: string) => {
      const row = rows.find((item) => item.kind === "servicio" && item.equipmentId === equipmentId);
      return row && row.kind === "servicio" ? row.clientName : null;
    };
    assert.equal(clientOf(systronRows, motor.id), "Aceros del norte");
    assert.equal(clientOf(servRows, motor.id), "SYSTRON");

    await prisma.technicalCase.update({ where: { id: dx!.id }, data: { status: "VALIDADO", quotePending: true } });
    const workshopQuote = await ensureQuoteFromCase({ userId: diego.id, activeCompanyId: servomotores.id }, dx!.id);
    const mirror = await prisma.quote.findFirst({ where: { companyId: systron.id, linkedQuoteId: workshopQuote.id } });
    assert.equal(workshopQuote.folio, "COT-3");
    assert.equal(workshopQuote.clientId, adminClient.id);
    assert.equal(mirror!.folio, "COT-4");
    assert.equal(mirror!.clientId, client.id);
    assert.equal(mirror!.technicalCaseId, dx!.id);
    assert.equal(mirror!.equipmentId, motor.id);
    await prisma.quote.update({ where: { id: workshopQuote.id }, data: { clientId: client.id } });
    await listActiveServicios(servomotores.id, "", { equipmentKind: "MOT" });
    const correctedQuote = await prisma.quote.findUnique({ where: { id: workshopQuote.id } });
    const mirrorAfter = await prisma.quote.findUnique({ where: { id: mirror!.id } });
    assert.equal(correctedQuote!.clientId, adminClient.id);
    assert.equal(mirrorAfter!.clientId, client.id);

    const legacyMotor = await prisma.equipment.create({
      data: {
        folio: "MOT-LEGACY",
        kind: "MOT",
        originCompanyId: systron.id,
        clientId: client.id,
        model: "VIEJO",
        custody: "EN_RESGUARDO",
        holderCompanyId: servomotores.id,
        createdByUserId: diego.id,
      },
    });
    const legacy = await prisma.attention.create({
      data: {
        equipmentId: legacyMotor.id,
        originCompanyId: systron.id,
        serviceCompanyId: servomotores.id,
        adminClientId: adminClient.id,
        attentionType: "DIAGNOSTICO",
        priorityName: "Normal",
        prioritySlaMaxDays: 5,
        reportedFault: "Ya existía",
        serviceNumber: 9,
        status: "EN_PROCESO",
        slaStartedAt: new Date(),
      },
    });
    const legacyDx = await prisma.technicalCase.create({
      data: {
        folio: "DX-9",
        attentionId: legacy.id,
        equipmentId: legacyMotor.id,
        serviceCompanyId: servomotores.id,
        kind: "DIAGNOSTICO",
        status: "EN_ESPERA",
      },
    });
    const originNumber = await ensureOriginCompanyServiceNumber(legacy.id);
    const legacyStored = await prisma.attention.findUnique({ where: { id: legacy.id } });
    const legacyCase = await prisma.technicalCase.findUnique({ where: { id: legacyDx.id } });
    assert.equal(legacyCase!.folio, "DX-9");
    assert.equal(legacyStored!.serviceNumber, 9);
    assert.equal(originNumber, 5);
    assert.equal(displayCompanyCaseFolio(legacyCase!.folio, legacyStored!, systron.id), "DX-5");
    assert.equal(displayCompanyCaseFolio(legacyCase!.folio, legacyStored!, servomotores.id), "DX-9");

    const syOs = await prisma.company.create({ data: { code: "SYOS", name: "Systron OS" } });
    const smOs = await prisma.company.create({ data: { code: "SMOS", name: "Servomotores OS" } });
    await prisma.folioSequence.create({ data: { companyId: syOs.id, series: "SRV", nextNumber: 23 } });
    await prisma.folioSequence.create({ data: { companyId: smOs.id, series: "SRV", nextNumber: 3 } });
    const diegoOs = await prisma.user.create({
      data: { username: "diego-os", name: "Diego", passwordHash: "x", role: "GERENTE_OPERATIVO_SERVOMOTORES", companyId: smOs.id },
    });
    const clientOs = await prisma.client.create({
      data: {
        companyId: syOs.id,
        name: "Aceros del norte",
        active: true,
        isSystem: false,
        requiresInvoice: true,
        rfc: "XAXX010101002",
        cfdiUse: "G03",
        paymentMethod: "PUE",
      },
    });
    const adminOs = await prisma.client.create({
      data: {
        companyId: smOs.id,
        name: "SYSTRON",
        active: true,
        isSystem: true,
        requiresInvoice: true,
        rfc: "XAXX010101003",
        cfdiUse: "G03",
        paymentMethod: "PUE",
      },
    });
    const motorOs = await prisma.equipment.create({
      data: {
        folio: "MOT-OS-3",
        kind: "MOT",
        originCompanyId: syOs.id,
        clientId: clientOs.id,
        model: "DRN",
        custody: "EN_RESGUARDO",
        holderCompanyId: smOs.id,
        createdByUserId: diegoOs.id,
      },
    });
    const attentionOs = await prisma.attention.create({
      data: {
        equipmentId: motorOs.id,
        originCompanyId: syOs.id,
        serviceCompanyId: smOs.id,
        adminClientId: adminOs.id,
        attentionType: "DIAGNOSTICO",
        priorityName: "Normal",
        prioritySlaMaxDays: 5,
        reportedFault: "Autorizada",
        sellerUserId: diegoOs.id,
        status: "EN_PROCESO",
        slaStartedAt: new Date(),
      },
    });
    const dxOs = await openCase(attentionOs.id, new Date());
    assert.equal(dxOs!.folio, "DX-3");
    const osBefore = await prisma.technicalCase.findFirst({ where: { attentionId: attentionOs.id, kind: "OS" } });
    assert.equal(osBefore!.folio, "OS-3");
    assert.equal(osBefore!.quotePending, true);
    assert.equal(osBefore!.serviceCompanyId, smOs.id);
    const hidden = await listActiveServicios(syOs.id, "", { originMotors: true, equipmentKind: "MOT" });
    const hiddenRow = hidden.find((item) => item.kind === "servicio" && item.equipmentId === motorOs.id);
    assert.equal(hiddenRow && hiddenRow.kind === "servicio" ? hiddenRow.osFolio : null, null);

    await prisma.quote.create({
      data: {
        folio: "COT-23",
        companyId: syOs.id,
        clientId: clientOs.id,
        quoteType: "DIAGNOSTICO",
        status: "AUTORIZADA",
        equipmentId: motorOs.id,
        technicalCaseId: dxOs!.id,
      },
    });
    await revealAuthorizedIntercompanyOrders();
    const osCases = await prisma.technicalCase.findMany({ where: { attentionId: attentionOs.id, kind: "OS" } });
    assert.equal(osCases.length, 1);
    assert.equal(osCases[0]!.folio, "OS-3");
    assert.equal(osCases[0]!.quotePending, false);
    assert.equal(osCases[0]!.serviceCompanyId, smOs.id);
    const numbered = await prisma.attention.findUnique({ where: { id: attentionOs.id } });
    assert.equal(numbered!.originServiceNumber, 23);
    const systronOsRows = await listActiveServicios(syOs.id, "", { originMotors: true, equipmentKind: "MOT" });
    const servOsRows = await listActiveServicios(smOs.id, "", { equipmentKind: "MOT" });
    const shown = (rows: typeof systronOsRows) => {
      const row = rows.find((item) => item.kind === "servicio" && item.equipmentId === motorOs.id);
      return row && row.kind === "servicio" ? row.osFolio : null;
    };
    assert.equal(shown(systronOsRows), "OS-23");
    assert.equal(shown(servOsRows), "OS-3");

    const motorBlank = await prisma.equipment.create({
      data: {
        folio: "MOT-BLANK",
        kind: "MOT",
        originCompanyId: syOs.id,
        clientId: clientOs.id,
        model: "DRN",
        custody: "EN_RESGUARDO",
        holderCompanyId: smOs.id,
        createdByUserId: diegoOs.id,
      },
    });
    const attentionBlank = await prisma.attention.create({
      data: {
        equipmentId: motorBlank.id,
        originCompanyId: syOs.id,
        serviceCompanyId: smOs.id,
        adminClientId: adminOs.id,
        attentionType: "DIAGNOSTICO",
        priorityName: "Normal",
        prioritySlaMaxDays: 5,
        reportedFault: "Columna vacía",
        status: "EN_PROCESO",
        slaStartedAt: new Date(),
        serviceNumber: 8,
        originServiceNumber: 23,
      },
    });
    const dxBlank = await prisma.technicalCase.create({
      data: {
        folio: "DX-8",
        attentionId: attentionBlank.id,
        equipmentId: motorBlank.id,
        serviceCompanyId: smOs.id,
        kind: "DIAGNOSTICO",
        status: "VALIDADO",
        quotePending: true,
      },
    });
    await prisma.technicalCase.create({
      data: {
        folio: "OS-8",
        attentionId: attentionBlank.id,
        equipmentId: motorBlank.id,
        serviceCompanyId: smOs.id,
        kind: "OS",
        status: "EN_ESPERA",
        spawnedFromId: dxBlank.id,
        quotePending: true,
      },
    });
    await prisma.quote.create({
      data: {
        folio: "COT-BLANK",
        companyId: syOs.id,
        clientId: clientOs.id,
        quoteType: "DIAGNOSTICO",
        status: "AUTORIZADA",
        equipmentId: motorBlank.id,
      },
    });
    const blankRows = await listActiveServicios(syOs.id, "", { originMotors: true, equipmentKind: "MOT" });
    const blank = blankRows.find((item) => item.kind === "servicio" && item.equipmentId === motorBlank.id);
    assert.ok(blank && blank.kind === "servicio");
    assert.equal(blank.diagnosisFolio, "DX-23");
    assert.equal(blank.osFolio, "OS-23");
    assert.equal(blank.osHref?.startsWith("/operacion/"), true);
  });
});
