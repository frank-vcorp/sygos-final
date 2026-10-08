import { decryptSecret } from "./crypto";
import { inSandbox, prisma, prismaProd } from "./db";
import { paymentFormForMethod } from "./sat-payment-method";

const API = "https://www.facturapi.io/v2";
const SERVICE_KEY = "78181500";

export function facturapiMode(secret: string): "test" | "live" | null {
  if (secret.startsWith("sk_test_")) return "test";
  if (secret.startsWith("sk_live_")) return "live";
  return null;
}

export function invoicePayload(input: {
  externalId: string;
  customerName: string;
  rfc: string | null;
  taxSystem: string | null;
  cfdiUse: string | null;
  paymentMethod: string | null;
  zip: string | null;
  email: string | null;
  lines: Array<{ concept: string; quantity: number; unitPrice: number }>;
  iva: number;
}) {
  const missing = [
    !input.rfc ? "RFC del cliente" : null,
    !input.taxSystem ? "régimen fiscal del cliente" : null,
    !input.zip ? "código postal fiscal del cliente" : null,
    !input.cfdiUse ? "uso de CFDI del cliente" : null,
    !input.paymentMethod ? "método de pago del cliente" : null,
    input.lines.length === 0 ? "partidas" : null,
  ].filter(Boolean);
  if (missing.length > 0) return { error: `Falta ${missing.join(", ")} para timbrar.` };
  let paymentForm: string;
  try {
    paymentForm = paymentFormForMethod(input.paymentMethod!);
  } catch {
    return { error: "El método de pago del cliente no es válido para timbrar." };
  }
  const taxed = input.iva > 0;
  return {
    body: {
      type: "I",
      external_id: input.externalId,
      customer: {
        legal_name: input.customerName,
        tax_id: input.rfc,
        tax_system: input.taxSystem?.slice(0, 3),
        email: input.email || undefined,
        address: { zip: input.zip, country: "MEX" },
      },
      items: input.lines.map((line) => ({
        quantity: line.quantity,
        product: {
          description: line.concept,
          product_key: SERVICE_KEY,
          unit_key: "E48",
          price: line.unitPrice,
          taxes: taxed ? [{ type: "IVA", rate: 0.16 }] : [],
        },
      })),
      use: input.cfdiUse!,
      payment_form: paymentForm,
      payment_method: input.paymentMethod!,
    },
  };
}

type InvoiceResponse = { id?: string; uuid?: string; status?: string; external_id?: string; message?: string };

async function facturapiFetch(secret: string, path: string, init?: RequestInit) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
      "Accept-Language": "es",
      ...(init?.headers ?? {}),
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) as InvoiceResponse & { data?: InvoiceResponse[] } : {};
  return { ok: response.ok, status: response.status, body };
}

export async function verifyFacturapi(secret: string) {
  const mode = facturapiMode(secret);
  if (!mode) return { ok: false, message: "La llave debe empezar con sk_test_ o sk_live_." };
  const result = await facturapiFetch(secret, "/invoices?limit=1");
  if (!result.ok) return { ok: false, message: result.body.message || "Facturapi rechazó la llave." };
  return { ok: true, message: mode === "test" ? "Llave de pruebas. El CFDI no se envía al SAT." : "Llave de producción. El CFDI se envía al SAT." };
}

async function loadSecret(companyId: string) {
  const setting = await prismaProd.integrationSetting.findFirst({ where: { companyId, provider: "FACTURAPI" } });
  if (!setting?.secretEnc) return null;
  return decryptSecret(setting.secretEnc);
}

export async function stampBillingDocument(documentId: string) {
  const document = await prisma.billingDocument.findUnique({
    where: { id: documentId },
    include: { client: true, lines: true, company: true },
  });
  if (!document || document.kind === "REMISION") return;
  if (await inSandbox()) {
    await prisma.billingDocument.update({
      where: { id: document.id },
      data: { fiscalStatus: "SIMULADA", fiscalError: "PRUEBA / SIN VALIDEZ. No se contactó a Facturapi." },
    });
    return;
  }
  const secret = await loadSecret(document.companyId);
  if (!secret) {
    await prisma.billingDocument.update({
      where: { id: document.id },
      data: { fiscalStatus: "ERROR", fiscalError: "Facturapi no está configurado para esta empresa. El reintento usa este mismo documento." },
    });
    return;
  }
  if (document.fiscalExternalId) {
    const current = await facturapiFetch(secret, `/invoices/${document.fiscalExternalId}`);
    await prisma.billingDocument.update({
      where: { id: document.id },
      data: current.ok && current.body.status === "valid"
        ? { fiscalStatus: "TIMBRADA", fiscalUuid: current.body.uuid ?? document.fiscalUuid, fiscalError: null }
        : { fiscalStatus: "ERROR", fiscalError: current.body.message || "Facturapi aún no confirma este CFDI. No se creó otro." },
    });
    return;
  }
  const listed = await facturapiFetch(secret, `/invoices?external_id=${encodeURIComponent(document.id)}&limit=20`);
  const existing = listed.body.data?.find((row) => row.external_id === document.id);
  if (existing?.id) {
    await prisma.billingDocument.update({
      where: { id: document.id },
      data: { fiscalExternalId: existing.id, fiscalUuid: existing.uuid, fiscalStatus: existing.status === "valid" ? "TIMBRADA" : "ERROR", fiscalError: existing.status === "valid" ? null : "Facturapi ya tiene este documento. No se creó otro." },
    });
    return;
  }
  const payload = invoicePayload({
    externalId: document.id,
    customerName: document.client.name,
    rfc: document.rfcSnapshot || document.client.rfc,
    taxSystem: document.client.taxRegime,
    cfdiUse: document.client.cfdiUse,
    paymentMethod: document.client.paymentMethod,
    zip: document.client.fiscalZip,
    email: null,
    lines: document.lines.map((line) => ({ concept: line.concept, quantity: line.quantity, unitPrice: line.unitPrice })),
    iva: document.iva,
  });
  if ("error" in payload && payload.error) {
    await prisma.billingDocument.update({ where: { id: document.id }, data: { fiscalStatus: "ERROR", fiscalError: payload.error } });
    return;
  }
  const created = await facturapiFetch(secret, "/invoices", { method: "POST", body: JSON.stringify(payload.body) });
  if (!created.ok || !created.body.id) {
    await prisma.billingDocument.update({
      where: { id: document.id },
      data: { fiscalStatus: "ERROR", fiscalError: created.body.message || "Facturapi no timbró este documento. Sigue siendo el mismo." },
    });
    return;
  }
  await prisma.billingDocument.update({
    where: { id: document.id },
    data: {
      fiscalExternalId: created.body.id,
      fiscalUuid: created.body.uuid,
      fiscalStatus: created.body.status === "valid" ? "TIMBRADA" : "ERROR",
      fiscalError: created.body.status === "valid" ? null : "Facturapi recibió el documento y aún no lo marca como vigente. No se creará otro.",
    },
  });
}

