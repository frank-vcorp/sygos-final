import { inSandbox, prisma, prismaProd } from "./db";
import {
  parseCompanyFiscalConfig,
  resolveFacturapiRuntimeCredential,
  resolveSatDefaultsForDocument,
} from "./fiscal-config";
import { resolveClientSatLegalName } from "./sat-legal-name";
import { resolvePaymentFormForDocument } from "./sat-payment-method";

const API = "https://www.facturapi.io/v2";
const DEFAULT_SERVICE_KEY = "72154000";

export function facturapiMode(secret: string): "test" | "live" | null {
  if (secret.startsWith("sk_test_")) return "test";
  if (secret.startsWith("sk_live_")) return "live";
  return null;
}

export function parseSygosSeriesAndFolio(
  folio: string,
  defaultSeries = "FAC",
): { series: string; folioNumber: number } | null {
  const trimmed = folio.trim();
  const match = trimmed.match(/^([A-Za-z0-9-]+?)-(\d+)$/);
  if (!match) return null;
  const folioNumber = Number.parseInt(match[2]!, 10);
  if (!Number.isFinite(folioNumber) || folioNumber <= 0) return null;
  const series = (match[1] || defaultSeries || "FAC").slice(0, 25);
  return { series, folioNumber };
}

export type InvoicePayloadLine = {
  concept: string;
  quantity: number;
  unitPrice: number;
  discountAmount?: number;
  taxIncluded?: boolean;
  productKey?: string | null;
  unitKey?: string | null;
  unitName?: string | null;
  taxability?: string | null;
};

export function invoicePayload(input: {
  externalId: string;
  idempotencyKey?: string | null;
  customerName: string;
  satLegalName?: string | null;
  rfc: string | null;
  taxSystem: string | null;
  cfdiUse: string | null;
  paymentMethod: string | null;
  paymentForm?: string | null;
  zip: string | null;
  email: string | null;
  series?: string | null;
  folioNumber?: number | null;
  lines: InvoicePayloadLine[];
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
    paymentForm = resolvePaymentFormForDocument(input.paymentMethod!, input.paymentForm);
  } catch {
    return { error: "El método de pago del cliente no es válido para timbrar." };
  }

  const legalName = resolveClientSatLegalName({
    name: input.customerName,
    satLegalName: input.satLegalName,
  });
  const taxed = input.iva > 0;

  return {
    body: {
      type: "I",
      external_id: input.externalId,
      ...(input.idempotencyKey ? { idempotency_key: input.idempotencyKey.slice(0, 100) } : {}),
      ...(input.series ? { series: input.series.slice(0, 25) } : {}),
      ...(input.folioNumber && input.folioNumber > 0 ? { folio_number: input.folioNumber } : {}),
      customer: {
        legal_name: legalName,
        tax_id: input.rfc,
        tax_system: input.taxSystem?.slice(0, 3),
        email: input.email || undefined,
        address: { zip: input.zip, country: "MEX" },
      },
      items: input.lines.map((line) => {
        const taxability = line.taxability && /^0[1-8]$/.test(line.taxability)
          ? line.taxability
          : taxed
            ? "02"
            : "01";
        const taxes =
          taxed && taxability === "02"
            ? [{ type: "IVA", rate: 0.16 }]
            : [];
        const discount = line.discountAmount && line.discountAmount > 0 ? line.discountAmount : undefined;
        return {
          quantity: line.quantity,
          ...(discount !== undefined ? { discount } : {}),
          product: {
            description: line.concept,
            product_key: line.productKey?.trim() || DEFAULT_SERVICE_KEY,
            unit_key: line.unitKey?.trim() || "E48",
            ...(line.unitName?.trim() ? { unit_name: line.unitName.trim().slice(0, 20) } : {}),
            price: line.unitPrice,
            tax_included: line.taxIncluded ?? false,
            taxability,
            taxes,
          },
        };
      }),
      use: input.cfdiUse!,
      payment_form: paymentForm,
      payment_method: input.paymentMethod!,
    },
  };
}

