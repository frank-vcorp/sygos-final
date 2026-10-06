import { prisma } from "./db";
import { allocateFolio } from "./folios";
import { ConcurrencyError } from "./form";
import { recordHistory } from "./history";
import { stampPayrollPeriod } from "./facturapi";
import { roundMoney } from "./money";
import type { Role } from "./roles";

type Actor = { userId: string; role: Role; activeCompanyId: string; activeCompanyCode: string };

export function laborProfile(role: Role) {
  const exempt = role === "GERENTE_OPERATIVO_SERVOMOTORES";
  return {
    exempt,
    kiosk: !exempt && role !== "CEO" && role !== "ADMINISTRADOR" && role !== "COORDINACION_ADMINISTRACION" && role !== "KIOSCO_ASISTENCIA",
    overtimeSelf: !exempt && !["AYUDANTE_GENERAL", "KIOSCO_ASISTENCIA", "CEO", "ADMINISTRADOR", "COORDINACION_ADMINISTRACION", "GERENTE_OPERATIVO_SERVOMOTORES"].includes(role),
    overtimeByManager: role === "AYUDANTE_GENERAL",
  };
}

export function mexicoToday(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function noonUtc(isoDate: string) {
  return new Date(`${isoDate}T18:00:00.000Z`);
}

export function isWeekday(isoDate: string) {
  const day = noonUtc(isoDate).getUTCDay();
  return day !== 0 && day !== 6;
}

export function weekRange(isoDate: string) {
  const noon = noonUtc(isoDate);
  const day = noon.getUTCDay();
  const delta = day === 0 ? 6 : day - 1;
  const start = new Date(noon);
  start.setUTCDate(start.getUTCDate() - delta);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export function eachDate(start: string, end: string) {
  const days: string[] = [];
  const cursor = noonUtc(start);
  const last = noonUtc(end);
  while (cursor <= last) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

export function weekdaysBetween(start: string, end: string) {
  return eachDate(start, end).filter(isWeekday);
}

export function vacationDaysForSeniority(years: number) {
  if (years < 1) return 0;
  if (years <= 5) return 12 + (years - 1) * 2;
  return 22 + Math.floor((years - 6) / 5) * 2;
}

export function primaForDays(days: number, dailyStamped: number, dailyCash: number) {
  const total = dailyStamped + dailyCash;
  const prima = total * 0.25 * days;
  if (total <= 0) return { stamped: 0, cash: 0 };
  return { stamped: roundMoney(prima * (dailyStamped / total)), cash: roundMoney(prima * (dailyCash / total)) };
}

export function primaByWeek(days: string[], dailyStamped: number, dailyCash: number) {
  const groups = new Map<string, number>();
  for (const day of days) {
    const key = weekRange(day).start;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  return [...groups.entries()].map(([weekStart, count]) => ({ weekStart, days: count, ...primaForDays(count, dailyStamped, dailyCash) }));
}

export function absenceDiscount(days: number, daily: number) {
  return roundMoney(days * (7 / 6) * daily);
}

export function overtimeBands(previousHours: number, hours: number) {
  const end = previousHours + hours;
  const doubleHours = Math.max(0, Math.min(end, 9) - previousHours);
  const tripleHours = roundMoney(hours - doubleHours);
  return { doubleHours: roundMoney(doubleHours), tripleHours };
}

export function overtimeAmount(doubleHours: number, tripleHours: number, rate: number) {
  return roundMoney(rate * 2 * doubleHours + rate * 3 * tripleHours);
}

export function splitBySalary(amount: number, dailyStamped: number, dailyCash: number) {
  const total = dailyStamped + dailyCash;
  if (total <= 0) return { stamped: roundMoney(amount), cash: 0 };
  return { stamped: roundMoney(amount * (dailyStamped / total)), cash: roundMoney(amount * (dailyCash / total)) };
}

export function bracketRate(amount: number, brackets: Array<{ upTo: number | null; rate: number }>) {
  const ordered = [...brackets].sort((a, b) => (a.upTo ?? Number.POSITIVE_INFINITY) - (b.upTo ?? Number.POSITIVE_INFINITY));
  return ordered.find((row) => row.upTo == null || amount <= row.upTo)?.rate ?? 0;
}

const SELLER_BRACKETS = [
  { upTo: 100000, rate: 0.02 },
  { upTo: null, rate: 0.03 },
];

function assertHr(actor: Actor) {
  if (actor.role !== "ADMINISTRADOR" && actor.role !== "CEO" && actor.role !== "COORDINACION_ADMINISTRACION") {
    throw new Error("Personal lo operan Coordinación, el CEO o el administrador.");
  }
}

function assertCeo(actor: Actor) {
  if (actor.role !== "ADMINISTRADOR" && actor.role !== "CEO") throw new Error("Esa decisión es del CEO.");
}

export async function registerCollaborator(
  actor: Actor,
  input: { userId: string; hireKind: "NUEVO" | "MIGRADO"; hiredAt: string; bossUserId: string | null; dailyStamped: number; dailyCash: number; vacationBalance: number; rfc: string | null; overtimeRate: number },
) {
  assertHr(actor);
  const user = await prisma.user.findFirst({ where: { id: input.userId, active: true, companyId: actor.activeCompanyId } });
  if (!user) throw new Error("El colaborador tiene que ser un usuario de esta empresa.");
  if (user.role === "CEO") throw new Error("El CEO no lleva jefe ni ficha de una sola empresa.");
  const profile = laborProfile(user.role as Role);
  if (!profile.exempt && !input.bossUserId) throw new Error("El jefe directo es obligatorio.");
  if (input.bossUserId) {
    const boss = await prisma.user.findFirst({ where: { id: input.bossUserId, active: true } });
    if (!boss) throw new Error("El jefe no existe.");
  }
  const existing = await prisma.collaborator.findUnique({ where: { userId: user.id } });
  if (existing) throw new Error("Ese usuario ya tiene ficha de colaborador.");
  const row = await prisma.collaborator.create({
    data: {
      companyId: actor.activeCompanyId,
      userId: user.id,
      bossUserId: input.bossUserId,
      hireKind: input.hireKind,
      status: "ACTIVO",
      hiredAt: noonUtc(input.hiredAt),
      vacationBalance: input.hireKind === "MIGRADO" ? input.vacationBalance : 0,
      dailyStamped: input.dailyStamped,
      dailyCash: input.dailyCash,
      overtimeRate: profile.exempt ? 0 : input.overtimeRate,
      rfc: input.rfc,
      exemptBenefits: profile.exempt,
    },
  });
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "COLABORADOR",
    entityId: row.id,
    action: "ALTA",
    summary: profile.exempt ? `${user.name} quedó con salario fijo, sin asistencia ni prestaciones ordinarias.` : `${user.name} quedó activo.`,
    authorUserId: actor.userId,
  });
  return row;
}

export async function changeBoss(actor: Actor, collaboratorId: string, version: number, bossUserId: string) {
  assertCeo(actor);
  const row = await prisma.collaborator.findFirst({ where: { id: collaboratorId, companyId: actor.activeCompanyId }, include: { user: true } });
  if (!row || row.status !== "ACTIVO") throw new Error("Esa ficha no está activa.");
  const updated = await prisma.collaborator.updateMany({ where: { id: row.id, version }, data: { bossUserId, version: { increment: 1 } } });
  if (updated.count === 0) throw new ConcurrencyError();
  await recordHistory({ companyId: actor.activeCompanyId, entityType: "COLABORADOR", entityId: row.id, action: "JEFE", summary: `Cambió el jefe de ${row.user.name}.`, authorUserId: actor.userId });
}

export async function changeSalary(actor: Actor, collaboratorId: string, version: number, dailyStamped: number, dailyCash: number, overtimeRate: number) {
  assertCeo(actor);
  const row = await prisma.collaborator.findFirst({ where: { id: collaboratorId, companyId: actor.activeCompanyId }, include: { user: true } });
  if (!row) throw new Error("Esa ficha no es de esta empresa.");
  const updated = await prisma.collaborator.updateMany({
    where: { id: row.id, version },
    data: { dailyStamped, dailyCash, overtimeRate: row.exemptBenefits ? 0 : overtimeRate, version: { increment: 1 } },
  });
  if (updated.count === 0) throw new ConcurrencyError();
  await recordHistory({ companyId: actor.activeCompanyId, entityType: "COLABORADOR", entityId: row.id, action: "SALARIO", summary: `Cambió el salario de ${row.user.name}. El anterior era $${row.dailyStamped} timbrado y $${row.dailyCash} efectivo.`, authorUserId: actor.userId });
}

export async function deactivateCollaborator(actor: Actor, collaboratorId: string, version: number) {
  assertHr(actor);
  const row = await prisma.collaborator.findFirst({ where: { id: collaboratorId, companyId: actor.activeCompanyId, status: "ACTIVO" }, include: { user: true } });
  if (!row) throw new Error("Esa ficha ya no está activa.");
  const updated = await prisma.collaborator.updateMany({ where: { id: row.id, version }, data: { status: "BAJA", version: { increment: 1 } } });
  if (updated.count === 0) throw new ConcurrencyError();
  await prisma.user.update({ where: { id: row.userId }, data: { active: false } });
  await recordHistory({ companyId: actor.activeCompanyId, entityType: "COLABORADOR", entityId: row.id, action: "BAJA", summary: `${row.user.name} causó baja. La historia se conserva y el acceso quedó deshabilitado.`, authorUserId: actor.userId });
}

export async function adjustVacationBalance(actor: Actor, collaboratorId: string, version: number, balance: number, reason: string) {
  assertCeo(actor);
  const row = await prisma.collaborator.findFirst({ where: { id: collaboratorId, companyId: actor.activeCompanyId }, include: { user: true } });
  if (!row || row.exemptBenefits) throw new Error("Ese colaborador no lleva saldo de vacaciones.");
  if (!reason.trim()) throw new Error("El ajuste exige motivo.");
  const updated = await prisma.collaborator.updateMany({ where: { id: row.id, version }, data: { vacationBalance: balance, version: { increment: 1 } } });
  if (updated.count === 0) throw new ConcurrencyError();
  await recordHistory({ companyId: actor.activeCompanyId, entityType: "COLABORADOR", entityId: row.id, action: "VACACIONES", summary: `Saldo de vacaciones de ${row.user.name} quedó en ${balance}. ${reason.trim()}`, authorUserId: actor.userId });
}

export async function requestVacation(actor: Actor, collaboratorId: string, startDate: string, endDate: string) {
  const row = await prisma.collaborator.findFirst({ where: { id: collaboratorId, companyId: actor.activeCompanyId, status: "ACTIVO" }, include: { user: true } });
  if (!row || row.exemptBenefits) throw new Error("Ese colaborador no toma vacaciones por este proceso.");
  const isBoss = row.bossUserId === actor.userId;
  const isCeo = actor.role === "CEO" || actor.role === "ADMINISTRADOR";
  if (!isBoss && !isCeo) throw new Error("Las vacaciones las registra el jefe directo.");
  const days = weekdaysBetween(startDate, endDate);
  if (days.length === 0) throw new Error("El rango no tiene días hábiles.");
  if (days.length > row.vacationBalance) throw new Error("El saldo de vacaciones no alcanza.");
  const auto = isCeo && isBoss;
  const vacation = await prisma.vacationRequest.create({
    data: {
      collaboratorId: row.id,
      startDate,
      endDate,
      status: auto ? "AUTORIZADA" : "PENDIENTE",
      requestedByUserId: actor.userId,
      primas: auto ? { create: primaByWeek(days, row.dailyStamped, row.dailyCash) } : undefined,
    },
  });
  if (auto) await applyVacation(row.id, row.vacationBalance, days);
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "VACACION",
    entityId: vacation.id,
    action: auto ? "AUTORIZACION" : "ALTA",
    summary: auto ? `Vacaciones de ${row.user.name} autorizadas por ser el jefe directo.` : `Vacaciones de ${row.user.name} quedaron pendientes del CEO.`,
    authorUserId: actor.userId,
  });
  return vacation;
}

