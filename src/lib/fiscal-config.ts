import { decryptSecret } from "./crypto";
import { inSandbox, prisma, prismaProd } from "./db";
import { normalizeSatLegalName } from "./sat-legal-name";

export type FacturapiRunMode = "OFF" | "TEST" | "LIVE";
export type FiscalSeriesPolicy = "SYGOS_FAC" | "FACTURAPI_AUTO";
export type FiscalLineMode = "LINE_BY_LINE" | "CONSOLIDATED";
export type CancelWithPaymentsPolicy = "BLOCK_UNTIL_REP_CANCELED" | "ALLOW_GUIDED_SUBSTITUTION";

export type FiscalOperationKind =
  | "EQUIPO_ELECTRONICO"
  | "SERVOMOTORES"
  | "SERVICIO_CAMPO"
  | "VENTA_EQUIPO"
  | "FACTURA_LIBRE";

export type SatLineDefaults = {
  productKey: string;
  unitKey: string;
  unitName: string;
  taxability: string;
};

export type FiscalAutomationToggles = {
  autoEmailOnStamp: boolean;
  autoWhatsAppOnStamp: boolean;
  autoRepOnPaymentValidation: boolean;
  cancelWithPaymentsPolicy: CancelWithPaymentsPolicy;
};

export type CompanyFiscalConfig = {
  facturapiMode: FacturapiRunMode;
  fiscalSeriesPolicy: FiscalSeriesPolicy;
  fiscalDefaultSeries: string;
  fiscalLineMode: FiscalLineMode;
  satDefaults: Record<FiscalOperationKind, SatLineDefaults>;
  toggles: FiscalAutomationToggles;
};

export type FacturapiEnvExtra = {
  organizationId?: string | null;
  organizationName?: string | null;
  taxId?: string | null;
  webhookId?: string | null;
  webhookSecretEnc?: string | null;
  webhookSecretHint?: string | null;
  isProductionReady?: boolean | null;
  hasCertificate?: boolean | null;
  certificateSerial?: string | null;
  certificateExpiresAt?: string | null;
  pendingSteps?: string[];
  verifiedAt?: string | null;
  registroPatronal?: string | null;
  employerCurp?: string | null;
  employerState?: string | null;
};

export const FISCAL_OPERATION_KINDS: Array<{
  key: FiscalOperationKind;
  label: string;
  hint: string;
}> = [
  {
    key: "EQUIPO_ELECTRONICO",
    label: "Diagnóstico / Reparación de equipo electrónico",
    hint: "Servicios DX, OS, COT y DX sin reparación para equipos electrónicos (SYSTRON).",
  },
  {
    key: "SERVOMOTORES",
    label: "Reparación de servomotores / Intercompañía",
    hint: "Servicios MOT en Servomotores y facturas intercompañía Servomotores → SYSTRON.",
  },
  {
    key: "SERVICIO_CAMPO",
    label: "Servicio en campo (SCA)",
    hint: "Cotizaciones de campo COTSC / órdenes SCA.",
  },
  {
    key: "VENTA_EQUIPO",
    label: "Venta de equipo (VENTA_EQUIPO)",
    hint: "Venta comercial de equipos o piezas.",
  },
  {
    key: "FACTURA_LIBRE",
    label: "Factura libre",
    hint: "Facturas emitidas directamente desde Facturación → Nueva factura libre.",
  },
];

export const SAT_TAXABILITY_OPTIONS = [
  { id: "02", label: "02 — Sí objeto de impuesto" },
  { id: "01", label: "01 — No objeto de impuesto" },
  { id: "03", label: "03 — Sí objeto y no obligado al desglose" },
  { id: "04", label: "04 — Sí objeto y no causa impuesto" },
] as const;

export const SAT_UNIT_OPTIONS = [
  { id: "E48", name: "Servicio", label: "E48 — Unidad de servicio" },
  { id: "H87", name: "Pieza", label: "H87 — Pieza" },
  { id: "ACT", name: "Actividad", label: "ACT — Actividad" },
  { id: "HUR", name: "Hora", label: "HUR — Hora" },
] as const;

