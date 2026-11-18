import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { encryptSecret } from "./crypto";
import {
  canDownloadBillingDocument,
  resolveBillingDocumentEmailRecipient,
  resolveBillingDocumentWhatsAppPhone,
} from "./billing-delivery";
import {
  processFacturapiWebhook,
  registerOrVerifyFacturapiWebhook,
  stampBillingDocument,
} from "./facturapi";
import { buildZipBuffer } from "./zip";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Facturapi Fase 2: permisos de descarga y ZIP", () => {
  it("valida permisos por rol, empresa emisora y Payable intercompañía en SYSTRON", () => {
    const ownDoc = {
      companyId: "comp_sm",
      kind: "FACTURA",
      clientOwnerUserId: "u_seller1",
      payableCompanyId: null,
    };
    const icDoc = {
      companyId: "comp_sm",
      kind: "FACTURA_INTERCOMPANIA",
      clientOwnerUserId: null,
      payableCompanyId: "comp_sy",
    };

    assert.equal(canDownloadBillingDocument(null, ownDoc), false);
    assert.equal(
      canDownloadBillingDocument(
        { userId: "u_coord", role: "COORDINACION_ADMINISTRACION", activeCompanyId: "comp_sm", activeCompanyCode: "SERVOMOTORES" },
        ownDoc,
      ),
      true,
    );
    assert.equal(
      canDownloadBillingDocument(
        { userId: "u_seller1", role: "VENTAS", activeCompanyId: "comp_sm", activeCompanyCode: "SERVOMOTORES" },
        ownDoc,
      ),
      false, // VENTAS no opera en SERVOMOTORES
    );
    assert.equal(
      canDownloadBillingDocument(
        { userId: "u_seller1", role: "VENTAS", activeCompanyId: "comp_sy", activeCompanyCode: "SYSTRON" },
        { ...ownDoc, companyId: "comp_sy" },
      ),
      true,
    );
    assert.equal(
      canDownloadBillingDocument(
        { userId: "u_seller2", role: "VENTAS", activeCompanyId: "comp_sy", activeCompanyCode: "SYSTRON" },
        { ...ownDoc, companyId: "comp_sy" },
      ),
      false,
    );
    assert.equal(
      canDownloadBillingDocument(
        { userId: "u_tec", role: "TECNICO", activeCompanyId: "comp_sm", activeCompanyCode: "SERVOMOTORES" },
        ownDoc,
      ),
      false,
    );

    // SYSTRON descargando XML/PDF de factura intercompañía ligada a su Payable
    assert.equal(
      canDownloadBillingDocument(
        { userId: "u_coord", role: "COORDINACION_ADMINISTRACION", activeCompanyId: "comp_sy", activeCompanyCode: "SYSTRON" },
        icDoc,
      ),
      true,
    );
    assert.equal(
      canDownloadBillingDocument(
        { userId: "u_ceo", role: "CEO", activeCompanyId: "comp_sy", activeCompanyCode: "SYSTRON" },
        icDoc,
      ),
      true,
    );
    assert.equal(
      canDownloadBillingDocument(
        { userId: "u_seller1", role: "VENTAS", activeCompanyId: "comp_sy", activeCompanyCode: "SYSTRON" },
        icDoc,
      ),
      false,
    );
  });

  it("construye un ZIP válido con cabeceras PKZIP", () => {
    const zip = buildZipBuffer([
      { name: "FAC-1.xml", content: Buffer.from("<cfdi:Comprobante />", "utf8") },
      { name: "FAC-1.pdf", content: Buffer.from("%PDF-1.4\n...", "utf8") },
    ]);
    assert.equal(zip.subarray(0, 4).toString("binary"), "PK\x03\x04");
    assert.ok(zip.includes(Buffer.from("FAC-1.xml", "utf8")));
    assert.ok(zip.includes(Buffer.from("FAC-1.pdf", "utf8")));
  });

  it("resuelve correo fiscal > contacto principal y teléfono principal para entrega", () => {
    const email = resolveBillingDocumentEmailRecipient({
      client: {
        fiscalEmail: "cfdi@cliente.mx",
        contacts: [{ email: "ventas@cliente.mx", isPrimary: true }],
      },
    });
    assert.equal(email, "cfdi@cliente.mx");

    const fallbackEmail = resolveBillingDocumentEmailRecipient({
      client: {
        fiscalEmail: null,
        contacts: [
          { email: "secundario@cliente.mx", isPrimary: false },
          { email: "principal@cliente.mx", isPrimary: true },
        ],
      },
    });
    assert.equal(fallbackEmail, "principal@cliente.mx");

    const phone = resolveBillingDocumentWhatsAppPhone({
      client: {
        contacts: [
          { phone: "8100000001", isPrimary: false },
          { phone: "8100000002", isPrimary: true },
        ],
      },
    });
    assert.equal(phone, "8100000002");
  });
});