async function applyVacation(collaboratorId: string, balance: number, days: string[]) {
  await prisma.collaborator.update({ where: { id: collaboratorId }, data: { vacationBalance: roundMoney(balance - days.length) } });
  for (const workDate of days) {
    await prisma.attendanceDay.upsert({
      where: { collaboratorId_workDate: { collaboratorId, workDate } },
      update: { status: "VACACIONES", justified: true, paidLeave: true, entryAt: null, exitAt: null },
      create: { collaboratorId, workDate, status: "VACACIONES", justified: true, paidLeave: true },
    });
  }
}

export async function decideVacation(actor: Actor, vacationId: string, version: number, authorized: boolean) {
  assertCeo(actor);
  const row = await prisma.vacationRequest.findFirst({ where: { id: vacationId, status: "PENDIENTE" }, include: { collaborator: { include: { user: true } } } });
  if (!row || row.collaborator.companyId !== actor.activeCompanyId) throw new Error("Esa solicitud no está pendiente en esta empresa.");
  const days = weekdaysBetween(row.startDate, row.endDate);
  if (authorized && days.length > row.collaborator.vacationBalance) throw new Error("El saldo ya no alcanza.");
  const updated = await prisma.vacationRequest.updateMany({ where: { id: row.id, version }, data: { status: authorized ? "AUTORIZADA" : "RECHAZADA", version: { increment: 1 } } });
  if (updated.count === 0) throw new ConcurrencyError();
  if (authorized) {
    await prisma.vacationPrima.createMany({ data: primaByWeek(days, row.collaborator.dailyStamped, row.collaborator.dailyCash).map((prima) => ({ ...prima, vacationId: row.id })) });
    await applyVacation(row.collaboratorId, row.collaborator.vacationBalance, days);
  }
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "VACACION",
    entityId: row.id,
    action: "AUTORIZACION",
    summary: authorized ? `Vacaciones de ${row.collaborator.user.name} autorizadas. La prima quedó generada.` : `Vacaciones de ${row.collaborator.user.name} rechazadas.`,
    authorUserId: actor.userId,
  });
}