export function defaultSatDefaultsForCompany(companyCode?: string | null): Record<FiscalOperationKind, SatLineDefaults> {
  const isSm = companyCode === "SERVOMOTORES";
  return {
    EQUIPO_ELECTRONICO: {
      productKey: "72154000",
      unitKey: "E48",
      unitName: "Servicio",
      taxability: "02",
    },
    SERVOMOTORES: {
      productKey: "73152100",
      unitKey: "E48",
      unitName: "Servicio",
      taxability: "02",
    },
    SERVICIO_CAMPO: {
      productKey: "72154000",
      unitKey: "E48",
      unitName: "Servicio",
      taxability: "02",
    },
    VENTA_EQUIPO: {
      productKey: "32151700",
      unitKey: "H87",
      unitName: "Pieza",
      taxability: "02",
    },
    FACTURA_LIBRE: {
      productKey: isSm ? "73152100" : "72154000",
      unitKey: "E48",
      unitName: "Servicio",
      taxability: "02",
    },
  };
}

export const DEFAULT_FISCAL_TOGGLES: FiscalAutomationToggles = {
  autoEmailOnStamp: false,
  autoWhatsAppOnStamp: false,
  autoRepOnPaymentValidation: false,
  cancelWithPaymentsPolicy: "BLOCK_UNTIL_REP_CANCELED",
};

function cleanMode(raw: string | null | undefined): FacturapiRunMode {
  if (raw === "TEST" || raw === "LIVE" || raw === "OFF") return raw;
  return "OFF";
}

function cleanSeriesPolicy(raw: string | null | undefined): FiscalSeriesPolicy {
  return raw === "FACTURAPI_AUTO" ? "FACTURAPI_AUTO" : "SYGOS_FAC";
}

function cleanLineMode(raw: string | null | undefined): FiscalLineMode {
  return raw === "CONSOLIDATED" ? "CONSOLIDATED" : "LINE_BY_LINE";
}

function cleanSatEntry(
  raw: Partial<SatLineDefaults> | undefined,
  fallback: SatLineDefaults,
): SatLineDefaults {
  const productKey = raw?.productKey?.replace(/\D/g, "").slice(0, 8) || fallback.productKey;
  const unitKey = raw?.unitKey?.trim().toUpperCase().slice(0, 6) || fallback.unitKey;
  const unitName = raw?.unitName?.trim() || fallback.unitName;
  const taxability = raw?.taxability && /^0[1-8]$/.test(raw.taxability.trim())
    ? raw.taxability.trim()
    : fallback.taxability;
  return {
    productKey: productKey.length === 8 ? productKey : fallback.productKey,
    unitKey,
    unitName,
    taxability,
  };
}