type InvoiceResponse = {
  id?: string;
  uuid?: string;
  status?: string;
  external_id?: string;
  series?: string;
  folio_number?: number;
  verification_url?: string;
  code?: string;
  message?: string;
};

type OrganizationResponse = {
  id?: string;
  is_production_ready?: boolean;
  pending_steps?: Array<{ type?: string; description?: string }>;
  certificate?: {
    has_certificate?: boolean;
    expires_at?: string | null;
    serial_number?: string | null;
  };
  legal?: {
    name?: string | null;
    legal_name?: string | null;
    tax_id?: string | null;
  };
  message?: string;
};

async function facturapiFetch<T = InvoiceResponse & { data?: InvoiceResponse[] }>(
  secret: string,
  path: string,
  init?: RequestInit,
  fetchFn: typeof fetch = fetch,
) {
  const response = await fetchFn(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
      "Accept-Language": "es",
      ...(init?.headers ?? {}),
    },
  });
  const text = await response.text();
  let body: T;
  try {
    body = (text ? JSON.parse(text) : {}) as T;
  } catch {
    body = { message: text || `Respuesta HTTP ${response.status} de Facturapi.` } as T;
  }
  return { ok: response.ok, status: response.status, body };
}

export async function verifyFacturapi(secret: string, fetchFn: typeof fetch = fetch) {
  const mode = facturapiMode(secret);
  if (!mode) return { ok: false, message: "La llave debe empezar con sk_test_ o sk_live_." };
  const result = await facturapiFetch(secret, "/invoices?limit=1", undefined, fetchFn);
  if (!result.ok) return { ok: false, message: result.body.message || "Facturapi rechazó la llave." };
  return {
    ok: true,
    message:
      mode === "test"
        ? "Llave de pruebas (Sandbox). El CFDI no se envía al SAT."
        : "Llave de producción (Live). El CFDI se envía al SAT.",
  };
}

export async function inspectFacturapiOrganization(
  secret: string,
  fetchFn: typeof fetch = fetch,
): Promise<{
  ok: boolean;
  mode: "test" | "live" | null;
  organizationId: string | null;
  organizationName: string | null;
  taxId: string | null;
  isProductionReady: boolean;
  hasCertificate: boolean;
  certificateSerial: string | null;
  certificateExpiresAt: string | null;
  pendingSteps: string[];
  message: string;
}> {
  const mode = facturapiMode(secret);
  if (!mode) {
    return {
      ok: false,
      mode: null,
      organizationId: null,
      organizationName: null,
      taxId: null,
      isProductionReady: false,
      hasCertificate: false,
      certificateSerial: null,
      certificateExpiresAt: null,
      pendingSteps: [],
      message: "La llave debe empezar con sk_test_ o sk_live_.",
    };
  }
  const result = await facturapiFetch<OrganizationResponse>(secret, "/organizations/me", undefined, fetchFn);
  if (!result.ok || !result.body.id) {
    return {
      ok: false,
      mode,
      organizationId: null,
      organizationName: null,
      taxId: null,
      isProductionReady: false,
      hasCertificate: false,
      certificateSerial: null,
      certificateExpiresAt: null,
      pendingSteps: [],
      message: result.body.message || "Facturapi no devolvió los datos de la organización.",
    };
  }
  const pendingSteps = (result.body.pending_steps ?? [])
    .map((step) => step.description || step.type || "")
    .filter(Boolean);
  const hasCertificate = Boolean(result.body.certificate?.has_certificate);
  const isProductionReady = Boolean(result.body.is_production_ready);
  const orgName = result.body.legal?.legal_name || result.body.legal?.name || null;
  const taxId = result.body.legal?.tax_id || null;

  const statusText = isProductionReady
    ? "Organización lista para producción (CSD y Carta Manifiesto completos)."
    : pendingSteps.length > 0
      ? `Organización verificada (${mode === "test" ? "Test" : "Live"}). Pendiente: ${pendingSteps.join(" · ")}`
      : hasCertificate
        ? "Organización verificada. Falta completar pasos de producción en Facturapi."
        : "Organización verificada. Falta cargar CSD en Facturapi.";

  return {
    ok: true,
    mode,
    organizationId: result.body.id,
    organizationName: orgName,
    taxId,
    isProductionReady,
    hasCertificate,
    certificateSerial: result.body.certificate?.serial_number ?? null,
    certificateExpiresAt: result.body.certificate?.expires_at ?? null,
    pendingSteps,
    message: statusText,
  };
}

