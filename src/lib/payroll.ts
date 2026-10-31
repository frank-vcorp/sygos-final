import { prisma } from "./db";
import { ConcurrencyError } from "./form";
import { recordHistory } from "./history";
import { money, roundMoney } from "./money";
import {
  eachDate,
  mexicoToday,
  noonUtc,
  parseCommissionTiers,
  splitBySalary,
  weekdaysBetween,
  weekRange,
} from "./personnel";
import type { Role } from "./roles";

export type PayrollActor = {
  userId: string;
  role: Role;
  activeCompanyId: string;
  activeCompanyCode: string;
};

export type PayrollStatus =
  | "EN_PREPARACION"
  | "PENDIENTE_VALIDACION"
  | "EN_CORRECCION"
  | "CERRADA";

export const PAYROLL_STATUS_LABEL: Record<string, string> = {
  EN_PREPARACION: "En preparación",
  PRELIMINAR: "En preparación",
  PENDIENTE_VALIDACION: "Pendiente de validación",
  EN_CORRECCION: "En corrección",
  CERRADA: "Cerrada",
  AUTORIZADA: "Cerrada",
};

export function payrollStatusLabel(status: string): string {
  return PAYROLL_STATUS_LABEL[status] ?? status;
}

export function payrollStatusTone(status: string): "neutral" | "ok" | "warn" | "danger" {
  if (status === "CERRADA" || status === "AUTORIZADA") return "ok";
  if (status === "PENDIENTE_VALIDACION") return "warn";
  if (status === "EN_CORRECCION") return "danger";
  return "neutral";
}

export function isPayrollEditable(status: string): boolean {
  return status === "EN_PREPARACION" || status === "EN_CORRECCION" || status === "PRELIMINAR";
}

/** CEO, Administrador y Coordinación ajustan importes solo con la nómina abierta. */
export function canAdjustPayrollAmounts(role: Role, status?: string): boolean {
  const operator =
    role === "ADMINISTRADOR" || role === "CEO" || role === "COORDINACION_ADMINISTRACION";
  if (!operator) return false;
  if (status === undefined) return true;
  return isPayrollEditable(status);
}

export function isPayrollClosed(status: string): boolean {
  return status === "CERRADA" || status === "AUTORIZADA";
}

export function formatPayrollFolio(companyCode: string, year: number, weekNumber: number): string {
  const cleanCode = (companyCode || "SYSTRON").toUpperCase();
  const paddedWeek = String(weekNumber).padStart(2, "0");
  return `NOM-${cleanCode}-${year}-S${paddedWeek}`;
}

/**
 * Calcula año ISO y número de semana ISO (1-53) para una fecha YYYY-MM-DD,
 * junto con el lunes (periodStart) y domingo (periodEnd) de esa semana.
 */
export function isoWeekFromDate(isoDate: string): {
  year: number;
  weekNumber: number;
  periodStart: string;
  periodEnd: string;
  isoWeekString: string;
  periodLabel: string;
} {
  const range = weekRange(isoDate);
  const monday = noonUtc(range.start);
  const thursday = new Date(monday);
  thursday.setUTCDate(monday.getUTCDate() + 3);
  const isoYear = thursday.getUTCFullYear();

  const jan4 = new Date(Date.UTC(isoYear, 0, 4, 18, 0, 0));
  const jan4Day = jan4.getUTCDay();
  const jan4Delta = jan4Day === 0 ? 6 : jan4Day - 1;
  const firstMonday = new Date(jan4);
  firstMonday.setUTCDate(jan4.getUTCDate() - jan4Delta);

  const diffDays = Math.round((monday.getTime() - firstMonday.getTime()) / (86400 * 1000));
  const weekNumber = Math.max(1, Math.min(53, Math.floor(diffDays / 7) + 1));
  const paddedWeek = String(weekNumber).padStart(2, "0");
  const isoWeekString = `${isoYear}-W${paddedWeek}`;
  const periodLabel = `Semana ${paddedWeek} · ${isoYear} (${range.start} a ${range.end})`;

  return {
    year: isoYear,
    weekNumber,
    periodStart: range.start,
    periodEnd: range.end,
    isoWeekString,
    periodLabel,
  };
}

/**
 * Parsea tanto un string ISO week ("2026-W44") como una fecha ("2026-10-26").
 */
