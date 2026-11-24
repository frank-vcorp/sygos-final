import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { encryptSecret } from "./crypto";
import { invoicePayload, parseSygosSeriesAndFolio, stampBillingDocument } from "./facturapi";
import {
  defaultSatDefaultsForCompany,
  parseCompanyFiscalConfig,
  resolveCredentialFromInputs,
  serializeFiscalConfigJson,
  syncIntercompanyPartiesFromCompany,
} from "./fiscal-config";
import { quoteTotals, roundMoney } from "./money";
import { resolveClientSatLegalName, stripCorporateRegimeSuffix } from "./sat-legal-name";
import { resolvePaymentFormForDocument } from "./sat-payment-method";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Facturapi Fase 1: helpers puros y payload CFDI 4.0", () => {
  it("normaliza la razón social SAT quitando sufijos societarios sin dañar nombres propios", () => {
    assert.equal(stripCorporateRegimeSuffix("Aceros del Norte, S.A. de C.V."), "Aceros del Norte");
    assert.equal(stripCorporateRegimeSuffix("Industrias Beta SAPI DE CV"), "Industrias Beta");
    assert.equal(stripCorporateRegimeSuffix("Servicios Gamma S. de R.L. de C.V."), "Servicios Gamma");
    assert.equal(stripCorporateRegimeSuffix("Consultores Delta S.C."), "Consultores Delta");
    assert.equal(stripCorporateRegimeSuffix("SAUL HERNANDEZ"), "SAUL HERNANDEZ");
    assert.equal(
      resolveClientSatLegalName({ name: "Aceros del Norte, S.A. de C.V.", satLegalName: "ACEROS DEL NORTE" }),
      "ACEROS DEL NORTE",
    );
    assert.equal(
      resolveClientSatLegalName({ name: "Aceros del Norte, S.A. de C.V.", satLegalName: null }),
      "Aceros del Norte",
    );
  });

  it("resuelve c_FormaPago en PUE y fuerza 99 en PPD", () => {
    assert.equal(resolvePaymentFormForDocument("PPD", "01"), "99");
    assert.equal(resolvePaymentFormForDocument("PPD", "03"), "99");
    assert.equal(resolvePaymentFormForDocument("PUE", null), "03");
    assert.equal(resolvePaymentFormForDocument("PUE", "99"), "03");
    assert.equal(resolvePaymentFormForDocument("PUE", "01"), "01");
    assert.equal(resolvePaymentFormForDocument("PUE", "04"), "04");
    assert.equal(resolvePaymentFormForDocument("PUE", "28"), "28");
  });

  it("extrae serie y folio entero de SYGOS", () => {
    assert.deepEqual(parseSygosSeriesAndFolio("FAC-102"), { series: "FAC", folioNumber: 102 });
    assert.deepEqual(parseSygosSeriesAndFolio("FAC-SM-9"), { series: "FAC-SM", folioNumber: 9 });
    assert.equal(parseSygosSeriesAndFolio("SIN-NUMERO"), null);
  });

  it("arma payload CFDI 4.0 con precios netos (tax_included: false), descuentos, serie/folio e idempotency_key", () => {
    const built = invoicePayload({
      externalId: "doc_1",
      idempotencyKey: "sygos-doc_1-a1",
      customerName: "Aceros del Norte, S.A. de C.V.",
      satLegalName: null,
      rfc: "ANO010101AAA",
      taxSystem: "601",
      cfdiUse: "G03",
      paymentMethod: "PUE",
      paymentForm: "01",
      zip: "64000",
      email: "cxp@aceros.mx",
      series: "FAC",
      folioNumber: 102,
      lines: [
        {
          concept: "Reparación driver",
          quantity: 2,
          unitPrice: 500,
          discountAmount: 100,
          taxIncluded: false,
          productKey: "72154000",
          unitKey: "E48",
          unitName: "Servicio",
          taxability: "02",
        },
        {
          concept: "Venta módulo",
          quantity: 1,
          unitPrice: 300,
          discountAmount: 30,
          taxIncluded: false,
          productKey: "32151700",
          unitKey: "H87",
          unitName: "Pieza",
          taxability: "02",
        },
      ],
      iva: 187.2,
    });

    assert.ok(built.body);
    assert.equal(built.body.series, "FAC");
    assert.equal(built.body.folio_number, 102);
    assert.equal(built.body.idempotency_key, "sygos-doc_1-a1");
    assert.equal(built.body.customer.legal_name, "Aceros del Norte");
    assert.equal(built.body.customer.email, "cxp@aceros.mx");
    assert.equal(built.body.payment_method, "PUE");
    assert.equal(built.body.payment_form, "01");
    assert.equal(built.body.items.length, 2);
    assert.equal(built.body.items[0]!.discount, 100);
    assert.equal(built.body.items[0]!.product.tax_included, false);
    assert.equal(built.body.items[0]!.product.product_key, "72154000");
    assert.equal(built.body.items[0]!.product.unit_key, "E48");
    assert.equal(built.body.items[0]!.product.taxability, "02");
    assert.equal(built.body.items[1]!.product.product_key, "32151700");
    assert.equal(built.body.items[1]!.product.unit_key, "H87");
  });

  it("resuelve credenciales respetando inSandbox, TEST, LIVE, isProductionReady y compatibilidad legacy", () => {
    // Guarda dura inSandbox: nunca devuelve sk_live_*
    const sandboxed = resolveCredentialFromInputs({
      sandboxActive: true,
      configuredMode: "LIVE",
      testSecret: "sk_test_123",
      liveSecret: "sk_live_999",
      legacySecret: null,
      liveIsProductionReady: true,
    });
    assert.equal(sandboxed.status, "SIMULATED");
    assert.equal(sandboxed.secret, null);

    // TEST activo
    const testRes = resolveCredentialFromInputs({
      sandboxActive: false,
      configuredMode: "TEST",
      testSecret: "sk_test_abc",
      liveSecret: "sk_live_xyz",
      legacySecret: null,
    });
    assert.equal(testRes.status, "READY");
    if (testRes.status === "READY") {
      assert.equal(testRes.env, "TEST");
      assert.equal(testRes.secret, "sk_test_abc");
    }

    // LIVE bloqueado si isProductionReady === false
    const liveNotReady = resolveCredentialFromInputs({
      sandboxActive: false,
      configuredMode: "LIVE",
      testSecret: "sk_test_abc",
      liveSecret: "sk_live_xyz",
      legacySecret: null,
      liveIsProductionReady: false,
    });
    assert.equal(liveNotReady.status, "UNAVAILABLE");

    // LIVE listo
    const liveReady = resolveCredentialFromInputs({
      sandboxActive: false,
      configuredMode: "LIVE",
      testSecret: "sk_test_abc",
      liveSecret: "sk_live_xyz",
      legacySecret: null,
      liveIsProductionReady: true,
    });
    assert.equal(liveReady.status, "READY");
    if (liveReady.status === "READY") {
      assert.equal(liveReady.env, "LIVE");
      assert.equal(liveReady.secret, "sk_live_xyz");
    }

    // Retrocompatibilidad legacy FACTURAPI cuando configuredMode === OFF
    const legacyTest = resolveCredentialFromInputs({
      sandboxActive: false,
      configuredMode: "OFF",
      testSecret: null,
      liveSecret: null,
      legacySecret: "sk_test_legacy",
    });
    assert.equal(legacyTest.status, "READY");
    if (legacyTest.status === "READY") {
      assert.equal(legacyTest.env, "TEST");
      assert.equal(legacyTest.fromLegacy, true);
    }
  });
});

