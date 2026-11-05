import assert from "node:assert/strict";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { describe, it } from "node:test";

describe("commercial quote folios", () => {
  it("series COTDX/COTOS/COTSC/COTVT/SCA son independientes", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sygos-cot-"));
    process.env.DATABASE_URL = `file:${join(dir, "test.db")}`;
    const { execSync } = await import("child_process");
    execSync("npx prisma db push --skip-generate", {
      cwd: join(import.meta.dirname, "../.."),
      env: process.env,
      stdio: "ignore",
    });
    const { allocateFolio } = await import("./folios");
    const { prisma } = await import("./db");
    const company = await prisma.company.create({ data: { code: "COTCO", name: "COT" } });
    assert.equal(await allocateFolio(company.id, "COTDX"), "COTDX-1");
    assert.equal(await allocateFolio(company.id, "COTOS"), "COTOS-1");
    assert.equal(await allocateFolio(company.id, "COTSC"), "COTSC-1");
    assert.equal(await allocateFolio(company.id, "COTVT"), "COTVT-1");
    assert.equal(await allocateFolio(company.id, "SCA"), "SCA-1");
    assert.equal(await allocateFolio(company.id, "COTDX"), "COTDX-2");
    assert.equal(await allocateFolio(company.id, "SRV"), "SRV-1");
    await prisma.$disconnect();
  });

  it("createSellerQuote asigna COTDX y congela prioridad", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sygos-cotdx-"));
    process.env.DATABASE_URL = `file:${join(dir, "test.db")}`;
    const { execSync } = await import("child_process");
    execSync("npx prisma db push --skip-generate", {
      cwd: join(import.meta.dirname, "../.."),
      env: process.env,
      stdio: "ignore",
    });
    const { prisma } = await import("./db");
    const { createSellerQuote } = await import("./quotes");
    const { initialPriorities } = await import("./priorities");

    const company = await prisma.company.create({ data: { code: "SYT", name: "Systron" } });
    for (const row of initialPriorities("SYSTRON")) {
      await prisma.priority.create({ data: { companyId: company.id, ...row } });
    }
    const user = await prisma.user.create({
      data: { username: "vendedor", name: "V", passwordHash: "x", role: "VENTAS", companyId: company.id },
    });
    const client = await prisma.client.create({
      data: {
        companyId: company.id,
        name: "Cliente",
        ownerUserId: user.id,
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
        createdByUserId: user.id,
      },
    });
    const priority = await prisma.priority.findFirst({ where: { companyId: company.id, attentionType: "DIAGNOSTICO", name: "Alta" } });
    assert.ok(priority);

    const quote = await createSellerQuote(
      { userId: user.id, role: "VENTAS", activeCompanyId: company.id, activeCompanyCode: "SYSTRON" },
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
    assert.match(quote.folio, /^COTDX-/);
    assert.equal(quote.priorityName, "Alta");
    await prisma.$disconnect();
  });

  it("COTSC autorizada crea SCA", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sygos-cotsc-"));
    process.env.DATABASE_URL = `file:${join(dir, "test.db")}`;
    const { execSync } = await import("child_process");
    execSync("npx prisma db push --skip-generate", {
      cwd: join(import.meta.dirname, "../.."),
      env: process.env,
      stdio: "ignore",
    });
    const { prisma } = await import("./db");
    const { createSellerQuote, setPrices, decideQuote } = await import("./quotes");

    const company = await prisma.company.create({ data: { code: "SYT2", name: "Systron" } });
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
    assert.match(quote.folio, /^COTSC-/);
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
    assert.match(sca!.folio, /^SCA-/);
    assert.equal(sca!.hours, 4);
    assert.equal(sca!.unitPrice, 1500);
    await prisma.$disconnect();
  });
});
