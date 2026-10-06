import { prisma } from "./db";
import { linesForTotal, money, quoteTotals } from "./money";
import { productionCredit, type ProductionItem } from "./panels";
import type { Role } from "./roles";

export const REPORTS: Array<{ id: string; label: string; roles: Role[] | "all" }> = [
  { id: "cotizaciones", label: "Cotizaciones", roles: "all" },
  { id: "conversion", label: "Conversión comercial", roles: "all" },
  { id: "cxc", label: "Cuentas por cobrar", roles: ["ADMINISTRADOR", "CEO", "COORDINACION_ADMINISTRACION", "VENTAS", "GERENTE_OPERATIVO_SERVOMOTORES"] },
  { id: "cxp", label: "Cuentas por pagar", roles: ["ADMINISTRADOR", "CEO", "COORDINACION_ADMINISTRACION"] },
  { id: "movimientos", label: "Ingresos y egresos", roles: ["ADMINISTRADOR", "CEO", "COORDINACION_ADMINISTRACION"] },
  { id: "produccion", label: "Producción por ejecutor", roles: ["ADMINISTRADOR", "CEO", "COORDINACION_ADMINISTRACION", "GERENTE_OPERATIVO_SERVOMOTORES"] },
  { id: "diagnosticos", label: "Diagnósticos y SLA", roles: ["ADMINISTRADOR", "CEO", "COORDINACION_ADMINISTRACION", "GERENTE_OPERATIVO_SYSTRON", "GERENTE_OPERATIVO_SERVOMOTORES", "SUPERVISOR_TECNICO"] },
  { id: "reparaciones", label: "Reparaciones y resultados", roles: ["ADMINISTRADOR", "CEO", "COORDINACION_ADMINISTRACION", "GERENTE_OPERATIVO_SYSTRON", "GERENTE_OPERATIVO_SERVOMOTORES", "SUPERVISOR_TECNICO"] },
  { id: "inventario", label: "Inventario actual", roles: ["ADMINISTRADOR", "CEO", "COORDINACION_ADMINISTRACION", "GERENTE_OPERATIVO_SYSTRON", "ALMACEN"] },
  { id: "nomina", label: "Nómina y asistencia", roles: ["ADMINISTRADOR", "CEO", "COORDINACION_ADMINISTRACION"] },
];

export function visibleReports(role: Role) {
  return REPORTS.filter((report) => report.roles === "all" || report.roles.includes(role));
}

function inRange(from: string | null, to: string | null) {
  return {
    ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
    ...(to ? { lt: new Date(`${to}T23:59:59.000Z`) } : {}),
  };
}

