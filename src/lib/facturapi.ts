import { Prisma } from "@prisma/client";
import {
  ensureBillingDocumentArtifacts,
  ensurePaymentComplementArtifacts,
} from "./billing-artifacts";
import { maybeAutoDeliverStampedDocument } from "./billing-delivery";
import { inSandbox, prisma, prismaProd } from "./db";
import {
  loadWebhookSlotForEnvironment,
  parseCompanyFiscalConfig,
  resolveFacturapiRuntimeCredential,
  resolveSatDefaultsForDocument,
  syncIntercompanyPartiesFromCompany,
} from "./fiscal-config";
import { recordHistory } from "./history";
import { roundMoney } from "./money";
import { resolveClientSatLegalName } from "./sat-legal-name";
import { resolvePaymentFormForDocument, satFormaPagoForOperationalPayment } from "./sat-payment-method";

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

async function finalizeStampedArtifactsAndDelivery(documentId: string, fetchFn: typeof fetch) {
  await ensureBillingDocumentArtifacts(documentId, { fetchFn }).catch(() => undefined);
  await maybeAutoDeliverStampedDocument(documentId, { fetchFn }).catch(() => undefined);
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
        await finalizeStampedArtifactsAndDelivery(document.id, fetchFn);
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
      if (existing.status === "valid") {
        await finalizeStampedArtifactsAndDelivery(document.id, fetchFn);
      }
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
        if (match.status === "valid") {
          await finalizeStampedArtifactsAndDelivery(document.id, fetchFn);
        }
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
    if (created.body.status === "valid") {
      await finalizeStampedArtifactsAndDelivery(document.id, fetchFn);
    }
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

type WebhookRecord = {
  id?: string;
  url?: string;
  status?: string;
  enabled_events?: string[];
  secret?: string;
};

const REQUIRED_WEBHOOK_EVENTS = [
  "invoice.status_updated",
  "invoice.cancellation_status_updated",
] as const;

export async function registerOrVerifyFacturapiWebhook(input: {
  secret: string;
  targetUrl: string;
  hasLocalWebhookSecret: boolean;
  fetchFn?: typeof fetch;
}): Promise<{
  ok: boolean;
  webhookId: string | null;
  url: string;
  secret: string | null;
  created: boolean;
  message: string;
}> {
  const fetchFn = input.fetchFn ?? fetch;
  const listed = await facturapiFetch<{ data?: WebhookRecord[]; message?: string }>(
    input.secret,
    "/webhooks?limit=100",
    undefined,
    fetchFn,
  );
  if (!listed.ok) {
    return {
      ok: false,
      webhookId: null,
      url: input.targetUrl,
      secret: null,
      created: false,
      message: listed.body.message || "Facturapi rechazó la consulta de webhooks.",
    };
  }

  const normalizedTarget = input.targetUrl.trim().replace(/\/+$/, "");
  const existing = (listed.body.data ?? []).find((row) => {
    const rowUrl = (row.url ?? "").trim().replace(/\/+$/, "");
    if (rowUrl !== normalizedTarget || row.status !== "enabled") return false;
    const events = new Set(row.enabled_events ?? []);
    return REQUIRED_WEBHOOK_EVENTS.every((ev) => events.has(ev) || events.has("*"));
  });

  if (existing?.id && input.hasLocalWebhookSecret) {
    return {
      ok: true,
      webhookId: existing.id,
      url: normalizedTarget,
      secret: null,
      created: false,
      message: `Webhook activo y verificado en Facturapi (${normalizedTarget}).`,
    };
  }

  if (existing?.id && !input.hasLocalWebhookSecret) {
    await facturapiFetch(input.secret, `/webhooks/${existing.id}`, { method: "DELETE" }, fetchFn).catch(() => undefined);
  }

  const created = await facturapiFetch<WebhookRecord & { message?: string }>(
    input.secret,
    "/webhooks",
    {
      method: "POST",
      body: JSON.stringify({
        url: normalizedTarget,
        enabled_events: [...REQUIRED_WEBHOOK_EVENTS],
        description: "SYGOS 3.0 ERP",
      }),
    },
    fetchFn,
  );

  if (!created.ok || !created.body.id) {
    return {
      ok: false,
      webhookId: null,
      url: normalizedTarget,
      secret: null,
      created: false,
      message: created.body.message || "Facturapi no pudo registrar el webhook.",
    };
  }

  return {
    ok: true,
    webhookId: created.body.id,
    url: normalizedTarget,
    secret: created.body.secret ?? null,
    created: true,
    message: created.body.secret
      ? `Webhook registrado en Facturapi (${normalizedTarget}) y secreto guardado cifrado.`
      : `Webhook registrado en Facturapi (${normalizedTarget}).`,
  };
}

export type WebhookProcessResult = {
  status: number;
  body: {
    ok: boolean;
    duplicate?: boolean;
    ignored?: boolean;
    reason?: string;
    message?: string;
  };
};

type WebhookPayloadShape = {
  id?: string;
  type?: string;
  livemode?: boolean;
  organization?: string;
  related_resource_messages?: Array<{
    resource_type?: string;
    resource_id?: string;
    severity?: string;
    message?: string;
  }>;
  data?: {
    type?: string;
    object?: InvoiceResponse;
  };
};

export async function processFacturapiWebhook(input: {
  companyCode: string;
  rawBody: string;
  signature: string | null;
  fetchFn?: typeof fetch;
}): Promise<WebhookProcessResult> {
  const fetchFn = input.fetchFn ?? fetch;
  const code = input.companyCode.trim().toUpperCase();
  const company = await prisma.company.findUnique({ where: { code } });
  if (!company) {
    return { status: 404, body: { ok: false, message: "Empresa no encontrada." } };
  }

  let event: WebhookPayloadShape;
  try {
    event = JSON.parse(input.rawBody) as WebhookPayloadShape;
  } catch {
    return { status: 400, body: { ok: false, message: "JSON de webhook inválido." } };
  }

  if (!event.id || !event.type || typeof event.livemode !== "boolean") {
    return { status: 400, body: { ok: false, message: "Evento de webhook incompleto." } };
  }

  const eventEnv: "TEST" | "LIVE" = event.livemode ? "LIVE" : "TEST";
  const slot = await loadWebhookSlotForEnvironment(company.id, eventEnv);

  if (!input.signature?.trim()) {
    return { status: 401, body: { ok: false, message: "Falta el encabezado Facturapi-Signature." } };
  }
  if (!slot.webhookSecret || !slot.apiSecret) {
    return { status: 401, body: { ok: false, message: "Webhook o llave de Facturapi no configurada para este ambiente." } };
  }

  const sigCheck = await facturapiFetch<{ valid?: boolean; message?: string }>(
    slot.apiSecret,
    "/webhooks/validate-signature",
    {
      method: "POST",
      body: JSON.stringify({
        secret: slot.webhookSecret,
        payload: input.rawBody,
        signature: input.signature.trim(),
      }),
    },
    fetchFn,
  );
  if (!sigCheck.ok) {
    return { status: 401, body: { ok: false, message: sigCheck.body.message || "Firma de webhook inválida." } };
  }

  if (slot.organizationId && event.organization && event.organization !== slot.organizationId) {
    return { status: 403, body: { ok: false, message: "El evento pertenece a otra organización de Facturapi." } };
  }

  const expectedLivemode =
    slot.config.facturapiMode === "LIVE"
      ? true
      : slot.config.facturapiMode === "TEST"
        ? false
        : null;

  if (expectedLivemode === null || event.livemode !== expectedLivemode) {
    return {
      status: 200,
      body: { ok: true, ignored: true, reason: "mode_mismatch" },
    };
  }

  const existingEvent = await prisma.facturapiWebhookEvent.findUnique({ where: { id: event.id } });
  if (existingEvent) {
    return { status: 200, body: { ok: true, duplicate: true } };
  }

  try {
    await prisma.facturapiWebhookEvent.create({
      data: {
        id: event.id,
        companyId: company.id,
        eventType: event.type,
        livemode: event.livemode,
        resourceId: event.data?.object?.id ?? null,
        payloadJson: input.rawBody,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { status: 200, body: { ok: true, duplicate: true } };
    }
    throw error;
  }

  if (event.type === "invoice.status_updated" && event.data?.object) {
    const inv = event.data.object;
    const orFilters: Array<{ fiscalExternalId?: string; id?: string }> = [];
    if (inv.id) orFilters.push({ fiscalExternalId: inv.id });
    if (inv.external_id) orFilters.push({ id: inv.external_id });

    if (orFilters.length > 0) {
      const doc = await prisma.billingDocument.findFirst({
        where: {
          companyId: company.id,
          OR: orFilters,
        },
      });
      if (doc && (!doc.fiscalEnv || doc.fiscalEnv === eventEnv)) {
        if (inv.status === "valid") {
          await prisma.billingDocument.update({
            where: { id: doc.id },
            data: {
              fiscalEnv: eventEnv,
              fiscalExternalId: inv.id ?? doc.fiscalExternalId,
              fiscalUuid: inv.uuid ?? doc.fiscalUuid,
              fiscalSeries: inv.series ?? doc.fiscalSeries,
              fiscalFolioNumber: inv.folio_number ?? doc.fiscalFolioNumber,
              verificationUrl: inv.verification_url ?? doc.verificationUrl,
              stampedAt: doc.stampedAt ?? new Date(),
              fiscalStatus: "TIMBRADA",
              fiscalError: null,
            },
          });
          await finalizeStampedArtifactsAndDelivery(doc.id, fetchFn);
          await recordHistory({
            companyId: company.id,
            entityType: "DOCUMENTO",
            entityId: doc.id,
            action: "TIMBRADO_WEBHOOK",
            summary: `${doc.folio} quedó timbrada vía webhook Facturapi (${eventEnv}).`,
          });
        } else if (inv.status === "failed") {
          const errorDetail =
            event.related_resource_messages
              ?.filter((m) => m.message && (!m.severity || m.severity === "error"))
              .map((m) => m.message)
              .join(" · ")
            || inv.message
            || "Facturapi marcó el timbrado asíncrono como fallido.";
          await prisma.billingDocument.update({
            where: { id: doc.id },
            data: {
              fiscalEnv: eventEnv,
              fiscalStatus: "ERROR",
              fiscalExternalId: null,
              fiscalIdempotencyKey: nextIdempotencyAttemptKey(doc.id, doc.fiscalIdempotencyKey),
              fiscalError: errorDetail,
            },
          });
          await recordHistory({
            companyId: company.id,
            entityType: "DOCUMENTO",
            entityId: doc.id,
            action: "ERROR_TIMBRADO_WEBHOOK",
            summary: `Webhook Facturapi reportó error en ${doc.folio}: ${errorDetail}`,
          });
        } else if (inv.status === "pending") {
          await prisma.billingDocument.update({
            where: { id: doc.id },
            data: {
              fiscalEnv: eventEnv,
              fiscalExternalId: inv.id ?? doc.fiscalExternalId,
              fiscalStatus: "PROCESANDO",
            },
          });
        } else if (inv.status === "canceled") {
          await prisma.billingDocument.update({
            where: { id: doc.id },
            data: {
              fiscalEnv: eventEnv,
              fiscalStatus: "CANCELADA",
            },
          });
        }
      } else {
        const rep = await prisma.paymentComplement.findFirst({
          where: {
            companyId: company.id,
            OR: orFilters,
          },
          include: { payment: true },
        });
        if (rep && (!rep.fiscalEnv || rep.fiscalEnv === eventEnv)) {
          if (inv.status === "valid") {
            await prisma.paymentComplement.update({
              where: { id: rep.id },
              data: {
                fiscalEnv: eventEnv,
                fiscalExternalId: inv.id ?? rep.fiscalExternalId,
                fiscalUuid: inv.uuid ?? rep.fiscalUuid,
                fiscalSeries: inv.series ?? rep.fiscalSeries,
                fiscalFolioNumber: inv.folio_number ?? rep.fiscalFolioNumber,
                verificationUrl: inv.verification_url ?? rep.verificationUrl,
                stampedAt: rep.stampedAt ?? new Date(),
                fiscalStatus: "TIMBRADA",
                fiscalError: null,
              },
            });
            await ensurePaymentComplementArtifacts(rep.id, { fetchFn }).catch(() => undefined);
            await recordHistory({
              companyId: company.id,
              entityType: "PAGO",
              entityId: rep.paymentId,
              action: "TIMBRADO_REP_WEBHOOK",
              summary: `REP de ${rep.payment.folio} quedó timbrado vía webhook Facturapi (${eventEnv}).`,
            });
          } else if (inv.status === "failed") {
            const errorDetail =
              event.related_resource_messages
                ?.filter((m) => m.message && (!m.severity || m.severity === "error"))
                .map((m) => m.message)
                .join(" · ")
              || inv.message
              || "Facturapi marcó el timbrado del REP como fallido.";
            await prisma.paymentComplement.update({
              where: { id: rep.id },
              data: {
                fiscalEnv: eventEnv,
                fiscalStatus: "ERROR",
                fiscalExternalId: null,
                fiscalIdempotencyKey: nextRepIdempotencyAttemptKey(rep.id, rep.fiscalIdempotencyKey),
                fiscalError: errorDetail,
              },
            });
            await recordHistory({
              companyId: company.id,
              entityType: "PAGO",
              entityId: rep.paymentId,
              action: "ERROR_REP_WEBHOOK",
              summary: `Webhook Facturapi reportó error en REP de ${rep.payment.folio}: ${errorDetail}`,
            });
          } else if (inv.status === "pending") {
            await prisma.paymentComplement.update({
              where: { id: rep.id },
              data: {
                fiscalEnv: eventEnv,
                fiscalExternalId: inv.id ?? rep.fiscalExternalId,
                fiscalStatus: "PROCESANDO",
              },
            });
          } else if (inv.status === "canceled") {
            await prisma.paymentComplement.update({
              where: { id: rep.id },
              data: {
                fiscalEnv: eventEnv,
                fiscalStatus: "CANCELADA",
                canceledAt: rep.canceledAt ?? new Date(),
              },
            });
          }
        }
      }
    }
  }

  return { status: 200, body: { ok: true } };
}

export function isBillingDocumentEligibleForRep(doc: {
  kind: string;
  paymentMethodSnapshot: string | null;
  fiscalStatus: string;
}): boolean {
  return doc.kind !== "REMISION" && doc.paymentMethodSnapshot === "PPD" && doc.fiscalStatus === "TIMBRADA";
}

function nextRepIdempotencyAttemptKey(complementId: string, currentKey: string | null | undefined): string {
  if (!currentKey) return `sygos-rep-${complementId}-a1`;
  const match = currentKey.match(/-a(\d+)$/);
  const nextAttempt = match ? Number.parseInt(match[1]!, 10) + 1 : 2;
  return `sygos-rep-${complementId}-a${nextAttempt}`;
}

export type PaymentSummaryResponse = {
  uuid: string;
  folio_number?: number;
  series?: string;
  installment: number;
  last_balance: number;
  total?: number;
  currency?: string;
  amount: number;
  taxes?: Array<Record<string, unknown>>;
  message?: string;
  code?: string;
};

export function buildRepPayload(input: {
  externalId: string;
  idempotencyKey?: string | null;
  customerName: string;
  satLegalName?: string | null;
  rfc: string | null;
  taxSystem: string | null;
  zip: string | null;
  email: string | null;
  paymentForm: string;
  paymentDate: Date;
  series?: string | null;
  folioNumber?: number | null;
  relatedDocuments: PaymentSummaryResponse[];
}) {
  const missing = [
    !input.rfc ? "RFC del receptor" : null,
    !input.taxSystem ? "régimen fiscal del receptor" : null,
    !input.zip ? "código postal fiscal del receptor" : null,
    input.relatedDocuments.length === 0 ? "documentos relacionados PPD" : null,
  ].filter(Boolean);
  if (missing.length > 0) return { error: `Falta ${missing.join(", ")} para timbrar el REP.` };

  const legalName = resolveClientSatLegalName({
    name: input.customerName,
    satLegalName: input.satLegalName,
  });

  return {
    body: {
      type: "P" as const,
      external_id: input.externalId,
      ...(input.idempotencyKey ? { idempotency_key: input.idempotencyKey.slice(0, 100) } : {}),
      ...(input.series ? { series: input.series.slice(0, 25) } : {}),
      ...(input.folioNumber && input.folioNumber > 0 ? { folio_number: input.folioNumber } : {}),
      customer: {
        legal_name: legalName,
        tax_id: input.rfc!,
        tax_system: input.taxSystem!.slice(0, 3),
        email: input.email || undefined,
        address: { zip: input.zip!, country: "MEX" },
      },
      complements: [
        {
          type: "pago" as const,
          data: [
            {
              payment_form: input.paymentForm,
              date: input.paymentDate.toISOString(),
              related_documents: input.relatedDocuments,
            },
          ],
        },
      ],
    },
  };
}

export async function resolveEligibleRepData(paymentId: string) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      applications: {
        include: {
          receivable: { include: { document: true } },
          payable: { include: { document: true } },
        },
      },
    },
  });
  if (!payment || payment.status !== "VALIDADO") return null;

  const entries = payment.applications
    .map((application) => {
      const document =
        payment.kind === "INTERCOMPANIA"
          ? application.payable?.document ?? null
          : application.receivable?.document ?? null;
      return { application, document };
    })
    .filter(
      (row): row is { application: (typeof payment.applications)[number]; document: NonNullable<typeof row.document> } =>
        Boolean(row.document) && isBillingDocumentEligibleForRep(row.document!),
    );

  if (entries.length === 0) return null;

  const firstDoc = entries[0]!.document;
  const paymentForm = satFormaPagoForOperationalPayment(payment.method);
  const totalAmount = roundMoney(entries.reduce((sum, row) => sum + row.application.amount, 0));
  const paymentDate =
    entries.find((row) => row.application.confirmedAt)?.application.confirmedAt
    ?? payment.createdAt;

  return {
    payment,
    entries,
    companyId: firstDoc.companyId,
    clientId: firstDoc.clientId,
    paymentForm,
    totalAmount,
    paymentDate,
  };
}

