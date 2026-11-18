import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { encryptSecret } from "./crypto";
import { canDownloadPayrollLine } from "./billing-delivery";
import {
  buildPayrollReceiptPayload,
  processFacturapiWebhook,
  stampPayrollPeriod,
} from "./facturapi";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Facturapi Fase 5: payload nómina tipo N y permisos de descarga", () => {
  it("arma payload CFDI tipo N con idempotency_key, emisor y receptor, y valida faltantes", () => {
    const missing = buildPayrollReceiptPayload({
      externalId: "line_1",
      idempotencyKey: "sygos-nom-line_1-a1",
      employeeName: "Juan Pérez",
      rfc: null,
      curp: "CURP123",
      nss: "12345678901",
      fiscalZip: "64000",
      hiredAt: new Date("2025-01-15T00:00:00.000Z"),
      dailySalary: 500,
      transferTotal: 3500,
      periodStart: "2026-11-09",
      periodEnd: "2026-11-15",
      paymentDate: "2026-11-15",
      employerCurp: "EMPCURP",
      registroPatronal: "Y1234567890",
      employerState: "NLE",
    });
    assert.equal("error" in missing, true);

    const ready = buildPayrollReceiptPayload({
      externalId: "line_1",
      idempotencyKey: "sygos-nom-line_1-a1",
      employeeName: "Juan Pérez",
      rfc: "PEPJ900101AAA",
      curp: "PEPJ900101HNLRRN01",
      nss: "12345678901",
      fiscalZip: "64000",
      hiredAt: new Date("2025-01-15T00:00:00.000Z"),
      dailySalary: 500,
      transferTotal: 3500,
      periodStart: "2026-11-09",
      periodEnd: "2026-11-15",
      paymentDate: "2026-11-15",
      employerCurp: "EMPCURP",
      registroPatronal: "Y1234567890",
      employerState: "NLE",
    });
    assert.ok(ready.body);
    assert.equal(ready.body.type, "N");
    assert.equal(ready.body.idempotency_key, "sygos-nom-line_1-a1");
    assert.equal(ready.body.customer.tax_system, "605");
    assert.equal(ready.body.complements[0]!.type, "nomina");
    assert.equal(ready.body.complements[0]!.data.emisor.registro_patronal, "Y1234567890");
    assert.equal(ready.body.complements[0]!.data.percepciones.percepcion[0]!.importe_gravado, 3500);
  });

  it("valida permisos de descarga por empresa y rol de nómina", () => {
    assert.equal(canDownloadPayrollLine(null, { companyId: "sy" }), false);
    assert.equal(
      canDownloadPayrollLine(
        { userId: "u1", role: "COORDINACION_ADMINISTRACION", activeCompanyId: "sy", activeCompanyCode: "SYSTRON" },
        { companyId: "sy" },
      ),
      true,
    );
    assert.equal(
      canDownloadPayrollLine(
        { userId: "u2", role: "CEO", activeCompanyId: "sm", activeCompanyCode: "SERVOMOTORES" },
        { companyId: "sy" },
      ),
      false,
    );
    assert.equal(
      canDownloadPayrollLine(
        { userId: "u3", role: "VENTAS", activeCompanyId: "sy", activeCompanyCode: "SYSTRON" },
        { companyId: "sy" },
      ),
      false,
    );
  });
});