export async function punch(actor: Actor, collaboratorId: string, kind: "ENTRADA" | "SALIDA") {
  if (actor.role !== "KIOSCO_ASISTENCIA" && actor.role !== "ADMINISTRADOR") throw new Error("El marcaje sale del kiosco.");
  const row = await prisma.collaborator.findFirst({ where: { id: collaboratorId, companyId: actor.activeCompanyId, status: "ACTIVO" } });
  if (!row || row.exemptBenefits) throw new Error("Ese colaborador no marca en el kiosco.");
  const workDate = mexicoToday();
  const existing = await prisma.attendanceDay.findUnique({ where: { collaboratorId_workDate: { collaboratorId: row.id, workDate } } });
  if (existing?.status === "VACACIONES" || existing?.status === "PERMISO") throw new Error("Ese día ya está cubierto.");
  const now = new Date();
  if (kind === "ENTRADA") {
    if (existing?.entryAt) throw new Error("La entrada de ese día ya quedó registrada.");
    const [hour, minute] = row.scheduleStart.split(":").map(Number);
    const limit = noonUtc(workDate);
    limit.setUTCHours(hour + 6, minute + row.toleranceMinutes, 0, 0);
    const late = now > limit;
    await prisma.attendanceDay.upsert({
      where: { collaboratorId_workDate: { collaboratorId: row.id, workDate } },
      update: { entryAt: now, status: late ? "RETARDO" : "EN_JORNADA" },
      create: { collaboratorId: row.id, workDate, entryAt: now, status: late ? "RETARDO" : "EN_JORNADA" },
    });
    return;
  }
  if (!existing?.entryAt || existing.exitAt) throw new Error("No hay una entrada abierta para registrar la salida.");
  const status = existing.status === "RETARDO" ? "RETARDO" : "NORMAL";
  await prisma.attendanceDay.update({ where: { id: existing.id }, data: { exitAt: now, status } });
}

