import assert from "node:assert/strict";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { describe, it } from "node:test";

describe("facturación SCA", () => {
  it("COTSC autorizada solicita FAC con folio global ligado al SCA", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sygos-sca-fac-"));
    process.env.DATABASE_URL = `file:${join(dir, "test.db")}`;
    const { execSync } = await import("child_process");
    execSync("npx prisma db push --skip-generate", {
      cwd: join(import.meta.dirname, "../.."),
      env: process.env,
      stdio: "ignore",
    });
    const { prisma } = await import("./db");
    const { createSellerQuote, setPrices, decideQuote } = await import("./quotes");
    const { requestFromFieldServiceCase } = await import("./billing");
    const { allocateFolio } = await import("./folios");

    const company = await prisma.company.create({ data: { code: "SYTSCA", name: "Systron" } });
    const user = await prisma.user.create({
      data: { username: "ceo", name: "CEO", passwordHash: "x", role: "CEO", companyId: company.id },
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
        creditDays: 0,
      },
    });
    const contact = await prisma.contact.create({ data: { clientId: client.id, name: "C", active: true, isPrimary: true } });

    const quote = await createSellerQuote(
      { userId: user.id, role: "CEO", activeCompanyId: company.id, activeCompanyCode: "SYSTRON" },
      {
        clientId: client.id,
        quoteType: "CAMPO",
        equipmentId: null,
        reference: null,
        concepts: [{ concept: "Instalación en planta", quantity: 1 }],
        contactIds: [contact.id],
      },
    );
    const withLines = await prisma.quote.findUnique({ where: { id: quote.id }, include: { lines: true } });
    await setPrices(
      { userId: user.id, role: "CEO", activeCompanyId: company.id, activeCompanyCode: "SYSTRON" },
      quote.id,
      1,
      [{ lineId: withLines!.lines[0]!.id, amount: 1500 }],
      null,
      4,
    );
    await decideQuote(
      { userId: user.id, role: "CEO", activeCompanyId: company.id, activeCompanyCode: "SYSTRON" },
      quote.id,
      2,
      true,
      [withLines!.lines[0]!.id],
    );
    const sca = await prisma.fieldServiceCase.findUnique({ where: { quoteId: quote.id } });
    assert.ok(sca);

    const srvBefore = await allocateFolio(company.id, "SRV");
    assert.equal(srvBefore, "SRV-1");

    const actor = { userId: user.id, role: "CEO" as const, activeCompanyId: company.id, activeCompanyCode: "SYSTRON" };
    const document = await requestFromFieldServiceCase(actor, sca!.id, "FACTURA", null);
    assert.match(document.folio, /^FAC-/);
    assert.equal(document.fieldServiceCaseId, sca!.id);
    assert.equal(document.quoteId, quote.id);
    assert.equal(document.total, 6000);
    assert.equal(document.technicalCaseId, null);

    const srvAfter = await allocateFolio(company.id, "SRV");
    assert.equal(srvAfter, "SRV-2");

    await assert.rejects(
      () => requestFromFieldServiceCase(actor, sca!.id, "FACTURA", null),
      /ya tiene una factura/,
    );

    await prisma.$disconnect();
  });
});