export function parseCompanyFiscalConfig(company: {
  code?: string | null;
  facturapiMode?: string | null;
  fiscalSeriesPolicy?: string | null;
  fiscalDefaultSeries?: string | null;
  fiscalLineMode?: string | null;
  fiscalConfigJson?: string | null;
}): CompanyFiscalConfig {
  const baseSat = defaultSatDefaultsForCompany(company.code);
  let parsedJson: {
    satDefaults?: Partial<Record<FiscalOperationKind, Partial<SatLineDefaults>>>;
    toggles?: Partial<FiscalAutomationToggles>;
  } = {};
  if (company.fiscalConfigJson) {
    try {
      parsedJson = JSON.parse(company.fiscalConfigJson) as typeof parsedJson;
    } catch {
      parsedJson = {};
    }
  }
  const satDefaults: Record<FiscalOperationKind, SatLineDefaults> = {
    EQUIPO_ELECTRONICO: cleanSatEntry(parsedJson.satDefaults?.EQUIPO_ELECTRONICO, baseSat.EQUIPO_ELECTRONICO),
    SERVOMOTORES: cleanSatEntry(parsedJson.satDefaults?.SERVOMOTORES, baseSat.SERVOMOTORES),
    SERVICIO_CAMPO: cleanSatEntry(parsedJson.satDefaults?.SERVICIO_CAMPO, baseSat.SERVICIO_CAMPO),
    VENTA_EQUIPO: cleanSatEntry(parsedJson.satDefaults?.VENTA_EQUIPO, baseSat.VENTA_EQUIPO),
    FACTURA_LIBRE: cleanSatEntry(parsedJson.satDefaults?.FACTURA_LIBRE, baseSat.FACTURA_LIBRE),
  };
  const toggles: FiscalAutomationToggles = {
    autoEmailOnStamp: Boolean(parsedJson.toggles?.autoEmailOnStamp),
    autoWhatsAppOnStamp: Boolean(parsedJson.toggles?.autoWhatsAppOnStamp),
    autoRepOnPaymentValidation: Boolean(parsedJson.toggles?.autoRepOnPaymentValidation),
    cancelWithPaymentsPolicy:
      parsedJson.toggles?.cancelWithPaymentsPolicy === "ALLOW_GUIDED_SUBSTITUTION"
        ? "ALLOW_GUIDED_SUBSTITUTION"
        : "BLOCK_UNTIL_REP_CANCELED",
  };

  return {
    facturapiMode: cleanMode(company.facturapiMode),
    fiscalSeriesPolicy: cleanSeriesPolicy(company.fiscalSeriesPolicy),
    fiscalDefaultSeries: company.fiscalDefaultSeries?.trim().slice(0, 25) || "FAC",
    fiscalLineMode: cleanLineMode(company.fiscalLineMode),
    satDefaults,
    toggles,
  };
}

export function serializeFiscalConfigJson(input: {
  satDefaults: Record<FiscalOperationKind, SatLineDefaults>;
  toggles: FiscalAutomationToggles;
}): string {
  return JSON.stringify({
    satDefaults: input.satDefaults,
    toggles: input.toggles,
  });
}

export function parseFacturapiExtra(raw: string | null | undefined): FacturapiEnvExtra {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as FacturapiEnvExtra;
  } catch {
    return {};
  }
}

export function resolveOperationKindForDocument(input: {
  companyCode?: string | null;
  documentKind: string;
  quoteType?: string | null;
  equipmentKind?: string | null;
  hasFieldServiceCase?: boolean;
}): FiscalOperationKind {
  if (input.documentKind === "FACTURA_INTERCOMPANIA") return "SERVOMOTORES";
  if (input.documentKind === "FACTURA_LIBRE") return "FACTURA_LIBRE";
  if (input.hasFieldServiceCase || input.quoteType === "CAMPO") return "SERVICIO_CAMPO";
  if (input.quoteType === "VENTA_EQUIPO") return "VENTA_EQUIPO";
  if (input.companyCode === "SERVOMOTORES" || input.equipmentKind === "MOT") return "SERVOMOTORES";
  return "EQUIPO_ELECTRONICO";
}

export function resolveSatDefaultsForDocument(
  config: CompanyFiscalConfig,
  input: Parameters<typeof resolveOperationKindForDocument>[0],
): SatLineDefaults {
  const kind = resolveOperationKindForDocument(input);
  return config.satDefaults[kind];
}

export type CredentialResolutionInput = {
  sandboxActive: boolean;
  configuredMode: FacturapiRunMode;
  testSecret: string | null;
  liveSecret: string | null;
  legacySecret: string | null;
  liveIsProductionReady?: boolean | null;
};

export type CredentialResolutionResult =
  | {
      status: "SIMULATED";
      env: "SIMULATED";
      secret: null;
      message: string;
    }
  | {
      status: "READY";
      env: "TEST" | "LIVE";
      secret: string;
      fromLegacy: boolean;
    }
  | {
      status: "UNAVAILABLE";
      env: "TEST" | "LIVE" | null;
      secret: null;
      message: string;
    };

export function keyEnvironment(secret: string | null | undefined): "test" | "live" | null {
  if (!secret) return null;
  if (secret.startsWith("sk_test_")) return "test";
  if (secret.startsWith("sk_live_")) return "live";
  return null;
}