export function parsePayrollPeriodInput(rawInput: string): {
  year: number;
  weekNumber: number;
  periodStart: string;
  periodEnd: string;
  isoWeekString: string;
  periodLabel: string;
} {
  const trimmed = rawInput.trim();
  const weekMatch = /^(\d{4})-W(\d{1,2})$/i.exec(trimmed);
  if (weekMatch) {
    const year = Number(weekMatch[1]);
    const weekNumber = Number(weekMatch[2]);
    if (weekNumber < 1 || weekNumber > 53) {
      throw new Error("El número de semana debe estar entre 1 y 53.");
    }
    const jan4 = new Date(Date.UTC(year, 0, 4, 18, 0, 0));
    const jan4Day = jan4.getUTCDay();
    const jan4Delta = jan4Day === 0 ? 6 : jan4Day - 1;
    const firstMonday = new Date(jan4);
    firstMonday.setUTCDate(jan4.getUTCDate() - jan4Delta);
    const targetMonday = new Date(firstMonday);
    targetMonday.setUTCDate(firstMonday.getUTCDate() + (weekNumber - 1) * 7);
    const targetSunday = new Date(targetMonday);
    targetSunday.setUTCDate(targetMonday.getUTCDate() + 6);
    const periodStart = targetMonday.toISOString().slice(0, 10);
    const periodEnd = targetSunday.toISOString().slice(0, 10);
    const paddedWeek = String(weekNumber).padStart(2, "0");
    return {
      year,
      weekNumber,
      periodStart,
      periodEnd,
      isoWeekString: `${year}-W${paddedWeek}`,
      periodLabel: `Semana ${paddedWeek} · ${year} (${periodStart} a ${periodEnd})`,
    };
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return isoWeekFromDate(trimmed);
  }

  throw new Error("Indica una semana válida (ej. 2026-W44 o fecha del periodo).");
}

export type PayrollConceptOrigins = {
  sueldo: string;
  horasExtra: string;
  bonos: string;
  comision: string;
  compensaciones: string;
  primaVacacional: string;
  otrosConceptos: string;
  descuentos: string;
};

