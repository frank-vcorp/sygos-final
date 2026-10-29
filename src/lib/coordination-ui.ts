import type { Role } from "@/lib/roles";

/** Coordinación de Administración usa el menú lateral; no repetir sub-navegación en página. */
export function coordUsesSidebarNav(role: Role): boolean {
  return role === "COORDINACION_ADMINISTRACION";
}

export function coordCompanyLabel(companyCode: string | null): string {
  return companyCode === "SERVOMOTORES" ? "Servomotores" : "SYSTRON";
}

/** Título de pantalla: en Coordinación, el ítem activo del menú lateral. */
export function coordPageTitle(sidebarNav: boolean, sectionTitle: string | undefined, defaultTitle: string): string {
  if (sidebarNav && sectionTitle) return sectionTitle;
  return defaultTitle;
}

/** Subtítulo breve al estilo Ventas: empresa · hint operativo. */
export function coordPageSubtitle(
  sidebarNav: boolean,
  companyCode: string | null,
  defaultSubtitle: string,
  sectionHint?: string,
): string {
  if (!sidebarNav) return defaultSubtitle;
  const company = coordCompanyLabel(companyCode);
  return sectionHint ? `${company} · ${sectionHint}` : company;
}

/** Sin chips de vista duplicados cuando la vista viene del menú lateral. */
export function coordFilterChips<T extends { label: string; clearHref: string }>(sidebarNav: boolean, chips: T[]): T[] {
  return sidebarNav ? [] : chips;
}

export function coordFormWidthClass(sidebarNav: boolean): string {
  return sidebarNav ? "max-w-none" : "";
}
