import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { administrativeStatus } from "./servicios-bandeja";
import {
  servicioCotizadaSinAutorizacion,
  servicioPendienteAutorizacion,
  servicioPendienteAutorizacionForSeller,
} from "./sales-panel";
import { listActiveServicios, pickBestQuoteForBandeja } from "./servicios-supervisor";

describe("cotización taller COT-* en panel ventas", () => {
  it("ensureQuoteFromCase asigna vendedor del cliente si la atención no trae sellerUserId", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sygos-cot-legacy-seller-"));
    process.env.DATABASE_URL = `file:${join(dir, "test.db")}`;
    const { execSync } = await import("child_process");
    execSync("npx prisma db push --skip-generate", {
      cwd: join(import.meta.dirname, "../.."),
      env: process.env,
      stdio: "ignore",
    });
    const { prisma } = await import("./db");
    const { ensureQuoteFromCase, setPrices } = await import("./quotes");
    const { initialPriorities } = await import("./priorities");

    const company = await prisma.company.create({ data: { code: "SYT4", name: "Systron" } });
    for (const row of initialPriorities("SYSTRON")) {
      await prisma.priority.create({ data: { companyId: company.id, ...row } });
    }
    const seller = await prisma.user.create({
      data: { username: "vendedor-cot2", name: "V", passwordHash: "x", role: "VENTAS", companyId: company.id },
    });
    const ceo = await prisma.user.create({
      data: { username: "ceo-cot2", name: "CEO", passwordHash: "x", role: "CEO", companyId: company.id },
    });
    const client = await prisma.client.create({
      data: {
        companyId: company.id,
        name: "Cliente COT2",
        ownerUserId: seller.id,
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
        folio: "EQUI-COT2",
        kind: "EQUI",
        originCompanyId: company.id,
        clientId: client.id,
        model: "M",
        custody: "EN_RESGUARDO",
        createdByUserId: seller.id,
      },
    });
    const priority = await prisma.priority.findFirst({
      where: { companyId: company.id, attentionType: "DIAGNOSTICO", name: "Alta" },
    });
    assert.ok(priority);
    const attention = await prisma.attention.create({
      data: {
        equipmentId: equipment.id,
        originCompanyId: company.id,
        serviceCompanyId: company.id,
        adminClientId: client.id,
        attentionType: "DIAGNOSTICO",
        priorityName: priority!.name,
        priorityIncrementPct: priority!.incrementPct,
        prioritySlaMaxDays: priority!.slaMaxDays,
        reportedFault: "Falla",
        sellerUserId: null,
      },
    });
    const dx = await prisma.technicalCase.create({
      data: {
        folio: "DX-COT2",
        attentionId: attention.id,
        equipmentId: equipment.id,
        serviceCompanyId: company.id,
        kind: "DIAGNOSTICO",
        status: "VALIDADO",
        quotePending: false,
      },
    });

    const quote = await ensureQuoteFromCase(
      { userId: ceo.id, activeCompanyId: company.id },
      dx.id,
    );
    assert.match(quote.folio, /^COT-/);
    assert.equal(quote.sellerUserId, seller.id);

    const withLines = await prisma.quote.findUnique({ where: { id: quote.id }, include: { lines: true } });
    await setPrices(
      { userId: ceo.id, role: "CEO", activeCompanyId: company.id, activeCompanyCode: "SYSTRON" },
      quote.id,
      1,
      [{ lineId: withLines!.lines[0]!.id, amount: 1800 }],
      5,
    );

    const priced = await prisma.quote.findUnique({ where: { id: quote.id } });
    assert.equal(priced!.status, "PENDIENTE_DECISION");

    const rows = await listActiveServicios(company.id, "", { clientOwnerUserId: seller.id });
    const servicioRows = rows.filter((row) => row.kind === "servicio");
    assert.ok(servicioRows.length >= 1);
    const match = servicioRows.find((row) => row.quoteFolio === quote.folio);
    assert.ok(match);
    assert.equal(match!.quoteStatus, "PENDIENTE_DECISION");
    assert.equal(servicioPendienteAutorizacionForSeller(match!, seller.id), true);
    assert.equal(servicioCotizadaSinAutorizacion(match!), false);

    const pendiente = administrativeStatus({
      attentionType: "DIAGNOSTICO",
      quoteStatus: "PENDIENTE_DECISION",
      quotePending: false,
      warrantyDecision: null,
    });
    assert.equal(pendiente.label, "Cotizado");
    assert.equal(servicioPendienteAutorizacion({ ...match!, administrative: pendiente }), true);

    await prisma.$disconnect();
  });

  it("pickBestQuoteForBandeja elige COT-2 en decisión aunque exista borrador comercial más nuevo", () => {
    const legacyDecision = {
      id: "legacy",
      folio: "COT-2",
      technicalCaseId: "dx-1",
      equipmentId: "eq-1",
      status: "PENDIENTE_DECISION",
      quoteType: "DIAGNOSTICO",
      discountPct: 0,
      updatedAt: new Date("2026-01-10"),
      sellerUserId: "seller-1",
      lines: [{ quantity: 1, unitPrice: 900, authorized: false }],
    };
    const commercialDraft = {
      ...legacyDecision,
      id: "commercial",
      folio: "COTDX-1",
      technicalCaseId: null,
      status: "PENDIENTE_COTIZAR",
      updatedAt: new Date("2026-03-01"),
      lines: [{ quantity: 1, unitPrice: null, authorized: false }],
    };
    const picked = pickBestQuoteForBandeja([commercialDraft, legacyDecision]);
    assert.equal(picked?.folio, "COT-2");
  });
});
