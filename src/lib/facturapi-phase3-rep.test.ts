import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { encryptSecret } from "./crypto";
import { canDownloadPaymentComplement } from "./billing-delivery";
import {
  buildRepPayload,
  isBillingDocumentEligibleForRep,
  processFacturapiWebhook,
  stampPaymentComplement,
} from "./facturapi";
import {
  defaultSatDefaultsForCompany,
  parseCompanyFiscalConfig,
  serializeFiscalConfigJson,
} from "./fiscal-config";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Facturapi Fase 3: elegibilidad REP, payload tipo P y permisos", () => {
  it("valida elegibilidad estricta PPD + TIMBRADA y excluye PUE/REMISION", () => {
    assert.equal(
      isBillingDocumentEligibleForRep({ kind: "FACTURA", paymentMethodSnapshot: "PPD", fiscalStatus: "TIMBRADA" }),
      true,
    );
    assert.equal(
      isBillingDocumentEligibleForRep({ kind: "FACTURA_INTERCOMPANIA", paymentMethodSnapshot: "PPD", fiscalStatus: "TIMBRADA" }),
      true,
    );
    assert.equal(
      isBillingDocumentEligibleForRep({ kind: "FACTURA", paymentMethodSnapshot: "PUE", fiscalStatus: "TIMBRADA" }),
      false,
    );
    assert.equal(
      isBillingDocumentEligibleForRep({ kind: "REMISION", paymentMethodSnapshot: "PPD", fiscalStatus: "TIMBRADA" }),
      false,
    );
    assert.equal(
      isBillingDocumentEligibleForRep({ kind: "FACTURA", paymentMethodSnapshot: "PPD", fiscalStatus: "ERROR" }),
      false,
    );
  });

  it("arma payload CFDI tipo P con complemento pago y related_documents", () => {
    const built = buildRepPayload({
      externalId: "rep_1",
      idempotencyKey: "sygos-rep-rep_1-a1",
      customerName: "Aceros del Norte, S.A. de C.V.",
      rfc: "ANO010101AAA",
      taxSystem: "601",
      zip: "64000",
      email: "pagos@aceros.mx",
      paymentForm: "03",
      paymentDate: new Date("2026-11-18T12:00:00.000Z"),
      series: "REP",
      folioNumber: 12,
      relatedDocuments: [
        {
          uuid: "11111111-1111-1111-1111-111111111111",
          installment: 2,
          last_balance: 700,
          amount: 300,
          taxes: [{ base: 258.62, rate: 0.16, type: "IVA", factor: "Tasa", withholding: false }],
        },
      ],
    });
    assert.ok(built.body);
    assert.equal(built.body.type, "P");
    assert.equal(built.body.series, "REP");
    assert.equal(built.body.folio_number, 12);
    assert.equal(built.body.idempotency_key, "sygos-rep-rep_1-a1");
    assert.equal(built.body.customer.legal_name, "Aceros del Norte");
    assert.equal(built.body.complements[0]!.type, "pago");
    assert.equal(built.body.complements[0]!.data[0]!.payment_form, "03");
    assert.equal(built.body.complements[0]!.data[0]!.related_documents[0]!.installment, 2);
  });

  it("valida permisos de descarga del REP en empresa emisora e intercompañía SYSTRON", () => {
    const icRep = {
      companyId: "comp_sm",
      paymentKind: "INTERCOMPANIA",
      paymentCompanyId: "comp_sy",
      clientOwnerUserId: null,
    };
    const clientRep = {
      companyId: "comp_sy",
      paymentKind: "CLIENTE",
      paymentCompanyId: "comp_sy",
      clientOwnerUserId: "u_seller1",
    };

    assert.equal(canDownloadPaymentComplement(null, clientRep), false);
    assert.equal(
      canDownloadPaymentComplement(
        { userId: "u_coord", role: "COORDINACION_ADMINISTRACION", activeCompanyId: "comp_sm", activeCompanyCode: "SERVOMOTORES" },
        icRep,
      ),
      true,
    );
    assert.equal(
      canDownloadPaymentComplement(
        { userId: "u_coord", role: "COORDINACION_ADMINISTRACION", activeCompanyId: "comp_sy", activeCompanyCode: "SYSTRON" },
        icRep,
      ),
      true,
    );
    assert.equal(
      canDownloadPaymentComplement(
        { userId: "u_seller1", role: "VENTAS", activeCompanyId: "comp_sy", activeCompanyCode: "SYSTRON" },
        icRep,
      ),
      false,
    );
    assert.equal(
      canDownloadPaymentComplement(
        { userId: "u_seller1", role: "VENTAS", activeCompanyId: "comp_sy", activeCompanyCode: "SYSTRON" },
        clientRep,
      ),
      true,
    );
    assert.equal(
      canDownloadPaymentComplement(
        { userId: "u_seller2", role: "VENTAS", activeCompanyId: "comp_sy", activeCompanyCode: "SYSTRON" },
        clientRep,
      ),
      false,
    );
  });
});