/**
 * Resolución pura de credenciales Facturapi:
 * - Si inSandbox() está activo: NUNCA devuelve sk_live_*; siempre devuelve SIMULATED.
 * - Si configuredMode === "OFF" pero existe llave legacy FACTURAPI sin llaves nuevas, infiere TEST/LIVE.
 * - Valida que la llave corresponda exactamente al ambiente elegido (sk_test_ para TEST, sk_live_ para LIVE).
 */
export function resolveCredentialFromInputs(input: CredentialResolutionInput): CredentialResolutionResult {
  if (input.sandboxActive) {
    return {
      status: "SIMULATED",
      env: "SIMULATED",
      secret: null,
      message: "PRUEBA / SIN VALIDEZ. No se contactó a Facturapi.",
    };
  }

  let effectiveMode: FacturapiRunMode = input.configuredMode;
  const legacyKind = keyEnvironment(input.legacySecret);
  if (effectiveMode === "OFF" && !input.testSecret && !input.liveSecret && legacyKind) {
    effectiveMode = legacyKind === "live" ? "LIVE" : "TEST";
  }

  if (effectiveMode === "OFF") {
    return {
      status: "UNAVAILABLE",
      env: null,
      secret: null,
      message: "Facturapi está desactivado para esta empresa. Activa modo Test o Live en Integraciones.",
    };
  }

  if (effectiveMode === "TEST") {
    const candidate = input.testSecret || (legacyKind === "test" ? input.legacySecret : null);
    if (!candidate) {
      return {
        status: "UNAVAILABLE",
        env: "TEST",
        secret: null,
        message: "Falta la llave Test (sk_test_) de Facturapi para esta empresa. El reintento usa este mismo documento.",
      };
    }
    if (keyEnvironment(candidate) !== "test") {
      return {
        status: "UNAVAILABLE",
        env: "TEST",
        secret: null,
        message: "La llave configurada para ambiente Test no inicia con sk_test_.",
      };
    }
    return {
      status: "READY",
      env: "TEST",
      secret: candidate,
      fromLegacy: !input.testSecret && Boolean(input.legacySecret),
    };
  }

  // LIVE
  const candidate = input.liveSecret || (legacyKind === "live" ? input.legacySecret : null);
  if (!candidate) {
    return {
      status: "UNAVAILABLE",
      env: "LIVE",
      secret: null,
      message: "Falta la llave Live (sk_live_) de Facturapi para emitir CFDI ante el SAT.",
    };
  }
  if (keyEnvironment(candidate) !== "live") {
    return {
      status: "UNAVAILABLE",
      env: "LIVE",
      secret: null,
      message: "La llave configurada para ambiente Live no inicia con sk_live_.",
    };
  }
  if (input.liveIsProductionReady === false) {
    return {
      status: "UNAVAILABLE",
      env: "LIVE",
      secret: null,
      message: "La organización en Facturapi no está lista para producción (falta CSD, datos fiscales o Carta Manifiesto).",
    };
  }
  return {
    status: "READY",
    env: "LIVE",
    secret: candidate,
    fromLegacy: !input.liveSecret && Boolean(input.legacySecret),
  };
}

function safeDecrypt(enc: string | null | undefined): string | null {
  if (!enc) return null;
  try {
    return decryptSecret(enc);
  } catch {
    return null;
  }
}