export async function reportTable(companyId: string, inventoryEnabled: boolean, type: string, from: string | null, to: string | null) {
  const created = inRange(from, to);
  const hasRange = Boolean(from || to);
  if (type === "cotizaciones") {
    const rows = await prisma.quote.findMany({ where: { companyId, ...(hasRange ? { createdAt: created } : {}) }, include: { client: true, lines: true }, orderBy: { createdAt: "desc" }, take: 200 });
    return {
      title: "Cotizaciones",
      headers: ["Folio", "Cliente", "Estado", "Total"],
      rows: rows.map((row) => ({ href: `/cotizaciones/${row.id}`, cells: [row.folio, row.client.name, row.status, money(quoteTotals(linesForTotal(row.lines, row.quoteType, row.status), row.discountPct)?.total)] })),
    };
  }
  if (type === "conversion") {
    const rows = await prisma.quote.groupBy({ by: ["status"], where: { companyId, ...(hasRange ? { createdAt: created } : {}) }, _count: true });
    const total = rows.reduce((sum, row) => sum + row._count, 0);
    const won = rows.filter((row) => row.status.startsWith("AUTORIZADA")).reduce((sum, row) => sum + row._count, 0);
    return {
      title: "Conversión comercial",
      headers: ["Estado", "Cantidad", "Parte"],
      rows: [{ href: "/cotizaciones", cells: ["Autorizadas sobre decidibles", String(won), total ? `${Math.round((won / total) * 100)}%` : "0%"] }, ...rows.map((row) => ({ href: "/cotizaciones", cells: [row.status, String(row._count), total ? `${Math.round((row._count / total) * 100)}%` : "0%"] }))],
    };
  }
  if (type === "cxc") {
    const rows = await prisma.receivable.findMany({ where: { companyId, ...(hasRange ? { createdAt: created } : {}) }, include: { client: true, document: true }, orderBy: { dueAt: "asc" }, take: 200 });
    return { title: "Cuentas por cobrar", headers: ["Documento", "Cliente", "Saldo", "Estado"], rows: rows.map((row) => ({ href: `/cobranza/${row.id}`, cells: [row.document.folio, row.client.name, money(row.balance), row.status] })) };
  }
  if (type === "cxp") {
    const rows = await prisma.payable.findMany({ where: { companyId, ...(hasRange ? { createdAt: created } : {}) }, include: { supplier: true, document: true }, orderBy: { dueAt: "asc" }, take: 200 });
    return { title: "Cuentas por pagar", headers: ["Documento", "Proveedor", "Saldo", "Estado"], rows: rows.map((row) => ({ href: "/finanzas", cells: [row.document?.folio ?? "Compra", row.supplier.name, money(row.balance), row.status] })) };
  }
  if (type === "movimientos") {
    const rows = await prisma.financeMovement.findMany({ where: { companyId, ...(hasRange ? { createdAt: created } : {}) }, include: { account: true }, orderBy: { createdAt: "desc" }, take: 200 });
    return { title: "Ingresos y egresos", headers: ["Cuenta", "Dirección", "Importe", "Nota"], rows: rows.map((row) => ({ href: "/finanzas", cells: [row.account.name, row.direction, money(row.amount), row.note ?? ""] })) };
  }
  if (type === "produccion") {
    const credits = await productionForCompany(companyId);
    return { title: "Producción por ejecutor", headers: ["Ejecutor", "Trabajos", "Valor", "Efectividad"], rows: credits.map((row) => ({ href: "/produccion", cells: [row.name, String(row.jobs), money(row.value), row.effectiveness == null ? "—" : `${Math.round(row.effectiveness * 100)}%`] })) };
  }
  if (type === "diagnosticos" || type === "reparaciones") {
    const kind = type === "diagnosticos" ? "DIAGNOSTICO" : "OS";
    const rows = await prisma.technicalCase.findMany({ where: { serviceCompanyId: companyId, kind, ...(hasRange ? { createdAt: created } : {}) }, include: { equipment: true, attention: true }, orderBy: { createdAt: "desc" }, take: 200 });
    return { title: type === "diagnosticos" ? "Diagnósticos y SLA" : "Reparaciones y resultados", headers: ["Folio", "Equipo", "Estado", "SLA"], rows: rows.map((row) => ({ href: `/operacion/${row.id}`, cells: [row.folio, row.equipment.folio, row.status, row.slaDueAt ? row.slaDueAt.toISOString().slice(0, 10) : "—"] })) };
  }
  if (type === "inventario") {
    if (!inventoryEnabled) return { title: "Inventario", headers: ["Aviso"], rows: [{ cells: ["El inventario de esta empresa no está habilitado."] }] };
    const rows = await prisma.part.findMany({ where: { companyId, active: true }, orderBy: { partNumber: "asc" } });
    return { title: "Inventario actual", headers: ["Número", "Descripción", "Existencia", "Mínimo"], rows: rows.map((row) => ({ href: "/inventario", cells: [row.partNumber, row.description, String(row.qty), row.minQty == null ? "—" : String(row.minQty)] })) };
  }
  if (type === "nomina") {
    const rows = await prisma.payrollPeriod.findMany({ where: { companyId, ...(hasRange ? { createdAt: created } : {}) }, include: { lines: true }, orderBy: { createdAt: "desc" }, take: 50 });
    return { title: "Nómina y asistencia", headers: ["Folio", "Periodo", "Estado", "Transferencia"], rows: rows.map((row) => ({ href: `/nomina/${row.id}`, cells: [row.folio, row.periodStart, row.status, money(row.lines.reduce((sum, line) => sum + line.transferTotal, 0))] })) };
  }
  return { title: "Reporte", headers: ["Aviso"], rows: [{ cells: ["Ese reporte no existe."] }] };
}

export async function productionForCompany(companyId: string) {
  const cases = await prisma.technicalCase.findMany({
    where: { serviceCompanyId: companyId, status: { in: ["VALIDADO", "TERMINADA", "SIN_REPARACION"] } },
    include: { attention: true },
  });
  const users = await prisma.user.findMany({ where: { id: { in: cases.map((row) => row.finishedByUserId).filter((id): id is string => Boolean(id)) } } });
  const quotes = await prisma.quote.findMany({ where: { companyId, technicalCaseId: { in: cases.map((row) => row.id) } }, include: { lines: true } });
  const items: ProductionItem[] = cases.map((row) => {
    const quote = quotes.find((item) => item.technicalCaseId === row.id);
    const total = quote ? quoteTotals(linesForTotal(quote.lines, quote.quoteType, quote.status), quote.discountPct)?.total ?? 0 : 0;
    const user = users.find((item) => item.id === row.finishedByUserId);
    return {
      id: row.id,
      equipmentId: row.equipmentId,
      kind: row.kind === "OS" ? "OS" : "DIAGNOSTICO",
      attentionType: row.attention.attentionType,
      status: row.status,
      external: Boolean(row.externalSupplierId),
      finishedByUserId: row.finishedByUserId,
      finishedByRole: user?.role ?? null,
      validated: true,
      value: total,
      originalCaseId: row.originalCaseId,
    };
  });
  return productionCredit(items).map((row) => ({ ...row, name: users.find((user) => user.id === row.userId)?.name ?? "Ejecutor" }));
}