export function parsePayrollOrigins(json: string | null | undefined): PayrollConceptOrigins {
  const fallback: PayrollConceptOrigins = {
    sueldo: "Suma del sueldo diario timbrado y el sueldo diario sin timbrar por los días del periodo.",
    horasExtra: "Sin horas extra autorizadas en el periodo.",
    bonos: "Sin bonos aplicados en el periodo.",
    comision: "Sin comisión por facturación en el periodo.",
    compensaciones: "Sin compensaciones autorizadas en el periodo.",
    primaVacacional: "Sin prima vacacional en el periodo.",
    otrosConceptos: "Sin otros conceptos registrados.",
    descuentos: "Sin descuentos por incidencias en el periodo.",
  };
  if (!json) return fallback;
  try {
    const parsed = JSON.parse(json) as Partial<PayrollConceptOrigins>;
    return { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
}

export function computeLineTotals(values: {
  sueldo: number;
  horasExtra: number;
  bonos: number;
  comision: number;
  compensaciones: number;
  primaVacacional: number;
  otrosConceptos: number;
  descuentos: number;
}) {
  const totalPercepciones = roundMoney(
    values.sueldo +
      values.horasExtra +
      values.bonos +
      values.comision +
      values.compensaciones +
      values.primaVacacional +
      values.otrosConceptos,
  );
  const totalPagar = roundMoney(totalPercepciones - values.descuentos);
  return { totalPercepciones, totalPagar };
}

/** Importes que se muestran en el desglose del colaborador. Otros conceptos y descuentos siguen en la línea, pero no entran en este total. */
export function visiblePayrollAmounts(line: {
  sueldo: number;
  calcSueldo: number;
  stampedBase: number;
  cashBase: number;
  horasExtra: number;
  calcHorasExtra: number;
  overtimeStamped: number;
  overtimeCash: number;
  bonos: number;
  calcBonos: number;
  bonus: number;
  comision: number;
  calcComision: number;
  compensaciones: number;
  calcCompensaciones: number;
  primaVacacional: number;
  calcPrimaVacacional: number;
  primaStamped: number;
  primaCash: number;
}) {
  const sueldo = line.sueldo !== 0 || line.calcSueldo !== 0 ? line.sueldo : line.stampedBase + line.cashBase;
  const calcSueldo = line.calcSueldo !== 0 ? line.calcSueldo : sueldo;
  const horasExtra =
    line.horasExtra !== 0 || line.calcHorasExtra !== 0 ? line.horasExtra : line.overtimeStamped + line.overtimeCash;
  const calcHorasExtra = line.calcHorasExtra !== 0 ? line.calcHorasExtra : horasExtra;
  const bonos = line.bonos !== 0 || line.calcBonos !== 0 ? line.bonos : line.bonus;
  const calcBonos = line.calcBonos !== 0 ? line.calcBonos : bonos;
  const comision = line.comision;
  const calcComision = line.calcComision;
  const compensaciones = line.compensaciones;
  const calcCompensaciones = line.calcCompensaciones;
  const primaVacacional =
    line.primaVacacional !== 0 || line.calcPrimaVacacional !== 0
      ? line.primaVacacional
      : line.primaStamped + line.primaCash;
  const calcPrimaVacacional = line.calcPrimaVacacional !== 0 ? line.calcPrimaVacacional : primaVacacional;
  const total = roundMoney(sueldo + horasExtra + bonos + comision + compensaciones + primaVacacional);
  const calcTotal = roundMoney(
    calcSueldo + calcHorasExtra + calcBonos + calcComision + calcCompensaciones + calcPrimaVacacional,
  );
  return {
    sueldo,
    calcSueldo,
    horasExtra,
    calcHorasExtra,
    bonos,
    calcBonos,
    comision,
    calcComision,
    compensaciones,
    calcCompensaciones,
    primaVacacional,
    calcPrimaVacacional,
    total,
    calcTotal,
  };
}

export type PayrollPendingWarning = {
  collaboratorId: string;
  collaboratorName: string;
  concept: "Horas extra" | "Vacaciones" | "Compensación" | "Permiso de falta" | "Asistencia por validar";
  detail: string;
  href: string;
};

export async function getPayrollPendingWarnings(
  companyId: string,
  periodStart: string,
  periodEnd: string,
  collaboratorIds?: string[],
): Promise<PayrollPendingWarning[]> {
  const collabFilter = collaboratorIds && collaboratorIds.length > 0 ? { id: { in: collaboratorIds } } : {};
  const [overtime, vacations, compensations, permissions, attendance] = await Promise.all([
    prisma.overtimeRequest.findMany({
      where: {
        status: { in: ["PENDIENTE_CEO", "PENDIENTE_JEFE"] },
        workDate: { gte: periodStart, lte: periodEnd },
        collaborator: { companyId, ...collabFilter },
      },
      include: { collaborator: { include: { user: true } } },
    }),
    prisma.vacationRequest.findMany({
      where: {
        status: "PENDIENTE",
        startDate: { lte: periodEnd },
        endDate: { gte: periodStart },
        collaborator: { companyId, ...collabFilter },
      },
      include: { collaborator: { include: { user: true } } },
    }),
    prisma.compensationRequest.findMany({
      where: {
        status: "PENDIENTE",
        collaborator: { companyId, ...collabFilter },
      },
      include: { collaborator: { include: { user: true } } },
    }),
    prisma.leavePermissionRequest.findMany({
      where: {
        status: "PENDIENTE",
        startDate: { lte: periodEnd },
        endDate: { gte: periodStart },
        collaborator: { companyId, ...collabFilter },
      },
      include: { collaborator: { include: { user: true } } },
    }),
    prisma.attendanceDay.findMany({
      where: {
        justificationStatus: "PENDIENTE_VALIDACION_CEO",
        workDate: { gte: periodStart, lte: periodEnd },
        collaborator: { companyId, ...collabFilter },
      },
      include: { collaborator: { include: { user: true } } },
    }),
  ]);

  const warnings: PayrollPendingWarning[] = [];

  for (const row of overtime) {
    warnings.push({
      collaboratorId: row.collaboratorId,
      collaboratorName: row.collaborator.user.name,
      concept: "Horas extra",
      detail: `${row.workDate} · ${row.hours} h (${row.reason})`,
      href: `/personal/colaboradores/${row.collaboratorId}?tab=solicitudes&subtab=horas`,
    });
  }
  for (const row of vacations) {
    warnings.push({
      collaboratorId: row.collaboratorId,
      collaboratorName: row.collaborator.user.name,
      concept: "Vacaciones",
      detail: `${row.startDate} a ${row.endDate}`,
      href: `/personal/colaboradores/${row.collaboratorId}?tab=solicitudes&subtab=vacaciones`,
    });
  }
  for (const row of compensations) {
    warnings.push({
      collaboratorId: row.collaboratorId,
      collaboratorName: row.collaborator.user.name,
      concept: "Compensación",
      detail: `${row.concept} (${money(row.requestedAmount)})`,
      href: `/personal/colaboradores/${row.collaboratorId}?tab=solicitudes&subtab=compensaciones`,
    });
  }
  for (const row of permissions) {
    warnings.push({
      collaboratorId: row.collaboratorId,
      collaboratorName: row.collaborator.user.name,
      concept: "Permiso de falta",
      detail: `${row.startDate === row.endDate ? row.startDate : `${row.startDate} a ${row.endDate}`} (${row.reason})`,
      href: `/personal/colaboradores/${row.collaboratorId}?tab=solicitudes&subtab=permisos`,
    });
  }
  for (const row of attendance) {
    warnings.push({
      collaboratorId: row.collaboratorId,
      collaboratorName: row.collaborator.user.name,
      concept: "Asistencia por validar",
      detail: `${row.workDate} · ${row.status === "RETARDO" ? "Retardo" : "Falta"} pendiente de validación del CEO`,
      href: `/personal/colaboradores/${row.collaboratorId}?tab=asistencia`,
    });
  }

  return warnings;
}

function assertPayrollOperator(actor: PayrollActor) {
  if (!canAdjustPayrollAmounts(actor.role)) {
    throw new Error("Nómina la operan Coordinación de Administración o el CEO.");
  }
}

function assertPayrollCeo(actor: PayrollActor) {
  if (actor.role !== "ADMINISTRADOR" && actor.role !== "CEO") {
    throw new Error("Solo el CEO puede validar la nómina o regresarla a corrección.");
  }
}

export async function generateOrOpenWeeklyPayroll(
  actor: PayrollActor,
  input: { periodInput: string; paymentDate?: string | null },
): Promise<{ period: { id: string; folio: string }; existed: boolean }> {
  assertPayrollOperator(actor);
  const parsed = parsePayrollPeriodInput(input.periodInput);
  const folio = formatPayrollFolio(actor.activeCompanyCode, parsed.year, parsed.weekNumber);
  const paymentDate = input.paymentDate?.trim() || parsed.periodEnd || mexicoToday();

  const existing = await prisma.payrollPeriod.findFirst({
    where: {
      companyId: actor.activeCompanyId,
      kind: "SEMANAL",
      OR: [
        { folio },
        { year: parsed.year, weekNumber: parsed.weekNumber },
        { periodStart: parsed.periodStart },
      ],
    },
  });
  if (existing) {
    return { period: existing, existed: true };
  }

  const people = await prisma.collaborator.findMany({
    where: { companyId: actor.activeCompanyId, status: "ACTIVO" },
    include: { user: true },
    orderBy: { user: { name: "asc" } },
  });

  const period = await prisma.payrollPeriod.create({
    data: {
      folio,
      companyId: actor.activeCompanyId,
      kind: "SEMANAL",
      year: parsed.year,
      weekNumber: parsed.weekNumber,
      periodLabel: parsed.periodLabel,
      periodStart: parsed.periodStart,
      periodEnd: parsed.periodEnd,
      paymentDate,
      status: "EN_PREPARACION",
    },
  });

  const periodStartUtc = new Date(`${parsed.periodStart}T00:00:00.000Z`);
  const periodEndUtc = new Date(`${parsed.periodEnd}T23:59:59.999Z`);

  const companyInvoices = await prisma.billingDocument.findMany({
    where: {
      companyId: actor.activeCompanyId,
      status: "EMITIDA",
      kind: { in: ["FACTURA", "FACTURA_INTERCOMPANIA"] },
      issuedAt: { gte: periodStartUtc, lte: periodEndUtc },
    },
    include: { quote: true, receivable: true },
  });

  for (const person of people) {
    const periodDays = eachDate(parsed.periodStart, parsed.periodEnd).length;
    const dailyTotal = roundMoney(person.dailyStamped + person.dailyCash);
    const stampedBase = roundMoney(person.dailyStamped * periodDays);
    const cashBase = roundMoney(person.dailyCash * periodDays);
    const calcSueldo = roundMoney(stampedBase + cashBase);
    const sueldoOrigin = `Sueldo diario timbrado ${money(person.dailyStamped)} + sueldo diario sin timbrar ${money(person.dailyCash)} × ${periodDays} días del periodo (${money(calcSueldo)}).`;

    // Horas extra autorizadas en el periodo
    const overtimeRows = await prisma.overtimeRequest.findMany({
      where: {
        collaboratorId: person.id,
        status: "AUTORIZADA",
        workDate: { gte: parsed.periodStart, lte: parsed.periodEnd },
      },
    });
    const totalOtHours = overtimeRows.reduce(
      (sum, row) => sum + (row.authorizedHours ?? row.hours),
      0,
    );
    const hourlyRate = person.overtimeRate > 0 ? person.overtimeRate : dailyTotal > 0 ? roundMoney(dailyTotal / 8) : 0;
    const calcHorasExtra = roundMoney(
      overtimeRows.reduce((sum, row) => {
        const stored = row.amountStamped + row.amountCash;
        if (stored > 0) return sum + stored;
        const hrs = row.authorizedHours ?? row.hours;
        return sum + hrs * hourlyRate * 2;
      }, 0),
    );
    const horasExtraOrigin =
      overtimeRows.length > 0
        ? `${overtimeRows.length} solicitud(es) autorizada(s) en el periodo (${totalOtHours} h autorizadas: ${overtimeRows
            .map((r) => `${r.workDate} · ${r.authorizedHours ?? r.hours} h`)
            .join(", ")}).`
        : "Sin horas extra autorizadas en el periodo.";

    // Asistencia / Faltas y retardos en el periodo
    const marks = await prisma.attendanceDay.findMany({
      where: {
        collaboratorId: person.id,
        workDate: { gte: parsed.periodStart, lte: parsed.periodEnd },
      },
    });
    const unjustifiedAbsences = marks.filter(
      (m) => (m.status === "AUSENCIA" || (m.status === "PERMISO" && !m.paidLeave)) && !m.justified,
    );
    const unjustifiedRetardos = marks.filter((m) => m.status === "RETARDO" && !m.justified);

    // Bonos configurados
    let calcBonos = 0;
    const bonoNotes: string[] = [];
    const punctualityActive = person.bonusesEnabled ? person.punctualityBonusEnabled : person.punctualityBonus > 0;
    const productivityActive = person.bonusesEnabled ? person.productivityBonusEnabled : person.productivityBonus > 0;

    if (punctualityActive && person.punctualityBonus > 0) {
      if (unjustifiedAbsences.length === 0 && unjustifiedRetardos.length === 0) {
        calcBonos += person.punctualityBonus;
        bonoNotes.push(`Asistencia y puntualidad: ${money(person.punctualityBonus)}`);
      } else {
        bonoNotes.push(
          `Asistencia y puntualidad (${money(person.punctualityBonus)}) no aplicado por incidencias no justificadas en el periodo`,
        );
      }
    }
    if (productivityActive && person.productivityBonus > 0) {
      calcBonos += person.productivityBonus;
      bonoNotes.push(`Producción: ${money(person.productivityBonus)}`);
    }
    calcBonos = roundMoney(calcBonos);
    const bonosOrigin =
      bonoNotes.length > 0
        ? `Bonos configurados en la ficha: ${bonoNotes.join(" · ")}.`
        : "Bonos deshabilitados o en $0.00 en la ficha del colaborador.";

    // Comisión por facturación
    let calcComision = 0;
    let comisionOrigin = "Comisión por facturación deshabilitada en la ficha del colaborador.";
    if (person.commissionEnabled) {
      const tiers = parseCommissionTiers(person.commissionTiersJson);
      const userBilled = roundMoney(
        companyInvoices
          .filter(
            (doc) =>
              (doc.receivable?.sellerUserId ?? doc.quote?.sellerUserId ?? doc.requestedByUserId) ===
              person.userId,
          )
          .reduce((sum, doc) => sum + doc.total, 0),
      );
      const reached = [...tiers]
        .sort((a, b) => a.targetAmount - b.targetAmount)
        .filter((t) => userBilled >= t.targetAmount)
        .pop();
      if (reached) {
        calcComision =
          reached.kind === "MONTO"
            ? roundMoney(reached.value)
            : roundMoney(userBilled * (reached.value / 100));
        comisionOrigin = `Facturación del periodo ${money(userBilled)} · Escalafón alcanzado (${money(
          reached.targetAmount,
        )}): ${reached.kind === "MONTO" ? money(reached.value) : `${reached.value}%`}.`;
      } else {
        comisionOrigin = `Facturación del periodo ${money(userBilled)} · Sin escalafón alcanzado.`;
      }
    }

    // Compensaciones por evento autorizadas
    const compRows = await prisma.compensationRequest.findMany({
      where: {
        collaboratorId: person.id,
        status: "AUTORIZADA",
      },
    });
    const periodCompRows = compRows.filter((c) => {
      const refDate = (c.decidedAt ?? c.createdAt).toISOString().slice(0, 10);
      return refDate >= parsed.periodStart && refDate <= parsed.periodEnd;
    });
    const activeCompRows = periodCompRows.length > 0 ? periodCompRows : compRows;
    const calcCompensaciones = roundMoney(
      activeCompRows.reduce((sum, c) => sum + (c.authorizedAmount ?? c.requestedAmount), 0),
    );
    const compensacionesOrigin =
      activeCompRows.length > 0
        ? `${activeCompRows.length} compensación(es) autorizada(s): ${activeCompRows
            .map((c) => `${c.concept} (${money(c.authorizedAmount ?? c.requestedAmount)})`)
            .join(", ")}.`
        : "Sin solicitudes de compensación autorizadas en el periodo.";

    // Prima vacacional
    const vacRows = await prisma.vacationRequest.findMany({
      where: {
        collaboratorId: person.id,
        status: "AUTORIZADA",
        startDate: { lte: parsed.periodEnd },
        endDate: { gte: parsed.periodStart },
      },
    });
    const periodWeekdays = new Set(eachDate(parsed.periodStart, parsed.periodEnd));
    let vacDaysInPeriod = 0;
    for (const v of vacRows) {
      const vDays = weekdaysBetween(v.startDate, v.endDate).filter((d) => periodWeekdays.has(d));
      vacDaysInPeriod += vDays.length;
    }
    const dailyEquivalent = dailyTotal;
    const calcPrimaVacacional = roundMoney(vacDaysInPeriod * dailyEquivalent * 0.25);
    const primaSplit = splitBySalary(calcPrimaVacacional, person.dailyStamped, person.dailyCash);
    const primaOrigin =
      vacDaysInPeriod > 0
        ? `${vacDaysInPeriod} día(s) de vacaciones autorizadas en el periodo (25% prima vacacional).`
        : "Sin días de vacaciones autorizadas en este periodo.";

    // Otros conceptos
    const calcOtrosConceptos = 0;
    const otrosOrigin = "Sin otros conceptos adicionales capturados.";

    // Descuentos por faltas no justificadas
    const calcDescuentos = roundMoney(unjustifiedAbsences.length * dailyEquivalent);
    const discountSplit = splitBySalary(calcDescuentos, person.dailyStamped, person.dailyCash);
    const descuentosOrigin =
      unjustifiedAbsences.length > 0
        ? `${unjustifiedAbsences.length} falta(s) no justificada(s) en el periodo (${unjustifiedAbsences
            .map((m) => m.workDate)
            .join(", ")}).`
        : "Sin faltas no justificadas ni descuentos aplicables en el periodo.";

    const origins: PayrollConceptOrigins = {
      sueldo: sueldoOrigin,
      horasExtra: horasExtraOrigin,
      bonos: bonosOrigin,
      comision: comisionOrigin,
      compensaciones: compensacionesOrigin,
      primaVacacional: primaOrigin,
      otrosConceptos: otrosOrigin,
      descuentos: descuentosOrigin,
    };

    const totals = computeLineTotals({
      sueldo: calcSueldo,
      horasExtra: calcHorasExtra,
      bonos: calcBonos,
      comision: calcComision,
      compensaciones: calcCompensaciones,
      primaVacacional: calcPrimaVacacional,
      otrosConceptos: calcOtrosConceptos,
      descuentos: calcDescuentos,
    });

    await prisma.payrollLine.create({
      data: {
        periodId: period.id,
        collaboratorId: person.id,
        stampedBase,
        cashBase,
        discountStamped: discountSplit.stamped,
        discountCash: discountSplit.cash,
        overtimeStamped: calcHorasExtra,
        overtimeCash: 0,
        primaStamped: primaSplit.stamped,
        primaCash: primaSplit.cash,
        bonus: calcBonos,
        extraStamped: roundMoney(calcComision + calcCompensaciones + calcOtrosConceptos),
        extraCash: 0,
        transferTotal: roundMoney(totals.totalPagar - (cashBase - discountSplit.cash + primaSplit.cash)),
        cashTotal: roundMoney(cashBase - discountSplit.cash + primaSplit.cash),
        calcSueldo,
        calcHorasExtra,
        calcBonos,
        calcComision,
        calcCompensaciones,
        calcPrimaVacacional,
        calcOtrosConceptos,
        calcDescuentos,
        sueldo: calcSueldo,
        horasExtra: calcHorasExtra,
        bonos: calcBonos,
        comision: calcComision,
        compensaciones: calcCompensaciones,
        primaVacacional: calcPrimaVacacional,
        otrosConceptos: calcOtrosConceptos,
        descuentos: calcDescuentos,
        totalPercepciones: totals.totalPercepciones,
        totalPagar: totals.totalPagar,
        originsJson: JSON.stringify(origins),
        missing: !person.rfc ? "RFC" : null,
      },
    });
  }

  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "NOMINA",
    entityId: period.id,
    action: "GENERAR",
    summary: `Nómina ${folio} generada en estado En preparación (${people.length} colaboradores).`,
    authorUserId: actor.userId,
  });

  return { period, existed: false };
}