export async function loadFacturapiCompanySettings(companyId: string) {
  const [company, rows] = await Promise.all([
    prismaProd.company.findUnique({ where: { id: companyId } }),
    prismaProd.integrationSetting.findMany({
      where: {
        companyId,
        provider: { in: ["FACTURAPI_TEST", "FACTURAPI_LIVE", "FACTURAPI"] },
      },
    }),
  ]);
  const testRow = rows.find((r) => r.provider === "FACTURAPI_TEST") ?? null;
  const liveRow = rows.find((r) => r.provider === "FACTURAPI_LIVE") ?? null;
  const legacyRow = rows.find((r) => r.provider === "FACTURAPI") ?? null;

  const testSecret = safeDecrypt(testRow?.secretEnc);
  const liveSecret = safeDecrypt(liveRow?.secretEnc);
  const legacySecret = safeDecrypt(legacyRow?.secretEnc);
  const legacyKind = keyEnvironment(legacySecret);

  const testExtra = parseFacturapiExtra(testRow?.extra ?? (legacyKind === "test" ? legacyRow?.extra : null));
  const liveExtra = parseFacturapiExtra(liveRow?.extra ?? (legacyKind === "live" ? legacyRow?.extra : null));
  const config = parseCompanyFiscalConfig(company ?? {});
  if (config.facturapiMode === "OFF" && !testRow && !liveRow && legacyKind) {
    config.facturapiMode = legacyKind === "live" ? "LIVE" : "TEST";
  }

  return {
    company,
    config,
    test: {
      hasSecret: Boolean(testSecret || (legacyKind === "test" && legacySecret)),
      secretHint: testRow?.secretHint ?? (legacyKind === "test" ? legacyRow?.secretHint : null) ?? null,
      secret: testSecret ?? (legacyKind === "test" ? legacySecret : null),
      extra: testExtra,
    },
    live: {
      hasSecret: Boolean(liveSecret || (legacyKind === "live" && legacySecret)),
      secretHint: liveRow?.secretHint ?? (legacyKind === "live" ? legacyRow?.secretHint : null) ?? null,
      secret: liveSecret ?? (legacyKind === "live" ? legacySecret : null),
      extra: liveExtra,
    },
    legacy: {
      hasSecret: Boolean(legacySecret),
      secretHint: legacyRow?.secretHint ?? null,
      secret: legacySecret,
      extra: parseFacturapiExtra(legacyRow?.extra),
    },
  };
}

export async function resolveFacturapiRuntimeCredential(companyId: string): Promise<CredentialResolutionResult> {
  const sandboxActive = await inSandbox();
  if (sandboxActive) {
    return {
      status: "SIMULATED",
      env: "SIMULATED",
      secret: null,
      message: "PRUEBA / SIN VALIDEZ. No se contactó a Facturapi.",
    };
  }
  const loaded = await loadFacturapiCompanySettings(companyId);
  return resolveCredentialFromInputs({
    sandboxActive: false,
    configuredMode: loaded.config.facturapiMode,
    testSecret: loaded.test.secret,
    liveSecret: loaded.live.secret,
    legacySecret: loaded.legacy.secret,
    liveIsProductionReady: loaded.live.extra.isProductionReady ?? null,
  });
}

/**
 * Sincroniza los datos fiscales de SYSTRON / SERVOMOTORES hacia los registros
 * intercompañía fijos (client-intercompany-systron y supplier-intercompany-servomotores).
 */
export async function syncIntercompanyPartiesFromCompany(companyId: string) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) return;

  if (company.code === "SYSTRON") {
    const existing = await prisma.client.findUnique({ where: { id: "client-intercompany-systron" } });
    if (!existing) return;
    await prisma.client.update({
      where: { id: existing.id },
      data: {
        satLegalName: normalizeSatLegalName(company.legalName ?? company.name) ?? existing.satLegalName,
        rfc: company.rfc ?? existing.rfc,
        taxRegime: company.taxRegime ?? existing.taxRegime,
        fiscalZip: company.postalCode ?? existing.fiscalZip,
        fiscalAddress: company.fiscalAddress ?? existing.fiscalAddress,
        fiscalEmail: company.email ?? existing.fiscalEmail,
        cfdiUse: existing.cfdiUse || "G03",
        paymentMethod: existing.paymentMethod || "PPD",
        requiresInvoice: true,
      },
    });
  } else if (company.code === "SERVOMOTORES") {
    const existing = await prisma.supplier.findUnique({ where: { id: "supplier-intercompany-servomotores" } });
    if (!existing) return;
    await prisma.supplier.update({
      where: { id: existing.id },
      data: {
        rfc: company.rfc ?? existing.rfc,
        fiscalAddress: company.fiscalAddress ?? existing.fiscalAddress,
        email: company.email ?? existing.email,
        phone: company.phone ?? existing.phone,
        issuesInvoice: true,
      },
    });
  }
}