describe("Facturapi Fase 2: persistencia XML/PDF, webhooks y envío SendGrid/WhatsApp", () => {
  it("descarga/persiste XML y PDF, procesa webhooks idempotentes y envía por correo/WhatsApp sin bloquear", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sygos-facturapi-p2-"));
    process.env.DATABASE_URL = `file:${join(dir, "test.db")}`;
    execSync("npx prisma db push --skip-generate", {
      cwd: join(import.meta.dirname, "../.."),
      env: process.env,
      stdio: "ignore",
    });

    const { prisma } = await import("./db");
    const { getBillingDocumentDownload } = await import("./billing-artifacts");
    const { sendBillingDocumentByEmail, sendBillingDocumentByWhatsApp } = await import("./billing-delivery");
    const { serializeSendGridExtra } = await import("./sendgrid");

    const systron = await prisma.company.create({
      data: {
        code: "SYSTRON",
        name: "SYSTRON",
        legalName: "SYSTRON INDUSTRIAL",
        rfc: "SYS010101AAA",
        taxRegime: "601",
        postalCode: "64000",
        facturapiMode: "TEST",
      },
    });

    await prisma.integrationSetting.create({
      data: {
        companyId: systron.id,
        provider: "FACTURAPI_TEST",
        secretEnc: encryptSecret("sk_test_systron_wh"),
        secretHint: "••••n_wh",
        extra: JSON.stringify({
          organizationId: "org_systron_test",
          webhookSecretEnc: encryptSecret("whsec_test_123"),
          webhookSecretHint: "••••_123",
        }),
      },
    });

    const client = await prisma.client.create({
      data: {
        companyId: systron.id,
        name: "Cliente Demo, S.A. de C.V.",
        active: true,
        requiresInvoice: true,
        rfc: "CDE010101AAA",
        taxRegime: "601",
        cfdiUse: "G03",
        paymentMethod: "PUE",
        fiscalZip: "64000",
        fiscalEmail: "facturas@demo.mx",
        contacts: {
          create: { name: "Contacto", phone: "8112345678", email: "contacto@demo.mx", isPrimary: true },
        },
      },
    });

    // 1. Documento timbrado con XML/PDF descargados al timbrar (200)
    const doc = await prisma.billingDocument.create({
      data: {
        folio: "FAC-201",
        companyId: systron.id,
        kind: "FACTURA",
        status: "EMITIDA",
        clientId: client.id,
        concept: "Servicio",
        subtotal: 1000,
        iva: 160,
        total: 1160,
        rfcSnapshot: client.rfc,
        cfdiUseSnapshot: "G03",
        paymentMethodSnapshot: "PUE",
        paymentFormSnapshot: "03",
        fiscalStatus: "PENDIENTE",
        lines: { create: [{ concept: "Servicio", quantity: 1, unitPrice: 1000, amount: 1000 }] },
      },
    });

    const xmlSample = '<?xml version="1.0"?><cfdi:Comprobante Folio="201" Total="1160.00"/>';
    const pdfSample = Buffer.from("%PDF-1.4\nFacturapi-FAC-201\n%%EOF", "utf8");

    const fetchStampWithFiles: typeof fetch = async (url, init) => {
      const u = String(url);
      if (u.includes("external_id=")) return jsonResponse(200, { data: [] });
      if (init?.method === "POST" && u.endsWith("/invoices")) {
        return jsonResponse(201, {
          id: "inv_201",
          status: "valid",
          uuid: "20100000-0000-0000-0000-000000000201",
          series: "FAC",
          folio_number: 201,
        });
      }
      if (u.endsWith("/invoices/inv_201/xml")) {
        return new Response(xmlSample, { status: 200, headers: { "Content-Type": "application/xml" } });
      }
      if (u.endsWith("/invoices/inv_201/pdf")) {
        return new Response(pdfSample, { status: 200, headers: { "Content-Type": "application/pdf" } });
      }
      throw new Error(`Unexpected URL: ${u}`);
    };

    await stampBillingDocument(doc.id, { fetchFn: fetchStampWithFiles });
    const stamped = await prisma.billingDocument.findUnique({ where: { id: doc.id } });
    assert.equal(stamped?.fiscalStatus, "TIMBRADA");
    assert.equal(stamped?.xmlContent, xmlSample);
    assert.ok(stamped?.pdfContent);
    assert.equal(Buffer.from(stamped.pdfContent).toString("utf8"), pdfSample.toString("utf8"));

    // Descargas cacheadas sin red
    const failingFetch: typeof fetch = async () => {
      throw new Error("No debería llamar red si ya está cacheado");
    };
    const dlXml = await getBillingDocumentDownload(doc.id, "xml", { fetchFn: failingFetch });
    const dlPdf = await getBillingDocumentDownload(doc.id, "pdf", { fetchFn: failingFetch });
    const dlZip = await getBillingDocumentDownload(doc.id, "zip", { fetchFn: failingFetch });
    assert.equal(dlXml?.filename, "FAC-201.xml");
    assert.equal(dlXml?.buffer.toString("utf8"), xmlSample);
    assert.equal(dlPdf?.filename, "FAC-201.pdf");
    assert.equal(dlZip?.filename, "FAC-201.zip");
    assert.equal(dlZip?.buffer.subarray(0, 4).toString("binary"), "PK\x03\x04");

    // 2. Fallback automático a Facturapi cuando falta PDF/XML en BD
    await prisma.billingDocument.update({ where: { id: doc.id }, data: { xmlContent: null, pdfContent: null } });
    const dlPdfFallback = await getBillingDocumentDownload(doc.id, "pdf", { fetchFn: fetchStampWithFiles });
    assert.equal(dlPdfFallback?.buffer.toString("utf8"), pdfSample.toString("utf8"));
    const recached = await prisma.billingDocument.findUnique({ where: { id: doc.id } });
    assert.equal(recached?.xmlContent, xmlSample);
    assert.ok(recached?.pdfContent);

    // 3. Webhooks: firma inválida, modo mismatch, valid + idempotencia, failed
    const docAsync = await prisma.billingDocument.create({
      data: {
        folio: "FAC-202",
        companyId: systron.id,
        kind: "FACTURA",
        status: "EMITIDA",
        clientId: client.id,
        concept: "Async",
        subtotal: 500,
        iva: 80,
        total: 580,
        fiscalStatus: "PROCESANDO",
        fiscalEnv: "TEST",
        fiscalExternalId: "inv_async_202",
        lines: { create: [{ concept: "Async", quantity: 1, unitPrice: 500, amount: 500 }] },
      },
    });

    const webhookFetch: typeof fetch = async (url, init) => {
      const u = String(url);
      if (u.endsWith("/webhooks/validate-signature")) {
        const parsed = JSON.parse(String(init?.body)) as { signature?: string };
        if (parsed.signature === "sig_valid") {
          return jsonResponse(200, { valid: true });
        }
        return jsonResponse(400, { code: "webhook_signature_invalid", message: "Firma inválida" });
      }
      if (u.endsWith("/invoices/inv_async_202/xml")) {
        return new Response('<cfdi:Comprobante Folio="202"/>', { status: 200 });
      }
      if (u.endsWith("/invoices/inv_async_202/pdf")) {
        return new Response(Buffer.from("%PDF-202"), { status: 200 });
      }
      throw new Error(`Unexpected webhook fetch: ${u}`);
    };

    // Sin firma -> 401
    const noSig = await processFacturapiWebhook({
      companyCode: "systron",
      rawBody: JSON.stringify({ id: "evt_0", type: "invoice.status_updated", livemode: false }),
      signature: null,
      fetchFn: webhookFetch,
    });
    assert.equal(noSig.status, 401);

    // Firma inválida -> 401
    const badSig = await processFacturapiWebhook({
      companyCode: "systron",
      rawBody: JSON.stringify({ id: "evt_0", type: "invoice.status_updated", livemode: false }),
      signature: "sig_bad",
      fetchFn: webhookFetch,
    });
    assert.equal(badSig.status, 401);

    // Organización distinta -> 403
    const wrongOrg = await processFacturapiWebhook({
      companyCode: "systron",
      rawBody: JSON.stringify({
        id: "evt_org",
        type: "invoice.status_updated",
        livemode: false,
        organization: "org_otra",
      }),
      signature: "sig_valid",
      fetchFn: webhookFetch,
    });
    assert.equal(wrongOrg.status, 403);

    // Modo mismatch (empresa TEST recibe livemode: true — requiere webhook secret live si valida firma)
    await prisma.integrationSetting.create({
      data: {
        companyId: systron.id,
        provider: "FACTURAPI_LIVE",
        secretEnc: encryptSecret("sk_live_systron_wh"),
        secretHint: "••••e_wh",
        extra: JSON.stringify({
          organizationId: "org_systron_test",
          webhookSecretEnc: encryptSecret("whsec_live_123"),
        }),
      },
    });
    const modeMismatch = await processFacturapiWebhook({
      companyCode: "systron",
      rawBody: JSON.stringify({
        id: "evt_live_ignored",
        type: "invoice.status_updated",
        livemode: true,
        organization: "org_systron_test",
        data: { object: { id: "inv_async_202", status: "valid" } },
      }),
      signature: "sig_valid",
      fetchFn: webhookFetch,
    });
    assert.equal(modeMismatch.status, 200);
    assert.equal(modeMismatch.body.ignored, true);
    assert.equal((await prisma.billingDocument.findUnique({ where: { id: docAsync.id } }))?.fiscalStatus, "PROCESANDO");

    // Evento válido status=valid -> TIMBRADA + descarga XML/PDF + idempotencia
    const validRaw = JSON.stringify({
      id: "evt_202_valid",
      type: "invoice.status_updated",
      livemode: false,
      organization: "org_systron_test",
      data: {
        type: "invoice",
        object: {
          id: "inv_async_202",
          external_id: docAsync.id,
          status: "valid",
          uuid: "20200000-0000-0000-0000-000000000202",
          series: "FAC",
          folio_number: 202,
        },
      },
    });
    const okEv = await processFacturapiWebhook({
      companyCode: "systron",
      rawBody: validRaw,
      signature: "sig_valid",
      fetchFn: webhookFetch,
    });
    assert.equal(okEv.status, 200);
    assert.equal(okEv.body.duplicate, undefined);
    const updatedAsync = await prisma.billingDocument.findUnique({ where: { id: docAsync.id } });
    assert.equal(updatedAsync?.fiscalStatus, "TIMBRADA");
    assert.equal(updatedAsync?.fiscalUuid, "20200000-0000-0000-0000-000000000202");
    assert.equal(updatedAsync?.xmlContent, '<cfdi:Comprobante Folio="202"/>');
    assert.ok(updatedAsync?.pdfContent);

    // Reenvío del mismo event.id -> duplicate: true
    const dupEv = await processFacturapiWebhook({
      companyCode: "systron",
      rawBody: validRaw,
      signature: "sig_valid",
      fetchFn: webhookFetch,
    });
    assert.equal(dupEv.status, 200);
    assert.equal(dupEv.body.duplicate, true);

    // Evento failed -> ERROR + libera fiscalExternalId para reintento
    const docFail = await prisma.billingDocument.create({
      data: {
        folio: "FAC-203",
        companyId: systron.id,
        kind: "FACTURA",
        status: "EMITIDA",
        clientId: client.id,
        concept: "Async Fail",
        subtotal: 100,
        iva: 16,
        total: 116,
        fiscalStatus: "PROCESANDO",
        fiscalEnv: "TEST",
        fiscalExternalId: "inv_async_203",
        fiscalIdempotencyKey: "sygos-doc203-a1",
        lines: { create: [{ concept: "Async Fail", quantity: 1, unitPrice: 100, amount: 100 }] },
      },
    });
    const failRes = await processFacturapiWebhook({
      companyCode: "systron",
      rawBody: JSON.stringify({
        id: "evt_203_fail",
        type: "invoice.status_updated",
        livemode: false,
        organization: "org_systron_test",
        related_resource_messages: [
          { severity: "error", message: "El RFC del receptor no está en la lista del SAT" },
        ],
        data: { object: { id: "inv_async_203", status: "failed" } },
      }),
      signature: "sig_valid",
      fetchFn: webhookFetch,
    });
    assert.equal(failRes.status, 200);
    const failedDoc = await prisma.billingDocument.findUnique({ where: { id: docFail.id } });
    assert.equal(failedDoc?.fiscalStatus, "ERROR");
    assert.equal(failedDoc?.fiscalExternalId, null);
    assert.match(failedDoc?.fiscalError ?? "", /RFC del receptor/);
    assert.equal(failedDoc?.fiscalIdempotencyKey, `sygos-${docFail.id}-a2`);

    // 4. Registro / verificación de webhook en Facturapi
    const registerRes = await registerOrVerifyFacturapiWebhook({
      secret: "sk_test_systron_wh",
      targetUrl: "https://erp.systron.mx/api/webhooks/facturapi/systron",
      hasLocalWebhookSecret: false,
      fetchFn: async (url, init) => {
        const u = String(url);
        if (u.includes("/webhooks?limit=100")) return jsonResponse(200, { data: [] });
        if (init?.method === "POST" && u.endsWith("/webhooks")) {
          return jsonResponse(201, {
            id: "wh_new_1",
            url: "https://erp.systron.mx/api/webhooks/facturapi/systron",
            secret: "whsec_generated_xyz",
            status: "enabled",
          });
        }
        throw new Error(`Unexpected register webhook URL: ${u}`);
      },
    });
    assert.equal(registerRes.ok, true);
    assert.equal(registerRes.created, true);
    assert.equal(registerRes.webhookId, "wh_new_1");
    assert.equal(registerRes.secret, "whsec_generated_xyz");

    // 5. Envío por correo (SendGrid API con adjuntos XML+PDF) y WhatsApp no bloqueante
    await prisma.integrationSetting.create({
      data: {
        companyId: systron.id,
        provider: "SENDGRID",
        secretEnc: encryptSecret("SG.test_sendgrid_key"),
        secretHint: "••••_key",
        extra: serializeSendGridExtra({
          enabled: true,
          host: "test.sendgrid.net",
          port: 587,
          username: "apikey",
          fromEmail: "facturas@systron.mx",
          fromName: "SYSTRON",
        }),
      },
    });

    const originalFetch = globalThis.fetch;
    const sentEmails: Array<{ to: string; attachments: Array<{ filename: string; type: string }> }> = [];
    globalThis.fetch = (async (url, init) => {
      if (String(url) === "https://api.sendgrid.com/v3/mail/send") {
        const parsed = JSON.parse(String(init?.body)) as {
          personalizations: Array<{ to: Array<{ email: string }> }>;
          attachments?: Array<{ filename: string; type: string }>;
        };
        sentEmails.push({
          to: parsed.personalizations[0]!.to[0]!.email,
          attachments: parsed.attachments ?? [],
        });
        return new Response("", { status: 202, headers: { "x-message-id": "msg_sg_1" } });
      }
      return jsonResponse(404, {});
    }) as typeof fetch;

    try {
      const emailRes = await sendBillingDocumentByEmail({
        companyId: systron.id,
        documentId: doc.id,
      });
      assert.equal(emailRes.ok, true);
      assert.equal(sentEmails.length, 1);
      assert.equal(sentEmails[0]!.to, "facturas@demo.mx");
      assert.deepEqual(
        sentEmails[0]!.attachments.map((a) => a.filename).sort(),
        ["FAC-201.pdf", "FAC-201.xml"],
      );
    } finally {
      globalThis.fetch = originalFetch;
    }

    // WhatsApp sin sesión vinculada -> no bloquea ni lanza error
    const waRes = await sendBillingDocumentByWhatsApp({
      companyId: systron.id,
      documentId: doc.id,
    });
    assert.equal(waRes.ok, false);
    assert.match(waRes.message, /no está vinculado/i);

    await prisma.$disconnect();
  });
});