export async function updatePayrollLineAppliedAmounts(
  actor: PayrollActor,
  periodId: string,
  collaboratorId: string,
  input: {
    sueldo: number;
    horasExtra: number;
    bonos: number;
    comision: number;
    compensaciones: number;
    primaVacacional: number;
    otrosConceptos?: number;
    descuentos?: number;
  },
) {
  if (!canAdjustPayrollAmounts(actor.role)) {
    throw new Error("Nómina la operan Coordinación de Administración o el CEO.");
  }
  const period = await prisma.payrollPeriod.findFirst({
    where: { id: periodId, companyId: actor.activeCompanyId },
  });
  if (!period) throw new Error("La nómina no pertenece a la empresa activa.");
  if (!canAdjustPayrollAmounts(actor.role, period.status)) {
    throw new Error("Solo se pueden ajustar importes cuando la nómina está En preparación o En corrección.");
  }

  const line = await prisma.payrollLine.findUnique({
    where: { periodId_collaboratorId: { periodId, collaboratorId } },
    include: { collaborator: { include: { user: true } } },
  });
  if (!line) throw new Error("El colaborador no forma parte de esta nómina.");

  const clean = {
    sueldo: roundMoney(Math.max(0, Number(input.sueldo) || 0)),
    horasExtra: roundMoney(Math.max(0, Number(input.horasExtra) || 0)),
    bonos: roundMoney(Math.max(0, Number(input.bonos) || 0)),
    comision: roundMoney(Math.max(0, Number(input.comision) || 0)),
    compensaciones: roundMoney(Math.max(0, Number(input.compensaciones) || 0)),
    primaVacacional: roundMoney(Math.max(0, Number(input.primaVacacional) || 0)),
    otrosConceptos:
      input.otrosConceptos == null
        ? roundMoney(Math.max(0, line.otrosConceptos))
        : roundMoney(Math.max(0, Number(input.otrosConceptos) || 0)),
    descuentos:
      input.descuentos == null
        ? roundMoney(
            Math.max(
              0,
              line.descuentos !== 0 || line.calcDescuentos !== 0
                ? line.descuentos
                : line.discountStamped + line.discountCash,
            ),
          )
        : roundMoney(Math.max(0, Number(input.descuentos) || 0)),
  };

  const totals = computeLineTotals(clean);
  const salarySplit = splitBySalary(clean.sueldo, line.collaborator.dailyStamped, line.collaborator.dailyCash);
  const discountApplied = splitBySalary(clean.descuentos, line.collaborator.dailyStamped, line.collaborator.dailyCash);
  const primaApplied = splitBySalary(clean.primaVacacional, line.collaborator.dailyStamped, line.collaborator.dailyCash);
  const cashTotal = roundMoney(salarySplit.cash - discountApplied.cash + primaApplied.cash);

  await prisma.payrollLine.update({
    where: { id: line.id },
    data: {
      ...clean,
      totalPercepciones: totals.totalPercepciones,
      totalPagar: totals.totalPagar,
      stampedBase: salarySplit.stamped,
      cashBase: salarySplit.cash,
      overtimeStamped: clean.horasExtra,
      bonus: clean.bonos,
      primaStamped: primaApplied.stamped,
      primaCash: primaApplied.cash,
      extraStamped: roundMoney(clean.comision + clean.compensaciones + clean.otrosConceptos),
      discountStamped: discountApplied.stamped,
      discountCash: discountApplied.cash,
      transferTotal: roundMoney(totals.totalPagar - cashTotal),
      cashTotal,
    },
  });

  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "NOMINA",
    entityId: period.id,
    action: "AJUSTE_IMPORTES",
    summary: `Ajustó importes aplicados de ${line.collaborator.user.name} en ${period.folio} (Total aplicado: ${money(totals.totalPagar)}).`,
    authorUserId: actor.userId,
  });
}