export async function manualAttendance(actor: Actor, collaboratorId: string, workDate: string, status: "NORMAL" | "RETARDO" | "AUSENCIA" | "PERMISO" | "SALIDA_FALTANTE", note: string, justified: boolean, paidLeave: boolean) {
  assertHr(actor);
  if (actor.role === "COORDINACION_ADMINISTRACION" || actor.role === "CEO" || actor.role === "ADMINISTRADOR") {
    if (!note.trim()) throw new Error("El registro manual exige motivo.");
  }
  const row = await prisma.collaborator.findFirst({ where: { id: collaboratorId, companyId: actor.activeCompanyId, status: "ACTIVO" } });
  if (!row || row.exemptBenefits) throw new Error("Ese colaborador no lleva asistencia.");
  const existing = await prisma.attendanceDay.findUnique({ where: { collaboratorId_workDate: { collaboratorId, workDate } } });
  if (existing && actor.role === "COORDINACION_ADMINISTRACION") throw new Error("Un registro existente lo corrige el CEO.");
  await prisma.attendanceDay.upsert({
    where: { collaboratorId_workDate: { collaboratorId, workDate } },
    update: { status, note: note.trim(), justified, paidLeave },
    create: { collaboratorId, workDate, status, note: note.trim(), justified, paidLeave },
  });
  await recordHistory({ companyId: actor.activeCompanyId, entityType: "ASISTENCIA", entityId: row.id, action: "CORRECCION", summary: `${workDate} quedó como ${status}. ${note.trim()}`, authorUserId: actor.userId });
}

export async function updateSchedule(actor: Actor, collaboratorId: string, version: number, scheduleStart: string, toleranceMinutes: number) {
  assertHr(actor);
  const updated = await prisma.collaborator.updateMany({
    where: { id: collaboratorId, companyId: actor.activeCompanyId, version },
    data: { scheduleStart, toleranceMinutes, scheduleEffectiveAt: new Date(), version: { increment: 1 } },
  });
  if (updated.count === 0) throw new ConcurrencyError();
}

export async function enrollFingerprint(actor: Actor, collaboratorId: string, note: string) {
  assertHr(actor);
  await prisma.collaborator.updateMany({ where: { id: collaboratorId, companyId: actor.activeCompanyId }, data: { fingerprintNote: note.trim(), fingerprintAt: new Date() } });
}

function hoursBetween(start: string, end: string) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const hours = eh + em / 60 - (sh + sm / 60);
  if (!Number.isFinite(hours) || hours <= 0) throw new Error("La hora de fin tiene que ser posterior al inicio.");
  return roundMoney(hours);
}

export async function requestOvertime(actor: Actor, collaboratorId: string, workDate: string, startedAt: string, endedAt: string, reason: string) {
  const row = await prisma.collaborator.findFirst({ where: { id: collaboratorId, companyId: actor.activeCompanyId, status: "ACTIVO" }, include: { user: true } });
  if (!row || row.exemptBenefits) throw new Error("Ese colaborador no genera horas extra.");
  const profile = laborProfile(row.user.role as Role);
  if (profile.overtimeByManager) {
    if (actor.role !== "GERENTE_OPERATIVO_SERVOMOTORES" && actor.role !== "CEO" && actor.role !== "ADMINISTRADOR") throw new Error("Las horas extra del ayudante las registra su gerente.");
  } else if (actor.userId !== row.userId && actor.role !== "CEO" && actor.role !== "ADMINISTRADOR") {
    throw new Error("El empleado registra sus propias horas extra.");
  }
  const hours = hoursBetween(startedAt, endedAt);
  const pendingCeo = profile.overtimeByManager || row.bossUserId === actor.userId && (actor.role === "CEO" || actor.role === "ADMINISTRADOR");
  const overtime = await prisma.overtimeRequest.create({
    data: { collaboratorId: row.id, workDate, startedAt, endedAt, hours, reason: reason.trim(), status: pendingCeo ? "PENDIENTE_CEO" : "PENDIENTE_JEFE", requestedByUserId: actor.userId },
  });
  await recordHistory({ companyId: actor.activeCompanyId, entityType: "HORAS", entityId: overtime.id, action: "ALTA", summary: `${row.user.name} tiene ${hours} h pendientes de autorización.`, authorUserId: actor.userId });
  return overtime;
}

export async function reviewOvertime(actor: Actor, overtimeId: string, version: number, approved: boolean) {
  const row = await prisma.overtimeRequest.findFirst({ where: { id: overtimeId }, include: { collaborator: { include: { user: true } } } });
  if (!row || row.collaborator.companyId !== actor.activeCompanyId) throw new Error("Esa solicitud no es de esta empresa.");
  const ceo = actor.role === "CEO" || actor.role === "ADMINISTRADOR";
  if (row.status === "PENDIENTE_JEFE") {
    if (row.collaborator.bossUserId !== actor.userId && !ceo) throw new Error("La valida el jefe directo.");
    if (!approved) {
      await prisma.overtimeRequest.updateMany({ where: { id: row.id, version }, data: { status: "RECHAZADA", version: { increment: 1 } } });
      return;
    }
    if (ceo && row.collaborator.bossUserId === actor.userId) {
      await authorizeOvertime(actor, row.id, version);
      return;
    }
    const updated = await prisma.overtimeRequest.updateMany({ where: { id: row.id, version }, data: { status: "PENDIENTE_CEO", version: { increment: 1 } } });
    if (updated.count === 0) throw new ConcurrencyError();
    return;
  }
  if (row.status === "PENDIENTE_CEO") {
    assertCeo(actor);
    if (!approved) {
      await prisma.overtimeRequest.updateMany({ where: { id: row.id, version }, data: { status: "RECHAZADA", version: { increment: 1 } } });
      return;
    }
    await authorizeOvertime(actor, row.id, version);
  }
}

