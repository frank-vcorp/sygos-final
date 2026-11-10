import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

describe("factura de Servomotores al solicitar la del cliente final", () => {
  it("emite a SYSTRON, abre CxC y CxP, y no duplica", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sygos-fac-ic-"));
    process.env.DATABASE_URL = `file:${join(dir, "test.db")}`;
    execSync("npx prisma db push --skip-generate", {
      cwd: join(import.meta.dirname, "../.."),
      env: process.env,
      stdio: "ignore",
    });

    const { prisma } = await import("./db");
    const { requestFromQuote, requestIntercompany } = await import("./billing");

    const systron = await prisma.company.create({ data: { code: "SYSTRON", name: "Systron" } });
    const servomotores = await prisma.company.create({ data: { code: "SERVOMOTORES", name: "Servomotores" } });
    const seller = await prisma.user.create({
      data: { username: "vendedor-ic", name: "Vendedor", passwordHash: "x", role: "VENTAS", companyId: systron.id },
    });
    const gerente = await prisma.user.create({
      data: { username: "gerente-ic", name: "Gerente", passwordHash: "x", role: "GERENTE_OPERATIVO_SERVOMOTORES", companyId: servomotores.id },
    });
    const aceros = await prisma.client.create({
      data: {
        companyId: systron.id,
        name: "Aceros del norte",
        active: true,
        isSystem: false,
        requiresInvoice: true,
        rfc: "XAXX010101000",
        cfdiUse: "G03",
        paymentMethod: "PUE",
        ownerUserId: seller.id,
      },
    });
    const systronClient = await prisma.client.create({
      data: {
        id: "client-intercompany-systron",
        companyId: servomotores.id,
        name: "SYSTRON",
        active: true,
        isSystem: true,
        requiresInvoice: true,
      },
    });
    await prisma.supplier.create({
      data: {
        id: "supplier-intercompany-servomotores",
        companyId: systron.id,
        name: "Servomotores",
        isSystem: true,
        issuesInvoice: true,
      },
    });
    await prisma.billingDocument.create({
      data: {
        folio: "FAC-1",
        companyId: servomotores.id,
        kind: "FACTURA",
        status: "EMITIDA",
        clientId: systronClient.id,
        concept: "Folio ya ocupado",
        subtotal: 100,
        iva: 16,
        total: 116,
      },
    });

    const equipment = await prisma.equipment.create({
      data: {
        folio: "MOT-IC-FAC",
        kind: "MOT",
        originCompanyId: systron.id,
        clientId: aceros.id,
        model: "M",
        custody: "EN_RESGUARDO",
        holderCompanyId: servomotores.id,
        createdByUserId: seller.id,
      },
    });
    const attention = await prisma.attention.create({
      data: {
        equipmentId: equipment.id,
        originCompanyId: systron.id,
        serviceCompanyId: servomotores.id,
        adminClientId: systronClient.id,
        attentionType: "REPARACION",
        priorityName: "Normal",
        prioritySlaMaxDays: 5,
        reportedFault: "Falla",
        status: "ABIERTA",
      },
    });
    const os = await prisma.technicalCase.create({
      data: {
        folio: "OS-9",
        attentionId: attention.id,
        equipmentId: equipment.id,
        serviceCompanyId: servomotores.id,
        kind: "OS",
        status: "TERMINADA",
      },
    });
    const base = await prisma.quote.create({
      data: {
        folio: "COT-SM-9",
        companyId: servomotores.id,
        clientId: systronClient.id,
        quoteType: "REPARACION",
        status: "AUTORIZADA",
        equipmentId: equipment.id,
        technicalCaseId: os.id,
        lines: { create: [{ concept: "Reparación Servomotores", quantity: 1, unitPrice: 1000, authorized: true }] },
      },
    });
    const endQuote = await prisma.quote.create({
      data: {
        folio: "COT-9",
        companyId: systron.id,
        clientId: aceros.id,
        quoteType: "REPARACION",
        status: "AUTORIZADA",
        equipmentId: equipment.id,
        technicalCaseId: os.id,
        linkedQuoteId: base.id,
        sellerUserId: seller.id,
        lines: { create: [{ concept: "Reparación al cliente", quantity: 1, unitPrice: 4000, authorized: true }] },
      },
    });

    const sellerActor = {
      userId: seller.id,
      role: "VENTAS" as const,
      activeCompanyId: systron.id,
      activeCompanyCode: "SYSTRON",
    };
    const [first, second] = await Promise.allSettled([
      requestFromQuote(sellerActor, endQuote.id, "FACTURA", null),
      requestFromQuote(sellerActor, endQuote.id, "FACTURA", null),
    ]);
    assert.equal(first.status, "fulfilled");
    assert.equal(second.status, "fulfilled");
    const endClient = first.status === "fulfilled" ? first.value : null;
    assert.ok(endClient);
    if (first.status === "fulfilled" && second.status === "fulfilled") {
      assert.equal(first.value.id, second.value.id);
    }
    assert.equal(endClient.status, "SOLICITADA");
    assert.equal(endClient.clientId, aceros.id);
    assert.equal(endClient.companyId, systron.id);
    assert.equal(endClient.total, 4640);

    const intercompany = await prisma.billingDocument.findMany({
      where: { kind: "FACTURA_INTERCOMPANIA", quoteId: base.id },
      include: { receivable: true, payable: { include: { supplier: true } } },
    });
    assert.equal(intercompany.length, 1);
    const issued = intercompany[0]!;
    assert.equal(issued.status, "EMITIDA");
    assert.equal(issued.clientId, "client-intercompany-systron");
    assert.equal(issued.companyId, servomotores.id);
    assert.equal(issued.total, 1160);
    assert.notEqual(issued.folio, "FAC-1");
    assert.match(issued.folio, /^FAC-\d+$/);
    assert.equal(issued.receivable?.companyId, servomotores.id);
    assert.equal(issued.receivable?.clientId, systronClient.id);
    assert.equal(issued.receivable?.amount, 1160);
    assert.equal(issued.receivable?.balance, 1160);
    assert.equal(issued.payable?.companyId, systron.id);
    assert.equal(issued.payable?.supplierId, "supplier-intercompany-servomotores");
    assert.equal(issued.payable?.amount, 1160);
    assert.equal(issued.cfdiUseSnapshot, "G03");
    assert.equal(issued.paymentMethodSnapshot, "PPD");

    const fiscalClient = await prisma.client.findUnique({ where: { id: systronClient.id } });
    assert.equal(fiscalClient?.cfdiUse, "G03");
    assert.equal(fiscalClient?.paymentMethod, "PPD");

    await assert.rejects(
      () => requestFromQuote(sellerActor, endQuote.id, "FACTURA", null),
      /ya tiene una factura/i,
    );
    assert.equal(await prisma.billingDocument.count({ where: { kind: "FACTURA_INTERCOMPANIA" } }), 1);
    assert.equal(await prisma.receivable.count({ where: { documentId: issued.id } }), 1);
    assert.equal(await prisma.payable.count({ where: { documentId: issued.id } }), 1);

    const manual = await requestIntercompany(
      { userId: gerente.id, role: "GERENTE_OPERATIVO_SERVOMOTORES", activeCompanyId: servomotores.id, activeCompanyCode: "SERVOMOTORES" },
      base.id,
    );
    assert.equal(manual.id, issued.id);
    assert.equal(manual.status, "EMITIDA");
    assert.equal(await prisma.billingDocument.count({ where: { quoteId: endQuote.id, kind: "FACTURA" } }), 1);

    const otherEquipment = await prisma.equipment.create({
      data: {
        folio: "MOT-IC-FAC-2",
        kind: "MOT",
        originCompanyId: systron.id,
        clientId: aceros.id,
        model: "M2",
        custody: "EN_RESGUARDO",
        holderCompanyId: servomotores.id,
        createdByUserId: seller.id,
      },
    });
    const otherAttention = await prisma.attention.create({
      data: {
        equipmentId: otherEquipment.id,
        originCompanyId: systron.id,
        serviceCompanyId: servomotores.id,
        adminClientId: systronClient.id,
        attentionType: "REPARACION",
        priorityName: "Normal",
        prioritySlaMaxDays: 5,
        reportedFault: "Otra",
        status: "ABIERTA",
      },
    });
    const otherOs = await prisma.technicalCase.create({
      data: {
        folio: "OS-10",
        attentionId: otherAttention.id,
        equipmentId: otherEquipment.id,
        serviceCompanyId: servomotores.id,
        kind: "OS",
        status: "TERMINADA",
      },
    });
    const otherBase = await prisma.quote.create({
      data: {
        folio: "COT-SM-10",
        companyId: servomotores.id,
        clientId: systronClient.id,
        quoteType: "REPARACION",
        status: "AUTORIZADA",
        equipmentId: otherEquipment.id,
        technicalCaseId: otherOs.id,
        lines: { create: [{ concept: "Base manual", quantity: 2, unitPrice: 500, authorized: true }] },
      },
    });
    const otherEnd = await prisma.quote.create({
      data: {
        folio: "COT-10",
        companyId: systron.id,
        clientId: aceros.id,
        quoteType: "REPARACION",
        status: "AUTORIZADA",
        equipmentId: otherEquipment.id,
        technicalCaseId: otherOs.id,
        linkedQuoteId: otherBase.id,
        sellerUserId: seller.id,
        lines: { create: [{ concept: "Precio cliente", quantity: 1, unitPrice: 9000, authorized: true }] },
      },
    });
    const requested = await requestIntercompany(
      { userId: gerente.id, role: "GERENTE_OPERATIVO_SERVOMOTORES", activeCompanyId: servomotores.id, activeCompanyCode: "SERVOMOTORES" },
      otherBase.id,
    );
    assert.equal(requested.status, "SOLICITADA");
    assert.equal(requested.total, 1160);
    assert.equal(await prisma.receivable.count({ where: { documentId: requested.id } }), 0);
    assert.equal(await prisma.payable.count({ where: { documentId: requested.id } }), 0);

    const endRequested = await requestFromQuote(sellerActor, otherEnd.id, "FACTURA", null);
    assert.equal(endRequested.status, "SOLICITADA");
    assert.equal(endRequested.clientId, aceros.id);
    assert.equal(endRequested.total, 10440);
    const issuedManual = await prisma.billingDocument.findUnique({
      where: { id: requested.id },
      include: { receivable: true, payable: true },
    });
    assert.equal(issuedManual?.status, "EMITIDA");
    assert.equal(issuedManual?.total, 1160);
    assert.equal(issuedManual?.receivable?.amount, 1160);
    assert.equal(issuedManual?.payable?.amount, 1160);
    assert.equal(await prisma.billingDocument.count({ where: { kind: "FACTURA_INTERCOMPANIA", quoteId: otherBase.id } }), 1);

    const plain = await prisma.quote.create({
      data: {
        folio: "COT-LIBRE",
        companyId: systron.id,
        clientId: aceros.id,
        quoteType: "REPARACION",
        status: "AUTORIZADA",
        sellerUserId: seller.id,
        lines: { create: [{ concept: "Sin intercompañía", quantity: 1, unitPrice: 200, authorized: true }] },
      },
    });
    const plainDoc = await requestFromQuote(sellerActor, plain.id, "FACTURA", null);
    assert.equal(plainDoc.status, "SOLICITADA");
    assert.equal(plainDoc.total, 232);
    assert.equal(await prisma.billingDocument.count({ where: { kind: "FACTURA_INTERCOMPANIA" } }), 2);

    const folios = await prisma.billingDocument.findMany({
      where: { companyId: servomotores.id },
      select: { folio: true },
    });
    assert.equal(new Set(folios.map((row) => row.folio)).size, folios.length);

    await prisma.$disconnect();
  });
});