export async function stampPayrollPeriod(periodId: string) {
  const period = await prisma.payrollPeriod.findUnique({
    where: { id: periodId },
    include: { lines: { include: { collaborator: { include: { user: true } } } }, company: true },
  });
  if (!period) return;
  if (await inSandbox()) {
    await prisma.payrollPeriod.update({ where: { id: period.id }, data: { fiscalStatus: "SIMULADA", fiscalError: "PRUEBA / SIN VALIDEZ. No se contactó a Facturapi." } });
    return;
  }
  const secret = await loadSecret(period.companyId);
  if (!secret) {
    await prisma.payrollPeriod.update({ where: { id: period.id }, data: { fiscalStatus: "ERROR", fiscalError: "Facturapi no está configurado para esta empresa." } });
    return;
  }
  const setting = await prismaProd.integrationSetting.findFirst({ where: { companyId: period.companyId, provider: "FACTURAPI" } });
  const extra = setting?.extra ? JSON.parse(setting.extra) as { registroPatronal?: string; employerCurp?: string; employerState?: string } : {};
  const registro = period.company.registroPatronal || extra.registroPatronal;
  const employerCurp = period.company.employerCurp || extra.employerCurp;
  const state = period.company.employerState || extra.employerState;
  if (!registro || !employerCurp || !state) {
    await prisma.payrollPeriod.update({ where: { id: period.id }, data: { fiscalStatus: "ERROR", fiscalError: "Facturapi está configurado, pero falta registro patronal, CURP del patrón o entidad federativa." } });
    return;
  }
  const errors: string[] = [];
  for (const line of period.lines.filter((row) => row.transferTotal > 0)) {
    const person = line.collaborator;
    const missing = [!person.rfc ? "RFC" : null, !person.curp ? "CURP" : null, !person.nss ? "NSS" : null, !person.fiscalZip ? "código postal" : null].filter(Boolean);
    if (missing.length > 0) {
      errors.push(`${person.user.name}: falta ${missing.join(", ")}`);
      continue;
    }
    if (line.fiscalExternalId) continue;
    const body = {
      type: "N",
      external_id: line.id,
      customer: { legal_name: person.user.name, tax_id: person.rfc, tax_system: "605", address: { country: "MEX", zip: person.fiscalZip } },
      complements: [{
        type: "nomina",
        data: {
          fecha_pago: new Date().toISOString(),
          fecha_inicial_pago: `${period.periodStart}T06:00:00.000Z`,
          fecha_final_pago: `${period.periodEnd}T06:00:00.000Z`,
          num_dias_pagados: 7,
          emisor: { curp: employerCurp, registro_patronal: registro },
          receptor: {
            curp: person.curp,
            tipo_contrato: "01",
            tipo_regimen: "02",
            num_empleado: person.id.slice(-6),
            periodicidad_pago: "02",
            clave_ent_fed: state,
            num_seguridad_social: person.nss,
            fecha_inicio_rel_laboral: person.hiredAt.toISOString(),
            tipo_jornada: "01",
            salario_diario_integrado: person.dailyStamped + person.dailyCash,
            antiguedad: true,
          },
          percepciones: { percepcion: [{ tipo_percepcion: "001", clave: "001", concepto: "Sueldo", importe_gravado: line.transferTotal, importe_exento: 0 }] },
        },
      }],
    };
    const created = await facturapiFetch(secret, "/invoices", { method: "POST", body: JSON.stringify(body) });
    if (!created.ok || !created.body.id) errors.push(`${person.user.name}: ${created.body.message || "Facturapi no timbró el recibo"}`);
    else await prisma.payrollLine.update({ where: { id: line.id }, data: { fiscalExternalId: created.body.id, fiscalUuid: created.body.uuid, fiscalStatus: created.body.status === "valid" ? "TIMBRADA" : "ERROR" } });
  }
  await prisma.payrollPeriod.update({
    where: { id: period.id },
    data: errors.length > 0
      ? { fiscalStatus: "ERROR", fiscalError: errors.join(". ") }
      : { fiscalStatus: "TIMBRADA", fiscalError: null },
  });
}