async function authorizeOvertime(actor: Actor, overtimeId: string, version: number) {
  const row = await prisma.overtimeRequest.findFirst({ where: { id: overtimeId }, include: { collaborator: true } });
  if (!row) throw new Error("No se encontró la solicitud.");
  const range = weekRange(row.workDate);
  const prior = await prisma.overtimeRequest.findMany({
    where: { collaboratorId: row.collaboratorId, status: { in: ["AUTORIZADA", "PAGADA"] }, workDate: { gte: range.start, lte: range.end }, id: { not: row.id } },
  });
  const previousHours = prior.reduce((sum, item) => sum + item.hours, 0);
  const bands = overtimeBands(previousHours, row.hours);
  const amount = overtimeAmount(bands.doubleHours, bands.tripleHours, row.collaborator.overtimeRate);
  const split = splitBySalary(amount, row.collaborator.dailyStamped, row.collaborator.dailyCash);
  const updated = await prisma.overtimeRequest.updateMany({
    where: { id: row.id, version },
    data: { status: "AUTORIZADA", frozenRate: row.collaborator.overtimeRate, doubleHours: bands.doubleHours, tripleHours: bands.tripleHours, amountStamped: split.stamped, amountCash: split.cash, version: { increment: 1 } },
  });
  if (updated.count === 0) throw new ConcurrencyError();
  await recordHistory({ companyId: actor.activeCompanyId, entityType: "HORAS", entityId: row.id, action: "AUTORIZACION", summary: `Quedaron ${bands.doubleHours} h dobles y ${bands.tripleHours} h triples. La tarifa quedó congelada.`, authorUserId: actor.userId });
}

function lineTotals(line: { stampedBase: number; cashBase: number; discountStamped: number; discountCash: number; overtimeStamped: number; overtimeCash: number; primaStamped: number; primaCash: number; bonus: number; extraStamped: number; extraCash: number; aguinaldoStamped: number; aguinaldoCash: number }) {
  const transferTotal = roundMoney(line.stampedBase - line.discountStamped + line.overtimeStamped + line.primaStamped + line.bonus + line.extraStamped + line.aguinaldoStamped);
  const cashTotal = roundMoney(line.cashBase - line.discountCash + line.overtimeCash + line.primaCash + line.extraCash + line.aguinaldoCash);
  return { transferTotal, cashTotal };
}

export async function generatePayroll(actor: Actor, weekStart: string) {
  assertHr(actor);
  if (weekRange(weekStart).start !== weekStart) throw new Error("La nómina semanal empieza en lunes.");
  const range = weekRange(weekStart);
  const existing = await prisma.payrollPeriod.findFirst({ where: { companyId: actor.activeCompanyId, kind: "SEMANAL", periodStart: range.start } });
  if (existing) return existing;
  const people = await prisma.collaborator.findMany({ where: { companyId: actor.activeCompanyId, status: "ACTIVO" }, include: { user: true } });
  const folio = await allocateFolio(actor.activeCompanyId, "NOM");
  const period = await prisma.payrollPeriod.create({ data: { folio, companyId: actor.activeCompanyId, kind: "SEMANAL", periodStart: range.start, periodEnd: range.end, status: "PRELIMINAR" } });
  const monthEnd = range.end.slice(0, 8) + String(new Date(Date.UTC(Number(range.end.slice(0, 4)), Number(range.end.slice(5, 7)), 0)).getUTCDate()).padStart(2, "0");
  const closesMonth = range.start <= monthEnd && monthEnd <= range.end;
  for (const person of people) {
    const missing = person.dailyStamped > 0 && !person.rfc ? "RFC" : null;
    if (person.exemptBenefits) {
      const draft = { stampedBase: roundMoney(person.dailyStamped * 7), cashBase: roundMoney(person.dailyCash * 7), discountStamped: 0, discountCash: 0, overtimeStamped: 0, overtimeCash: 0, primaStamped: 0, primaCash: 0, bonus: 0, extraStamped: 0, extraCash: 0, aguinaldoStamped: 0, aguinaldoCash: 0 };
      await prisma.payrollLine.create({ data: { periodId: period.id, collaboratorId: person.id, ...draft, ...lineTotals(draft), missing } });
      continue;
    }
    const days = eachDate(range.start, range.end);
    const marks = await prisma.attendanceDay.findMany({ where: { collaboratorId: person.id, workDate: { gte: range.start, lte: range.end } } });
    const unpaid = marks.filter((mark) => (mark.status === "AUSENCIA" || (mark.status === "PERMISO" && !mark.paidLeave)) && !mark.justified).length;
    const overtime = await prisma.overtimeRequest.findMany({ where: { collaboratorId: person.id, status: "AUTORIZADA", workDate: { gte: range.start, lte: range.end } } });
    const primas = await prisma.vacationPrima.findMany({ where: { weekStart: range.start, vacation: { collaboratorId: person.id, status: "AUTORIZADA" } } });
    let bonus = 0;
    if (closesMonth && person.punctualityBonus > 0) {
      const monthMarks = await prisma.attendanceDay.findMany({ where: { collaboratorId: person.id, workDate: { gte: `${range.start.slice(0, 7)}-01`, lte: monthEnd } } });
      const dirty = monthMarks.some((mark) => (mark.status === "AUSENCIA" || mark.status === "RETARDO") && !mark.justified);
      if (!dirty) bonus += person.punctualityBonus;
    }
    if (closesMonth && person.productivityBonus > 0) {
      const billed = await monthBilled(actor.activeCompanyId, range.start.slice(0, 7));
      if (billed >= person.productivityGoal) bonus += person.productivityBonus;
    }
    const draft = {
      stampedBase: roundMoney(person.dailyStamped * 7),
      cashBase: roundMoney(person.dailyCash * 7),
      discountStamped: absenceDiscount(unpaid, person.dailyStamped),
      discountCash: absenceDiscount(unpaid, person.dailyCash),
      overtimeStamped: roundMoney(overtime.reduce((sum, item) => sum + item.amountStamped, 0)),
      overtimeCash: roundMoney(overtime.reduce((sum, item) => sum + item.amountCash, 0)),
      primaStamped: roundMoney(primas.reduce((sum, item) => sum + item.stamped, 0)),
      primaCash: roundMoney(primas.reduce((sum, item) => sum + item.cash, 0)),
      bonus: roundMoney(bonus),
      extraStamped: 0,
      extraCash: 0,
      aguinaldoStamped: 0,
      aguinaldoCash: 0,
    };
    await prisma.payrollLine.create({ data: { periodId: period.id, collaboratorId: person.id, ...draft, ...lineTotals(draft), missing } });
  }
  return period;
}

