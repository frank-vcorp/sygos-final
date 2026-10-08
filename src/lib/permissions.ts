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
  | "attention.catalog"
  | "equipment.catalog"
  | "operation.queue"
  | "custody.confirm"
  | "inventory.operate"
  | "quote.create"
  | "quote.price"
  | "quote.follow"
  | "sale.receive"
  | "agenda.use"
  | "goals.manage"
  | "invoice.request"
  | "invoice.issue"
  | "payment.register"
  | "payment.validate"
  | "receivable.view"
  | "purchase.operate"
  | "purchase.authorize"
  | "finance.view"
  | "finance.manage"
  | "personnel.manage"
  | "personnel.authorize"
  | "overtime.capture"
  | "kiosk.punch"
  | "panel.view"
  | "production.view"
  | "report.view"

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
      return (
        companyCode === "SYSTRON"
        && role !== "AYUDANTE_GENERAL"
        && role !== "KIOSCO_ASISTENCIA"
        && role !== "ALMACEN"
      );
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
    case "attention.catalog":
      if (admin || ceo) return true;
      if (companyCode === "SYSTRON") return sales || gerenteSy || role === "SUPERVISOR_TECNICO" || role === "TECNICO";
      if (companyCode === "SERVOMOTORES") return gerenteSm;
      return false;
    case "equipment.catalog":
      if (
        role === "TECNICO"
        || role === "ALMACEN"
        || role === "COORDINACION_ADMINISTRACION"
        || role === "AYUDANTE_GENERAL"
        || role === "KIOSCO_ASISTENCIA"
      ) {
        return false;
      }
      return can(role, "equi.view", companyCode) || can(role, "mot.view", companyCode);
    case "operation.queue":
      if (role === "ALMACEN" || role === "COORDINACION_ADMINISTRACION" || role === "AYUDANTE_GENERAL" || role === "KIOSCO_ASISTENCIA") {
        return false;
      }
      if (admin || ceo || gerenteSy || gerenteSm || role === "SUPERVISOR_TECNICO" || role === "TECNICO" || sales) return true;
      return can(role, "equi.view", companyCode) || can(role, "mot.view", companyCode);
    case "custody.confirm":
      if (companyCode === "SYSTRON") return admin || ceo || gerenteSy || role === "ALMACEN";
      if (companyCode === "SERVOMOTORES") return admin || ceo || gerenteSm;
      return false;
    case "inventory.operate":
      if (companyCode === "SYSTRON") return admin || ceo || gerenteSy || role === "ALMACEN";
      if (companyCode === "SERVOMOTORES") return admin || ceo || gerenteSm;
      return false;
    case "quote.create":
      if (admin || ceo || coord) return true;
      if (companyCode === "SYSTRON") return sales;
      if (companyCode === "SERVOMOTORES") return gerenteSm;
      return false;
    case "quote.price":
      if (admin || ceo) return true;
      return companyCode === "SERVOMOTORES" && gerenteSm;
    case "quote.follow":
      if (admin || ceo || coord) return true;
      if (companyCode === "SYSTRON") return sales;
      if (companyCode === "SERVOMOTORES") return gerenteSm;
      return false;
    case "sale.receive":
      return companyCode === "SYSTRON" && (admin || ceo || gerenteSy || role === "ALMACEN");
    case "agenda.use":
      return admin || ceo || sales || gerenteSm;
    case "goals.manage":
      return (admin || ceo) && companyCode === "SYSTRON";
    case "invoice.request":
      if (admin || ceo || coord) return true;
      if (companyCode === "SYSTRON") return sales;
      return companyCode === "SERVOMOTORES" && gerenteSm;
    case "invoice.issue":
      return admin || ceo || coord;
    case "payment.register":
      return admin || ceo || coord || sales || gerenteSm;
    case "payment.validate":
      return admin || ceo || coord;
    case "receivable.view":
      return admin || ceo || coord || sales || gerenteSm;
    case "purchase.operate":
      if (admin || ceo || coord) return true;
      if (companyCode === "SYSTRON") return gerenteSy;
      return companyCode === "SERVOMOTORES" && gerenteSm;
    case "purchase.authorize":
      return admin || ceo;
    case "finance.view":
    case "finance.manage":
      return admin || ceo || coord;
    case "personnel.manage":
      return admin || ceo || coord;
    case "personnel.authorize":
      return admin || ceo;
    case "overtime.capture":
      if (role === "AYUDANTE_GENERAL" || role === "KIOSCO_ASISTENCIA" || role === "COORDINACION_ADMINISTRACION") return false;
      return admin || ceo || gerenteSy || gerenteSm || role === "SUPERVISOR_TECNICO" || role === "TECNICO" || role === "VENTAS" || role === "ALMACEN";
    case "kiosk.punch":
      return role === "KIOSCO_ASISTENCIA" || admin;
    case "panel.view":
      return admin || ceo || coord || sales || gerenteSy || gerenteSm || role === "SUPERVISOR_TECNICO" || role === "TECNICO";
    case "production.view":
      return admin || ceo || gerenteSm;
    case "report.view":
      return admin || ceo || coord || gerenteSy || gerenteSm || role === "SUPERVISOR_TECNICO" || role === "ALMACEN";
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
