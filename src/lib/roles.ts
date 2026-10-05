export const ROLES = [
  "ADMINISTRADOR",
  "CEO",
  "COORDINACION_ADMINISTRACION",
  "GERENTE_OPERATIVO_SYSTRON",
  "GERENTE_OPERATIVO_SERVOMOTORES",
  "SUPERVISOR_TECNICO",
  "TECNICO",
  "VENTAS",
  "ALMACEN",
  "AYUDANTE_GENERAL",
  "KIOSCO_ASISTENCIA",
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  ADMINISTRADOR: "Administrador",
  CEO: "CEO",
  COORDINACION_ADMINISTRACION: "Coordinación de Administración",
  GERENTE_OPERATIVO_SYSTRON: "Gerente Operativo",
  GERENTE_OPERATIVO_SERVOMOTORES: "Gerente Operativo",
  SUPERVISOR_TECNICO: "Supervisor Técnico",
  TECNICO: "Técnico",
  VENTAS: "Ventas",
  ALMACEN: "Almacén",
  AYUDANTE_GENERAL: "Ayudante General",
  KIOSCO_ASISTENCIA: "Kiosco de Asistencia",
};

export const MULTI_COMPANY_ROLES: Role[] = [
  "ADMINISTRADOR",
  "CEO",
  "COORDINACION_ADMINISTRACION",
];

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export function isMultiCompanyRole(role: Role): boolean {
  return MULTI_COMPANY_ROLES.includes(role);
}

export function companiesForRole(role: Role): "both" | Array<"SYSTRON" | "SERVOMOTORES"> {
  if (isMultiCompanyRole(role)) return "both";
  if (role === "GERENTE_OPERATIVO_SERVOMOTORES" || role === "AYUDANTE_GENERAL") {
    return ["SERVOMOTORES"];
  }
  if (role === "KIOSCO_ASISTENCIA") return ["SYSTRON", "SERVOMOTORES"];
  return ["SYSTRON"];
}

export function roleFitsCompany(role: Role, companyCode: string | null): boolean {
  const allowed = companiesForRole(role);
  if (allowed === "both") return companyCode === null;
  if (!companyCode) return false;
  return allowed.includes(companyCode as "SYSTRON" | "SERVOMOTORES");
}

export const DEFAULT_MONTHLY_PURCHASE = 5000;
export const DEFAULT_PURCHASE_LIMIT = 2000;

export function isPurchaseManager(role: Role): boolean {
  return role === "GERENTE_OPERATIVO_SYSTRON" || role === "GERENTE_OPERATIVO_SERVOMOTORES";
}