function nextIdempotencyAttemptKey(documentId: string, currentKey: string | null | undefined): string {
  if (!currentKey) return `sygos-${documentId}-a1`;
  const match = currentKey.match(/-a(\d+)$/);
  const nextAttempt = match ? Number.parseInt(match[1]!, 10) + 1 : 2;
  return `sygos-${documentId}-a${nextAttempt}`;
}

export async function stampBillingDocument(
  documentId: string,
  options?: { fetchFn?: typeof fetch; forceNewIdempotencyKey?: boolean },
) {
  const fetchFn = options?.fetchFn ?? fetch;
  const document = await prisma.billingDocument.findUnique({
    where: { id: documentId },
    include: {
      client: {
        include: {
          contacts: {
            where: { active: true },
            orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
          },
        },
      },
      lines: true,
      company: true,
      quote: { select: { quoteType: true } },
      fieldServiceCase: { select: { id: true } },
    },
  });
  if (!document || document.kind === "REMISION") return;

  const cred = await resolveFacturapiRuntimeCredential(document.companyId);
  if (cred.status === "SIMULATED") {
    await prisma.billingDocument.update({
      where: { id: document.id },
      data: {
        fiscalStatus: "SIMULADA",
        fiscalEnv: "SIMULATED",
        fiscalError: cred.message,
      },
    });
    return;
  }
  if (cred.status === "UNAVAILABLE") {
    await prisma.billingDocument.update({
      where: { id: document.id },
      data: {
        fiscalStatus: "ERROR",
        fiscalEnv: cred.env,
        fiscalError: cred.message,
      },
    });
    return;
  }

  const secret = cred.secret;
  const fiscalEnv = cred.env;

  try {
    if (document.fiscalExternalId) {
      const current = await facturapiFetch(secret, `/invoices/${document.fiscalExternalId}`, undefined, fetchFn);
      if (current.ok && current.body.status === "valid") {
        await prisma.billingDocument.update({
          where: { id: document.id },
          data: {
            fiscalEnv,
            fiscalStatus: "TIMBRADA",
            fiscalUuid: current.body.uuid ?? document.fiscalUuid,
            fiscalSeries: current.body.series ?? document.fiscalSeries,
            fiscalFolioNumber: current.body.folio_number ?? document.fiscalFolioNumber,
            verificationUrl: current.body.verification_url ?? document.verificationUrl,
            stampedAt: document.stampedAt ?? new Date(),
            fiscalError: null,
          },
        });
        return;
      }
      if (current.ok && current.body.status === "pending") {
        await prisma.billingDocument.update({
          where: { id: document.id },
          data: {
            fiscalEnv,
            fiscalStatus: "PROCESANDO",
            fiscalError: "Facturapi está recuperando el timbrado ante el SAT (HTTP 202). No se creará otro CFDI.",
          },
        });
        return;
      }
      if (current.ok && current.body.status === "canceled") {
        await prisma.billingDocument.update({
          where: { id: document.id },
          data: {
            fiscalEnv,
            fiscalStatus: "CANCELADA",
            fiscalError: "Este CFDI aparece cancelado en Facturapi.",
          },
        });
        return;
      }
      if (current.ok && current.body.status === "failed") {
        await prisma.billingDocument.update({
          where: { id: document.id },
          data: {
            fiscalEnv,
            fiscalExternalId: null,
            fiscalIdempotencyKey: nextIdempotencyAttemptKey(document.id, document.fiscalIdempotencyKey),
            fiscalStatus: "ERROR",
            fiscalError: current.body.message || "Facturapi agotó la recuperación (failed). Ya puedes reintentar el timbrado.",
          },
        });
        return;
      }
      await prisma.billingDocument.update({
        where: { id: document.id },
        data: {
          fiscalEnv,
          fiscalStatus: "ERROR",
          fiscalError: current.body.message || "Facturapi aún no confirma este CFDI. No se creó otro.",
        },
      });
      return;
    }

    const listed = await facturapiFetch(
      secret,
      `/invoices?external_id=${encodeURIComponent(document.id)}&limit=20`,
      undefined,
      fetchFn,
    );
    const existing = listed.body.data?.find(
      (row) => row.external_id === document.id && row.status !== "failed" && row.status !== "canceled",
    );
    if (existing?.id) {
      await prisma.billingDocument.update({
        where: { id: document.id },
        data: {
          fiscalEnv,
          fiscalExternalId: existing.id,
          fiscalUuid: existing.uuid ?? null,
          fiscalSeries: existing.series ?? null,
          fiscalFolioNumber: existing.folio_number ?? null,
          verificationUrl: existing.verification_url ?? null,
          stampedAt: existing.status === "valid" ? new Date() : null,
          fiscalStatus:
            existing.status === "valid"
              ? "TIMBRADA"
              : existing.status === "pending"
                ? "PROCESANDO"
                : "ERROR",
          fiscalError:
            existing.status === "valid"
              ? null
              : existing.status === "pending"
                ? "Facturapi ya tiene este documento en proceso (HTTP 202). No se creó otro."
                : "Facturapi ya tiene este documento. No se creó otro.",
        },
      });
      return;
    }

    let equipmentKind: string | null = null;
    if (document.equipmentId) {
      const equip = await prisma.equipment.findUnique({
        where: { id: document.equipmentId },
        select: { kind: true },
      });
      equipmentKind = equip?.kind ?? null;
    }

    const companyConfig = parseCompanyFiscalConfig(document.company);
    const satFallback = resolveSatDefaultsForDocument(companyConfig, {
      companyCode: document.company.code,
      documentKind: document.kind,
      quoteType: document.quote?.quoteType ?? null,
      equipmentKind,
      hasFieldServiceCase: Boolean(document.fieldServiceCaseId),
    });

    const parsedFolio =
      companyConfig.fiscalSeriesPolicy === "SYGOS_FAC"
        ? parseSygosSeriesAndFolio(document.folio, companyConfig.fiscalDefaultSeries)
        : null;

    const idempotencyKey =
      options?.forceNewIdempotencyKey || !document.fiscalIdempotencyKey
        ? nextIdempotencyAttemptKey(document.id, document.fiscalIdempotencyKey)
        : document.fiscalIdempotencyKey;

    if (idempotencyKey !== document.fiscalIdempotencyKey) {
      await prisma.billingDocument.update({
        where: { id: document.id },
        data: { fiscalIdempotencyKey: idempotencyKey },
      });
    }

    const contactEmail =
      document.client.fiscalEmail?.trim()
      || document.client.contacts.find((c) => c.email?.trim())?.email?.trim()
      || null;

    const payload = invoicePayload({
      externalId: document.id,
      idempotencyKey,
      customerName: document.client.name,
      satLegalName: document.client.satLegalName,
      rfc: document.rfcSnapshot || document.client.rfc,
      taxSystem: document.client.taxRegime,
      cfdiUse: document.cfdiUseSnapshot ?? document.client.cfdiUse,
      paymentMethod: document.paymentMethodSnapshot ?? document.client.paymentMethod,
      paymentForm: document.paymentFormSnapshot,
      zip: document.client.fiscalZip,
      email: contactEmail,
      series: parsedFolio?.series ?? null,
      folioNumber: parsedFolio?.folioNumber ?? null,
      lines: document.lines.map((line) => ({
        concept: line.concept,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discountAmount: line.discountAmount,
        taxIncluded: line.taxIncluded,
        productKey: line.satProductKey || satFallback.productKey,
        unitKey: line.satUnitKey || satFallback.unitKey,
        unitName: line.satUnitName || satFallback.unitName,
        taxability: line.taxability || satFallback.taxability,
      })),
      iva: document.iva,
    });

    if ("error" in payload && payload.error) {
      await prisma.billingDocument.update({
        where: { id: document.id },
        data: { fiscalEnv, fiscalStatus: "ERROR", fiscalError: payload.error },
      });
      return;
    }

    const created = await facturapiFetch(
      secret,
      "/invoices",
      { method: "POST", body: JSON.stringify(payload.body) },
      fetchFn,
    );

    if (created.status === 409 || created.body.code === "idempotency_key_in_use") {
      const recovered = await facturapiFetch(
        secret,
        `/invoices?external_id=${encodeURIComponent(document.id)}&limit=20`,
        undefined,
        fetchFn,
      );
      const match = recovered.body.data?.find(
        (row) => row.external_id === document.id && row.status !== "failed" && row.status !== "canceled",
      );
      if (match?.id) {
        await prisma.billingDocument.update({
          where: { id: document.id },
          data: {
            fiscalEnv,
            fiscalExternalId: match.id,
            fiscalUuid: match.uuid ?? null,
            fiscalSeries: match.series ?? parsedFolio?.series ?? null,
            fiscalFolioNumber: match.folio_number ?? parsedFolio?.folioNumber ?? null,
            verificationUrl: match.verification_url ?? null,
            stampedAt: match.status === "valid" ? new Date() : null,
            fiscalStatus: match.status === "valid" ? "TIMBRADA" : match.status === "pending" ? "PROCESANDO" : "ERROR",
            fiscalError:
              match.status === "valid"
                ? null
                : match.status === "pending"
                  ? "Timbrado en proceso ante el SAT (recuperado tras 409)."
                  : "Facturapi ya registró este documento (409).",
          },
        });
        return;
      }
      await prisma.billingDocument.update({
        where: { id: document.id },
        data: {
          fiscalEnv,
          fiscalStatus: "ERROR",
          fiscalError: "Facturapi reportó clave de idempotencia en uso (409). Consulta o reintenta en unos segundos.",
        },
      });
      return;
    }

    if ((created.status === 202 || created.body.status === "pending") && created.body.id) {
      await prisma.billingDocument.update({
        where: { id: document.id },
        data: {
          fiscalEnv,
          fiscalExternalId: created.body.id,
          fiscalSeries: created.body.series ?? parsedFolio?.series ?? null,
          fiscalFolioNumber: created.body.folio_number ?? parsedFolio?.folioNumber ?? null,
          fiscalStatus: "PROCESANDO",
          fiscalError: "Timbrado en proceso por intermitencia SAT (HTTP 202). Facturapi reintentará automáticamente; no se creará otro CFDI.",
        },
      });
      return;
    }

    if (!created.ok || !created.body.id) {
      await prisma.billingDocument.update({
        where: { id: document.id },
        data: {
          fiscalEnv,
          fiscalStatus: "ERROR",
          fiscalError: created.body.message || "Facturapi no timbró este documento. Sigue siendo el mismo.",
        },
      });
      return;
    }

    await prisma.billingDocument.update({
      where: { id: document.id },
      data: {
        fiscalEnv,
        fiscalExternalId: created.body.id,
        fiscalUuid: created.body.uuid ?? null,
        fiscalSeries: created.body.series ?? parsedFolio?.series ?? null,
        fiscalFolioNumber: created.body.folio_number ?? parsedFolio?.folioNumber ?? null,
        verificationUrl: created.body.verification_url ?? null,
        stampedAt: created.body.status === "valid" ? new Date() : null,
        fiscalStatus: created.body.status === "valid" ? "TIMBRADA" : "ERROR",
        fiscalError:
          created.body.status === "valid"
            ? null
            : "Facturapi recibió el documento y aún no lo marca como vigente. No se creará otro.",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error de red al contactar a Facturapi.";
    await prisma.billingDocument.update({
      where: { id: document.id },
      data: {
        fiscalEnv,
        fiscalStatus: "ERROR",
        fiscalError: `${message} El reintento usa este mismo documento.`,
      },
    });
  }
}

export async function stampPayrollPeriod(periodId: string) {
  const period = await prisma.payrollPeriod.findUnique({
    where: { id: periodId },
    include: { lines: { include: { collaborator: { include: { user: true } } } }, company: true },
  });
  if (!period) return;
  if (await inSandbox()) {
    await prisma.payrollPeriod.update({
      where: { id: period.id },
      data: { fiscalStatus: "SIMULADA", fiscalError: "PRUEBA / SIN VALIDEZ. No se contactó a Facturapi." },
    });
    return;
  }
  const cred = await resolveFacturapiRuntimeCredential(period.companyId);
  if (cred.status !== "READY") {
    await prisma.payrollPeriod.update({
      where: { id: period.id },
      data: { fiscalStatus: "ERROR", fiscalError: cred.status === "UNAVAILABLE" ? cred.message : cred.message },
    });
    return;
  }
  const secret = cred.secret;
  const setting = await prismaProd.integrationSetting.findFirst({
    where: {
      companyId: period.companyId,
      provider: { in: [`FACTURAPI_${cred.env}`, "FACTURAPI"] },
    },
  });
  const extra = setting?.extra
    ? (JSON.parse(setting.extra) as { registroPatronal?: string; employerCurp?: string; employerState?: string })
    : {};
  const registro = period.company.registroPatronal || extra.registroPatronal;
  const employerCurp = period.company.employerCurp || extra.employerCurp;
  const state = period.company.employerState || extra.employerState;
  if (!registro || !employerCurp || !state) {
    await prisma.payrollPeriod.update({
      where: { id: period.id },
      data: {
        fiscalStatus: "ERROR",
        fiscalError: "Facturapi está configurado, pero falta registro patronal, CURP del patrón o entidad federativa.",
      },
    });
    return;
  }
  const errors: string[] = [];
  for (const line of period.lines.filter((row) => row.transferTotal > 0)) {
    const person = line.collaborator;
    const missing = [
      !person.rfc ? "RFC" : null,
      !person.curp ? "CURP" : null,
      !person.nss ? "NSS" : null,
      !person.fiscalZip ? "código postal" : null,
    ].filter(Boolean);
    if (missing.length > 0) {
      errors.push(`${person.user.name}: falta ${missing.join(", ")}`);
      continue;
    }
    if (line.fiscalExternalId) continue;
    const body = {
      type: "N",
      external_id: line.id,
      customer: {
        legal_name: person.user.name,
        tax_id: person.rfc,
        tax_system: "605",
        address: { country: "MEX", zip: person.fiscalZip },
      },
      complements: [
        {
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
            percepciones: {
              percepcion: [
                {
                  tipo_percepcion: "001",
                  clave: "001",
                  concepto: "Sueldo",
                  importe_gravado: line.transferTotal,
                  importe_exento: 0,
                },
              ],
            },
          },
        },
      ],
    };
    const created = await facturapiFetch(secret, "/invoices", { method: "POST", body: JSON.stringify(body) });
    if (!created.ok || !created.body.id) {
      errors.push(`${person.user.name}: ${created.body.message || "Facturapi no timbró el recibo"}`);
    } else {
      await prisma.payrollLine.update({
        where: { id: line.id },
        data: {
          fiscalExternalId: created.body.id,
          fiscalUuid: created.body.uuid,
          fiscalStatus: created.body.status === "valid" ? "TIMBRADA" : "ERROR",
        },
      });
    }
  }
  await prisma.payrollPeriod.update({
    where: { id: period.id },
    data:
      errors.length > 0
        ? { fiscalStatus: "ERROR", fiscalError: errors.join(". ") }
        : { fiscalStatus: "TIMBRADA", fiscalError: null },
  });
}