async function monthBilled(companyId: string, month: string) {
  const start = new Date(`${month}-01T06:00:00.000Z`);
  const [year, mon] = month.split("-").map(Number);
  const end = new Date(Date.UTC(year, mon, 1, 6, 0, 0));
  const sum = await prisma.billingDocument.aggregate({
    where: { companyId, status: "EMITIDA", kind: { in: ["FACTURA", "FACTURA_INTERCOMPANIA"] }, issuedAt: { gte: start, lt: end } },
    _sum: { total: true },
  });
  return sum._sum.total ?? 0;
}

export async function addPayrollAdjustment(actor: Actor, periodId: string, collaboratorId: string, kind: "INGRESO" | "DESCUENTO", component: "TIMBRADO" | "EFECTIVO", amount: number, note: string) {
  assertHr(actor);
  const period = await prisma.payrollPeriod.findFirst({ where: { id: periodId, companyId: actor.activeCompanyId, status: "PRELIMINAR" } });
  if (!period) throw new Error("Esa nómina ya no admite conceptos.");
  if (!note.trim()) throw new Error("El concepto extraordinario exige nota.");
  await prisma.payrollAdjustment.create({ data: { periodId, collaboratorId, kind, component, amount, note: note.trim(), authorUserId: actor.userId } });
  await refreshExtras(periodId, collaboratorId);
}

export async function editPayrollAdjustment(actor: Actor, adjustmentId: string, amount: number) {
  assertCeo(actor);
  const row = await prisma.payrollAdjustment.findFirst({ where: { id: adjustmentId }, include: { period: true } });
  if (!row || row.period.companyId !== actor.activeCompanyId || row.period.status !== "PRELIMINAR") throw new Error("Ese concepto ya no se puede modificar.");
  await prisma.payrollAdjustment.update({ where: { id: row.id }, data: { amount } });
  await refreshExtras(row.periodId, row.collaboratorId);
}

async function refreshExtras(periodId: string, collaboratorId: string) {
  const extras = await prisma.payrollAdjustment.findMany({ where: { periodId, collaboratorId } });
  const signed = (row: { kind: string; amount: number }) => (row.kind === "DESCUENTO" ? -row.amount : row.amount);
  const extraStamped = roundMoney(extras.filter((row) => row.component === "TIMBRADO").reduce((sum, row) => sum + signed(row), 0));
  const extraCash = roundMoney(extras.filter((row) => row.component === "EFECTIVO").reduce((sum, row) => sum + signed(row), 0));
  const line = await prisma.payrollLine.findUnique({ where: { periodId_collaboratorId: { periodId, collaboratorId } } });
  if (!line) return;
  const totals = lineTotals({ ...line, extraStamped, extraCash });
  await prisma.payrollLine.update({ where: { id: line.id }, data: { extraStamped, extraCash, ...totals } });
}

