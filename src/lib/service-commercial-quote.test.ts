import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { creditNoteAmountForLine } from "./billing";
import { documentHasUnpaidBalance } from "./billing-list-payment-method";

function pushDb(prefix: string) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`;
  execSync("npx prisma db push --skip-generate", {
    cwd: join(import.meta.dirname, "../.."),
    env: process.env,
    stdio: "ignore",
  });
}

describe("nota de crédito por una partida", () => {
  it("propone el importe con IVA de una línea y deja usarlo parcial", () => {
    const suggested = creditNoteAmountForLine({ amount: 1000, taxability: "02", taxIncluded: false }, 5000);
    assert.equal(suggested, 1160);
    const partial = Math.min(suggested, 400);
    assert.equal(partial < suggested, true);
    assert.equal(partial > 0, true);
    assert.equal(creditNoteAmountForLine({ amount: 1000, taxability: "02", taxIncluded: false }, 200), 200);
  });
});

describe("saldo pendiente", () => {
  it("PPD con saldo sigue pendiente y saldo cero no", () => {
    assert.equal(documentHasUnpaidBalance(10), true);
    assert.equal(documentHasUnpaidBalance(0), false);
  });
});

describe("cotización de servicios con precio", () => {
  it("el precio del CEO no crea cotización; el vendedor arma una COTSV y autorizarla no solicita factura", async () => {
    pushDb("sygos-cotsv-");
    const { prisma } = await import("./db");
    const { ensureQuoteFromCase, decideQuote } = await import("./quotes");
    const { assignServiceCeoPrice } = await import("./service-ceo-price");
    const { createServicesExistingQuote, syncServicesExistingQuoteLines } = await import("./service-bundle-quote");
    const { defaultSellerQuoteCommercialTerms } = await import("./quote-commercial-terms");

    const company = await prisma.company.create({ data: { code: "SYSTRON", name: "Systron" } });
    const ceo = await prisma.user.create({
      data: { username: "josue", name: "Josué", passwordHash: "x", role: "CEO", companyId: company.id },
    });
    const seller = await prisma.user.create({
      data: { username: "vendedor", name: "Vendedora", passwordHash: "x", role: "VENTAS", companyId: company.id },
    });
    const otherSeller = await prisma.user.create({
      data: { username: "otro", name: "Otro", passwordHash: "x", role: "VENTAS", companyId: company.id },
    });
    const client = await prisma.client.create({
      data: {
        companyId: company.id,
        name: "Aceros",
        ownerUserId: seller.id,
        active: true,
        isSystem: false,
        requiresInvoice: true,
        rfc: "XAXX010101000",
        cfdiUse: "G03",
        paymentMethod: "PPD",
        creditDays: 30,
      },
    });
    const otherClient = await prisma.client.create({
      data: {
        companyId: company.id,
        name: "Otro cliente",
        ownerUserId: seller.id,
        active: true,
        isSystem: false,
        requiresInvoice: true,
        rfc: "XAXX010101001",
        cfdiUse: "G03",
        paymentMethod: "PPD",
      },
    });
    const contact = await prisma.contact.create({
      data: { clientId: client.id, name: "Compras", active: true, isPrimary: true },
    });

    async function service(folio: string, clientId: string, serviceNumber: number) {
      const equipment = await prisma.equipment.create({
        data: {
          folio: `EQ-${folio}`,
          kind: "EQUI",
          originCompanyId: company.id,
          clientId,
          model: "M",
          custody: "EN_RESGUARDO",
          holderCompanyId: company.id,
          createdByUserId: ceo.id,
        },
      });
      const attention = await prisma.attention.create({
        data: {
          equipmentId: equipment.id,
          originCompanyId: company.id,
          serviceCompanyId: company.id,
          adminClientId: clientId,
          attentionType: "DIAGNOSTICO",
          priorityName: "Normal",
          prioritySlaMaxDays: 5,
          reportedFault: "Falla",
          sellerUserId: seller.id,
          serviceNumber,
          slaStartedAt: new Date(),
          status: "EN_PROCESO",
        },
      });
      return prisma.technicalCase.create({
        data: {
          folio,
          attentionId: attention.id,
          equipmentId: equipment.id,
          serviceCompanyId: company.id,
          kind: "DIAGNOSTICO",
          status: "VALIDADO",
          quotePending: true,
        },
      });
    }

    const dx1 = await service("DX-1", client.id, 1);
    const dx2 = await service("DX-2", client.id, 2);
    const dxOther = await service("DX-9", otherClient.id, 9);
    const ceoActor = { userId: ceo.id, role: "CEO" as const, activeCompanyId: company.id, activeCompanyCode: "SYSTRON" };
    const sellerActor = { userId: seller.id, role: "VENTAS" as const, activeCompanyId: company.id, activeCompanyCode: "SYSTRON" };

    assert.equal(await ensureQuoteFromCase({ userId: ceo.id, activeCompanyId: company.id }, dx1.id), null);
    await ensureQuoteFromCase({ userId: ceo.id, activeCompanyId: company.id }, dx2.id);
    await ensureQuoteFromCase({ userId: ceo.id, activeCompanyId: company.id }, dxOther.id);
    assert.equal(await prisma.quote.count(), 0);
    assert.equal((await prisma.technicalCase.findUnique({ where: { id: dx1.id } }))!.ceoPricePending, true);

    await assignServiceCeoPrice(ceoActor, dx1.id, { amount: 1500, deliveryBusinessDays: 4, concept: "Reparación de tarjeta" });
    await assignServiceCeoPrice(ceoActor, dx2.id, { amount: 800, deliveryBusinessDays: 4 });
    await assignServiceCeoPrice(ceoActor, dxOther.id, { amount: 100, deliveryBusinessDays: 4 });
    assert.equal(await prisma.quote.count(), 0);
    assert.equal((await prisma.technicalCase.findUnique({ where: { id: dx1.id } }))!.ceoPricePending, false);

    const terms = { ...defaultSellerQuoteCommercialTerms, creditDays: 30, reference: null, contactIds: [contact.id] };
    await assert.rejects(
      () => createServicesExistingQuote(sellerActor, { ...terms, clientId: client.id, technicalCaseIds: [dx1.id, dxOther.id] }),
      /mismo cliente/,
    );
    await assert.rejects(
      () => createServicesExistingQuote(
        { ...sellerActor, userId: otherSeller.id },
        { ...terms, clientId: client.id, technicalCaseIds: [dx1.id] },
      ),
      /asignad/,
    );

    const quote = await createServicesExistingQuote(sellerActor, {
      ...terms,
      clientId: client.id,
      technicalCaseIds: [dx1.id],
    });
    assert.match(quote.folio, /^COTSV-1$/);
    assert.equal(quote.status, "PENDIENTE_DECISION");
    await assert.rejects(
      () => createServicesExistingQuote(sellerActor, { ...terms, clientId: client.id, technicalCaseIds: [dx1.id, dx2.id] }),
      /cotización abierta/,
    );

    await syncServicesExistingQuoteLines(sellerActor, quote.id, quote.version, [dx2.id]);
    const edited = await prisma.quote.findUnique({ where: { id: quote.id }, include: { lines: true } });
    assert.equal(edited!.lines.length, 1);
    assert.equal(edited!.lines[0]!.sourceTechnicalCaseId, dx2.id);
    await syncServicesExistingQuoteLines(sellerActor, quote.id, edited!.version, [dx1.id, dx2.id]);

    const fresh = await prisma.quote.findUnique({ where: { id: quote.id } });
    await decideQuote(sellerActor, quote.id, fresh!.version, true, [], null);
    assert.equal(await prisma.billingDocument.count({ where: { quoteId: quote.id } }), 0);
    assert.equal((await prisma.quote.findUnique({ where: { id: quote.id } }))!.status, "AUTORIZADA");
    await assert.rejects(
      () => createServicesExistingQuote(sellerActor, { ...terms, clientId: client.id, technicalCaseIds: [dx1.id] }),
      /autorizada/,
    );
    await assert.rejects(
      () => syncServicesExistingQuoteLines(sellerActor, quote.id, fresh!.version + 1, [dx2.id]),
      /ya no se edita/,
    );

    const os = await prisma.technicalCase.findFirst({ where: { spawnedFromId: dx1.id, kind: "OS" } });
    assert.ok(os);
    assert.equal(os!.quotePending, false);

    await prisma.$disconnect();
  });
});

describe("complemento de varias facturas", () => {
  it("timbra un pago que cubre dos facturas PPD del mismo cliente y no trata el saldo como pagado por ser PPD", async () => {
    pushDb("sygos-rep-multi-");
    const { prisma } = await import("./db");
    const { registerMultiInvoicePaymentComplement } = await import("./billing");

    const company = await prisma.company.create({ data: { code: "SYREP", name: "Systron rep" } });
    await prisma.financeAccount.create({
      data: { companyId: company.id, name: "BBVA", kind: "BANCARIA", balance: 0 },
    });
    const coord = await prisma.user.create({
      data: { username: "coord", name: "Coord", passwordHash: "x", role: "COORDINACION_ADMINISTRACION", companyId: company.id },
    });
    const seller = await prisma.user.create({
      data: { username: "ven", name: "Ven", passwordHash: "x", role: "VENTAS", companyId: company.id },
    });
    const client = await prisma.client.create({
      data: {
        companyId: company.id,
        name: "Cliente PPD",
        ownerUserId: seller.id,
        active: true,
        requiresInvoice: true,
        rfc: "XAXX010101000",
        cfdiUse: "G03",
        paymentMethod: "PPD",
      },
    });
    const other = await prisma.client.create({
      data: {
        companyId: company.id,
        name: "Otro",
        active: true,
        requiresInvoice: true,
        rfc: "XAXX010101001",
        cfdiUse: "G03",
        paymentMethod: "PPD",
      },
    });

    async function invoice(folio: string, clientId: string, method: string, balance: number) {
      const doc = await prisma.billingDocument.create({
        data: {
          folio,
          companyId: company.id,
          kind: "FACTURA",
          status: "EMITIDA",
          clientId,
          concept: folio,
          subtotal: balance / 1.16,
          iva: balance - balance / 1.16,
          total: balance,
          paymentMethodSnapshot: method,
          fiscalStatus: "TIMBRADA",
          fiscalUuid: `uuid-${folio}`,
        },
      });
      const receivable = await prisma.receivable.create({
        data: {
          companyId: company.id,
          documentId: doc.id,
          clientId,
          amount: balance,
          balance,
          dueAt: new Date("2026-12-31"),
          status: "PENDIENTE",
        },
      });
      return { doc, receivable };
    }

    const a = await invoice("FAC-1", client.id, "PPD", 1000);
    const b = await invoice("FAC-2", client.id, "PPD", 500);
    const pue = await invoice("FAC-3", client.id, "PUE", 200);
    const foreign = await invoice("FAC-9", other.id, "PPD", 300);
    const actor = {
      userId: coord.id,
      role: "COORDINACION_ADMINISTRACION" as const,
      activeCompanyId: company.id,
      activeCompanyCode: "SYSTRON",
    };

    await assert.rejects(
      () => registerMultiInvoicePaymentComplement(actor, {
        clientId: client.id,
        allocations: [
          { documentId: a.doc.id, amount: 1000 },
          { documentId: foreign.doc.id, amount: 300 },
        ],
        method: "TRANSFERENCIA",
        receipt: "SPEI-1",
        destination: "BBVA",
      }),
      /mismo cliente|no es de este cliente/,
    );
    await assert.rejects(
      () => registerMultiInvoicePaymentComplement(actor, {
        clientId: client.id,
        allocations: [
          { documentId: a.doc.id, amount: 1000 },
          { documentId: pue.doc.id, amount: 200 },
        ],
        method: "TRANSFERENCIA",
        receipt: "SPEI-1",
        destination: "BBVA",
      }),
      /PPD/,
    );
    await assert.rejects(
      () => registerMultiInvoicePaymentComplement(
        { ...actor, userId: seller.id, role: "VENTAS" },
        {
          clientId: client.id,
          allocations: [
            { documentId: a.doc.id, amount: 400 },
            { documentId: b.doc.id, amount: 500 },
          ],
          method: "TRANSFERENCIA",
          receipt: "SPEI-1",
          destination: "BBVA",
        },
      ),
      /Coordinación/,
    );

    const result = await registerMultiInvoicePaymentComplement(actor, {
      clientId: client.id,
      allocations: [
        { documentId: a.doc.id, amount: 400 },
        { documentId: b.doc.id, amount: 500 },
      ],
      method: "TRANSFERENCIA",
      receipt: "SPEI-VARIAS",
      destination: "BBVA",
    });
    const payment = await prisma.payment.findUnique({
      where: { id: result.payment.id },
      include: { applications: true, paymentComplement: true },
    });
    assert.equal(payment!.applications.length, 2);
    assert.equal(payment!.amount, 900);
    assert.ok(payment!.paymentComplement);
    const balanceA = (await prisma.receivable.findUnique({ where: { id: a.receivable.id } }))!.balance;
    const balanceB = (await prisma.receivable.findUnique({ where: { id: b.receivable.id } }))!.balance;
    assert.equal(balanceA, 600);
    assert.equal(balanceB, 0);
    assert.equal(documentHasUnpaidBalance(balanceA), true);
    assert.equal(a.doc.paymentMethodSnapshot, "PPD");

    await prisma.$disconnect();
  });
});