describe("Facturapi Fase 3: ciclo completo REP, intercompañía, 202/409/4xx y webhook", () => {
  it("maneja REP manual/auto, no revierte CxC/CxP si falla, soporta intercompañía y resuelve 202 vía webhook", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sygos-facturapi-p3-"));
    process.env.DATABASE_URL = `file:${join(dir, "test.db")}`;
    execSync("npx prisma db push --skip-generate", {
      cwd: join(import.meta.dirname, "../.."),
      env: process.env,
      stdio: "ignore",
    });

    const { prisma } = await import("./db");
    const {
      confirmIntercompanyPayment,
      registerClientPayment,
      registerIntercompanyPayment,
      validatePayment,
    } = await import("./billing");
    const { getPaymentComplementDownload } = await import("./billing-artifacts");

    const systron = await prisma.company.create({
      data: {
        code: "SYSTRON",
        name: "SYSTRON",
        legalName: "SYSTRON INDUSTRIAL, S.A. DE C.V.",
        rfc: "SYS010101AAA",
        taxRegime: "601",
        postalCode: "64000",
        email: "cxp@systron.mx",
        facturapiMode: "TEST",
      },
    });
    const servomotores = await prisma.company.create({
      data: {
        code: "SERVOMOTORES",
        name: "Servomotores",
        legalName: "SERVOMOTORES INDUSTRIALES",
        rfc: "SME010101BBB",
        taxRegime: "601",
        postalCode: "64100",
        facturapiMode: "TEST",
      },
    });

    await prisma.integrationSetting.create({
      data: {
        companyId: systron.id,
        provider: "FACTURAPI_TEST",
        secretEnc: encryptSecret("sk_test_systron_rep"),
        secretHint: "••••_rep",
        extra: JSON.stringify({
          organizationId: "org_sy_test",
          webhookSecretEnc: encryptSecret("whsec_sy_test"),
        }),
      },
    });
    await prisma.integrationSetting.create({
      data: {
        companyId: servomotores.id,
        provider: "FACTURAPI_TEST",
        secretEnc: encryptSecret("sk_test_servo_rep"),
        secretHint: "••••_rep",
        extra: JSON.stringify({
          organizationId: "org_sm_test",
          webhookSecretEnc: encryptSecret("whsec_sm_test"),
        }),
      },
    });

    for (const company of [systron, servomotores]) {
      await prisma.financeAccount.create({
        data: { companyId: company.id, name: "Banco", kind: "BANCARIA", balance: 50000 },
      });
      await prisma.financeAccount.create({
        data: { companyId: company.id, name: "Caja", kind: "EFECTIVO", balance: 5000 },
      });
    }

    const seller = await prisma.user.create({
      data: { username: "vendedor-p3", name: "Vendedor", passwordHash: "x", role: "VENTAS", companyId: systron.id },
    });
    const coord = await prisma.user.create({
      data: { username: "coord-p3", name: "Coordinación", passwordHash: "x", role: "COORDINACION_ADMINISTRACION" },
    });

    const client = await prisma.client.create({
      data: {
        companyId: systron.id,
        name: "Cliente PPD, S.A. de C.V.",
        active: true,
        requiresInvoice: true,
        rfc: "CPP010101AAA",
        taxRegime: "601",
        cfdiUse: "G03",
        paymentMethod: "PPD",
        fiscalZip: "64000",
        fiscalEmail: "tesoreria@clienteppd.mx",
        ownerUserId: seller.id,
      },
    });

    const systronIcClient = await prisma.client.create({
      data: {
        id: "client-intercompany-systron",
        companyId: servomotores.id,
        name: "SYSTRON",
        active: true,
        isSystem: true,
        requiresInvoice: true,
        cfdiUse: "G03",
        paymentMethod: "PPD",
      },
    });
    const smSupplier = await prisma.supplier.create({
      data: {
        id: "supplier-intercompany-servomotores",
        companyId: systron.id,
        name: "Servomotores",
        isSystem: true,
        issuesInvoice: true,
      },
    });

    const sellerActor = { userId: seller.id, role: "VENTAS" as const, activeCompanyId: systron.id, activeCompanyCode: "SYSTRON" };
    const coordSy = { userId: coord.id, role: "COORDINACION_ADMINISTRACION" as const, activeCompanyId: systron.id, activeCompanyCode: "SYSTRON" };
    const coordSm = { userId: coord.id, role: "COORDINACION_ADMINISTRACION" as const, activeCompanyId: servomotores.id, activeCompanyCode: "SERVOMOTORES" };

    // 1. Facturas de prueba: una PPD timbrada y una PUE timbrada
    const docPpd = await prisma.billingDocument.create({
      data: {
        folio: "FAC-301",
        companyId: systron.id,
        kind: "FACTURA",
        status: "EMITIDA",
        clientId: client.id,
        concept: "Servicio PPD",
        subtotal: 1000,
        iva: 160,
        total: 1160,
        rfcSnapshot: client.rfc,
        cfdiUseSnapshot: "G03",
        paymentMethodSnapshot: "PPD",
        paymentFormSnapshot: "99",
        fiscalStatus: "TIMBRADA",
        fiscalEnv: "TEST",
        fiscalExternalId: "inv_ppd_301",
        fiscalUuid: "30100000-0000-0000-0000-000000000301",
        receivable: {
          create: {
            companyId: systron.id,
            clientId: client.id,
            sellerUserId: seller.id,
            amount: 1160,
            balance: 1160,
            dueAt: new Date(),
            status: "ABIERTA",
          },
        },
      },
      include: { receivable: true },
    });

    const docPue = await prisma.billingDocument.create({
      data: {
        folio: "FAC-302",
        companyId: systron.id,
        kind: "FACTURA",
        status: "EMITIDA",
        clientId: client.id,
        concept: "Servicio PUE",
        subtotal: 500,
        iva: 80,
        total: 580,
        rfcSnapshot: client.rfc,
        cfdiUseSnapshot: "G03",
        paymentMethodSnapshot: "PUE",
        paymentFormSnapshot: "03",
        fiscalStatus: "TIMBRADA",
        fiscalEnv: "TEST",
        fiscalExternalId: "inv_pue_302",
        fiscalUuid: "30200000-0000-0000-0000-000000000302",
        receivable: {
          create: {
            companyId: systron.id,
            clientId: client.id,
            sellerUserId: seller.id,
            amount: 580,
            balance: 580,
            dueAt: new Date(),
            status: "ABIERTA",
          },
        },
      },
      include: { receivable: true },
    });

    // Pago sobre PUE -> NO genera PaymentComplement
    const payPue = await registerClientPayment(coordSy, {
      clientId: client.id,
      receivableId: docPue.receivable!.id,
      amount: 580,
      method: "TRANSFERENCIA",
      receipt: "SPEI-PUE",
      destination: "Banco",
    });
    assert.equal(await prisma.paymentComplement.count({ where: { paymentId: payPue.id } }), 0);
    const pueStampAttempt = await stampPaymentComplement(payPue.id, { isPaymentId: true });
    assert.equal(pueStampAttempt.ok, false);
    assert.equal(pueStampAttempt.status, "INELIGIBLE");

    // Pago de vendedor sobre PPD -> pendiente hasta validar; al validar en modo manual deja REP PENDIENTE
    const payPpd = await registerClientPayment(sellerActor, {
      clientId: client.id,
      receivableId: docPpd.receivable!.id,
      amount: 500,
      method: "TRANSFERENCIA",
      receipt: "SPEI-PPD-1",
      destination: "Banco",
    });
    assert.equal(payPpd.status, "PENDIENTE");
    assert.equal(await prisma.paymentComplement.count({ where: { paymentId: payPpd.id } }), 0);

    await validatePayment(coordSy, payPpd.id);
    const repManual = await prisma.paymentComplement.findUnique({ where: { paymentId: payPpd.id } });
    assert.ok(repManual);
    assert.equal(repManual.fiscalStatus, "PENDIENTE");
    assert.equal(repManual.paymentForm, "03");
    assert.equal(repManual.totalAmount, 500);
    assert.equal((await prisma.receivable.findUnique({ where: { id: docPpd.receivable!.id } }))?.balance, 660);

    // Timbrado manual del REP con payment-summary + descarga XML/PDF
    const capturedBodies: Array<Record<string, unknown>> = [];
    const fetchRepOk: typeof fetch = async (url, init) => {
      const u = String(url);
      if (u.includes("external_id=")) return jsonResponse(200, { data: [] });
      if (u.includes("/invoices/inv_ppd_301/payment-summary?amount=500")) {
        return jsonResponse(200, {
          uuid: docPpd.fiscalUuid,
          installment: 1,
          last_balance: 1160,
          amount: 500,
          taxes: [{ base: 431.03, rate: 0.16, type: "IVA", factor: "Tasa", withholding: false }],
        });
      }
      if (init?.method === "POST" && u.endsWith("/invoices")) {
        capturedBodies.push(JSON.parse(String(init.body)) as Record<string, unknown>);
        return jsonResponse(201, {
          id: "inv_rep_1",
          status: "valid",
          uuid: "99990001-0000-0000-0000-000000000001",
          series: "REP",
          folio_number: 2,
        });
      }
      if (u.endsWith("/invoices/inv_rep_1/xml")) {
        return new Response('<cfdi:Comprobante TipoDeComprobante="P"/>', { status: 200 });
      }
      if (u.endsWith("/invoices/inv_rep_1/pdf")) {
        return new Response(Buffer.from("%PDF-REP-1"), { status: 200 });
      }
      throw new Error(`Unexpected URL: ${u}`);
    };

    const stampRes = await stampPaymentComplement(repManual.id, { fetchFn: fetchRepOk });
    assert.equal(stampRes.ok, true);
    assert.equal(stampRes.status, "TIMBRADA");
    assert.equal(capturedBodies.length, 1);
    assert.equal(capturedBodies[0]!.type, "P");
    const itemsSaved = await prisma.paymentComplementItem.findMany({ where: { complementId: repManual.id } });
    assert.equal(itemsSaved.length, 1);
    assert.equal(itemsSaved[0]!.installment, 1);
    assert.equal(itemsSaved[0]!.lastBalance, 1160);
    assert.equal(itemsSaved[0]!.amountPaid, 500);
    assert.equal(itemsSaved[0]!.insoluto, 660);

    const dlRepZip = await getPaymentComplementDownload(repManual.id, "zip");
    assert.equal(dlRepZip?.buffer.subarray(0, 4).toString("binary"), "PK\x03\x04");

    // 2. autoRepOnPaymentValidation = true con fallo 4xx -> NO revierte Receivable ni Payment
    const cfgAuto = parseCompanyFiscalConfig({ code: "SYSTRON" });
    await prisma.company.update({
      where: { id: systron.id },
      data: {
        fiscalConfigJson: serializeFiscalConfigJson({
          satDefaults: defaultSatDefaultsForCompany("SYSTRON"),
          toggles: { ...cfgAuto.toggles, autoRepOnPaymentValidation: true },
        }),
      },
    });
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async () => jsonResponse(400, { message: "Fallo simulado de PAC en auto-REP" })) as typeof fetch;
    let payAutoId = "";
    try {
      const payAuto = await registerClientPayment(coordSy, {
        clientId: client.id,
        receivableId: docPpd.receivable!.id,
        amount: 200,
        method: "EFECTIVO",
        receipt: "REC-EFEC",
        destination: "Caja",
      });
      payAutoId = payAuto.id;
    } finally {
      globalThis.fetch = origFetch;
    }
    const payAutoDb = await prisma.payment.findUnique({
      where: { id: payAutoId },
      include: { paymentComplement: true },
    });
    assert.equal(payAutoDb?.status, "VALIDADO");
    assert.equal((await prisma.receivable.findUnique({ where: { id: docPpd.receivable!.id } }))?.balance, 460);
    assert.equal(payAutoDb?.paymentComplement?.fiscalStatus, "ERROR");
    assert.equal(payAutoDb?.paymentComplement?.paymentForm, "01");

    // 3. Intercompañía: pago SYSTRON -> confirma Servomotores -> REP con emisor Servomotores + 202 + webhook
    const icDoc = await prisma.billingDocument.create({
      data: {
        folio: "FAC-SM-10",
        companyId: servomotores.id,
        kind: "FACTURA_INTERCOMPANIA",
        status: "EMITIDA",
        clientId: systronIcClient.id,
        concept: "Reparación motor IC",
        subtotal: 1000,
        iva: 160,
        total: 1160,
        rfcSnapshot: systron.rfc,
        cfdiUseSnapshot: "G03",
        paymentMethodSnapshot: "PPD",
        paymentFormSnapshot: "99",
        fiscalStatus: "TIMBRADA",
        fiscalEnv: "TEST",
        fiscalExternalId: "inv_ic_10",
        fiscalUuid: "44440000-0000-0000-0000-000000000010",
        receivable: {
          create: {
            companyId: servomotores.id,
            clientId: systronIcClient.id,
            amount: 1160,
            balance: 1160,
            dueAt: new Date(),
            status: "ABIERTA",
          },
        },
        payable: {
          create: {
            companyId: systron.id,
            supplierId: smSupplier.id,
            amount: 1160,
            balance: 1160,
            dueAt: new Date(),
            status: "ABIERTA",
          },
        },
      },
      include: { payable: true, receivable: true },
    });

    const icPay = await registerIntercompanyPayment(coordSy, {
      payableId: icDoc.payable!.id,
      amount: 600,
      receipt: "SPEI-IC-1",
      destination: "Banco",
    });
    await confirmIntercompanyPayment(coordSm, icPay.id);

    const icRep = await prisma.paymentComplement.findUnique({ where: { paymentId: icPay.id } });
    assert.ok(icRep);
    assert.equal(icRep.companyId, servomotores.id);
    assert.equal(icRep.clientId, systronIcClient.id);
    assert.equal(icRep.fiscalStatus, "PENDIENTE");

    let usedAuthHeader = "";
    const fetchIc202: typeof fetch = async (url, init) => {
      const u = String(url);
      const auth = (init?.headers as Record<string, string> | undefined)?.Authorization ?? "";
      if (auth) usedAuthHeader = auth;
      if (u.includes("external_id=")) return jsonResponse(200, { data: [] });
      if (u.includes("/invoices/inv_ic_10/payment-summary?amount=600")) {
        return jsonResponse(200, {
          uuid: icDoc.fiscalUuid,
          installment: 1,
          last_balance: 1160,
          amount: 600,
          taxes: [{ base: 517.24, rate: 0.16, type: "IVA", factor: "Tasa", withholding: false }],
        });
      }
      if (init?.method === "POST" && u.endsWith("/invoices")) {
        return jsonResponse(202, { id: "inv_rep_ic_202", status: "pending", series: "REP", folio_number: 1 });
      }
      throw new Error(`Unexpected IC fetch: ${u}`);
    };

    const icStampRes = await stampPaymentComplement(icRep.id, { fetchFn: fetchIc202 });
    assert.equal(icStampRes.status, "PROCESANDO");
    assert.equal(usedAuthHeader, "Bearer sk_test_servo_rep");

    // Webhook resuelve el REP en PROCESANDO -> TIMBRADA + guarda XML/PDF
    const whRes = await processFacturapiWebhook({
      companyCode: "servomotores",
      rawBody: JSON.stringify({
        id: "evt_rep_ic_valid",
        type: "invoice.status_updated",
        livemode: false,
        organization: "org_sm_test",
        data: {
          type: "invoice",
          object: {
            id: "inv_rep_ic_202",
            external_id: icRep.id,
            status: "valid",
            uuid: "88880000-0000-0000-0000-000000000202",
            series: "REP",
            folio_number: 1,
          },
        },
      }),
      signature: "sig_ok",
      fetchFn: async (url) => {
        const u = String(url);
        if (u.endsWith("/webhooks/validate-signature")) return jsonResponse(200, { valid: true });
        if (u.endsWith("/invoices/inv_rep_ic_202/xml")) return new Response('<cfdi:Comprobante TipoDeComprobante="P" IC="1"/>', { status: 200 });
        if (u.endsWith("/invoices/inv_rep_ic_202/pdf")) return new Response(Buffer.from("%PDF-IC-REP"), { status: 200 });
        throw new Error(`Unexpected WH URL: ${u}`);
      },
    });
    assert.equal(whRes.status, 200);
    const updatedIcRep = await prisma.paymentComplement.findUnique({ where: { id: icRep.id } });
    assert.equal(updatedIcRep?.fiscalStatus, "TIMBRADA");
    assert.equal(updatedIcRep?.fiscalUuid, "88880000-0000-0000-0000-000000000202");
    assert.ok(updatedIcRep?.xmlContent?.includes('TipoDeComprobante="P"'));
    assert.ok(updatedIcRep?.pdfContent);

    // 4. Prueba 409 en REP
    const pay409 = await registerClientPayment(coordSy, {
      clientId: client.id,
      receivableId: docPpd.receivable!.id,
      amount: 100,
      method: "TRANSFERENCIA",
      receipt: "SPEI-409",
      destination: "Banco",
    });
    // Desactivamos autoRep para poder probar stampPaymentComplement directo con 409
    await prisma.paymentComplement.update({
      where: { paymentId: pay409.id },
      data: { fiscalStatus: "PENDIENTE", fiscalError: null },
    });
    const rep409 = await prisma.paymentComplement.findUnique({ where: { paymentId: pay409.id } });
    let listCalls = 0;
    const res409 = await stampPaymentComplement(rep409!.id, {
      fetchFn: async (url, init) => {
        const u = String(url);
        if (u.includes("external_id=")) {
          listCalls += 1;
          if (listCalls === 1) return jsonResponse(200, { data: [] });
          return jsonResponse(200, {
            data: [
              {
                id: "inv_rep_409",
                external_id: rep409!.id,
                status: "valid",
                uuid: "40900000-0000-0000-0000-000000000409",
              },
            ],
          });
        }
        if (u.includes("payment-summary")) {
          return jsonResponse(200, { uuid: docPpd.fiscalUuid, installment: 3, last_balance: 460, amount: 100 });
        }
        if (init?.method === "POST" && u.endsWith("/invoices")) {
          return jsonResponse(409, { ok: false, status: 409, code: "idempotency_key_in_use" });
        }
        if (u.endsWith("/invoices/inv_rep_409/xml")) return new Response("<xml-409/>", { status: 200 });
        if (u.endsWith("/invoices/inv_rep_409/pdf")) return new Response(Buffer.from("%PDF-409"), { status: 200 });
        throw new Error(`Unexpected 409 URL: ${u}`);
      },
    });
    assert.equal(res409.ok, true);
    assert.equal(res409.status, "TIMBRADA");
    assert.equal((await prisma.paymentComplement.findUnique({ where: { id: rep409!.id } }))?.fiscalExternalId, "inv_rep_409");

    await prisma.$disconnect();
  });
});