describe("Facturapi Fase 5: timbrado de nómina, 202/409, webhook y descargas XML/PDF/ZIP", () => {
  it("timbra periodo con idempotency_key, maneja OFF, 202->webhook, 409 y ZIP por recibo/periodo", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sygos-facturapi-p5-"));
    process.env.DATABASE_URL = `file:${join(dir, "test.db")}`;
    execSync("npx prisma db push --skip-generate", {
      cwd: join(import.meta.dirname, "../.."),
      env: process.env,
      stdio: "ignore",
    });

    const { prisma } = await import("./db");
    const { getPayrollLineDownload, getPayrollPeriodZipDownload } = await import("./billing-artifacts");

    const systron = await prisma.company.create({
      data: {
        code: "SYSTRON",
        name: "SYSTRON",
        legalName: "SYSTRON INDUSTRIAL",
        rfc: "SYS010101AAA",
        taxRegime: "601",
        postalCode: "64000",
        registroPatronal: "Y1234567890",
        employerCurp: "EMPCURP010101",
        employerState: "NLE",
        facturapiMode: "OFF",
      },
    });

    const userA = await prisma.user.create({
      data: { username: "col-a", name: "Juan Uno", passwordHash: "x", role: "TECNICO", companyId: systron.id },
    });
    const userB = await prisma.user.create({
      data: { username: "col-b", name: "Ana Dos", passwordHash: "x", role: "TECNICO", companyId: systron.id },
    });
    const colA = await prisma.collaborator.create({
      data: {
        companyId: systron.id,
        userId: userA.id,
        hireKind: "PLANTA",
        status: "ACTIVO",
        hiredAt: new Date("2025-01-01"),
        dailyStamped: 400,
        rfc: "JUAU900101AAA",
        curp: "JUAU900101HNLRR01",
        nss: "11111111111",
        fiscalZip: "64000",
      },
    });
    const colB = await prisma.collaborator.create({
      data: {
        companyId: systron.id,
        userId: userB.id,
        hireKind: "PLANTA",
        status: "ACTIVO",
        hiredAt: new Date("2025-02-01"),
        dailyStamped: 500,
        rfc: "ANAD920202BBB",
        curp: "ANAD920202MNLRR02",
        nss: "22222222222",
        fiscalZip: "64000",
      },
    });

    const period = await prisma.payrollPeriod.create({
      data: {
        folio: "NOM-SYSTRON-2026-S46",
        companyId: systron.id,
        kind: "SEMANAL",
        year: 2026,
        weekNumber: 46,
        periodStart: "2026-11-09",
        periodEnd: "2026-11-15",
        paymentDate: "2026-11-15",
        status: "CERRADA",
      },
    });

    const lineA = await prisma.payrollLine.create({
      data: { periodId: period.id, collaboratorId: colA.id, transferTotal: 2800, totalPagar: 2800 },
    });
    const lineB = await prisma.payrollLine.create({
      data: { periodId: period.id, collaboratorId: colB.id, transferTotal: 3500, totalPagar: 3500 },
    });

    // 1. Modo OFF -> ERROR en periodo sin contactar Facturapi
    await stampPayrollPeriod(period.id);
    const afterOff = await prisma.payrollPeriod.findUnique({ where: { id: period.id } });
    assert.equal(afterOff?.fiscalStatus, "ERROR");
    assert.match(afterOff?.fiscalError ?? "", /desactivado/i);

    // 2. Activar TEST con sk_test_ -> lineA 201 valid, lineB 202 pending -> periodo PROCESANDO
    await prisma.company.update({ where: { id: systron.id }, data: { facturapiMode: "TEST" } });
    await prisma.integrationSetting.create({
      data: {
        companyId: systron.id,
        provider: "FACTURAPI_TEST",
        secretEnc: encryptSecret("sk_test_nomina_p5"),
        secretHint: "••••_p5",
        extra: JSON.stringify({
          organizationId: "org_nom_test",
          webhookSecretEnc: encryptSecret("whsec_nom_test"),
        }),
      },
    });

    let postCount = 0;
    const fetchPeriod: typeof fetch = async (url, init) => {
      const u = String(url);
      if (u.includes("external_id=")) return jsonResponse(200, { data: [] });
      if (init?.method === "POST" && u.endsWith("/invoices")) {
        postCount += 1;
        const body = JSON.parse(String(init.body)) as { external_id: string; idempotency_key: string };
        assert.equal(body.idempotency_key, `sygos-nom-${body.external_id}-a1`);
        if (body.external_id === lineA.id) {
          return jsonResponse(201, {
            id: "inv_nom_a",
            status: "valid",
            uuid: "N000000A-0000-0000-0000-000000000001",
          });
        }
        if (body.external_id === lineB.id) {
          return jsonResponse(202, { id: "inv_nom_b", status: "pending" });
        }
      }
      if (u.endsWith("/invoices/inv_nom_a/xml")) return new Response("<cfdi:Comprobante Nom='A'/>", { status: 200 });
      if (u.endsWith("/invoices/inv_nom_a/pdf")) return new Response(Buffer.from("%PDF-NOM-A"), { status: 200 });
      throw new Error(`Unexpected URL: ${u}`);
    };

    await stampPayrollPeriod(period.id, { fetchFn: fetchPeriod });
    assert.equal(postCount, 2);

    const lineAAfter = await prisma.payrollLine.findUnique({ where: { id: lineA.id } });
    const lineBAfter = await prisma.payrollLine.findUnique({ where: { id: lineB.id } });
    const periodAfter = await prisma.payrollPeriod.findUnique({ where: { id: period.id } });

    assert.equal(lineAAfter?.fiscalStatus, "TIMBRADA");
    assert.equal(lineAAfter?.fiscalEnv, "TEST");
    assert.equal(lineAAfter?.xmlContent, "<cfdi:Comprobante Nom='A'/>");
    assert.ok(lineAAfter?.pdfContent);
    assert.equal(lineBAfter?.fiscalStatus, "PROCESANDO");
    assert.equal(lineBAfter?.fiscalExternalId, "inv_nom_b");
    assert.equal(periodAfter?.fiscalStatus, "PROCESANDO");
    assert.equal(periodAfter?.fiscalEnv, "TEST");

    // 3. Webhook resuelve lineB -> TIMBRADA + XML/PDF + periodo TIMBRADA
    const whRes = await processFacturapiWebhook({
      companyCode: "systron",
      rawBody: JSON.stringify({
        id: "evt_nom_b_valid",
        type: "invoice.status_updated",
        livemode: false,
        organization: "org_nom_test",
        data: {
          type: "invoice",
          object: {
            id: "inv_nom_b",
            external_id: lineB.id,
            status: "valid",
            uuid: "N000000B-0000-0000-0000-000000000002",
          },
        },
      }),
      signature: "sig_ok",
      fetchFn: async (url) => {
        const u = String(url);
        if (u.endsWith("/webhooks/validate-signature")) return jsonResponse(200, { valid: true });
        if (u.endsWith("/invoices/inv_nom_b/xml")) return new Response("<cfdi:Comprobante Nom='B'/>", { status: 200 });
        if (u.endsWith("/invoices/inv_nom_b/pdf")) return new Response(Buffer.from("%PDF-NOM-B"), { status: 200 });
        throw new Error(`Unexpected WH URL: ${u}`);
      },
    });
    assert.equal(whRes.status, 200);

    const lineBFinal = await prisma.payrollLine.findUnique({ where: { id: lineB.id } });
    const periodFinal = await prisma.payrollPeriod.findUnique({ where: { id: period.id } });
    assert.equal(lineBFinal?.fiscalStatus, "TIMBRADA");
    assert.equal(lineBFinal?.fiscalUuid, "N000000B-0000-0000-0000-000000000002");
    assert.equal(periodFinal?.fiscalStatus, "TIMBRADA");

    // Descargas individuales y ZIP del periodo
    const dlA = await getPayrollLineDownload(lineA.id, "zip");
    assert.equal(dlA?.buffer.subarray(0, 4).toString("binary"), "PK\x03\x04");
    const dlPeriodZip = await getPayrollPeriodZipDownload(period.id);
    assert.ok(dlPeriodZip);
    assert.equal(dlPeriodZip.buffer.subarray(0, 4).toString("binary"), "PK\x03\x04");
    assert.ok(dlPeriodZip.buffer.includes(Buffer.from("Juan_Uno.pdf")));
    assert.ok(dlPeriodZip.buffer.includes(Buffer.from("Ana_Dos.xml")));

    // 4. Recuperación 409 en recibo de nómina
    const userC = await prisma.user.create({
      data: { username: "col-c", name: "Luis Tres", passwordHash: "x", role: "TECNICO", companyId: systron.id },
    });
    const colC = await prisma.collaborator.create({
      data: {
        companyId: systron.id,
        userId: userC.id,
        hireKind: "PLANTA",
        status: "ACTIVO",
        hiredAt: new Date("2025-03-01"),
        dailyStamped: 300,
        rfc: "LUIT930303CCC",
        curp: "LUIT930303HNLRR03",
        nss: "33333333333",
        fiscalZip: "64000",
      },
    });
    const lineC = await prisma.payrollLine.create({
      data: { periodId: period.id, collaboratorId: colC.id, transferTotal: 2100, totalPagar: 2100 },
    });

    let listCalls = 0;
    await stampPayrollPeriod(period.id, {
      lineId: lineC.id,
      fetchFn: async (url, init) => {
        const u = String(url);
        if (u.includes("external_id=")) {
          listCalls += 1;
          if (listCalls === 1) return jsonResponse(200, { data: [] });
          return jsonResponse(200, {
            data: [{ id: "inv_nom_c_409", external_id: lineC.id, status: "valid", uuid: "N409000C-0000-0000-0000-000000000003" }],
          });
        }
        if (init?.method === "POST" && u.endsWith("/invoices")) {
          return jsonResponse(409, { ok: false, status: 409, code: "idempotency_key_in_use" });
        }
        if (u.endsWith("/invoices/inv_nom_c_409/xml")) return new Response("<cfdi:Comprobante Nom='C'/>", { status: 200 });
        if (u.endsWith("/invoices/inv_nom_c_409/pdf")) return new Response(Buffer.from("%PDF-NOM-C"), { status: 200 });
        throw new Error(`Unexpected 409 URL: ${u}`);
      },
    });
    const lineCFinal = await prisma.payrollLine.findUnique({ where: { id: lineC.id } });
    assert.equal(lineCFinal?.fiscalStatus, "TIMBRADA");
    assert.equal(lineCFinal?.fiscalExternalId, "inv_nom_c_409");

    await prisma.$disconnect();
  });
});
