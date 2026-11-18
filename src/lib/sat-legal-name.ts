const CORPORATE_REGIME_SUFFIXES = [
  "S\\.?\\s*A\\.?\\s*P\\.?\\s*I\\.?\\s*B\\.?\\s*DE\\s*C\\.?\\s*V\\.?",
  "S\\.?\\s*A\\.?\\s*P\\.?\\s*I\\.?\\s*DE\\s*C\\.?\\s*V\\.?",
  "S\\.?\\s*A\\.?\\s*B\\.?\\s*DE\\s*C\\.?\\s*V\\.?",
  "S\\.?\\s*A\\.?\\s*S\\.?\\s*DE\\s*C\\.?\\s*V\\.?",
  "S\\.?\\s*A\\.?\\s*DE\\s*C\\.?\\s*V\\.?",
  "S\\.?\\s*DE\\s*R\\.?\\s*L\\.?\\s*DE\\s*C\\.?\\s*V\\.?",
  "S\\.?\\s*DE\\s*R\\.?\\s*L\\.?\\s*MI\\.?",
  "S\\.?\\s*DE\\s*R\\.?\\s*L\\.?",
  "S\\.?\\s*EN\\s*N\\.?\\s*C\\.?",
  "S\\.?\\s*EN\\s*C\\.?\\s*POR\\s*A\\.?",
  "S\\.?\\s*EN\\s*C\\.?",
  "S\\.?\\s*N\\.?\\s*C\\.?",
  "S\\.?\\s*C\\.?\\s*L\\.?",
  "S\\.?\\s*A\\.?\\s*S\\.?",
  "S\\.?\\s*A\\.?",
  "S\\.?\\s*C\\.?",
  "A\\.?\\s*C\\.?",
];

const TRAILING_REGIME_PATTERN = new RegExp(
  `(?:\\s*,\\s*|\\s+)(?:${CORPORATE_REGIME_SUFFIXES.join("|")})\\s*\\.?\\s*$`,
  "i",
);

/**
 * Quita el régimen societario al final de una razón social para cumplir con CFDI 4.0
 * (ej. "Aceros del Norte, S.A. de C.V." -> "Aceros del Norte").
 */
export function stripCorporateRegimeSuffix(raw: string | null | undefined): string {
  let text = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  for (let i = 0; i < 3; i++) {
    const next = text.replace(TRAILING_REGIME_PATTERN, "").replace(/[\s,]+$/, "").trim();
    if (next === text) break;
    text = next;
  }
  return text;
}

export function normalizeSatLegalName(raw: string | null | undefined): string | null {
  const cleaned = stripCorporateRegimeSuffix(raw);
  return cleaned || null;
}

export function resolveClientSatLegalName(client: {
  name: string;
  satLegalName?: string | null;
}): string {
  const explicit = stripCorporateRegimeSuffix(client.satLegalName);
  if (explicit) return explicit;
  return stripCorporateRegimeSuffix(client.name) || client.name.trim();
}