describe("Facturapi Fase 1: flujo BD, líneas, 202/409 e intercompañía resiliente", () => {
  it("traslada líneas con descuento/IVA neto, maneja 202 y 409, y no bloquea intercompañía si Facturapi falla", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sygos-facturapi-p1-"));
    process.env.DATABASE_URL = `file:${join(dir, "test.db")}`;
    execSync("npx prisma db push --skip-generate", {
      cwd: join(import.meta.dirname, "../.."),
      env: process.env,
      stdio: "ignore",
    });

    const { prisma } = await import("./db");
    const { buildQuoteBillingLines, issueDocument, requestFromQuote } = await import("./billing");

    // 1. Prueba pura de buildQuoteBillingLines con descuento
    const quoteSampleLines = [
      { id: "ql1", concept: "Diagnóstico", quantity: 1, unitPrice: 1000 },
      { id: "ql2", concept: "Bobinado", quantity: 2, unitPrice: 750 },
    ];
    const totalsSample = quoteTotals(quoteSampleLines, 15)!;
    const builtLines = buildQuoteBillingLines({
      lines: quoteSampleLines,
      discountPct: 15,
      targetSubtotal: totalsSample.base,
      satDefaults: defaultSatDefaultsForCompany("SYSTRON").EQUIPO_ELECTRONICO,
      lineMode: "LINE_BY_LINE",
      isPartial: false,
      consolidatedConcept: "Diagnóstico; Bobinado",
    });
    assert.equal(builtLines.length, 2);
    assert.equal(builtLines[0]!.satProductKey, null);
    assert.equal(builtLines[0]!.satUnitKey, null);
    assert.equal(builtLines[0]!.taxIncluded, false);
    assert.equal(builtLines[0]!.unitPrice, 1000);
    assert.equal(builtLines[0]!.discountAmount, 150);
    assert.equal(builtLines[0]!.amount, 850);
    assert.equal(
      roundMoney(builtLines.reduce((sum, l) => sum + l.amount, 0)),
      totalsSample.base,
    );

    // 2. Setup empresas SYSTRON (TEST con sk_test_) y SERVOMOTORES (TEST sin llave para probar resiliencia)
    const systronDefaults = defaultSatDefaultsForCompany("SYSTRON");
    const systron = await prisma.company.create({
      data: {
        code: "SYSTRON",
        name: "SYSTRON",
        legalName: "SYSTRON INDUSTRIAL, S.A. DE C.V.",
        rfc: "SYS010101AAA",
        taxRegime: "601",
        postalCode: "64000",
        email: "facturacion@systron.mx",
        facturapiMode: "TEST",
        fiscalSeriesPolicy: "SYGOS_FAC",
        fiscalDefaultSeries: "FAC",
        fiscalLineMode: "LINE_BY_LINE",
        fiscalConfigJson: serializeFiscalConfigJson({
          satDefaults: systronDefaults,
          toggles: parseCompanyFiscalConfig({ code: "SYSTRON" }).toggles,
        }),
      },
    });
    const servomotores = await prisma.company.create({
      data: {
        code: "SERVOMOTORES",
        name: "Servomotores",
        facturapiMode: "TEST",
      },
    });
    await prisma.integrationSetting.create({
      data: {
        companyId: systron.id,
        provider: "FACTURAPI_TEST",
        secretEnc: encryptSecret("sk_test_systron_unit"),
        secretHint: "••••unit",
        extra: JSON.stringify({}),
      },
    });

    const seller = await prisma.user.create({
      data: { username: "seller-p1", name: "Vendedor", passwordHash: "x", role: "VENTAS", companyId: systron.id },
    });
    const coord = await prisma.user.create({
      data: { username: "coord-p1", name: "Coordinación", passwordHash: "x", role: "COORDINACION_ADMINISTRACION" },
    });

    const client = await prisma.client.create({
      data: {
        companyId: systron.id,
        name: "Aceros del Norte, S.A. de C.V.",
        active: true,
        isSystem: false,
        requiresInvoice: true,
        rfc: "ANO010101AAA",
        taxRegime: "601",
        cfdiUse: "G03",
        paymentMethod: "PUE",
        fiscalZip: "64000",
        ownerUserId: seller.id,
        contacts: {
          create: { name: "Pagos", phone: "8111111111", email: "pagos@aceros.mx", isPrimary: true },
        },
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

    // Verificar syncIntercompanyPartiesFromCompany
    await syncIntercompanyPartiesFromCompany(systron.id);
    const syncedIcClient = await prisma.client.findUnique({ where: { id: systronClient.id } });
    assert.equal(syncedIcClient?.rfc, "SYS010101AAA");
    assert.equal(syncedIcClient?.taxRegime, "601");
    assert.equal(syncedIcClient?.fiscalZip, "64000");
    assert.equal(syncedIcClient?.satLegalName, "SYSTRON INDUSTRIAL");

    // 3. Caso intercompañía: Servomotores sin llave TEST -> deja intercompañía ERROR pero NO bloquea SYSTRON
    const equipment = await prisma.equipment.create({
      data: {
        folio: "MOT-P1-1",
        kind: "MOT",
        originCompanyId: systron.id,
        clientId: client.id,
        model: "Servo X",
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
        reportedFault: "Falla encoder",
        status: "ABIERTA",
      },
    });
    const os = await prisma.technicalCase.create({
      data: {
        folio: "OS-50",
        attentionId: attention.id,
        equipmentId: equipment.id,
        serviceCompanyId: servomotores.id,
        kind: "OS",
        status: "TERMINADA",
      },
    });
    const baseQuote = await prisma.quote.create({
      data: {
        folio: "COT-SM-50",
        companyId: servomotores.id,
        clientId: systronClient.id,
        quoteType: "REPARACION",
        status: "AUTORIZADA",
        equipmentId: equipment.id,
        technicalCaseId: os.id,
        discountPct: 10,
        lines: {
          create: [
            { concept: "Reembobinado", quantity: 1, unitPrice: 1000, authorized: true },
            { concept: "Rodamientos", quantity: 2, unitPrice: 500, authorized: true },
          ],
        },
      },
    });
    const endQuote = await prisma.quote.create({
      data: {
        folio: "COT-50",
        companyId: systron.id,
        clientId: client.id,
        quoteType: "REPARACION",
        status: "AUTORIZADA",
        equipmentId: equipment.id,
        technicalCaseId: os.id,
        linkedQuoteId: baseQuote.id,
        sellerUserId: seller.id,
        discountPct: 10,
        lines: {
          create: [
            { concept: "Reparación servo", quantity: 1, unitPrice: 3000, authorized: true },
            { concept: "Pruebas en banco", quantity: 2, unitPrice: 500, authorized: true },
          ],
        },
      },
    });

    const sellerActor = {
      userId: seller.id,
      role: "VENTAS" as const,
      activeCompanyId: systron.id,
      activeCompanyCode: "SYSTRON",
    };
    const endDoc = await requestFromQuote(sellerActor, endQuote.id, "FACTURA", null);
    assert.equal(endDoc.status, "SOLICITADA");

    const endWithLines = await prisma.billingDocument.findUnique({
      where: { id: endDoc.id },
      include: { lines: true },
    });
    assert.equal(endWithLines?.lines.length, 2);
    assert.equal(endWithLines?.subtotal, 3600);
    assert.equal(endWithLines?.iva, 576);
    assert.equal(endWithLines?.total, 4176);
    assert.equal(endWithLines?.lines[0]!.taxIncluded, false);
    assert.equal(endWithLines?.lines[0]!.discountAmount, 300);

    const icDoc = await prisma.billingDocument.findFirst({
      where: { kind: "FACTURA_INTERCOMPANIA", quoteId: baseQuote.id },
      include: { lines: true, receivable: true, payable: true },
    });
    assert.ok(icDoc);
    assert.equal(icDoc.status, "EMITIDA");
    assert.equal(icDoc.fiscalStatus, "ERROR");
    assert.equal(icDoc.subtotal, 1800);
    assert.equal(icDoc.total, 2088);
    assert.equal(icDoc.lines.length, 2);
    assert.ok(icDoc.receivable);
    assert.ok(icDoc.payable);

    // 4. Emisión en SYSTRON con c_FormaPago real ("01") + prueba de HTTP 202 -> polling -> TIMBRADA
    const coordActor = {
      userId: coord.id,
      role: "COORDINACION_ADMINISTRACION" as const,
      activeCompanyId: systron.id,
      activeCompanyCode: "SYSTRON",
    };
    // Sin fetch mock aún para emitir local primero (forzamos un documento nuevo sin linkedQuoteId para controlar 100% el fetch)
    const plainQuote = await prisma.quote.create({
      data: {
        folio: "COT-51",
        companyId: systron.id,
        clientId: client.id,
        quoteType: "VENTA_EQUIPO",
        status: "AUTORIZADA",
        sellerUserId: seller.id,
        lines: { create: [{ concept: "PLC S7-1200", quantity: 1, unitPrice: 1000, authorized: true }] },
      },
    });
    const plainDoc = await requestFromQuote(sellerActor, plainQuote.id, "FACTURA", null);
    const plainLine = await prisma.billingLine.findFirst({ where: { documentId: plainDoc.id } });
    assert.equal(plainLine?.satProductKey, null);
    assert.equal(plainLine?.satUnitKey, null);

    const { patchBillingLineSatKeys } = await import("./billing");
    await patchBillingLineSatKeys(coordActor, {
      documentId: plainDoc.id,
      lineId: plainLine!.id,
      satProductKey: "32151700",
      satUnitKey: "H87",
    });

    // Emitimos preparando snapshot (usando facturapiMode OFF temporalmente para probar stampBillingDocument con mock fetch)
    await prisma.company.update({ where: { id: systron.id }, data: { facturapiMode: "OFF" } });
    await prisma.integrationSetting.deleteMany({ where: { companyId: systron.id } });
    await issueDocument(coordActor, plainDoc.id, { cfdiUse: "G01", paymentMethod: "PUE", paymentForm: "01" });

    const afterLocalIssue = await prisma.billingDocument.findUnique({ where: { id: plainDoc.id } });
    assert.equal(afterLocalIssue?.paymentFormSnapshot, "01");
    assert.equal(afterLocalIssue?.fiscalStatus, "ERROR");

    // Reactivamos TEST en SYSTRON y simulamos HTTP 202 Accepted seguido de polling GET -> valid
    await prisma.company.update({ where: { id: systron.id }, data: { facturapiMode: "TEST" } });
    await prisma.integrationSetting.create({
      data: {
        companyId: systron.id,
        provider: "FACTURAPI_TEST",
        secretEnc: encryptSecret("sk_test_systron_unit"),
        secretHint: "••••unit",
        extra: JSON.stringify({}),
      },
    });

    const capturedPayloads: Array<Record<string, unknown>> = [];
    const fetch202: typeof fetch = async (url, init) => {
      const urlStr = String(url);
      if (urlStr.includes("external_id=")) {
        return jsonResponse(200, { data: [] });
      }
      if (init?.method === "POST" && urlStr.endsWith("/invoices")) {
        capturedPayloads.push(JSON.parse(String(init.body)) as Record<string, unknown>);
        return jsonResponse(202, { id: "inv_202", status: "pending", series: "FAC", folio_number: 1 });
      }
      if (urlStr.endsWith("/invoices/inv_202")) {
        return jsonResponse(200, {
          id: "inv_202",
          status: "valid",
          uuid: "11111111-2222-3333-4444-555555555555",
          series: "FAC",
          folio_number: 1,
          verification_url: "https://verificacfdi.facturaelectronica.sat.gob.mx/test",
        });
      }
      throw new Error(`Unexpected fetch URL: ${urlStr}`);
    };

    await stampBillingDocument(plainDoc.id, { fetchFn: fetch202 });
    const after202 = await prisma.billingDocument.findUnique({ where: { id: plainDoc.id } });
    assert.equal(after202?.fiscalStatus, "PROCESANDO");
    assert.equal(after202?.fiscalEnv, "TEST");
    assert.equal(after202?.fiscalExternalId, "inv_202");
    assert.equal(capturedPayloads.length, 1);
    assert.equal(capturedPayloads[0]!.payment_form, "01");
    assert.equal((capturedPayloads[0]!.customer as Record<string, unknown>).legal_name, "Aceros del Norte");
    assert.equal((capturedPayloads[0]!.customer as Record<string, unknown>).email, "pagos@aceros.mx");

    // Polling sobre el mismo documento (sin crear segundo POST)
    await stampBillingDocument(plainDoc.id, { fetchFn: fetch202 });
    const afterPoll = await prisma.billingDocument.findUnique({ where: { id: plainDoc.id } });
    assert.equal(afterPoll?.fiscalStatus, "TIMBRADA");
    assert.equal(afterPoll?.fiscalUuid, "11111111-2222-3333-4444-555555555555");
    assert.equal(capturedPayloads.length, 1);

    // 5. Prueba de recuperación ante HTTP 409 idempotency_key_in_use
    const quote409 = await prisma.quote.create({
      data: {
        folio: "COT-52",
        companyId: systron.id,
        clientId: client.id,
        quoteType: "REPARACION",
        status: "AUTORIZADA",
        sellerUserId: seller.id,
        lines: { create: [{ concept: "Mantenimiento", quantity: 1, unitPrice: 500, authorized: true }] },
      },
    });
    const doc409 = await requestFromQuote(sellerActor, quote409.id, "FACTURA", null);
    await prisma.billingDocument.update({
      where: { id: doc409.id },
      data: { status: "EMITIDA", paymentFormSnapshot: "03", cfdiUseSnapshot: "G03", paymentMethodSnapshot: "PUE" },
    });

    let listCalls = 0;
    const fetch409: typeof fetch = async (url, init) => {
      const urlStr = String(url);
      if (urlStr.includes("external_id=")) {
        listCalls += 1;
        if (listCalls === 1) return jsonResponse(200, { data: [] });
        return jsonResponse(200, {
          data: [
            {
              id: "inv_409",
              external_id: doc409.id,
              status: "valid",
              uuid: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
              series: "FAC",
              folio_number: 2,
            },
          ],
        });
      }
      if (init?.method === "POST" && urlStr.endsWith("/invoices")) {
        return jsonResponse(409, { ok: false, status: 409, code: "idempotency_key_in_use" });
      }
      throw new Error(`Unexpected fetch URL: ${urlStr}`);
    };

    await stampBillingDocument(doc409.id, { fetchFn: fetch409 });
    const recovered = await prisma.billingDocument.findUnique({ where: { id: doc409.id } });
    assert.equal(recovered?.fiscalStatus, "TIMBRADA");
    assert.equal(recovered?.fiscalExternalId, "inv_409");
    assert.equal(recovered?.fiscalUuid, "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");

    await prisma.$disconnect();
  });
});
