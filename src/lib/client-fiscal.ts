import { resolveClientSatLegalName } from "./sat-legal-name";

export type ClientFiscalInput = {
  name: string;
  satLegalName?: string | null;
  rfc?: string | null;
  taxRegime?: string | null;
  cfdiUse?: string | null;
  paymentMethod?: string | null;
  fiscalZip?: string | null;
  fiscalEmail?: string | null;
};

/** Campos mínimos para solicitar factura (alineado con timbrado Facturapi Fase 1). */
export function clientFiscalMissingLabels(client: ClientFiscalInput): string[] {
  const missing: string[] = [];
  if (!client.rfc?.trim()) missing.push("RFC");
  const legal = resolveClientSatLegalName({ name: client.name, satLegalName: client.satLegalName });
  if (!legal?.trim()) missing.push("razón social fiscal");
  if (!client.taxRegime?.trim()) missing.push("régimen fiscal");
  if (!client.fiscalZip?.trim()) missing.push("código postal fiscal");
  if (!client.cfdiUse?.trim()) missing.push("uso de CFDI");
  if (!client.paymentMethod?.trim()) missing.push("método de pago");
  if (!client.fiscalEmail?.trim()) missing.push("correo fiscal");
  return missing;
}

export function clientFiscalReady(client: ClientFiscalInput): boolean {
  return clientFiscalMissingLabels(client).length === 0;
}

export const CLIENT_FISCAL_INVOICE_BLOCK_MESSAGE =
  "El cliente no tiene datos fiscales completos para solicitar factura. Captúralos en la ficha del cliente o solicita remisión en su lugar.";

export function assertClientFiscalReadyForInvoice(client: ClientFiscalInput) {
  if (!clientFiscalReady(client)) {
    throw new Error(CLIENT_FISCAL_INVOICE_BLOCK_MESSAGE);
  }
}