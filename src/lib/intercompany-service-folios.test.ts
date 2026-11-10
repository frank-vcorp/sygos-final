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
    const { displayCompanyCaseFolio, ensureOriginCompanyServiceNumber } = await import("./folios");
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

    await prisma.technicalCase.update({ where: { id: dx!.id }, data: { status: "VALIDADO", quotePending: true } });
    const workshopQuote = await ensureQuoteFromCase({ userId: diego.id, activeCompanyId: servomotores.id }, dx!.id);
    const mirror = await prisma.quote.findFirst({ where: { companyId: systron.id, linkedQuoteId: workshopQuote.id } });
    assert.equal(workshopQuote.folio, "COT-3");
    assert.equal(mirror!.folio, "COT-4");
    assert.equal(mirror!.technicalCaseId, dx!.id);
    assert.equal(mirror!.equipmentId, motor.id);

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
  });
});
