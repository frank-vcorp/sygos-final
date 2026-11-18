import { Prisma } from "@prisma/client";
import {
  ensureBillingDocumentArtifacts,
  ensureCancellationReceiptArtifacts,
  ensurePaymentComplementArtifacts,
  ensurePayrollLineArtifacts,
  ensureRepCancellationReceiptArtifacts,
} from "./billing-artifacts";
import { maybeAutoDeliverStampedDocument } from "./billing-delivery";
import { inSandbox, prisma, prismaProd } from "./db";
import {
  loadWebhookSlotForEnvironment,
  parseCompanyFiscalConfig,
  resolveFacturapiRuntimeCredential,
  resolveFacturapiSecretForEnv,
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
  type?: "I" | "E";
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
  relatedDocuments?: Array<{ relationship: string; documents: string[] }>;
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
  const cfdiType = input.type ?? "I";

  return {
    body: {
      type: cfdiType,
      external_id: input.externalId,
      ...(input.idempotencyKey ? { idempotency_key: input.idempotencyKey.slice(0, 100) } : {}),
      ...(input.series ? { series: input.series.slice(0, 25) } : {}),
      ...(input.folioNumber && input.folioNumber > 0 ? { folio_number: input.folioNumber } : {}),
      ...(input.relatedDocuments && input.relatedDocuments.length > 0
        ? { related_documents: input.relatedDocuments }
        : {}),
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
  cancellation_status?: string;
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
      relatedDocument: { select: { id: true, folio: true, fiscalUuid: true, fiscalStatus: true } },
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

    let relatedDocuments: Array<{ relationship: string; documents: string[] }> | undefined;
    if (document.kind === "NOTA_CREDITO") {
      if (!document.relatedDocument?.fiscalUuid) {
        await prisma.billingDocument.update({
          where: { id: document.id },
          data: {
            fiscalEnv,
            fiscalStatus: "ERROR",
            fiscalError: "La factura origen aún no tiene UUID fiscal para timbrar la Nota de Crédito.",
          },
        });
        return;
      }
      relatedDocuments = [
        {
          relationship: document.satRelationType || "01",
          documents: [document.relatedDocument.fiscalUuid],
        },
      ];
    }

    const payload = invoicePayload({
      type: document.kind === "NOTA_CREDITO" ? "E" : "I",
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
      relatedDocuments,
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

function nextPayrollIdempotencyAttemptKey(lineId: string, currentKey: string | null | undefined): string {
  if (!currentKey) return `sygos-nom-${lineId}-a1`;
  const match = currentKey.match(/-a(\d+)$/);
  const nextAttempt = match ? Number.parseInt(match[1]!, 10) + 1 : 2;
  return `sygos-nom-${lineId}-a${nextAttempt}`;
}

export function buildPayrollReceiptPayload(input: {
  externalId: string;
  idempotencyKey?: string | null;
  employeeName: string;
  rfc: string | null;
  curp: string | null;
  nss: string | null;
  fiscalZip: string | null;
  hiredAt: Date;
  dailySalary: number;
  transferTotal: number;
  periodStart: string;
  periodEnd: string;
  paymentDate?: string | null;
  employerCurp: string | null;
  registroPatronal: string | null;
  employerState: string | null;
  employeeNumber?: string;
}) {
  const missing = [
    !input.rfc ? "RFC" : null,
    !input.curp ? "CURP" : null,
    !input.nss ? "NSS" : null,
    !input.fiscalZip ? "código postal" : null,
    !input.employerCurp ? "CURP del patrón" : null,
    !input.registroPatronal ? "registro patronal" : null,
    !input.employerState ? "entidad federativa" : null,
  ].filter(Boolean);
  if (missing.length > 0) return { error: `Falta ${missing.join(", ")}` };

  const payDate = input.paymentDate?.trim() || input.periodEnd;
  return {
    body: {
      type: "N" as const,
      external_id: input.externalId,
      ...(input.idempotencyKey ? { idempotency_key: input.idempotencyKey.slice(0, 100) } : {}),
      customer: {
        legal_name: resolveClientSatLegalName({ name: input.employeeName }),
        tax_id: input.rfc!,
        tax_system: "605",
        address: { country: "MEX", zip: input.fiscalZip! },
      },
      complements: [
        {
          type: "nomina" as const,
          data: {
            fecha_pago: `${payDate}T12:00:00.000Z`,
            fecha_inicial_pago: `${input.periodStart}T06:00:00.000Z`,
            fecha_final_pago: `${input.periodEnd}T06:00:00.000Z`,
            num_dias_pagados: 7,
            emisor: {
              curp: input.employerCurp!,
              registro_patronal: input.registroPatronal!,
            },
            receptor: {
              curp: input.curp!,
              tipo_contrato: "01",
              tipo_regimen: "02",
              num_empleado: input.employeeNumber || input.externalId.slice(-6),
              periodicidad_pago: "02",
              clave_ent_fed: input.employerState!,
              num_seguridad_social: input.nss!,
              fecha_inicio_rel_laboral: input.hiredAt.toISOString(),
              tipo_jornada: "01",
              salario_diario_integrado: input.dailySalary,
              antiguedad: true,
            },
            percepciones: {
              percepcion: [
                {
                  tipo_percepcion: "001",
                  clave: "001",
                  concepto: "Sueldo",
                  importe_gravado: input.transferTotal,
                  importe_exento: 0,
                },
              ],
            },
          },
        },
      ],
    },
  };
}

export async function recomputePayrollPeriodFiscalStatus(
  periodId: string,
  envOverride?: string | null,
) {
  const period = await prisma.payrollPeriod.findUnique({
    where: { id: periodId },
    include: { lines: true },
  });
  if (!period) return;
  const eligible = period.lines.filter((line) => line.transferTotal > 0);
  if (eligible.length === 0) {
    await prisma.payrollPeriod.update({
      where: { id: period.id },
      data: { fiscalStatus: "NO_APLICA", fiscalEnv: envOverride ?? period.fiscalEnv, fiscalError: null },
    });
    return;
  }

  const lineErrors = eligible
    .filter((l) => l.fiscalStatus === "ERROR")
    .map((l) => l.fiscalError || "Error al timbrar recibo");
  const hasProcessing = eligible.some((l) => l.fiscalStatus === "PROCESANDO");
  const hasSimulated = eligible.some((l) => l.fiscalStatus === "SIMULADA");
  const allStamped = eligible.every((l) => l.fiscalStatus === "TIMBRADA");
  const resolvedEnv = envOverride ?? eligible.find((l) => l.fiscalEnv)?.fiscalEnv ?? period.fiscalEnv;

  let fiscalStatus = "PENDIENTE";
  let fiscalError: string | null = null;
  if (lineErrors.length > 0) {
    fiscalStatus = "ERROR";
    fiscalError = lineErrors.join(" · ");
  } else if (hasProcessing) {
    fiscalStatus = "PROCESANDO";
    fiscalError = "Uno o más recibos están en proceso ante el SAT (HTTP 202).";
  } else if (hasSimulated) {
    fiscalStatus = "SIMULADA";
    fiscalError = "PRUEBA / SIN VALIDEZ. No se contactó a Facturapi.";
  } else if (allStamped) {
    fiscalStatus = "TIMBRADA";
    fiscalError = null;
  }

  await prisma.payrollPeriod.update({
    where: { id: period.id },
    data: {
      fiscalStatus,
      fiscalEnv: resolvedEnv,
      fiscalError,
    },
  });
}

export async function stampPayrollPeriod(
  periodId: string,
  options?: { lineId?: string; fetchFn?: typeof fetch },
) {
  const fetchFn = options?.fetchFn ?? fetch;
  const period = await prisma.payrollPeriod.findUnique({
    where: { id: periodId },
    include: { lines: { include: { collaborator: { include: { user: true } } } }, company: true },
  });
  if (!period) return;

  const targetLines = period.lines.filter(
    (row) => row.transferTotal > 0 && (!options?.lineId || row.id === options.lineId),
  );

  const cred = await resolveFacturapiRuntimeCredential(period.companyId);
  if (cred.status === "SIMULATED") {
    for (const line of targetLines) {
      await prisma.payrollLine.update({
        where: { id: line.id },
        data: { fiscalStatus: "SIMULADA", fiscalEnv: "SIMULATED", fiscalError: cred.message },
      });
    }
    await prisma.payrollPeriod.update({
      where: { id: period.id },
      data: { fiscalStatus: "SIMULADA", fiscalEnv: "SIMULATED", fiscalError: cred.message },
    });
    return;
  }
  if (cred.status === "UNAVAILABLE") {
    await prisma.payrollPeriod.update({
      where: { id: period.id },
      data: { fiscalStatus: "ERROR", fiscalEnv: cred.env, fiscalError: cred.message },
    });
    return;
  }

  const secret = cred.secret;
  const fiscalEnv = cred.env;
  const setting = await prismaProd.integrationSetting.findFirst({
    where: {
      companyId: period.companyId,
      provider: { in: [`FACTURAPI_${fiscalEnv}`, "FACTURAPI"] },
    },
  });
  const extra = setting?.extra
    ? (JSON.parse(setting.extra) as { registroPatronal?: string; employerCurp?: string; employerState?: string })
    : {};
  const registro = period.company.registroPatronal || extra.registroPatronal || null;
  const employerCurp = period.company.employerCurp || extra.employerCurp || null;
  const state = period.company.employerState || extra.employerState || null;
  if (!registro || !employerCurp || !state) {
    await prisma.payrollPeriod.update({
      where: { id: period.id },
      data: {
        fiscalStatus: "ERROR",
        fiscalEnv,
        fiscalError: "Facturapi está configurado, pero falta registro patronal, CURP del patrón o entidad federativa.",
      },
    });
    return;
  }

  for (const line of targetLines) {
    const person = line.collaborator;
    if (line.fiscalStatus === "TIMBRADA") continue;

    try {
      if (line.fiscalExternalId) {
        const current = await facturapiFetch(secret, `/invoices/${line.fiscalExternalId}`, undefined, fetchFn);
        if (current.ok && current.body.status === "valid") {
          await prisma.payrollLine.update({
            where: { id: line.id },
            data: {
              fiscalEnv,
              fiscalStatus: "TIMBRADA",
              fiscalUuid: current.body.uuid ?? line.fiscalUuid,
              stampedAt: line.stampedAt ?? new Date(),
              fiscalError: null,
            },
          });
          await ensurePayrollLineArtifacts(line.id, { fetchFn }).catch(() => undefined);
          continue;
        }
        if (current.ok && current.body.status === "pending") {
          await prisma.payrollLine.update({
            where: { id: line.id },
            data: {
              fiscalEnv,
              fiscalStatus: "PROCESANDO",
              fiscalError: "Recibo en proceso ante el SAT (HTTP 202).",
            },
          });
          continue;
        }
        if (current.ok && current.body.status === "failed") {
          await prisma.payrollLine.update({
            where: { id: line.id },
            data: {
              fiscalEnv,
              fiscalExternalId: null,
              fiscalIdempotencyKey: nextPayrollIdempotencyAttemptKey(line.id, line.fiscalIdempotencyKey),
              fiscalStatus: "ERROR",
              fiscalError: `${person.user.name}: ${current.body.message || "Facturapi agotó la recuperación (failed)."}`,
            },
          });
          continue;
        }
        if (current.ok && current.body.status === "canceled") {
          await prisma.payrollLine.update({
            where: { id: line.id },
            data: { fiscalEnv, fiscalStatus: "CANCELADA", fiscalError: "Recibo cancelado en Facturapi." },
          });
          continue;
        }
        await prisma.payrollLine.update({
          where: { id: line.id },
          data: {
            fiscalEnv,
            fiscalStatus: "ERROR",
            fiscalError: `${person.user.name}: ${current.body.message || "Facturapi aún no confirma este recibo."}`,
          },
        });
        continue;
      }

      const listed = await facturapiFetch(
        secret,
        `/invoices?external_id=${encodeURIComponent(line.id)}&limit=20`,
        undefined,
        fetchFn,
      );
      const existing = listed.body.data?.find(
        (row) => row.external_id === line.id && row.status !== "failed" && row.status !== "canceled",
      );
      if (existing?.id) {
        const nextStatus = existing.status === "valid" ? "TIMBRADA" : existing.status === "pending" ? "PROCESANDO" : "ERROR";
        await prisma.payrollLine.update({
          where: { id: line.id },
          data: {
            fiscalEnv,
            fiscalExternalId: existing.id,
            fiscalUuid: existing.uuid ?? null,
            stampedAt: existing.status === "valid" ? new Date() : null,
            fiscalStatus: nextStatus,
            fiscalError:
              existing.status === "valid"
                ? null
                : `${person.user.name}: ya existe en Facturapi (${existing.status ?? "pendiente"}).`,
          },
        });
        if (existing.status === "valid") {
          await ensurePayrollLineArtifacts(line.id, { fetchFn }).catch(() => undefined);
        }
        continue;
      }

      const idempotencyKey =
        line.fiscalIdempotencyKey || nextPayrollIdempotencyAttemptKey(line.id, line.fiscalIdempotencyKey);
      if (idempotencyKey !== line.fiscalIdempotencyKey) {
        await prisma.payrollLine.update({
          where: { id: line.id },
          data: { fiscalIdempotencyKey: idempotencyKey },
        });
      }

      const payload = buildPayrollReceiptPayload({
        externalId: line.id,
        idempotencyKey,
        employeeName: person.user.name,
        rfc: person.rfc,
        curp: person.curp,
        nss: person.nss,
        fiscalZip: person.fiscalZip,
        hiredAt: person.hiredAt,
        dailySalary: person.dailyStamped + person.dailyCash,
        transferTotal: line.transferTotal,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        paymentDate: period.paymentDate,
        employerCurp,
        registroPatronal: registro,
        employerState: state,
        employeeNumber: person.id.slice(-6),
      });

      if ("error" in payload && payload.error) {
        await prisma.payrollLine.update({
          where: { id: line.id },
          data: { fiscalEnv, fiscalStatus: "ERROR", fiscalError: `${person.user.name}: ${payload.error}` },
        });
        continue;
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
          `/invoices?external_id=${encodeURIComponent(line.id)}&limit=20`,
          undefined,
          fetchFn,
        );
        const match = recovered.body.data?.find(
          (row) => row.external_id === line.id && row.status !== "failed" && row.status !== "canceled",
        );
        if (match?.id) {
          const nextStatus = match.status === "valid" ? "TIMBRADA" : match.status === "pending" ? "PROCESANDO" : "ERROR";
          await prisma.payrollLine.update({
            where: { id: line.id },
            data: {
              fiscalEnv,
              fiscalExternalId: match.id,
              fiscalUuid: match.uuid ?? null,
              stampedAt: match.status === "valid" ? new Date() : null,
              fiscalStatus: nextStatus,
              fiscalError: match.status === "valid" ? null : `${person.user.name}: recibo recuperado (${match.status}).`,
            },
          });
          if (match.status === "valid") {
            await ensurePayrollLineArtifacts(line.id, { fetchFn }).catch(() => undefined);
          }
          continue;
        }
        await prisma.payrollLine.update({
          where: { id: line.id },
          data: {
            fiscalEnv,
            fiscalStatus: "ERROR",
            fiscalError: `${person.user.name}: clave de idempotencia en uso (409). Consulta en unos segundos.`,
          },
        });
        continue;
      }

      if ((created.status === 202 || created.body.status === "pending") && created.body.id) {
        await prisma.payrollLine.update({
          where: { id: line.id },
          data: {
            fiscalEnv,
            fiscalExternalId: created.body.id,
            fiscalStatus: "PROCESANDO",
            fiscalError: "Recibo en proceso ante el SAT (HTTP 202). Facturapi reintentará automáticamente.",
          },
        });
        continue;
      }

      if (!created.ok || !created.body.id) {
        await prisma.payrollLine.update({
          where: { id: line.id },
          data: {
            fiscalEnv,
            fiscalStatus: "ERROR",
            fiscalError: `${person.user.name}: ${created.body.message || "Facturapi no timbró el recibo"}`,
          },
        });
        continue;
      }

      await prisma.payrollLine.update({
        where: { id: line.id },
        data: {
          fiscalEnv,
          fiscalExternalId: created.body.id,
          fiscalUuid: created.body.uuid ?? null,
          stampedAt: created.body.status === "valid" ? new Date() : null,
          fiscalStatus: created.body.status === "valid" ? "TIMBRADA" : "ERROR",
          fiscalError:
            created.body.status === "valid"
              ? null
              : `${person.user.name}: Facturapi recibió el recibo y aún no lo marca como vigente.`,
        },
      });
      if (created.body.status === "valid") {
        await ensurePayrollLineArtifacts(line.id, { fetchFn }).catch(() => undefined);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Error de red al timbrar recibo.";
      await prisma.payrollLine.update({
        where: { id: line.id },
        data: { fiscalEnv, fiscalStatus: "ERROR", fiscalError: `${person.user.name}: ${msg}` },
      });
    }
  }

  await recomputePayrollPeriodFiscalStatus(period.id, fiscalEnv);
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
        } else {
          const payrollLine = await prisma.payrollLine.findFirst({
            where: {
              period: { companyId: company.id },
              OR: orFilters,
            },
            include: {
              period: { select: { id: true, folio: true } },
              collaborator: { include: { user: { select: { name: true } } } },
            },
          });
          if (payrollLine && (!payrollLine.fiscalEnv || payrollLine.fiscalEnv === eventEnv)) {
            if (inv.status === "valid") {
              await prisma.payrollLine.update({
                where: { id: payrollLine.id },
                data: {
                  fiscalEnv: eventEnv,
                  fiscalExternalId: inv.id ?? payrollLine.fiscalExternalId,
                  fiscalUuid: inv.uuid ?? payrollLine.fiscalUuid,
                  stampedAt: payrollLine.stampedAt ?? new Date(),
                  fiscalStatus: "TIMBRADA",
                  fiscalError: null,
                },
              });
              await ensurePayrollLineArtifacts(payrollLine.id, { fetchFn }).catch(() => undefined);
              await recomputePayrollPeriodFiscalStatus(payrollLine.period.id, eventEnv);
              await recordHistory({
                companyId: company.id,
                entityType: "NOMINA",
                entityId: payrollLine.period.id,
                action: "TIMBRADO_NOMINA_WEBHOOK",
                summary: `Recibo CFDI de ${payrollLine.collaborator.user.name} en ${payrollLine.period.folio} timbrado vía webhook (${eventEnv}).`,
              });
            } else if (inv.status === "failed") {
              const errorDetail =
                event.related_resource_messages
                  ?.filter((m) => m.message && (!m.severity || m.severity === "error"))
                  .map((m) => m.message)
                  .join(" · ")
                || inv.message
                || "Facturapi marcó el recibo de nómina como fallido.";
              await prisma.payrollLine.update({
                where: { id: payrollLine.id },
                data: {
                  fiscalEnv: eventEnv,
                  fiscalStatus: "ERROR",
                  fiscalExternalId: null,
                  fiscalIdempotencyKey: nextPayrollIdempotencyAttemptKey(payrollLine.id, payrollLine.fiscalIdempotencyKey),
                  fiscalError: `${payrollLine.collaborator.user.name}: ${errorDetail}`,
                },
              });
              await recomputePayrollPeriodFiscalStatus(payrollLine.period.id, eventEnv);
              await recordHistory({
                companyId: company.id,
                entityType: "NOMINA",
                entityId: payrollLine.period.id,
                action: "ERROR_NOMINA_WEBHOOK",
                summary: `Error en recibo CFDI de ${payrollLine.collaborator.user.name} (${payrollLine.period.folio}): ${errorDetail}`,
              });
            } else if (inv.status === "pending") {
              await prisma.payrollLine.update({
                where: { id: payrollLine.id },
                data: {
                  fiscalEnv: eventEnv,
                  fiscalExternalId: inv.id ?? payrollLine.fiscalExternalId,
                  fiscalStatus: "PROCESANDO",
                },
              });
              await recomputePayrollPeriodFiscalStatus(payrollLine.period.id, eventEnv);
            } else if (inv.status === "canceled") {
              await prisma.payrollLine.update({
                where: { id: payrollLine.id },
                data: {
                  fiscalEnv: eventEnv,
                  fiscalStatus: "CANCELADA",
                },
              });
              await recomputePayrollPeriodFiscalStatus(payrollLine.period.id, eventEnv);
            }
          }
        }
      }
    }
  } else if (event.type === "invoice.cancellation_status_updated" && event.data?.object) {
    const inv = event.data.object;
    const orFilters: Array<{ fiscalExternalId?: string; id?: string }> = [];
    if (inv.id) orFilters.push({ fiscalExternalId: inv.id });
    if (inv.external_id) orFilters.push({ id: inv.external_id });

    if (orFilters.length > 0) {
      const doc = await prisma.billingDocument.findFirst({
        where: { companyId: company.id, OR: orFilters },
      });
      if (doc && (!doc.fiscalEnv || doc.fiscalEnv === eventEnv)) {
        const cancelStatus = inv.cancellation_status ?? (inv.status === "canceled" ? "accepted" : null);
        if (inv.status === "canceled" || cancelStatus === "accepted") {
          await finalizeDocumentCancellation(doc.id, { fetchFn, viaWebhook: true });
        } else if (cancelStatus === "rejected" || cancelStatus === "expired") {
          await prisma.billingDocument.update({
            where: { id: doc.id },
            data: {
              cancellationStatus: cancelStatus,
              fiscalError:
                cancelStatus === "rejected"
                  ? "El receptor rechazó la solicitud de cancelación ante el SAT."
                  : "La solicitud de cancelación expiró sin respuesta del receptor.",
            },
          });
          await recordHistory({
            companyId: company.id,
            entityType: "DOCUMENTO",
            entityId: doc.id,
            action: "CANCELACION_RECHAZADA",
            summary: `Cancelación de ${doc.folio} terminó en estado ${cancelStatus} vía webhook.`,
          });
        } else if (cancelStatus === "pending" || cancelStatus === "verifying") {
          await prisma.billingDocument.update({
            where: { id: doc.id },
            data: { cancellationStatus: cancelStatus },
          });
        }
      } else {
        const rep = await prisma.paymentComplement.findFirst({
          where: { companyId: company.id, OR: orFilters },
          include: { payment: true },
        });
        if (rep && (!rep.fiscalEnv || rep.fiscalEnv === eventEnv)) {
          const cancelStatus = inv.cancellation_status ?? (inv.status === "canceled" ? "accepted" : null);
          if (inv.status === "canceled" || cancelStatus === "accepted") {
            await finalizeRepCancellation(rep.id, { fetchFn, viaWebhook: true });
          } else if (cancelStatus === "rejected" || cancelStatus === "expired") {
            await prisma.paymentComplement.update({
              where: { id: rep.id },
              data: {
                cancellationStatus: cancelStatus,
                fiscalError:
                  cancelStatus === "rejected"
                    ? "El receptor rechazó la cancelación del REP ante el SAT."
                    : "La cancelación del REP expiró sin respuesta del receptor.",
              },
            });
            await recordHistory({
              companyId: company.id,
              entityType: "PAGO",
              entityId: rep.paymentId,
              action: "CANCELACION_REP_RECHAZADA",
              summary: `Cancelación del REP de ${rep.payment.folio} terminó en estado ${cancelStatus} vía webhook.`,
            });
          } else if (cancelStatus === "pending" || cancelStatus === "verifying") {
            await prisma.paymentComplement.update({
              where: { id: rep.id },
              data: { cancellationStatus: cancelStatus },
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

export const SAT_CANCEL_MOTIVES = [
  { id: "01", label: "01 — Comprobante emitido con errores con relación (requiere sustitución)" },
  { id: "02", label: "02 — Comprobante emitido con errores sin relación" },
  { id: "03", label: "03 — No se llevó a cabo la operación" },
  { id: "04", label: "04 — Operación nominativa relacionada en factura global (requiere sustitución)" },
] as const;

export type SatCancelMotive = (typeof SAT_CANCEL_MOTIVES)[number]["id"];

export function isValidSatCancelMotive(value: string | null | undefined): value is SatCancelMotive {
  return value === "01" || value === "02" || value === "03" || value === "04";
}

function docBalanceStatus(balance: number, amount: number) {
  if (balance <= 0) return "SALDADA";
  if (balance < amount) return "PARCIAL";
  return "ABIERTA";
}

export async function finalizeDocumentCancellation(
  documentId: string,
  options?: { fetchFn?: typeof fetch; viaWebhook?: boolean; actorUserId?: string | null },
) {
  const doc = await prisma.billingDocument.findUnique({
    where: { id: documentId },
    include: {
      receivable: {
        include: {
          applications: { include: { payment: { select: { status: true } } } },
        },
      },
      payable: {
        include: {
          applications: { include: { payment: { select: { status: true } } } },
        },
      },
      relatedDocument: {
        include: {
          receivable: true,
          payable: true,
        },
      },
    },
  });
  if (!doc) return;

  await prisma.$transaction(async (tx) => {
    await tx.billingDocument.update({
      where: { id: doc.id },
      data: {
        status: "CANCELADA",
        fiscalStatus: doc.kind === "REMISION" ? "NO_APLICA" : "CANCELADA",
        cancellationStatus: "accepted",
        canceledAt: doc.canceledAt ?? new Date(),
        fiscalError: null,
        version: { increment: 1 },
      },
    });

    if (doc.receivable) {
      const hasValidatedPayment = doc.receivable.applications.some(
        (app) => Boolean(app.confirmedAt) && app.payment.status === "VALIDADO",
      );
      if (!hasValidatedPayment) {
        await tx.receivable.update({
          where: { id: doc.receivable.id },
          data: { status: "CANCELADA", balance: 0 },
        });
      }
    }

    if (doc.payable) {
      const hasValidatedPayablePayment = doc.payable.applications.some(
        (app) => Boolean(app.confirmedAt) && app.payment.status === "VALIDADO",
      );
      if (!hasValidatedPayablePayment) {
        await tx.payable.update({
          where: { id: doc.payable.id },
          data: { status: "CANCELADA", balance: 0 },
        });
      }
    }

    if (doc.kind === "NOTA_CREDITO" && doc.relatedDocument?.receivable) {
      const targetRec = doc.relatedDocument.receivable;
      if (targetRec.status !== "CANCELADA") {
        const restored = roundMoney(Math.min(targetRec.amount, targetRec.balance + doc.total));
        await tx.receivable.update({
          where: { id: targetRec.id },
          data: { balance: restored, status: docBalanceStatus(restored, targetRec.amount) },
        });
      }
    }

    if (doc.kind === "NOTA_CREDITO" && doc.relatedDocument?.payable) {
      const targetPay = doc.relatedDocument.payable;
      if (targetPay.status !== "CANCELADA") {
        const restored = roundMoney(Math.min(targetPay.amount, targetPay.balance + doc.total));
        await tx.payable.update({
          where: { id: targetPay.id },
          data: { balance: restored, status: docBalanceStatus(restored, targetPay.amount) },
        });
      }
    }
  });

  if (doc.fiscalExternalId && doc.fiscalEnv !== "SIMULATED") {
    await ensureCancellationReceiptArtifacts(doc.id, { fetchFn: options?.fetchFn }).catch(() => undefined);
  }

  await recordHistory({
    companyId: doc.companyId,
    entityType: "DOCUMENTO",
    entityId: doc.id,
    action: options?.viaWebhook ? "CANCELACION_SAT_WEBHOOK" : "CANCELACION_SAT",
    summary: `${doc.folio} quedó cancelado${doc.cancelMotive ? ` (motivo ${doc.cancelMotive})` : ""}${options?.viaWebhook ? " vía webhook" : ""}.`,
    authorUserId: options?.actorUserId ?? null,
  });
}

export async function cancelBillingDocumentInFacturapi(
  documentId: string,
  options?: { actorUserId?: string | null; fetchFn?: typeof fetch },
): Promise<{
  ok: boolean;
  status: string;
  cancellationStatus: string;
  message: string;
}> {
  const fetchFn = options?.fetchFn ?? fetch;
  const doc = await prisma.billingDocument.findUnique({
    where: { id: documentId },
    include: {
      company: true,
      substitutionDocument: true,
      paymentComplementItems: {
        include: {
          complement: {
            include: { payment: { select: { folio: true } } },
          },
        },
      },
      receivable: {
        include: {
          applications: { include: { payment: { select: { status: true } } } },
        },
      },
      payable: {
        include: {
          applications: { include: { payment: { select: { status: true } } } },
        },
      },
    },
  });

  if (!doc) throw new Error("No se encontró el documento.");
  if (doc.status === "CANCELADA") throw new Error("Este documento ya está cancelado.");
  if (doc.cancellationStatus === "pending" || doc.cancellationStatus === "verifying") {
    throw new Error("Ya existe una cancelación en proceso ante el SAT para este documento.");
  }

  const motive = doc.cancelMotive;
  if (!isValidSatCancelMotive(motive)) {
    throw new Error("Define un motivo de cancelación SAT válido (01, 02, 03 o 04).");
  }

  const sandboxActive = await inSandbox();
  let substitutionIdParam: string | null = null;
  if (motive === "01" || motive === "04") {
    if (!doc.cancelSubstitutionDocId) {
      throw new Error(`El motivo ${motive} exige seleccionar la factura que sustituye a este comprobante.`);
    }
    const subDoc =
      doc.substitutionDocument
      ?? (await prisma.billingDocument.findFirst({
        where: { id: doc.cancelSubstitutionDocId, companyId: doc.companyId },
      }));
    if (!subDoc || subDoc.companyId !== doc.companyId || subDoc.id === doc.id) {
      throw new Error("La factura sustituta no pertenece a la misma empresa o no es válida.");
    }
    const subAllowed = sandboxActive
      ? subDoc.status === "EMITIDA" && (subDoc.fiscalStatus === "TIMBRADA" || subDoc.fiscalStatus === "SIMULADA")
      : subDoc.status === "EMITIDA" && subDoc.fiscalStatus === "TIMBRADA" && Boolean(subDoc.fiscalUuid || subDoc.fiscalExternalId);
    if (!subAllowed) {
      throw new Error("La factura sustituta debe estar emitida y timbrada antes de cancelar con motivo 01 o 04.");
    }
    substitutionIdParam = subDoc.fiscalUuid || subDoc.fiscalExternalId || subDoc.id;
  }

  // Regla obligatoria SAT: si tiene un Complemento de Pago (REP) vigente, debe cancelarse primero el REP
  const activeReps = doc.paymentComplementItems.filter(
    (item) => item.complement.fiscalStatus !== "CANCELADA",
  );
  if (activeReps.length > 0) {
    const folios = activeReps.map((item) => item.complement.payment.folio).join(", ");
    throw new Error(
      `Esta factura PPD tiene Complemento(s) de Pago (REP) vigente(s) (${folios}). Cancela primero el REP desde el detalle del pago antes de cancelar la factura.`,
    );
  }

  // Verificar pagos validados en CxC / CxP según política del Administrador:
  // Si el documento tenía REP(s) y ya fueron cancelados, se desbloquea el orden SAT.
  const hasCancelledReps = doc.paymentComplementItems.length > 0 && activeReps.length === 0;
  const hasValidatedRecPayments = Boolean(
    doc.receivable?.applications.some((app) => Boolean(app.confirmedAt) && app.payment.status === "VALIDADO"),
  );
  const hasValidatedPayablePayments = Boolean(
    doc.payable?.applications.some((app) => Boolean(app.confirmedAt) && app.payment.status === "VALIDADO"),
  );
  if ((hasValidatedRecPayments || hasValidatedPayablePayments) && !hasCancelledReps) {
    const companyConfig = parseCompanyFiscalConfig(doc.company);
    if (
      companyConfig.toggles.cancelWithPaymentsPolicy === "BLOCK_UNTIL_REP_CANCELED"
      && motive !== "01"
    ) {
      throw new Error(
        "La factura tiene pagos validados aplicados. Usa sustitución (motivo 01) o regulariza los pagos antes de cancelar.",
      );
    }
  }

  const isLocalOnly =
    doc.kind === "REMISION"
    || !doc.fiscalExternalId
    || doc.fiscalStatus === "PENDIENTE"
    || doc.fiscalStatus === "ERROR"
    || doc.fiscalStatus === "SIMULADA"
    || doc.fiscalEnv === "SIMULATED"
    || sandboxActive;

  if (isLocalOnly) {
    await finalizeDocumentCancellation(doc.id, {
      fetchFn,
      actorUserId: options?.actorUserId ?? null,
    });
    return {
      ok: true,
      status: "CANCELADA",
      cancellationStatus: "accepted",
      message:
        sandboxActive || doc.fiscalEnv === "SIMULATED"
          ? `${doc.folio} cancelado en modo de pruebas (simulado).`
          : `${doc.folio} cancelado internamente.`,
    };
  }

  const cred = await resolveFacturapiSecretForEnv(doc.companyId, doc.fiscalEnv);
  if (!cred) {
    const msg = "No se encontró la llave de Facturapi del ambiente en que se timbró este documento.";
    await prisma.billingDocument.update({ where: { id: doc.id }, data: { fiscalError: msg } });
    return { ok: false, status: doc.fiscalStatus, cancellationStatus: doc.cancellationStatus ?? "none", message: msg };
  }

  const params = new URLSearchParams({ motive });
  if (substitutionIdParam) params.set("substitution", substitutionIdParam);

  const res = await facturapiFetch(
    cred.secret,
    `/invoices/${encodeURIComponent(doc.fiscalExternalId!)}?${params.toString()}`,
    { method: "DELETE" },
    fetchFn,
  );

  if (!res.ok) {
    const msg = res.body.message || "Facturapi rechazó la solicitud de cancelación ante el SAT.";
    await prisma.billingDocument.update({ where: { id: doc.id }, data: { fiscalError: msg } });
    return {
      ok: false,
      status: doc.fiscalStatus,
      cancellationStatus: doc.cancellationStatus ?? "none",
      message: msg,
    };
  }

  const cancelStatus = res.body.cancellation_status ?? (res.body.status === "canceled" ? "accepted" : "pending");
  if (res.body.status === "canceled" || cancelStatus === "accepted") {
    await finalizeDocumentCancellation(doc.id, {
      fetchFn,
      actorUserId: options?.actorUserId ?? null,
    });
    return {
      ok: true,
      status: "CANCELADA",
      cancellationStatus: "accepted",
      message: `${doc.folio} cancelado ante el SAT.`,
    };
  }

  await prisma.billingDocument.update({
    where: { id: doc.id },
    data: {
      cancellationStatus: cancelStatus,
      fiscalError: null,
    },
  });
  await ensureCancellationReceiptArtifacts(doc.id, { fetchFn }).catch(() => undefined);
  await recordHistory({
    companyId: doc.companyId,
    entityType: "DOCUMENTO",
    entityId: doc.id,
    action: "CANCELACION_EN_PROCESO",
    summary: `Solicitud de cancelación SAT enviada para ${doc.folio} (motivo ${motive}, estado ${cancelStatus}).`,
    authorUserId: options?.actorUserId ?? null,
  });

  return {
    ok: true,
    status: "EMITIDA",
    cancellationStatus: cancelStatus,
    message: `Cancelación en proceso (${cancelStatus}). El documento sigue vigente hasta que el SAT/receptor confirme.`,
  };
}

export async function pollBillingDocumentCancellation(
  documentId: string,
  options?: { actorUserId?: string | null; fetchFn?: typeof fetch },
): Promise<{ ok: boolean; status: string; cancellationStatus: string; message: string }> {
  const fetchFn = options?.fetchFn ?? fetch;
  const doc = await prisma.billingDocument.findUnique({ where: { id: documentId } });
  if (!doc) throw new Error("Documento no encontrado.");
  if (doc.status === "CANCELADA") {
    return { ok: true, status: "CANCELADA", cancellationStatus: "accepted", message: "El documento ya está cancelado." };
  }
  if (!doc.fiscalExternalId || doc.fiscalEnv === "SIMULATED") {
    return { ok: false, status: doc.fiscalStatus, cancellationStatus: doc.cancellationStatus ?? "none", message: "El documento no tiene solicitud activa en Facturapi." };
  }
  const cred = await resolveFacturapiSecretForEnv(doc.companyId, doc.fiscalEnv);
  if (!cred) {
    return { ok: false, status: doc.fiscalStatus, cancellationStatus: doc.cancellationStatus ?? "none", message: "No hay llave de Facturapi configurada para consultar." };
  }

  const res = await facturapiFetch(cred.secret, `/invoices/${encodeURIComponent(doc.fiscalExternalId)}`, undefined, fetchFn);
  if (!res.ok) {
    return { ok: false, status: doc.fiscalStatus, cancellationStatus: doc.cancellationStatus ?? "none", message: res.body.message || "Facturapi no devolvió el estado de cancelación." };
  }

  const cancelStatus = res.body.cancellation_status ?? (res.body.status === "canceled" ? "accepted" : "none");
  if (res.body.status === "canceled" || cancelStatus === "accepted") {
    await finalizeDocumentCancellation(doc.id, { fetchFn, actorUserId: options?.actorUserId ?? null });
    return { ok: true, status: "CANCELADA", cancellationStatus: "accepted", message: "Cancelación confirmada ante el SAT." };
  }

  if (cancelStatus === "rejected" || cancelStatus === "expired") {
    const errMsg =
      cancelStatus === "rejected"
        ? "El receptor rechazó la solicitud de cancelación ante el SAT."
        : "La solicitud de cancelación expiró sin respuesta.";
    await prisma.billingDocument.update({
      where: { id: doc.id },
      data: { cancellationStatus: cancelStatus, fiscalError: errMsg },
    });
    await recordHistory({
      companyId: doc.companyId,
      entityType: "DOCUMENTO",
      entityId: doc.id,
      action: "CANCELACION_RECHAZADA",
      summary: `Cancelación de ${doc.folio}: ${errMsg}`,
      authorUserId: options?.actorUserId ?? null,
    });
    return { ok: false, status: doc.fiscalStatus, cancellationStatus: cancelStatus, message: errMsg };
  }

  await prisma.billingDocument.update({
    where: { id: doc.id },
    data: { cancellationStatus: cancelStatus },
  });
  return { ok: true, status: doc.fiscalStatus, cancellationStatus: cancelStatus, message: `Cancelación aún en proceso (${cancelStatus}).` };
}

export async function finalizeRepCancellation(
  complementId: string,
  options?: { fetchFn?: typeof fetch; viaWebhook?: boolean; actorUserId?: string | null },
) {
  const rep = await prisma.paymentComplement.findUnique({
    where: { id: complementId },
    include: { payment: { select: { folio: true } } },
  });
  if (!rep) return;

  await prisma.paymentComplement.update({
    where: { id: rep.id },
    data: {
      fiscalStatus: "CANCELADA",
      cancellationStatus: "accepted",
      canceledAt: rep.canceledAt ?? new Date(),
      fiscalError: null,
    },
  });

  if (rep.fiscalExternalId && rep.fiscalEnv !== "SIMULATED") {
    await ensureRepCancellationReceiptArtifacts(rep.id, { fetchFn: options?.fetchFn }).catch(() => undefined);
  }

  await recordHistory({
    companyId: rep.companyId,
    entityType: "PAGO",
    entityId: rep.paymentId,
    action: options?.viaWebhook ? "CANCELACION_REP_WEBHOOK" : "CANCELACION_REP",
    summary: `REP de ${rep.payment.folio} quedó cancelado${rep.cancelMotive ? ` (motivo ${rep.cancelMotive})` : ""}.`,
    authorUserId: options?.actorUserId ?? null,
  });
}

export async function cancelPaymentComplement(
  complementId: string,
  options: { motive: string; actorUserId?: string | null; fetchFn?: typeof fetch },
): Promise<{ ok: boolean; status: string; cancellationStatus: string; message: string }> {
  const fetchFn = options.fetchFn ?? fetch;
  if (!isValidSatCancelMotive(options.motive)) {
    throw new Error("El motivo SAT de cancelación del REP debe ser 01, 02, 03 o 04.");
  }
  const rep = await prisma.paymentComplement.findUnique({
    where: { id: complementId },
    include: { payment: { select: { folio: true } } },
  });
  if (!rep) throw new Error("Complemento de pago no encontrado.");
  if (rep.fiscalStatus === "CANCELADA") throw new Error("Este REP ya está cancelado.");
  if (rep.cancellationStatus === "pending" || rep.cancellationStatus === "verifying") {
    throw new Error("La cancelación de este REP ya está en proceso ante el SAT.");
  }

  await prisma.paymentComplement.update({
    where: { id: rep.id },
    data: {
      cancelMotive: options.motive,
      cancelRequestedAt: rep.cancelRequestedAt ?? new Date(),
      cancelRequestedByUserId: rep.cancelRequestedByUserId ?? options.actorUserId ?? null,
      cancelAuthorizedByUserId: options.actorUserId ?? rep.cancelAuthorizedByUserId ?? null,
    },
  });

  const sandboxActive = await inSandbox();
  if (
    !rep.fiscalExternalId
    || rep.fiscalStatus === "PENDIENTE"
    || rep.fiscalStatus === "ERROR"
    || rep.fiscalStatus === "SIMULADA"
    || rep.fiscalEnv === "SIMULATED"
    || sandboxActive
  ) {
    await finalizeRepCancellation(rep.id, { fetchFn, actorUserId: options.actorUserId ?? null });
    return {
      ok: true,
      status: "CANCELADA",
      cancellationStatus: "accepted",
      message: `REP de ${rep.payment.folio} cancelado.`,
    };
  }

  const cred = await resolveFacturapiSecretForEnv(rep.companyId, rep.fiscalEnv);
  if (!cred) {
    const msg = "No se encontró la llave de Facturapi para cancelar este REP.";
    await prisma.paymentComplement.update({ where: { id: rep.id }, data: { fiscalError: msg } });
    return { ok: false, status: rep.fiscalStatus, cancellationStatus: rep.cancellationStatus ?? "none", message: msg };
  }

  const res = await facturapiFetch(
    cred.secret,
    `/invoices/${encodeURIComponent(rep.fiscalExternalId)}?motive=${encodeURIComponent(options.motive)}`,
    { method: "DELETE" },
    fetchFn,
  );
  if (!res.ok) {
    const msg = res.body.message || "Facturapi rechazó la cancelación del REP.";
    await prisma.paymentComplement.update({ where: { id: rep.id }, data: { fiscalError: msg } });
    return { ok: false, status: rep.fiscalStatus, cancellationStatus: rep.cancellationStatus ?? "none", message: msg };
  }

  const cancelStatus = res.body.cancellation_status ?? (res.body.status === "canceled" ? "accepted" : "pending");
  if (res.body.status === "canceled" || cancelStatus === "accepted") {
    await finalizeRepCancellation(rep.id, { fetchFn, actorUserId: options.actorUserId ?? null });
    return { ok: true, status: "CANCELADA", cancellationStatus: "accepted", message: "REP cancelado ante el SAT." };
  }

  await prisma.paymentComplement.update({
    where: { id: rep.id },
    data: { cancellationStatus: cancelStatus, fiscalError: null },
  });
  await ensureRepCancellationReceiptArtifacts(rep.id, { fetchFn }).catch(() => undefined);
  await recordHistory({
    companyId: rep.companyId,
    entityType: "PAGO",
    entityId: rep.paymentId,
    action: "CANCELACION_REP_EN_PROCESO",
    summary: `Cancelación del REP de ${rep.payment.folio} en proceso (${cancelStatus}).`,
    authorUserId: options.actorUserId ?? null,
  });
  return {
    ok: true,
    status: rep.fiscalStatus,
    cancellationStatus: cancelStatus,
    message: `Cancelación del REP en proceso (${cancelStatus}).`,
  };
}

export async function pollPaymentComplementCancellation(
  complementId: string,
  options?: { actorUserId?: string | null; fetchFn?: typeof fetch },
): Promise<{ ok: boolean; status: string; cancellationStatus: string; message: string }> {
  const fetchFn = options?.fetchFn ?? fetch;
  const rep = await prisma.paymentComplement.findUnique({
    where: { id: complementId },
    include: { payment: { select: { folio: true } } },
  });
  if (!rep) throw new Error("REP no encontrado.");
  if (rep.fiscalStatus === "CANCELADA") {
    return { ok: true, status: "CANCELADA", cancellationStatus: "accepted", message: "El REP ya está cancelado." };
  }
  if (!rep.fiscalExternalId || rep.fiscalEnv === "SIMULATED") {
    return { ok: false, status: rep.fiscalStatus, cancellationStatus: rep.cancellationStatus ?? "none", message: "El REP no tiene solicitud en Facturapi." };
  }
  const cred = await resolveFacturapiSecretForEnv(rep.companyId, rep.fiscalEnv);
  if (!cred) {
    return { ok: false, status: rep.fiscalStatus, cancellationStatus: rep.cancellationStatus ?? "none", message: "No hay llave de Facturapi configurada." };
  }
  const res = await facturapiFetch(cred.secret, `/invoices/${encodeURIComponent(rep.fiscalExternalId)}`, undefined, fetchFn);
  if (!res.ok) {
    return { ok: false, status: rep.fiscalStatus, cancellationStatus: rep.cancellationStatus ?? "none", message: res.body.message || "Facturapi no devolvió el estado del REP." };
  }
  const cancelStatus = res.body.cancellation_status ?? (res.body.status === "canceled" ? "accepted" : "none");
  if (res.body.status === "canceled" || cancelStatus === "accepted") {
    await finalizeRepCancellation(rep.id, { fetchFn, actorUserId: options?.actorUserId ?? null });
    return { ok: true, status: "CANCELADA", cancellationStatus: "accepted", message: "Cancelación del REP confirmada ante el SAT." };
  }
  if (cancelStatus === "rejected" || cancelStatus === "expired") {
    const errMsg =
      cancelStatus === "rejected"
        ? "El receptor rechazó la cancelación del REP."
        : "La cancelación del REP expiró sin respuesta.";
    await prisma.paymentComplement.update({
      where: { id: rep.id },
      data: { cancellationStatus: cancelStatus, fiscalError: errMsg },
    });
    return { ok: false, status: rep.fiscalStatus, cancellationStatus: cancelStatus, message: errMsg };
  }
  await prisma.paymentComplement.update({
    where: { id: rep.id },
    data: { cancellationStatus: cancelStatus },
  });
  return { ok: true, status: rep.fiscalStatus, cancellationStatus: cancelStatus, message: `Cancelación del REP en proceso (${cancelStatus}).` };
}
