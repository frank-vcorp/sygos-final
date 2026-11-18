import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { encryptSecret } from "./crypto";
import {
  cancelPaymentComplement,
  invoicePayload,
  processFacturapiWebhook,
} from "./facturapi";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Facturapi Fase 4: cancelación SAT, bloqueo REP y Notas de Crédito (tipo E)", () => {
  it("arma payload CFDI tipo E con related_documents relación 01", () => {
    const built = invoicePayload({
      type: "E",
      externalId: "nc_1",
      idempotencyKey: "sygos-nc_1-a1",
      customerName: "Aceros del Norte, S.A. de C.V.",
      rfc: "ANO010101AAA",
      taxSystem: "601",
      cfdiUse: "G02",
      paymentMethod: "PUE",
      paymentForm: "03",
      zip: "64000",
      email: "cxp@aceros.mx",
      series: "NC",
      folioNumber: 1,
      relatedDocuments: [{ relationship: "01", documents: ["11111111-1111-1111-1111-111111111111"] }],
      lines: [{ concept: "Bonificación", quantity: 1, unitPrice: 200, taxIncluded: false }],
      iva: 32,
    });
    assert.ok(built.body);
    assert.equal(built.body.type, "E");
    assert.equal(built.body.use, "G02");
    assert.deepEqual(built.body.related_documents, [
      { relationship: "01", documents: ["11111111-1111-1111-1111-111111111111"] },
    ]);
  });

  it("ejecuta gobernanza de cancelación, bloqueo por REP, flujo pending/accepted, intercompañía y Nota de Crédito", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sygos-facturapi-p4-"));
    process.env.DATABASE_URL = `file:${join(dir, "test.db")}`;
    execSync("npx prisma db push --skip-generate", {
      cwd: join(import.meta.dirname, "../.."),
      env: process.env,
      stdio: "ignore",
    });

    const { prisma } = await import("./db");
    const {
      authorizeDocumentCancellation,
      executeDocumentCancellation,
      issueCreditNote,
      registerClientPayment,
      requestDocumentCancellation,
      requestFromQuote,
    } = await import("./billing");
    const { getCancellationReceiptDownload } = await import("./billing-artifacts");

    const systron = await prisma.company.create({
      data: {
        code: "SYSTRON",
        name: "SYSTRON",
        legalName: "SYSTRON INDUSTRIAL, S.A. DE C.V.",
        rfc: "SYS010101AAA",
        taxRegime: "601",
        postalCode: "64000",
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
        secretEnc: encryptSecret("sk_test_sy_p4"),
        secretHint: "••••_p4",
        extra: JSON.stringify({
          organizationId: "org_sy_p4",
          webhookSecretEnc: encryptSecret("whsec_sy_p4"),
        }),
      },
    });

    await prisma.financeAccount.create({
      data: { companyId: systron.id, name: "Banco", kind: "BANCARIA", balance: 50000 },
    });

    const seller = await prisma.user.create({
      data: { username: "vendedor-p4", name: "Vendedor", passwordHash: "x", role: "VENTAS", companyId: systron.id },
    });
    const coord = await prisma.user.create({
      data: { username: "coord-p4", name: "Coordinación", passwordHash: "x", role: "COORDINACION_ADMINISTRACION" },
    });
    const ceo = await prisma.user.create({
      data: { username: "ceo-p4", name: "CEO", passwordHash: "x", role: "CEO" },
    });

    const client = await prisma.client.create({
      data: {
        companyId: systron.id,
        name: "Cliente Fase 4, S.A. de C.V.",
        active: true,
        requiresInvoice: true,
        rfc: "CF4010101AAA",
        taxRegime: "601",
        cfdiUse: "G03",
        paymentMethod: "PPD",
        fiscalZip: "64000",
        ownerUserId: seller.id,
      },
    });
    const icClient = await prisma.client.create({
      data: {
        id: "client-intercompany-systron",
        companyId: servomotores.id,
        name: "SYSTRON",
        active: true,
        isSystem: true,
        requiresInvoice: true,
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
    const coordActor = { userId: coord.id, role: "COORDINACION_ADMINISTRACION" as const, activeCompanyId: systron.id, activeCompanyCode: "SYSTRON" };
    const ceoActor = { userId: ceo.id, role: "CEO" as const, activeCompanyId: systron.id, activeCompanyCode: "SYSTRON" };

    // 1. Gobernanza: motivo 01 exige factura sustituta; solo CEO/Admin autoriza
    const quote1 = await prisma.quote.create({
      data: {
        folio: "COT-401",
        companyId: systron.id,
        clientId: client.id,
        quoteType: "REPARACION",
        status: "AUTORIZADA",
        sellerUserId: seller.id,
        lines: { create: [{ concept: "Reparación", quantity: 1, unitPrice: 1000, authorized: true }] },
      },
    });
    const doc1 = await requestFromQuote(sellerActor, quote1.id, "FACTURA", null);
    await prisma.billingDocument.update({
      where: { id: doc1.id },
      data: {
        status: "EMITIDA",
        fiscalStatus: "TIMBRADA",
        fiscalEnv: "TEST",
        fiscalExternalId: "inv_401",
        fiscalUuid: "40100000-0000-0000-0000-000000000401",
        paymentMethodSnapshot: "PUE",
        paymentFormSnapshot: "03",
      },
    });
    await prisma.receivable.create({
      data: {
        companyId: systron.id,
        documentId: doc1.id,
        clientId: client.id,
        sellerUserId: seller.id,
        amount: 1160,
        balance: 1160,
        dueAt: new Date(),
        status: "ABIERTA",
      },
    });

    await assert.rejects(
      () => requestDocumentCancellation(coordActor, doc1.id, { motive: "01" }),
      /factura sustituta/i,
    );

    await requestDocumentCancellation(coordActor, doc1.id, { motive: "02" });
    await assert.rejects(
      () => authorizeDocumentCancellation(coordActor, doc1.id),
      /CEO o Administrador/i,
    );
    await assert.rejects(
      () => executeDocumentCancellation(coordActor, doc1.id),
      /autorizada/i,
    );
    await authorizeDocumentCancellation(ceoActor, doc1.id);

    // 2. Cancelación inmediata (accepted) + descarga acuse + libera saldo de cotización y cierra CxC
    const fetchAccepted: typeof fetch = async (url, init) => {
      const u = String(url);
      if (init?.method === "DELETE" && u.includes("/invoices/inv_401?motive=02")) {
        return jsonResponse(200, { id: "inv_401", status: "canceled", cancellation_status: "accepted" });
      }
      if (u.endsWith("/invoices/inv_401/cancellation_receipt/xml")) {
        return new Response("<AcuseCancelacion UUID='401'/>", { status: 200 });
      }
      if (u.endsWith("/invoices/inv_401/cancellation_receipt/pdf")) {
        return new Response(Buffer.from("%PDF-ACUSE-401"), { status: 200 });
      }
      throw new Error(`Unexpected URL: ${u}`);
    };

    const cancel1 = await executeDocumentCancellation(coordActor, doc1.id, { fetchFn: fetchAccepted });
    assert.equal(cancel1.ok, true);
    assert.equal(cancel1.status, "CANCELADA");

    const doc1After = await prisma.billingDocument.findUnique({
      where: { id: doc1.id },
      include: { receivable: true },
    });
    assert.equal(doc1After?.status, "CANCELADA");
    assert.equal(doc1After?.fiscalStatus, "CANCELADA");
    assert.equal(doc1After?.cancellationStatus, "accepted");
    assert.equal(doc1After?.receivable?.status, "CANCELADA");
    assert.equal(doc1After?.receivable?.balance, 0);

    const acusePdf = await getCancellationReceiptDownload(doc1.id, "pdf");
    const acuseXml = await getCancellationReceiptDownload(doc1.id, "xml");
    assert.equal(acusePdf?.buffer.toString("utf8"), "%PDF-ACUSE-401");
    assert.equal(acuseXml?.buffer.toString("utf8"), "<AcuseCancelacion UUID='401'/>");

    // Cotización queda libre para refacturar (sustitución)
    const docSub = await requestFromQuote(sellerActor, quote1.id, "FACTURA", null);
    assert.equal(docSub.status, "SOLICITADA");

    // 3. Bloqueo por REP vigente en PPD -> cancelar REP -> desbloqueo -> cancelación pending -> webhook rejected/accepted
    const docPpd = await prisma.billingDocument.create({
      data: {
        folio: "FAC-402",
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
        fiscalExternalId: "inv_ppd_402",
        fiscalUuid: "40200000-0000-0000-0000-000000000402",
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

    const payPpd = await registerClientPayment(coordActor, {
      clientId: client.id,
      receivableId: docPpd.receivable!.id,
      amount: 500,
      method: "TRANSFERENCIA",
      receipt: "SPEI-402",
      destination: "Banco",
    });
    const appRow = await prisma.paymentApplication.findFirst({ where: { paymentId: payPpd.id } });
    const rep = await prisma.paymentComplement.update({
      where: { paymentId: payPpd.id },
      data: {
        fiscalStatus: "TIMBRADA",
        fiscalEnv: "TEST",
        fiscalExternalId: "inv_rep_402",
        fiscalUuid: "94020000-0000-0000-0000-000000000001",
      },
    });
    await prisma.paymentComplementItem.create({
      data: {
        complementId: rep.id,
        billingDocumentId: docPpd.id,
        paymentApplicationId: appRow!.id,
        installment: 1,
        lastBalance: 1160,
        amountPaid: 500,
        insoluto: 660,
      },
    });

    await requestDocumentCancellation(coordActor, docPpd.id, { motive: "03" });
    await authorizeDocumentCancellation(ceoActor, docPpd.id);

    // Bloqueada porque el REP sigue TIMBRADA
    await assert.rejects(
      () => executeDocumentCancellation(coordActor, docPpd.id),
      /Complemento\(s\) de Pago \(REP\) vigente/i,
    );

    // Cancelar el REP primero
    const cancelRepRes = await cancelPaymentComplement(rep.id, {
      motive: "02",
      actorUserId: ceo.id,
      fetchFn: async (url, init) => {
        const u = String(url);
        if (init?.method === "DELETE" && u.includes("/invoices/inv_rep_402?motive=02")) {
          return jsonResponse(200, { id: "inv_rep_402", status: "canceled", cancellation_status: "accepted" });
        }
        return new Response("", { status: 404 });
      },
    });
    assert.equal(cancelRepRes.ok, true);
    assert.equal((await prisma.paymentComplement.findUnique({ where: { id: rep.id } }))?.fiscalStatus, "CANCELADA");

    // Ahora la factura PPD puede iniciar cancelación SAT -> responde pending
    const cancelPendingRes = await executeDocumentCancellation(coordActor, docPpd.id, {
      fetchFn: async (url, init) => {
        const u = String(url);
        if (init?.method === "DELETE" && u.includes("/invoices/inv_ppd_402?motive=03")) {
          return jsonResponse(200, { id: "inv_ppd_402", status: "valid", cancellation_status: "pending" });
        }
        return new Response("", { status: 404 });
      },
    });
    assert.equal(cancelPendingRes.ok, true);
    assert.equal(cancelPendingRes.cancellationStatus, "pending");
    const docPpdPending = await prisma.billingDocument.findUnique({ where: { id: docPpd.id } });
    assert.equal(docPpdPending?.status, "EMITIDA");
    assert.equal(docPpdPending?.cancellationStatus, "pending");

    // Webhook cancellation_status_updated -> rejected (sigue EMITIDA)
    const whRejected = await processFacturapiWebhook({
      companyCode: "systron",
      rawBody: JSON.stringify({
        id: "evt_cancel_rej",
        type: "invoice.cancellation_status_updated",
        livemode: false,
        organization: "org_sy_p4",
        data: {
          type: "invoice",
          object: { id: "inv_ppd_402", status: "valid", cancellation_status: "rejected" },
        },
      }),
      signature: "sig_ok",
      fetchFn: async (url) => {
        if (String(url).endsWith("/webhooks/validate-signature")) return jsonResponse(200, { valid: true });
        return new Response("", { status: 404 });
      },
    });
    assert.equal(whRejected.status, 200);
    assert.equal((await prisma.billingDocument.findUnique({ where: { id: docPpd.id } }))?.cancellationStatus, "rejected");
    assert.equal((await prisma.billingDocument.findUnique({ where: { id: docPpd.id } }))?.status, "EMITIDA");

    // Webhook cancellation_status_updated -> accepted (finaliza CANCELADA)
    const whAccepted = await processFacturapiWebhook({
      companyCode: "systron",
      rawBody: JSON.stringify({
        id: "evt_cancel_acc",
        type: "invoice.cancellation_status_updated",
        livemode: false,
        organization: "org_sy_p4",
        data: {
          type: "invoice",
          object: { id: "inv_ppd_402", status: "canceled", cancellation_status: "accepted" },
        },
      }),
      signature: "sig_ok",
      fetchFn: async (url) => {
        const u = String(url);
        if (u.endsWith("/webhooks/validate-signature")) return jsonResponse(200, { valid: true });
        if (u.endsWith("/invoices/inv_ppd_402/cancellation_receipt/xml")) return new Response("<Acuse402/>", { status: 200 });
        if (u.endsWith("/invoices/inv_ppd_402/cancellation_receipt/pdf")) return new Response(Buffer.from("%PDF-402"), { status: 200 });
        return new Response("", { status: 404 });
      },
    });
    assert.equal(whAccepted.status, 200);
    const docPpdFinal = await prisma.billingDocument.findUnique({ where: { id: docPpd.id } });
    assert.equal(docPpdFinal?.status, "CANCELADA");
    assert.equal(docPpdFinal?.fiscalStatus, "CANCELADA");
    assert.equal(docPpdFinal?.cancellationStatus, "accepted");

    // 4. Cancelación de Payable intercompañía sin pagos
    const icDoc = await prisma.billingDocument.create({
      data: {
        folio: "FAC-SM-403",
        companyId: servomotores.id,
        kind: "FACTURA_INTERCOMPANIA",
        status: "EMITIDA",
        clientId: icClient.id,
        concept: "IC Cancel",
        subtotal: 500,
        iva: 80,
        total: 580,
        fiscalStatus: "PENDIENTE",
        receivable: {
          create: { companyId: servomotores.id, clientId: icClient.id, amount: 580, balance: 580, dueAt: new Date(), status: "ABIERTA" },
        },
        payable: {
          create: { companyId: systron.id, supplierId: smSupplier.id, amount: 580, balance: 580, dueAt: new Date(), status: "ABIERTA" },
        },
      },
      include: { receivable: true, payable: true },
    });
    const ceoSm = { userId: ceo.id, role: "CEO" as const, activeCompanyId: servomotores.id, activeCompanyCode: "SERVOMOTORES" };
    await requestDocumentCancellation(ceoSm, icDoc.id, { motive: "03" });
    await authorizeDocumentCancellation(ceoSm, icDoc.id);
    await executeDocumentCancellation(ceoSm, icDoc.id);
    assert.equal((await prisma.receivable.findUnique({ where: { id: icDoc.receivable!.id } }))?.status, "CANCELADA");
    assert.equal((await prisma.payable.findUnique({ where: { id: icDoc.payable!.id } }))?.status, "CANCELADA");
    assert.equal((await prisma.payable.findUnique({ where: { id: icDoc.payable!.id } }))?.balance, 0);

    // 5. Nota de Crédito (CFDI tipo E, relación 01) y reducción/restauración de Receivable
    const docForNc = await prisma.billingDocument.create({
      data: {
        folio: "FAC-404",
        companyId: systron.id,
        kind: "FACTURA",
        status: "EMITIDA",
        clientId: client.id,
        concept: "Servicio base NC",
        subtotal: 1000,
        iva: 160,
        total: 1160,
        rfcSnapshot: client.rfc,
        cfdiUseSnapshot: "G03",
        paymentMethodSnapshot: "PUE",
        paymentFormSnapshot: "03",
        fiscalStatus: "TIMBRADA",
        fiscalEnv: "TEST",
        fiscalExternalId: "inv_404",
        fiscalUuid: "40400000-0000-0000-0000-000000000404",
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

    const ncPayloads: Array<Record<string, unknown>> = [];
    const nc = await issueCreditNote(
      coordActor,
      docForNc.id,
      { concept: "Bonificación por ajuste", amount: 300, cfdiUse: "G02", paymentForm: "03" },
      {
        fetchFn: async (url, init) => {
          const u = String(url);
          if (u.includes("external_id=")) return jsonResponse(200, { data: [] });
          if (init?.method === "POST" && u.endsWith("/invoices")) {
            ncPayloads.push(JSON.parse(String(init.body)) as Record<string, unknown>);
            return jsonResponse(201, {
              id: "inv_nc_1",
              status: "valid",
              uuid: "E0000001-0000-0000-0000-000000000001",
              series: "NC",
              folio_number: 1,
            });
          }
          if (u.endsWith("/invoices/inv_nc_1/xml")) return new Response("<cfdi:Comprobante TipoDeComprobante='E'/>", { status: 200 });
          if (u.endsWith("/invoices/inv_nc_1/pdf")) return new Response(Buffer.from("%PDF-NC-1"), { status: 200 });
          throw new Error(`Unexpected NC URL: ${u}`);
        },
      },
    );

    assert.match(nc.folio, /^NC-/);
    assert.equal(nc.kind, "NOTA_CREDITO");
    assert.equal(nc.relatedDocumentId, docForNc.id);
    assert.equal(nc.satRelationType, "01");
    assert.equal(ncPayloads.length, 1);
    assert.equal(ncPayloads[0]!.type, "E");
    assert.equal(ncPayloads[0]!.use, "G02");
    assert.deepEqual(ncPayloads[0]!.related_documents, [
      { relationship: "01", documents: ["40400000-0000-0000-0000-000000000404"] },
    ]);

    const ncSaved = await prisma.billingDocument.findUnique({ where: { id: nc.id } });
    assert.equal(ncSaved?.fiscalStatus, "TIMBRADA");
    assert.equal(ncSaved?.fiscalUuid, "E0000001-0000-0000-0000-000000000001");
    const recAfterNc = await prisma.receivable.findUnique({ where: { id: docForNc.receivable!.id } });
    assert.equal(recAfterNc?.balance, 860);
    assert.equal(recAfterNc?.status, "PARCIAL");

    // No permite exceder el saldo acreditable restante (860)
    await assert.rejects(
      () => issueCreditNote(coordActor, docForNc.id, { concept: "Exceso", amount: 900 }),
      /excede el saldo acreditable/i,
    );

    // Cancelar la Nota de Crédito restaura el saldo en Receivable
    await requestDocumentCancellation(coordActor, nc.id, { motive: "02" });
    await authorizeDocumentCancellation(ceoActor, nc.id);
    await executeDocumentCancellation(coordActor, nc.id, {
      fetchFn: async (url, init) => {
        if (init?.method === "DELETE") {
          return jsonResponse(200, { id: "inv_nc_1", status: "canceled", cancellation_status: "accepted" });
        }
        return new Response("", { status: 404 });
      },
    });
    const recRestored = await prisma.receivable.findUnique({ where: { id: docForNc.receivable!.id } });
    assert.equal(recRestored?.balance, 1160);
    assert.equal(recRestored?.status, "ABIERTA");

    await prisma.$disconnect();
  });
});