export async function authorizePayroll(actor: Actor, periodId: string, version: number) {
  assertCeo(actor);
  const period = await prisma.payrollPeriod.findFirst({ where: { id: periodId, companyId: actor.activeCompanyId, status: "PRELIMINAR" }, include: { lines: { include: { collaborator: { include: { user: true } } } } } });
  if (!period) throw new Error("Esa nómina no está en preliminar.");
  const blocked = period.lines.filter((line) => line.missing && line.transferTotal > 0);
  if (blocked.length > 0) throw new Error(`Falta ${blocked[0].missing} de ${blocked[0].collaborator.user.name}.`);
  const updated = await prisma.payrollPeriod.updateMany({ where: { id: period.id, version }, data: { status: "AUTORIZADA", fiscalStatus: "PENDIENTE", version: { increment: 1 } } });
  if (updated.count === 0) throw new ConcurrencyError();
  const transfer = roundMoney(period.lines.reduce((sum, line) => sum + line.transferTotal, 0));
  const cash = roundMoney(period.lines.reduce((sum, line) => sum + line.cashTotal, 0));
  await payFromAccount(actor.activeCompanyId, "BANCO", transfer, period.folio, period.id);
  await payFromAccount(actor.activeCompanyId, "EFECTIVO", cash, period.folio, period.id);
  const overtimeIds = await prisma.overtimeRequest.findMany({
    where: { status: "AUTORIZADA", collaborator: { companyId: actor.activeCompanyId }, workDate: { gte: period.periodStart, lte: period.periodEnd } },
  });
  if (overtimeIds.length > 0) {
    await prisma.overtimeRequest.updateMany({ where: { id: { in: overtimeIds.map((row) => row.id) } }, data: { status: "PAGADA", payrollPeriodId: period.id } });
  }
  await stampPayrollPeriod(period.id);
  await recordHistory({ companyId: actor.activeCompanyId, entityType: "NOMINA", entityId: period.id, action: "AUTORIZACION", summary: `${period.folio} quedó autorizada y bloqueada.`, authorUserId: actor.userId });
}

async function payFromAccount(companyId: string, kind: "BANCO" | "EFECTIVO", amount: number, folio: string, originId: string) {
  if (amount <= 0) return;
  const account = await prisma.financeAccount.findFirst({ where: { companyId, kind, active: true }, orderBy: { name: "asc" } });
  if (!account) throw new Error(`Falta una cuenta de ${kind === "BANCO" ? "banco" : "efectivo"} para pagar la nómina.`);
  if (kind === "EFECTIVO" && account.balance < amount) throw new Error("La caja no tiene saldo para la parte en efectivo.");
  await prisma.financeAccount.update({ where: { id: account.id }, data: { balance: account.balance - amount } });
  await prisma.financeMovement.create({ data: { companyId, accountId: account.id, direction: "EGRESO", amount, category: "Nómina", note: folio, originType: "NOMINA", originId } });
}

export async function retryPayrollFiscal(actor: Actor, periodId: string) {
  assertHr(actor);
  const period = await prisma.payrollPeriod.findFirst({ where: { id: periodId, companyId: actor.activeCompanyId, status: "AUTORIZADA" } });
  if (!period) throw new Error("Solo se reintenta una nómina ya autorizada.");
  await stampPayrollPeriod(period.id);
  return period;
}

export async function generateAguinaldo(actor: Actor, year: number) {
  assertHr(actor);
  const existing = await prisma.payrollPeriod.findFirst({ where: { companyId: actor.activeCompanyId, kind: "AGUINALDO", periodStart: `${year}-01-01` } });
  if (existing) return existing;
  const people = await prisma.collaborator.findMany({ where: { companyId: actor.activeCompanyId, status: "ACTIVO", exemptBenefits: false }, include: { user: true } });
  const folio = await allocateFolio(actor.activeCompanyId, "AGU");
  const period = await prisma.payrollPeriod.create({ data: { folio, companyId: actor.activeCompanyId, kind: "AGUINALDO", periodStart: `${year}-01-01`, periodEnd: `${year}-12-31`, status: "PRELIMINAR" } });
  for (const person of people) {
    const hired = person.hiredAt.toISOString().slice(0, 10);
    const start = hired > `${year}-01-01` ? hired : `${year}-01-01`;
    const worked = eachDate(start, `${year}-12-31`).length;
    const factor = Math.min(1, worked / 365);
    const total = (person.dailyStamped + person.dailyCash) * 15 * factor;
    const split = splitBySalary(total, person.dailyStamped, person.dailyCash);
    const draft = { stampedBase: 0, cashBase: 0, discountStamped: 0, discountCash: 0, overtimeStamped: 0, overtimeCash: 0, primaStamped: 0, primaCash: 0, bonus: 0, extraStamped: 0, extraCash: 0, aguinaldoStamped: split.stamped, aguinaldoCash: split.cash };
    await prisma.payrollLine.create({ data: { periodId: period.id, collaboratorId: person.id, ...draft, ...lineTotals(draft), missing: person.dailyStamped > 0 && !person.rfc ? "RFC" : null } });
  }
  return period;
}

export async function adjustAguinaldo(actor: Actor, lineId: string, stamped: number, cash: number) {
  assertCeo(actor);
  const line = await prisma.payrollLine.findFirst({ where: { id: lineId }, include: { period: true } });
  if (!line || line.period.companyId !== actor.activeCompanyId || line.period.kind !== "AGUINALDO" || line.period.status !== "PRELIMINAR") throw new Error("Ese aguinaldo ya no se ajusta.");
  const totals = lineTotals({ ...line, aguinaldoStamped: stamped, aguinaldoCash: cash });
  await prisma.payrollLine.update({ where: { id: line.id }, data: { aguinaldoStamped: stamped, aguinaldoCash: cash, ...totals } });
}