export async function sendPayrollToValidation(
  actor: PayrollActor,
  periodId: string,
  version: number,
) {
  assertPayrollOperator(actor);
  const period = await prisma.payrollPeriod.findFirst({
    where: { id: periodId, companyId: actor.activeCompanyId },
  });
  if (!period) throw new Error("La nómina no pertenece a la empresa activa.");
  if (!isPayrollEditable(period.status)) {
    throw new Error("Solo una nómina En preparación o En corrección puede enviarse a validación.");
  }
  const updated = await prisma.payrollPeriod.updateMany({
    where: { id: period.id, version },
    data: { status: "PENDIENTE_VALIDACION", version: { increment: 1 } },
  });
  if (updated.count === 0) throw new ConcurrencyError();

  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "NOMINA",
    entityId: period.id,
    action: "ENVIAR_VALIDACION",
    summary: `${period.folio} fue enviada a validación del CEO.`,
    authorUserId: actor.userId,
  });
}

export async function returnPayrollToCorrection(
  actor: PayrollActor,
  periodId: string,
  version: number,
) {
  assertPayrollCeo(actor);
  const period = await prisma.payrollPeriod.findFirst({
    where: { id: periodId, companyId: actor.activeCompanyId },
  });
  if (!period) throw new Error("La nómina no pertenece a la empresa activa.");
  if (period.status !== "PENDIENTE_VALIDACION") {
    throw new Error("Solo una nómina Pendiente de validación puede regresarse a corrección.");
  }
  const updated = await prisma.payrollPeriod.updateMany({
    where: { id: period.id, version },
    data: { status: "EN_CORRECCION", version: { increment: 1 } },
  });
  if (updated.count === 0) throw new ConcurrencyError();

  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "NOMINA",
    entityId: period.id,
    action: "REGRESAR_CORRECCION",
    summary: `El CEO regresó ${period.folio} a En corrección.`,
    authorUserId: actor.userId,
  });
}

