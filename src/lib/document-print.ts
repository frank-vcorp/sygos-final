/** Une fragmentos no vacíos con « · » para bloques compactos en impresión. */
export function compactDotLine(parts: Array<string | null | undefined | false>): string | null {
  const filtered = parts
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean);
  return filtered.length > 0 ? filtered.join(" · ") : null;
}

export type DocumentCompanyFields = {
  code: string;
  name: string;
  legalName?: string | null;
  rfc?: string | null;
  taxRegime?: string | null;
  fiscalAddress?: string | null;
  postalCode?: string | null;
  phone?: string | null;
  email?: string | null;
};

export function companyDisplayName(company: DocumentCompanyFields): string {
  return (company.legalName || company.name).trim();
}

export function issuerCompactLines(company: DocumentCompanyFields): string[] {
  const lines: string[] = [];
  const rfcRegime = compactDotLine([
    company.rfc ? `RFC ${company.rfc}` : null,
    company.taxRegime ? `Régimen ${company.taxRegime}` : null,
  ]);
  if (rfcRegime) lines.push(rfcRegime);
  const address = compactDotLine([company.fiscalAddress, company.postalCode ? `C.P. ${company.postalCode}` : null]);
  if (address) lines.push(address);
  const contact = compactDotLine([company.phone, company.email]);
  if (contact) lines.push(contact);
  return lines;
}

export type DocumentClientCommercialFields = {
  name: string;
  rfc?: string | null;
  taxRegime?: string | null;
  fiscalAddress?: string | null;
  fiscalZip?: string | null;
};

export type DocumentContactFields = {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
};

export function clientCommercialCompactLines(
  client: DocumentClientCommercialFields,
  contact?: DocumentContactFields | null,
): string[] {
  const lines: string[] = [];
  const rfcRegime = compactDotLine([
    client.rfc ? `RFC ${client.rfc}` : null,
    client.taxRegime ? `Régimen ${client.taxRegime}` : null,
  ]);
  if (rfcRegime) lines.push(rfcRegime);
  const address = compactDotLine([client.fiscalAddress, client.fiscalZip ? `C.P. ${client.fiscalZip}` : null]);
  if (address) lines.push(address);
  const contactLine = compactDotLine([contact?.name, contact?.phone, contact?.email]);
  if (contactLine) lines.push(contactLine);
  return lines;
}

export type DocumentClientFiscalFields = DocumentClientCommercialFields & {
  satLegalName: string;
  cfdiUse?: string | null;
  paymentMethod?: string | null;
  paymentForm?: string | null;
};

export function clientFiscalCompactLines(
  client: DocumentClientFiscalFields,
  contact?: DocumentContactFields | null,
): string[] {
  const lines: string[] = [];
  const rfcRegime = compactDotLine([
    client.rfc ? `RFC ${client.rfc}` : null,
    client.taxRegime ? `Régimen ${client.taxRegime}` : null,
  ]);
  if (rfcRegime) lines.push(rfcRegime);
  const address = compactDotLine([client.fiscalAddress, client.fiscalZip ? `C.P. ${client.fiscalZip}` : null]);
  if (address) lines.push(address);
  const satPay = compactDotLine([
    client.cfdiUse ? `Uso CFDI ${client.cfdiUse}` : null,
    client.paymentMethod ?? null,
    client.paymentForm ?? null,
  ]);
  if (satPay) lines.push(satPay);
  const contactLine = compactDotLine([contact?.name, contact?.phone, contact?.email]);
  if (contactLine) lines.push(contactLine);
  return lines;
}

export function primaryContact<T extends { isPrimary?: boolean; active?: boolean }>(contacts: T[]): T | null {
  const active = contacts.filter((c) => c.active !== false);
  return active.find((c) => c.isPrimary) ?? active[0] ?? null;
}