export async function generateCommissions(actor: Actor, month: string) {
  assertHr(actor);
  const existing = await prisma.commissionRun.findFirst({ where: { companyId: actor.activeCompanyId, month } });
  if (existing) return existing;
  const [year, mon] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, mon - 1, 1, 6, 0, 0));
  const end = new Date(Date.UTC(year, mon, 1, 6, 0, 0));
  const documents = await prisma.billingDocument.findMany({
    where: { companyId: actor.activeCompanyId, status: "EMITIDA", kind: { in: ["FACTURA", "FACTURA_INTERCOMPANIA"] }, issuedAt: { gte: start, lt: end } },
    include: { quote: true, receivable: true },
  });
  const users = await prisma.user.findMany({ where: { companyId: actor.activeCompanyId, active: true, role: { in: ["VENTAS", "GERENTE_OPERATIVO_SYSTRON", "SUPERVISOR_TECNICO"] } } });
  const run = await prisma.commissionRun.create({ data: { companyId: actor.activeCompanyId, month, status: "PRELIMINAR" } });
  const prior = await prisma.commissionLine.findMany({ where: { run: { companyId: actor.activeCompanyId, status: "PAGADA" } } });
  const paidDocs = new Set(prior.flatMap((line) => line.parameters.split("docs:")[1]?.split(",").filter(Boolean) ?? []));
  for (const user of users) {
    const own = documents.filter((doc) => (doc.receivable?.sellerUserId ?? doc.quote?.sellerUserId ?? doc.requestedByUserId) === user.id || user.role !== "VENTAS");
    const services = own.filter((doc) => doc.quote?.quoteType !== "VENTA_EQUIPO" && !doc.saleId).reduce((sum, doc) => sum + doc.total, 0);
    const equipment = own.filter((doc) => doc.quote?.quoteType === "VENTA_EQUIPO" || doc.saleId).reduce((sum, doc) => sum + doc.total, 0);
    let original = 0;
    let rate = 0;
    let source = 0;
    let parameters = "";
    if (user.role === "VENTAS") {
      const serviceRate = bracketRate(services, SELLER_BRACKETS);
      const equipmentRate = bracketRate(equipment, SELLER_BRACKETS);
      original = roundMoney(services * serviceRate + equipment * equipmentRate);
      source = roundMoney(services + equipment);
      rate = source > 0 ? original / source : 0;
      parameters = `servicios ${services} al ${serviceRate}; equipo ${equipment} al ${equipmentRate}; docs:${own.map((doc) => doc.id).join(",")}`;
    } else if (user.role === "GERENTE_OPERATIVO_SYSTRON") {
      source = roundMoney(services + equipment);
      rate = 0.01;
      original = source >= 0 ? roundMoney(source * rate) : 0;
      parameters = `facturación ${source} al ${rate}; mínimo 0; docs:${documents.map((doc) => doc.id).join(",")}`;
    } else {
      source = roundMoney(services);
      rate = 0.01;
      original = roundMoney(source * rate);
      parameters = `servicios ${source} al ${rate}; venta de equipo excluida; docs:${documents.filter((doc) => doc.quote?.quoteType !== "VENTA_EQUIPO" && !doc.saleId).map((doc) => doc.id).join(",")}`;
    }
    await prisma.commissionLine.create({ data: { runId: run.id, userId: user.id, label: user.name, sourceAmount: source, rate, original, finalAmount: original, parameters } });
  }
  const cancelled = await prisma.billingDocument.findMany({ where: { companyId: actor.activeCompanyId, id: { in: [...paidDocs] }, status: { not: "EMITIDA" } } });
  for (const doc of cancelled) {
    const sourceLine = prior.find((line) => line.parameters.includes(doc.id));
    if (!sourceLine) continue;
    const negative = roundMoney(-doc.total * sourceLine.rate);
    await prisma.commissionLine.create({
      data: { runId: run.id, userId: sourceLine.userId, label: `Ajuste ${doc.folio}`, sourceAmount: doc.total, rate: sourceLine.rate, original: negative, finalAmount: negative, parameters: `cancelación posterior; docs:${doc.id}`, negativeFrom: doc.id },
    });
  }
  return run;
}

export async function adjustCommission(actor: Actor, lineId: string, adjustment: number) {
  assertCeo(actor);
  const line = await prisma.commissionLine.findFirst({ where: { id: lineId }, include: { run: true } });
  if (!line || line.run.companyId !== actor.activeCompanyId || line.run.status !== "PRELIMINAR") throw new Error("Esa comisión ya no se ajusta.");
  await prisma.commissionLine.update({ where: { id: line.id }, data: { adjustment, finalAmount: roundMoney(line.original + adjustment) } });
}

export async function payCommissions(actor: Actor, runId: string, version: number) {
  assertCeo(actor);
  const run = await prisma.commissionRun.findFirst({ where: { id: runId, companyId: actor.activeCompanyId, status: "PRELIMINAR" }, include: { lines: true } });
  if (!run) throw new Error("Ese preliminar no está abierto.");
  const updated = await prisma.commissionRun.updateMany({ where: { id: run.id, version }, data: { status: "PAGADA", version: { increment: 1 } } });
  if (updated.count === 0) throw new ConcurrencyError();
  const total = roundMoney(run.lines.reduce((sum, line) => sum + line.finalAmount, 0));
  await payFromAccount(actor.activeCompanyId, "BANCO", Math.max(0, total), `COMISION-${run.month}`, run.id);
}

export async function addLaborDocument(actor: Actor, collaboratorId: string, kind: "GENERAL" | "ACTA", title: string, note: string, occurredOn: string | null) {
  assertHr(actor);
  const row = await prisma.collaborator.findFirst({ where: { id: collaboratorId, companyId: actor.activeCompanyId } });
  if (!row) throw new Error("Esa ficha no es de esta empresa.");
  return prisma.laborDocument.create({ data: { collaboratorId, kind, title, note, occurredOn } });
}
