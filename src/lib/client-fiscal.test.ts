import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  CLIENT_FISCAL_INVOICE_BLOCK_MESSAGE,
  assertClientFiscalReadyForInvoice,
  clientFiscalMissingLabels,
  clientFiscalReady,
} from "./client-fiscal";

describe("clientFiscalReady", () => {
  const complete = {
    name: "Aceros del Norte, S.A. de C.V.",
    satLegalName: null,
    rfc: "ANO010101AAA",
    taxRegime: "601",
    cfdiUse: "G03",
    paymentMethod: "PUE",
    fiscalZip: "64000",
    fiscalEmail: "facturas@cliente.mx",
  };

  it("marca listo cuando están RFC, régimen, CP, uso CFDI y método de pago", () => {
    assert.equal(clientFiscalReady(complete), true);
    assert.deepEqual(clientFiscalMissingLabels(complete), []);
  });

  it("lista campos faltantes", () => {
    const missing = clientFiscalMissingLabels({
      name: "Sin datos",
      rfc: null,
      taxRegime: null,
      cfdiUse: null,
      paymentMethod: null,
      fiscalZip: null,
    });
    assert.ok(missing.includes("RFC"));
    assert.ok(missing.includes("régimen fiscal"));
    assert.ok(missing.includes("correo fiscal"));
  });

  it("assertClientFiscalReadyForInvoice lanza mensaje para el vendedor", () => {
    assert.throws(
      () => assertClientFiscalReadyForInvoice({ name: "Cliente", rfc: null }),
      (error: Error) => error.message === CLIENT_FISCAL_INVOICE_BLOCK_MESSAGE,
    );
  });

  it("requestFromQuote bloquea FACTURA sin datos fiscales y permite REMISION", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sygos-client-fiscal-"));
    process.env.DATABASE_URL = `file:${join(dir, "test.db")}`;
    execSync("npx prisma db push --skip-generate", {
      cwd: join(import.meta.dirname, "../.."),
      env: process.env,
      stdio: "ignore",
    });

    const { prisma } = await import("./db");
    const { requestFromQuote } = await import("./billing");

    const company = await prisma.company.create({ data: { code: "SYSTRON", name: "Systron" } });
    const seller = await prisma.user.create({
      data: { username: "v-fiscal", name: "Vendedor", passwordHash: "x", role: "VENTAS", companyId: company.id },
    });
    const client = await prisma.client.create({
      data: {
        companyId: company.id,
        name: "Cliente sin RFC",
        active: true,
        isSystem: false,
        requiresInvoice: false,
        ownerUserId: seller.id,
      },
    });
    const quote = await prisma.quote.create({
      data: {
        folio: "COT-FISCAL-1",
        companyId: company.id,
        clientId: client.id,
        sellerUserId: seller.id,
        status: "AUTORIZADA",
        quoteType: "VENTA_EQUIPO",
        discountPct: 0,
        lines: { create: [{ concept: "Equipo", quantity: 1, unitPrice: 1000, authorized: true }] },
      },
      include: { lines: true },
    });

    const actor = {
      userId: seller.id,
      role: "VENTAS" as const,
      activeCompanyId: company.id,
      activeCompanyCode: "SYSTRON",
    };

    await assert.rejects(
      () => requestFromQuote(actor, quote.id, "FACTURA", null),
      (error: Error) => error.message === CLIENT_FISCAL_INVOICE_BLOCK_MESSAGE,
    );

    const rem = await requestFromQuote(actor, quote.id, "REMISION", null);
    assert.equal(rem.kind, "REMISION");
    assert.equal(rem.status, "SOLICITADA");
    assert.equal(rem.total, 1160);
    const remWithLines = await prisma.billingDocument.findUnique({
      where: { id: rem.id },
      include: { lines: true },
    });
    assert.equal(remWithLines!.lines[0]!.unitPrice, 1000);
    assert.equal(remWithLines!.lines[0]!.amount, 1000);
    assert.equal(remWithLines!.lines[0]!.satProductKey, null);
  });
});