/**
 * Temas por empresa para todo el ERP (shell + documentos `.sygos-document`).
 *
 * SYSTRON — rojo industrial #A61E24, oro #C9A227, soft #FCEAEA.
 * SERVOMOTORES — azul acero #1B4965, soft #E3EDF5, secundario pizarra #64748B.
 */
export const COMPANY_THEME_CODES = ["SYSTRON", "SERVOMOTORES"] as const;
export type CompanyThemeCode = (typeof COMPANY_THEME_CODES)[number];

export const COMPANY_THEME_SYSTRON = {
  accent: "#A61E24",
  accentSoft: "#FCEAEA",
  accentSecondary: "#C9A227",
} as const;

export const COMPANY_THEME_SERVOMOTORES = {
  accent: "#1B4965",
  accentSoft: "#E3EDF5",
  accentSecondary: "#64748B",
} as const;

export function companyThemeDataAttribute(code: string | null | undefined): CompanyThemeCode {
  return code === "SERVOMOTORES" ? "SERVOMOTORES" : "SYSTRON";
}