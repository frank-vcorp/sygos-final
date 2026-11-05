import assert from "node:assert/strict";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { describe, it } from "node:test";

describe("COTDX comercial → almacén", () => {
  it("al autorizar con equipo SIN_CUSTODIA crea atención ABIERTA con originQuoteId", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sygos-cotdx-almacen-"));
    process.env.DATABASE_URL = `file:${join(dir, "test.db")}`;
    const { execSync } = await import("child_process");
    execSync("npx prisma db push --skip-generate", {
      cwd: join(import.meta.dirname, "../.."),
      env: process.env,
      stdio: "ignore",
    });
    const { prisma } = await import("./db");
    const { createSellerQuote, setPrices, decideQuote } = await import("./quotes");
    const { initialPriorities } = await import("./priorities");

    const company = await prisma.company.create({ data: { code: "SYT", name: "Systron" } });
    for (const row of initialPriorities("SYSTRON")) {
      await prisma.priority.create({ data: { companyId: company.id, ...row } });
    }
    const seller = await prisma.user.create({
      data: { username: "vendedor", name: "V", passwordHash: "x", role: "VENTAS", companyId: company.id },
    });
    const ceo = await prisma.user.create({
      data: { username: "ceo", name: "CEO", passwordHash: "x", role: "CEO", companyId: company.id },
    });
    const client = await prisma.client.create({
      data: {
        companyId: company.id,
        name: "Cliente",
        ownerUserId: seller.id,
        active: true,
        isSystem: false,
        requiresInvoice: true,
        rfc: "XAXX010101000",
        cfdiUse: "G03",
        paymentMethod: "PUE",
      },
    });
    const contact = await prisma.contact.create({ data: { clientId: client.id, name: "Contacto", active: true, isPrimary: true } });
    const equipment = await prisma.equipment.create({
      data: {
        folio: "EQUI-1",
        kind: "EQUI",
        originCompanyId: company.id,
        clientId: client.id,
        model: "M",
        custody: "SIN_CUSTODIA",
        createdByUserId: seller.id,
      },
    });
    const priority = await prisma.priority.findFirst({ where: { companyId: company.id, attentionType: "DIAGNOSTICO", name: "Alta" } });
    assert.ok(priority);

    const quote = await createSellerQuote(
      { userId: seller.id, role: "VENTAS", activeCompanyId: company.id, activeCompanyCode: "SYSTRON" },
      {
        clientId: client.id,
        quoteType: "DIAGNOSTICO",
        equipmentId: equipment.id,
        reference: null,
        concepts: [{ concept: "Diagnóstico comercial", quantity: 1 }],
        contactIds: [contact.id],
        priorityId: priority!.id,
      },
    );
    const withLines = await prisma.quote.findUnique({ where: { id: quote.id }, include: { lines: true } });
    await setPrices(
      { userId: ceo.id, role: "CEO", activeCompanyId: company.id, activeCompanyCode: "SYSTRON" },
      quote.id,
      1,
      [{ lineId: withLines!.lines[0]!.id, amount: 3500 }],
    );
    await decideQuote(
      { userId: seller.id, role: "VENTAS", activeCompanyId: company.id, activeCompanyCode: "SYSTRON" },
      quote.id,
      2,
      true,
      [withLines!.lines[0]!.id],
    );

    const updated = await prisma.quote.findUnique({ where: { id: quote.id } });
    assert.equal(updated?.status, "AUTORIZADA_PENDIENTE_EQUIPO");

    const attention = await prisma.attention.findFirst({ where: { originQuoteId: quote.id } });
    assert.ok(attention);
    assert.equal(attention!.equipmentId, equipment.id);
    assert.equal(attention!.status, "ABIERTA");
    assert.equal(attention!.attentionType, "DIAGNOSTICO");
    assert.equal(attention!.priorityName, "Alta");
    assert.equal(attention!.slaStartedAt, null);

    const cases = await prisma.technicalCase.count({ where: { attentionId: attention!.id } });
    assert.equal(cases, 0);

    await prisma.$disconnect();
  });
});
