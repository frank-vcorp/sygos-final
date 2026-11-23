/**
 * Temas por empresa para todo el ERP (shell + documentos `.sygos-document`).
 *
 * SYSTRON — rojo industrial #A61E24, oro #C9A227, soft #FCEAEA.
 * SERVOMOTORES — acento negro/carbón (Frank): #111827, soft #f3f4f6, secundario gris #6B7280.
 */
export const COMPANY_THEME_CODES = ["SYSTRON", "SERVOMOTORES"] as const;
export type CompanyThemeCode = (typeof COMPANY_THEME_CODES)[number];

export const COMPANY_THEME_SYSTRON = {
  accent: "#A61E24",
  accentSoft: "#FCEAEA",
  accentSecondary: "#C9A227",
} as const;

export const COMPANY_THEME_SERVOMOTORES = {
  accent: "#111827",
  accentSoft: "#f3f4f6",
  accentSecondary: "#6b7280",
} as const;

export function companyThemeDataAttribute(code: string | null | undefined): CompanyThemeCode {
  return code === "SERVOMOTORES" ? "SERVOMOTORES" : "SYSTRON";
}