export async function preparePaymentComplementForPayment(paymentId: string) {
  const existing = await prisma.paymentComplement.findUnique({
    where: { paymentId },
    include: { items: true },
  });
  const eligible = await resolveEligibleRepData(paymentId);

  if (existing) {
    if (existing.fiscalStatus === "PENDIENTE" && eligible && existing.totalAmount !== eligible.totalAmount) {
      return prisma.paymentComplement.update({
        where: { id: existing.id },
        data: { totalAmount: eligible.totalAmount, paymentForm: eligible.paymentForm },
        include: { items: true },
      });
    }
    return existing;
  }

  if (!eligible) return null;

  try {
    return await prisma.paymentComplement.create({
      data: {
        companyId: eligible.companyId,
        paymentId: eligible.payment.id,
        clientId: eligible.clientId,
        paymentForm: eligible.paymentForm,
        paymentDate: eligible.paymentDate,
        totalAmount: eligible.totalAmount,
        fiscalStatus: "PENDIENTE",
      },
      include: { items: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return prisma.paymentComplement.findUnique({
        where: { paymentId },
        include: { items: true },
      });
    }
    throw error;
  }
}

export async function triggerRepAfterPaymentValidation(
  paymentId: string,
  options?: { fetchFn?: typeof fetch },
) {
  const complement = await preparePaymentComplementForPayment(paymentId);
  if (!complement) return null;

  const company = await prisma.company.findUnique({ where: { id: complement.companyId } });
  const config = parseCompanyFiscalConfig(company ?? {});
  if (config.toggles.autoRepOnPaymentValidation) {
    await stampPaymentComplement(complement.id, { fetchFn: options?.fetchFn }).catch(() => undefined);
  }
  return prisma.paymentComplement.findUnique({
    where: { id: complement.id },
    include: { items: true },
  });
}

async function persistSimulatedRepItems(
  complementId: string,
  entries: NonNullable<Awaited<ReturnType<typeof resolveEligibleRepData>>>["entries"],
) {
  for (const { application, document } of entries) {
    const priorItems = await prisma.paymentComplementItem.findMany({
      where: {
        billingDocumentId: document.id,
        complementId: { not: complementId },
        complement: { fiscalStatus: { in: ["TIMBRADA", "SIMULADA"] } },
      },
    });
    const priorPaid = roundMoney(priorItems.reduce((sum, item) => sum + item.amountPaid, 0));
    const lastBalance = roundMoney(Math.max(0, document.total - priorPaid));
    const amountPaid = roundMoney(application.amount);
    const insoluto = roundMoney(Math.max(0, lastBalance - amountPaid));
    await prisma.paymentComplementItem.upsert({
      where: { paymentApplicationId: application.id },
      update: {
        installment: priorItems.length + 1,
        lastBalance,
        amountPaid,
        insoluto,
      },
      create: {
        complementId,
        billingDocumentId: document.id,
        paymentApplicationId: application.id,
        installment: priorItems.length + 1,
        lastBalance,
        amountPaid,
        insoluto,
      },
    });
  }
}

export async function stampPaymentComplement(
  complementOrPaymentId: string,
  options?: { isPaymentId?: boolean; fetchFn?: typeof fetch; forceNewIdempotencyKey?: boolean },
): Promise<{
  ok: boolean;
  status: string;
  complementId: string | null;
  message: string;
}> {
  const fetchFn = options?.fetchFn ?? fetch;

  let rep = options?.isPaymentId
    ? await preparePaymentComplementForPayment(complementOrPaymentId)
    : await prisma.paymentComplement.findUnique({
        where: { id: complementOrPaymentId },
        include: { items: true },
      });

  if (!rep && !options?.isPaymentId) {
    rep = await preparePaymentComplementForPayment(complementOrPaymentId);
  }

  if (!rep) {
    return {
      ok: false,
      status: "INELIGIBLE",
      complementId: null,
      message: "Este pago no aplica para Complemento de Pago (requiere pago validado sobre factura PPD timbrada).",
    };
  }

  if (rep.fiscalStatus === "TIMBRADA") {
    return {
      ok: true,
      status: "TIMBRADA",
      complementId: rep.id,
      message: "El complemento de pago (REP) ya está timbrado.",
    };
  }
  if (rep.fiscalStatus === "CANCELADA") {
    return {
      ok: false,
      status: "CANCELADA",
      complementId: rep.id,
      message: "El complemento de pago está cancelado.",
    };
  }

  const eligible = await resolveEligibleRepData(rep.paymentId);
  const cred = await resolveFacturapiRuntimeCredential(rep.companyId);

  if (cred.status === "SIMULATED") {
    if (eligible) {
      await persistSimulatedRepItems(rep.id, eligible.entries);
    }
    await prisma.paymentComplement.update({
      where: { id: rep.id },
      data: {
        fiscalStatus: "SIMULADA",
        fiscalEnv: "SIMULATED",
        fiscalError: cred.message,
      },
    });
    return {
      ok: false,
      status: "SIMULADA",
      complementId: rep.id,
      message: cred.message,
    };
  }

  if (cred.status === "UNAVAILABLE") {
    await prisma.paymentComplement.update({
      where: { id: rep.id },
      data: {
        fiscalStatus: "ERROR",
        fiscalEnv: cred.env,
        fiscalError: cred.message,
      },
    });
    return {
      ok: false,
      status: "ERROR",
      complementId: rep.id,
      message: cred.message,
    };
  }

  const secret = cred.secret;
  const fiscalEnv = cred.env;

  const paymentRow = await prisma.payment.findUnique({ where: { id: rep.paymentId } });
  const paymentFolio = paymentRow?.folio ?? rep.paymentId;

  try {
    if (rep.fiscalExternalId) {
      const current = await facturapiFetch(secret, `/invoices/${rep.fiscalExternalId}`, undefined, fetchFn);
      if (current.ok && current.body.status === "valid") {
        await prisma.paymentComplement.update({
          where: { id: rep.id },
          data: {
            fiscalEnv,
            fiscalStatus: "TIMBRADA",
            fiscalUuid: current.body.uuid ?? rep.fiscalUuid,
            fiscalSeries: current.body.series ?? rep.fiscalSeries,
            fiscalFolioNumber: current.body.folio_number ?? rep.fiscalFolioNumber,
            verificationUrl: current.body.verification_url ?? rep.verificationUrl,
            stampedAt: rep.stampedAt ?? new Date(),
            fiscalError: null,
          },
        });
        await ensurePaymentComplementArtifacts(rep.id, { fetchFn }).catch(() => undefined);
        await recordHistory({
          companyId: rep.companyId,
          entityType: "PAGO",
          entityId: rep.paymentId,
          action: "TIMBRADO_REP",
          summary: `REP de ${paymentFolio} confirmado y timbrado ante Facturapi (${fiscalEnv}).`,
        });
        return { ok: true, status: "TIMBRADA", complementId: rep.id, message: "Complemento de pago timbrado." };
      }
      if (current.ok && current.body.status === "pending") {
        await prisma.paymentComplement.update({
          where: { id: rep.id },
          data: {
            fiscalEnv,
            fiscalStatus: "PROCESANDO",
            fiscalError: "Facturapi está recuperando el REP ante el SAT (HTTP 202). No se creará otro.",
          },
        });
        return {
          ok: false,
          status: "PROCESANDO",
          complementId: rep.id,
          message: "REP en proceso ante el SAT (HTTP 202).",
        };
      }
      if (current.ok && current.body.status === "canceled") {
        await prisma.paymentComplement.update({
          where: { id: rep.id },
          data: {
            fiscalEnv,
            fiscalStatus: "CANCELADA",
            fiscalError: "Este REP aparece cancelado en Facturapi.",
          },
        });
        return { ok: false, status: "CANCELADA", complementId: rep.id, message: "Este REP aparece cancelado en Facturapi." };
      }
      if (current.ok && current.body.status === "failed") {
        const msg = current.body.message || "Facturapi agotó la recuperación del REP (failed). Ya puedes reintentar.";
        await prisma.paymentComplement.update({
          where: { id: rep.id },
          data: {
            fiscalEnv,
            fiscalExternalId: null,
            fiscalIdempotencyKey: nextRepIdempotencyAttemptKey(rep.id, rep.fiscalIdempotencyKey),
            fiscalStatus: "ERROR",
            fiscalError: msg,
          },
        });
        return { ok: false, status: "ERROR", complementId: rep.id, message: msg };
      }
      const pendingMsg = current.body.message || "Facturapi aún no confirma este REP. No se creó otro.";
      await prisma.paymentComplement.update({
        where: { id: rep.id },
        data: { fiscalEnv, fiscalStatus: "ERROR", fiscalError: pendingMsg },
      });
      return { ok: false, status: "ERROR", complementId: rep.id, message: pendingMsg };
    }

    const listed = await facturapiFetch(
      secret,
      `/invoices?external_id=${encodeURIComponent(rep.id)}&limit=20`,
      undefined,
      fetchFn,
    );
    const existing = listed.body.data?.find(
      (row) => row.external_id === rep.id && row.status !== "failed" && row.status !== "canceled",
    );
    if (existing?.id) {
      const nextStatus =
        existing.status === "valid"
          ? "TIMBRADA"
          : existing.status === "pending"
            ? "PROCESANDO"
            : "ERROR";
      await prisma.paymentComplement.update({
        where: { id: rep.id },
        data: {
          fiscalEnv,
          fiscalExternalId: existing.id,
          fiscalUuid: existing.uuid ?? null,
          fiscalSeries: existing.series ?? null,
          fiscalFolioNumber: existing.folio_number ?? null,
          verificationUrl: existing.verification_url ?? null,
          stampedAt: existing.status === "valid" ? new Date() : null,
          fiscalStatus: nextStatus,
          fiscalError:
            existing.status === "valid"
              ? null
              : existing.status === "pending"
                ? "Facturapi ya tiene este REP en proceso (HTTP 202). No se creó otro."
                : "Facturapi ya registró este REP. No se creó otro.",
        },
      });
      if (existing.status === "valid") {
        await ensurePaymentComplementArtifacts(rep.id, { fetchFn }).catch(() => undefined);
        return { ok: true, status: "TIMBRADA", complementId: rep.id, message: "Complemento de pago recuperado y timbrado." };
      }
      return {
        ok: false,
        status: nextStatus,
        complementId: rep.id,
        message: "Facturapi ya tiene este REP registrado; no se creó otro.",
      };
    }

    if (!eligible) {
      const msg = "No hay facturas PPD timbradas elegibles para este pago.";
      await prisma.paymentComplement.update({
        where: { id: rep.id },
        data: { fiscalEnv, fiscalStatus: "ERROR", fiscalError: msg },
      });
      return { ok: false, status: "ERROR", complementId: rep.id, message: msg };
    }

    let client = await prisma.client.findUnique({
      where: { id: rep.clientId },
      include: {
        contacts: {
          where: { active: true },
          orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        },
      },
    });
    if (client?.isSystem) {
      const systron = await prisma.company.findUnique({ where: { code: "SYSTRON" } });
      if (systron) {
        await syncIntercompanyPartiesFromCompany(systron.id);
        client = await prisma.client.findUnique({
          where: { id: rep.clientId },
          include: {
            contacts: {
              where: { active: true },
              orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
            },
          },
        });
      }
    }
    if (!client) {
      const msg = "No se encontró el cliente receptor del complemento de pago.";
      await prisma.paymentComplement.update({
        where: { id: rep.id },
        data: { fiscalEnv, fiscalStatus: "ERROR", fiscalError: msg },
      });
      return { ok: false, status: "ERROR", complementId: rep.id, message: msg };
    }

    const relatedDocuments: PaymentSummaryResponse[] = [];
    for (const { application, document } of eligible.entries) {
      if (!document.fiscalExternalId) {
        const msg = `La factura ${document.folio} no tiene ID externo de Facturapi para generar el REP.`;
        await prisma.paymentComplement.update({
          where: { id: rep.id },
          data: { fiscalEnv, fiscalStatus: "ERROR", fiscalError: msg },
        });
        return { ok: false, status: "ERROR", complementId: rep.id, message: msg };
      }
      const summaryRes = await facturapiFetch<PaymentSummaryResponse>(
        secret,
        `/invoices/${encodeURIComponent(document.fiscalExternalId)}/payment-summary?amount=${encodeURIComponent(String(application.amount))}`,
        undefined,
        fetchFn,
      );
      if (!summaryRes.ok || !summaryRes.body.uuid) {
        const msg =
          summaryRes.body.message
          || `Facturapi no pudo calcular el resumen de pago para ${document.folio}.`;
        await prisma.paymentComplement.update({
          where: { id: rep.id },
          data: { fiscalEnv, fiscalStatus: "ERROR", fiscalError: msg },
        });
        return { ok: false, status: "ERROR", complementId: rep.id, message: msg };
      }
      const summary = summaryRes.body;
      const paid = roundMoney(summary.amount ?? application.amount);
      const lastBalance = roundMoney(summary.last_balance);
      const insoluto = roundMoney(Math.max(0, lastBalance - paid));

      await prisma.paymentComplementItem.upsert({
        where: { paymentApplicationId: application.id },
        update: {
          installment: summary.installment,
          lastBalance,
          amountPaid: paid,
          insoluto,
        },
        create: {
          complementId: rep.id,
          billingDocumentId: document.id,
          paymentApplicationId: application.id,
          installment: summary.installment,
          lastBalance,
          amountPaid: paid,
          insoluto,
        },
      });
      relatedDocuments.push(summary);
    }

    const company = await prisma.company.findUnique({ where: { id: rep.companyId } });
    const companyConfig = parseCompanyFiscalConfig(company ?? {});
    const parsedPaymentFolio =
      companyConfig.fiscalSeriesPolicy === "SYGOS_FAC"
        ? parseSygosSeriesAndFolio(paymentFolio, "REP")
        : null;

    const idempotencyKey =
      options?.forceNewIdempotencyKey || !rep.fiscalIdempotencyKey
        ? nextRepIdempotencyAttemptKey(rep.id, rep.fiscalIdempotencyKey)
        : rep.fiscalIdempotencyKey;

    if (idempotencyKey !== rep.fiscalIdempotencyKey) {
      await prisma.paymentComplement.update({
        where: { id: rep.id },
        data: { fiscalIdempotencyKey: idempotencyKey },
      });
    }

    const contactEmail =
      client.fiscalEmail?.trim()
      || client.contacts.find((c) => c.email?.trim())?.email?.trim()
      || null;

    const payload = buildRepPayload({
      externalId: rep.id,
      idempotencyKey,
      customerName: client.name,
      satLegalName: client.satLegalName,
      rfc: client.rfc,
      taxSystem: client.taxRegime,
      zip: client.fiscalZip,
      email: contactEmail,
      paymentForm: rep.paymentForm,
      paymentDate: rep.paymentDate,
      series: parsedPaymentFolio ? "REP" : null,
      folioNumber: parsedPaymentFolio?.folioNumber ?? null,
      relatedDocuments,
    });

    if ("error" in payload && payload.error) {
      await prisma.paymentComplement.update({
        where: { id: rep.id },
        data: { fiscalEnv, fiscalStatus: "ERROR", fiscalError: payload.error },
      });
      return { ok: false, status: "ERROR", complementId: rep.id, message: payload.error };
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
        `/invoices?external_id=${encodeURIComponent(rep.id)}&limit=20`,
        undefined,
        fetchFn,
      );
      const match = recovered.body.data?.find(
        (row) => row.external_id === rep.id && row.status !== "failed" && row.status !== "canceled",
      );
      if (match?.id) {
        const nextStatus = match.status === "valid" ? "TIMBRADA" : match.status === "pending" ? "PROCESANDO" : "ERROR";
        await prisma.paymentComplement.update({
          where: { id: rep.id },
          data: {
            fiscalEnv,
            fiscalExternalId: match.id,
            fiscalUuid: match.uuid ?? null,
            fiscalSeries: match.series ?? (parsedPaymentFolio ? "REP" : null),
            fiscalFolioNumber: match.folio_number ?? parsedPaymentFolio?.folioNumber ?? null,
            verificationUrl: match.verification_url ?? null,
            stampedAt: match.status === "valid" ? new Date() : null,
            fiscalStatus: nextStatus,
            fiscalError:
              match.status === "valid"
                ? null
                : match.status === "pending"
                  ? "REP en proceso ante el SAT (recuperado tras 409)."
                  : "Facturapi ya registró este REP (409).",
          },
        });
        if (match.status === "valid") {
          await ensurePaymentComplementArtifacts(rep.id, { fetchFn }).catch(() => undefined);
          await recordHistory({
            companyId: rep.companyId,
            entityType: "PAGO",
            entityId: rep.paymentId,
            action: "TIMBRADO_REP",
            summary: `REP de ${paymentFolio} recuperado y timbrado (${fiscalEnv}).`,
          });
          return { ok: true, status: "TIMBRADA", complementId: rep.id, message: "Complemento de pago timbrado." };
        }
        return { ok: false, status: nextStatus, complementId: rep.id, message: "REP en proceso o ya registrado (409)." };
      }
      const conflictMsg = "Facturapi reportó clave de idempotencia en uso (409) para el REP. Consulta en unos segundos.";
      await prisma.paymentComplement.update({
        where: { id: rep.id },
        data: { fiscalEnv, fiscalStatus: "ERROR", fiscalError: conflictMsg },
      });
      return { ok: false, status: "ERROR", complementId: rep.id, message: conflictMsg };
    }

    if ((created.status === 202 || created.body.status === "pending") && created.body.id) {
      const msg202 = "REP en proceso por intermitencia SAT (HTTP 202). Facturapi reintentará automáticamente; no se creará otro.";
      await prisma.paymentComplement.update({
        where: { id: rep.id },
        data: {
          fiscalEnv,
          fiscalExternalId: created.body.id,
          fiscalSeries: created.body.series ?? (parsedPaymentFolio ? "REP" : null),
          fiscalFolioNumber: created.body.folio_number ?? parsedPaymentFolio?.folioNumber ?? null,
          fiscalStatus: "PROCESANDO",
          fiscalError: msg202,
        },
      });
      return { ok: false, status: "PROCESANDO", complementId: rep.id, message: msg202 };
    }

    if (!created.ok || !created.body.id) {
      const errMsg = created.body.message || "Facturapi no timbró el complemento de pago. El pago y sus saldos siguen vigentes.";
      await prisma.paymentComplement.update({
        where: { id: rep.id },
        data: { fiscalEnv, fiscalStatus: "ERROR", fiscalError: errMsg },
      });
      return { ok: false, status: "ERROR", complementId: rep.id, message: errMsg };
    }

    await prisma.paymentComplement.update({
      where: { id: rep.id },
      data: {
        fiscalEnv,
        fiscalExternalId: created.body.id,
        fiscalUuid: created.body.uuid ?? null,
        fiscalSeries: created.body.series ?? (parsedPaymentFolio ? "REP" : null),
        fiscalFolioNumber: created.body.folio_number ?? parsedPaymentFolio?.folioNumber ?? null,
        verificationUrl: created.body.verification_url ?? null,
        stampedAt: created.body.status === "valid" ? new Date() : null,
        fiscalStatus: created.body.status === "valid" ? "TIMBRADA" : "ERROR",
        fiscalError:
          created.body.status === "valid"
            ? null
            : "Facturapi recibió el REP y aún no lo marca como vigente.",
      },
    });

    if (created.body.status === "valid") {
      await ensurePaymentComplementArtifacts(rep.id, { fetchFn }).catch(() => undefined);
      await recordHistory({
        companyId: rep.companyId,
        entityType: "PAGO",
        entityId: rep.paymentId,
        action: "TIMBRADO_REP",
        summary: `Complemento de pago (REP) de ${paymentFolio} timbrado (${fiscalEnv}).`,
      });
      return {
        ok: true,
        status: "TIMBRADA",
        complementId: rep.id,
        message: "Complemento de pago (REP) timbrado correctamente.",
      };
    }

    return {
      ok: false,
      status: "ERROR",
      complementId: rep.id,
      message: "Facturapi recibió el REP y aún no lo marca como vigente.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error de red al contactar a Facturapi.";
    const fullMsg = `${message} El pago y sus saldos siguen vigentes; puedes reintentar el REP.`;
    await prisma.paymentComplement.update({
      where: { id: rep.id },
      data: { fiscalEnv, fiscalStatus: "ERROR", fiscalError: fullMsg },
    });
    return { ok: false, status: "ERROR", complementId: rep.id, message: fullMsg };
  }
}
