import { isMultiCompanyRole, type Role } from "./roles";

export type Action =
  | "client.create"
  | "client.edit"
  | "client.reassign"
  | "client.inactivate"
  | "prospect.operate"
  | "supplier.operate"
  | "user.manage"
  | "user.manageAdmins"
  | "config.company"
  | "config.integrations"
  | "search.global"
  | "nav.business"
  | "equi.view"
  | "equi.create"
  | "mot.view"
  | "mot.create"
  | "attention.create"
  | "custody.confirm"
  | "inventory.operate";

export function can(role: Role, action: Action, companyCode?: string | null): boolean {
  const admin = role === "ADMINISTRADOR";
  const ceo = role === "CEO";
  const coord = role === "COORDINACION_ADMINISTRACION";
  const sales = role === "VENTAS";
  const gerenteSy = role === "GERENTE_OPERATIVO_SYSTRON";
  const gerenteSm = role === "GERENTE_OPERATIVO_SERVOMOTORES";

  switch (action) {
    case "nav.business":
      return role !== "AYUDANTE_GENERAL" && role !== "KIOSCO_ASISTENCIA";
    case "search.global":
      return admin || ceo;
    case "user.manage":
      return admin || ceo;
    case "user.manageAdmins":
      return admin;
    case "config.company":
      return admin || ceo;
    case "config.integrations":
      return admin;
    case "client.reassign":
      return admin || ceo;
    case "client.inactivate":
      return admin || ceo || coord;
    case "client.edit":
      return admin || ceo || coord || sales || gerenteSm;
    case "client.create":
      if (admin || ceo || coord) return true;
      if (companyCode === "SYSTRON") return sales;
      if (companyCode === "SERVOMOTORES") return gerenteSm;
      return false;
    case "prospect.operate":
      if (admin || ceo || coord) return true;
      if (companyCode === "SYSTRON") return sales;
      if (companyCode === "SERVOMOTORES") return gerenteSm;
      return false;
    case "supplier.operate":
      return admin || ceo || coord || gerenteSy || gerenteSm;
    case "equi.view":
      return companyCode === "SYSTRON" && role !== "AYUDANTE_GENERAL" && role !== "KIOSCO_ASISTENCIA";
    case "equi.create":
      return companyCode === "SYSTRON" && (admin || ceo || coord || sales || gerenteSy);
    case "mot.view":
      if (role === "ALMACEN" || role === "AYUDANTE_GENERAL" || role === "KIOSCO_ASISTENCIA") return false;
      if (companyCode === "SERVOMOTORES") return admin || ceo || coord || gerenteSm;
      return companyCode === "SYSTRON" && (admin || ceo || coord || sales || gerenteSy || role === "SUPERVISOR_TECNICO" || role === "TECNICO");
    case "mot.create":
      if (companyCode === "SYSTRON") return admin || ceo || coord || sales;
      if (companyCode === "SERVOMOTORES") return admin || ceo || coord || gerenteSm;
      return false;
    case "attention.create":
      return can(role, "equi.create", companyCode) || can(role, "mot.create", companyCode);
    case "custody.confirm":
      if (companyCode === "SYSTRON") return admin || ceo || coord || gerenteSy || role === "ALMACEN";
      if (companyCode === "SERVOMOTORES") return admin || ceo || coord || gerenteSm;
      return false;
    case "inventory.operate":
      if (companyCode === "SYSTRON") return admin || ceo || gerenteSy || role === "ALMACEN";
      if (companyCode === "SERVOMOTORES") return admin || ceo || gerenteSm;
      return false;
    default:
      return false;
  }
}

export function canSeeUser(viewer: Role, target: Role): boolean {
  if (target === "ADMINISTRADOR" && viewer !== "ADMINISTRADOR") return false;
  return true;
}

export function needsExplicitCompany(role: Role): boolean {
  return isMultiCompanyRole(role);
}
