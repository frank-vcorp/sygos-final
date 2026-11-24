import assert from "node:assert/strict";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { describe, it } from "node:test";
import {
  QUOTE_STATUSES_ALLOWING_LINE_DESCRIPTION_CORRECTION,
  quoteLineDescriptionEditBlockedMessage,
  quoteStatusAllowsLineDescriptionCorrection,
} from "./quotes";

describe("corrección de descripciones de partida (CEO)", () => {
  it("expone estados permitidos para corrección", () => {
    assert.deepEqual(QUOTE_STATUSES_ALLOWING_LINE_DESCRIPTION_CORRECTION, [
      "PENDIENTE_DECISION",
      "AUTORIZADA",
      "NO_AUTORIZADA",
      "AUTORIZADA_PENDIENTE_EQUIPO",
    ]);
    assert.equal(quoteStatusAllowsLineDescriptionCorrection("PENDIENTE_DECISION"), true);
    assert.equal(quoteStatusAllowsLineDescriptionCorrection("AUTORIZADA"), true);
    assert.equal(quoteStatusAllowsLineDescriptionCorrection("PENDIENTE_COTIZAR"), false);
  });

  it("mensaje claro cuando hay comprobante timbrado", () => {
    const msg = quoteLineDescriptionEditBlockedMessage([{ folio: "F-100", fiscalStatus: "TIMBRADA" }]);
    assert.match(msg, /timbrado/);
    assert.match(msg, /descripciones/);
    assert.match(msg, /F-100/);
  });
});

async function setupSystronDb(suffix: string) {
  const dir = mkdtempSync(join(tmpdir(), `sygos-${suffix}-`));
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`;
  const { execSync } = await import("child_process");
  execSync("npx prisma db push --skip-generate", {
    cwd: join(import.meta.dirname, "../.."),
    env: process.env,
    stdio: "ignore",
  });
  const { prisma } = await import("./db");
  const { initialPriorities } = await import("./priorities");
  const company = await prisma.company.create({ data: { code: `T-${suffix}`.slice(0, 16), name: "Systron" } });
  for (const row of initialPriorities("SYSTRON")) {
    await prisma.priority.create({ data: { companyId: company.id, ...row } });
  }
  return { prisma, company };
}

describe("updateQuoteLineDescriptions (integración)", () => {
  it("CEO corrige descripción en PENDIENTE_DECISION", async () => {
    const { prisma, company } = await setupSystronDb("line-desc-ceo");
    const { createSellerQuote, setPrices, updateQuoteLineDescriptions } = await import("./quotes");

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
    const contact = await prisma.contact.create({ data: { clientId: client.id, name: "C", active: true, isPrimary: true } });
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
        concepts: [{ concept: "Diagnóstico", quantity: 1 }],
        contactIds: [contact.id],
        priorityId: priority!.id,
        warrantyMonths: 12,
        paymentCondition: "CONTADO",
      },
    );
    await prisma.quote.update({ where: { id: quote.id }, data: { status: "PENDIENTE_COTIZAR" } });
    const withLines = await prisma.quote.findUnique({ where: { id: quote.id }, include: { lines: true } });
    await setPrices(
      { userId: ceo.id, role: "CEO", activeCompanyId: company.id, activeCompanyCode: "SYSTRON" },
      quote.id,
      withLines!.version,
      [{ lineId: withLines!.lines[0]!.id, amount: 3500 }],
      null,
      null,
      { warrantyMonths: 12, paymentCondition: "CONTADO", creditDays: null },
    );
    const priced = await prisma.quote.findUnique({ where: { id: quote.id }, include: { lines: true } });
    assert.equal(priced!.status, "PENDIENTE_DECISION");
    const unitPriceBefore = priced!.lines[0]!.unitPrice;

    await updateQuoteLineDescriptions(
      { userId: ceo.id, role: "CEO", activeCompanyId: company.id, activeCompanyCode: "SYSTRON" },
      quote.id,
      priced!.version,
      [{ lineId: priced!.lines[0]!.id, concept: "Diagnóstico actualizado" }],
    );
    const after = await prisma.quote.findUnique({ where: { id: quote.id }, include: { lines: true } });
    assert.equal(after!.status, "PENDIENTE_DECISION");
    assert.equal(after!.lines[0]!.concept, "Diagnóstico actualizado");
    assert.equal(after!.lines[0]!.unitPrice, unitPriceBefore);

    await assert.rejects(
      () =>
        updateQuoteLineDescriptions(
          { userId: seller.id, role: "VENTAS", activeCompanyId: company.id, activeCompanyCode: "SYSTRON" },
          quote.id,
          after!.version,
          [{ lineId: after!.lines[0]!.id, concept: "Otro concepto" }],
        ),
      /permiso/,
    );

    await prisma.billingDocument.create({
      data: {
        folio: "FAC-TEST",
        companyId: company.id,
        clientId: client.id,
        quoteId: quote.id,
        kind: "FACTURA",
        status: "EMITIDA",
        fiscalStatus: "TIMBRADA",
        concept: "Servicio",
        subtotal: 3500,
        iva: 560,
        total: 4060,
      },
    });
    await assert.rejects(
      () =>
        updateQuoteLineDescriptions(
          { userId: ceo.id, role: "CEO", activeCompanyId: company.id, activeCompanyCode: "SYSTRON" },
          quote.id,
          after!.version,
          [{ lineId: after!.lines[0]!.id, concept: "Bloqueado" }],
        ),
      /timbrado/,
    );

    await prisma.$disconnect();
  });
});