export async function validateAndClosePayroll(
  actor: PayrollActor,
  periodId: string,
  version: number,
) {
  assertPayrollCeo(actor);
  const period = await prisma.payrollPeriod.findFirst({
    where: { id: periodId, companyId: actor.activeCompanyId },
    include: { lines: true },
  });
  if (!period) throw new Error("La nómina no pertenece a la empresa activa.");
  if (period.status !== "PENDIENTE_VALIDACION") {
    throw new Error("La nómina debe estar Pendiente de validación para poder validarse.");
  }
  const updated = await prisma.payrollPeriod.updateMany({
    where: { id: period.id, version },
    data: { status: "CERRADA", version: { increment: 1 } },
  });
  if (updated.count === 0) throw new ConcurrencyError();

  const overtimeIds = await prisma.overtimeRequest.findMany({
    where: {
      status: "AUTORIZADA",
      collaborator: { companyId: actor.activeCompanyId },
      workDate: { gte: period.periodStart, lte: period.periodEnd },
    },
    select: { id: true },
  });
  if (overtimeIds.length > 0) {
    await prisma.overtimeRequest.updateMany({
      where: { id: { in: overtimeIds.map((r) => r.id) } },
      data: { status: "PAGADA", payrollPeriodId: period.id },
    });
  }

  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "NOMINA",
    entityId: period.id,
    action: "VALIDAR_CERRAR",
    summary: `${period.folio} fue validada por el CEO y quedó Cerrada definitivamente.`,
    authorUserId: actor.userId,
  });
}

export async function addPayrollDocument(
  actor: PayrollActor,
  periodId: string,
  title: string,
  fileMeta?: { fileName?: string | null; mimeType?: string | null; fileDataUrl?: string | null },
) {
  assertPayrollOperator(actor);
  const period = await prisma.payrollPeriod.findFirst({
    where: { id: periodId, companyId: actor.activeCompanyId },
  });
  if (!period) throw new Error("La nómina no pertenece a la empresa activa.");
  const cleanTitle = title.trim();
  if (!cleanTitle) throw new Error("El nombre del documento es obligatorio.");
  const doc = await prisma.payrollDocument.create({
    data: {
      periodId: period.id,
      title: cleanTitle,
      fileName: fileMeta?.fileName ?? null,
      mimeType: fileMeta?.mimeType ?? null,
      fileDataUrl: fileMeta?.fileDataUrl ?? null,
    },
  });
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "NOMINA",
    entityId: period.id,
    action: "DOCUMENTO",
    summary: `Subió documento "${cleanTitle}" a la nómina ${period.folio}.`,
    authorUserId: actor.userId,
  });
  return doc;
}
