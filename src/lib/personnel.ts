import { hashPassword } from "./crypto";
import { prisma } from "./db";
import { allocateFolio } from "./folios";
import { ConcurrencyError } from "./form";
import { recordHistory } from "./history";
import { stampPayrollPeriod } from "./facturapi";
import { roundMoney } from "./money";
import {
  companiesForRole,
  DEFAULT_MONTHLY_PURCHASE,
  DEFAULT_PURCHASE_LIMIT,
  isPurchaseManager,
  isRole,
  type Role,
} from "./roles";

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

/** Both daily rates are required on alta and on salary edits. Zero is allowed; a missing or negative amount is not. */
export function requireDailySalaries(dailyStamped: number, dailyCash: number) {
  const stamped = roundMoney(Number(dailyStamped));
  const cash = roundMoney(Number(dailyCash));
  if (!Number.isFinite(stamped) || stamped < 0) throw new Error("El sueldo diario timbrado es obligatorio.");
  if (!Number.isFinite(cash) || cash < 0) throw new Error("El sueldo diario sin timbrar es obligatorio.");
  return { dailyStamped: stamped, dailyCash: cash };
}

export type HireKind = "NUEVO" | "MIGRADO";

export function hireKindLabel(hireKind: string | null | undefined) {
  return hireKind === "MIGRADO" ? "Migrado" : "Nuevo";
}

/** Nuevo ignora el saldo capturado. Migrado guarda días en medios (mínimo 0, paso 0.5). */
export function vacationBalanceForHire(hireKind: HireKind, vacationBalance: number) {
  if (hireKind !== "MIGRADO") return 0;
  const balance = Number(vacationBalance);
  if (!Number.isFinite(balance) || balance < 0) {
    throw new Error("El saldo inicial de vacaciones debe ser un número mayor o igual a 0.");
  }
  const halves = Math.round(balance * 2);
  if (Math.abs(balance * 2 - halves) > 1e-6) {
    throw new Error("El saldo inicial de vacaciones se captura en medios días.");
  }
  return halves / 2;
}

export function bracketRate(amount: number, brackets: Array<{ upTo: number | null; rate: number }>) {
  const ordered = [...brackets].sort((a, b) => (a.upTo ?? Number.POSITIVE_INFINITY) - (b.upTo ?? Number.POSITIVE_INFINITY));
  return ordered.find((row) => row.upTo == null || amount <= row.upTo)?.rate ?? 0;
}

export type CommissionTier = {
  targetAmount: number;
  kind: "PORCENTAJE" | "MONTO";
  value: number;
};

export type CollaboratorActivity = {
  name: string;
  targetCount: number;
};

export function normalizeCommissionTiers(input: CommissionTier[]): CommissionTier[] {
  return input
    .map((tier) => ({
      targetAmount: roundMoney(Math.max(0, Number(tier.targetAmount) || 0)),
      kind: (tier.kind === "MONTO" ? "MONTO" : "PORCENTAJE") as "PORCENTAJE" | "MONTO",
      value: roundMoney(Math.max(0, Number(tier.value) || 0)),
    }))
    .sort((a, b) => a.targetAmount - b.targetAmount);
}

export function parseCommissionTiers(json: string | null | undefined): CommissionTier[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return normalizeCommissionTiers(parsed as CommissionTier[]);
  } catch {
    return [];
  }
}

export function normalizeActivities(input: CollaboratorActivity[]): CollaboratorActivity[] {
  return input
    .map((item) => ({
      name: String(item.name ?? "").trim(),
      targetCount: Math.max(0, Math.trunc(Number(item.targetCount) || 0)),
    }))
    .filter((item) => item.name.length > 0);
}

export function parseActivities(json: string | null | undefined): CollaboratorActivity[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return normalizeActivities(parsed as CollaboratorActivity[]);
  } catch {
    return [];
  }
}

export function collaboratorDisplayStatus(status: string): "ACTIVO" | "INACTIVO" {
  return status === "ACTIVO" ? "ACTIVO" : "INACTIVO";
}

export function filterCollaborators<
  T extends {
    status: string;
    jobTitle?: string | null;
    user: { name: string; role: string };
  },
>(rows: T[], filters: { q?: string; estado?: string; puesto?: string }): T[] {
  const q = (filters.q ?? "").trim().toLowerCase();
  const estado = (filters.estado ?? "ACTIVOS").toUpperCase();
  const puesto = (filters.puesto ?? "").trim();
  return rows.filter((row) => {
    const isActive = collaboratorDisplayStatus(row.status) === "ACTIVO";
    if (estado === "ACTIVOS" && !isActive) return false;
    if (estado === "INACTIVOS" && isActive) return false;
    const rowJob = (row.jobTitle && row.jobTitle.trim()) || row.user.role;
    if (puesto && rowJob !== puesto && row.user.role !== puesto) return false;
    if (q && !row.user.name.toLowerCase().includes(q) && !rowJob.toLowerCase().includes(q)) return false;
    return true;
  });
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
  input: {
    userId: string;
    hireKind: HireKind;
    hiredAt: string;
    bossUserId: string | null;
    dailyStamped: number;
    dailyCash: number;
    vacationBalance: number;
    rfc: string | null;
    overtimeRate: number;
    jobTitle?: string | null;
    workSchedule?: string | null;
    birthDate?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    emergencyContact?: string | null;
    curp?: string | null;
    nss?: string | null;
  },
) {
  assertCeo(actor);
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
  const salaries = requireDailySalaries(input.dailyStamped, input.dailyCash);
  const row = await prisma.collaborator.create({
    data: {
      companyId: actor.activeCompanyId,
      userId: user.id,
      bossUserId: input.bossUserId,
      hireKind: input.hireKind,
      status: "ACTIVO",
      hiredAt: noonUtc(input.hiredAt),
      vacationBalance: vacationBalanceForHire(input.hireKind, input.vacationBalance),
      dailyStamped: salaries.dailyStamped,
      dailyCash: salaries.dailyCash,
      overtimeRate: profile.exempt ? 0 : input.overtimeRate,
      rfc: input.rfc,
      curp: input.curp ?? null,
      nss: input.nss ?? null,
      jobTitle: input.jobTitle?.trim() || null,
      workSchedule: input.workSchedule?.trim() || "Lunes a viernes 09:00 a 18:00",
      birthDate: input.birthDate?.trim() || null,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      address: input.address?.trim() || null,
      emergencyContact: input.emergencyContact?.trim() || null,
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

export async function createCollaboratorComplete(
  actor: Actor,
  input: {
    // 1. Datos personales
    name: string;
    phone: string;
    birthDate?: string | null;
    email?: string | null;
    address?: string | null;
    emergencyContact?: string | null;
    // 2. Acceso al sistema y credenciales
    role: string;
    username: string;
    password: string;
    // 3. Datos laborales
    jobTitle: string;
    bossUserId?: string | null;
    hireKind?: HireKind;
    hiredAt: string;
    vacationBalance?: number;
    workSchedule: string;
    // 4. Datos fiscales y de seguridad social
    rfc: string;
    curp: string;
    nss: string;
    // 5. Sueldo diario (timbrado y sin timbrar)
    dailyStamped: number;
    dailyCash: number;
    // 6. Cuenta bancaria
    bankName: string;
    bankAccount: string;
    // 7. Comisión por facturación (opcional)
    commissionEnabled?: boolean;
    commissionTiers?: CommissionTier[];
    // 8. Actividades (opcional)
    activitiesEnabled?: boolean;
    activities?: CollaboratorActivity[];
    // 9. Bonos (opcional)
    bonusesEnabled?: boolean;
    punctualityBonusEnabled?: boolean;
    punctualityBonus?: number;
    productivityBonusEnabled?: boolean;
    productivityBonus?: number;
  },
) {
  assertCeo(actor);
  const cleanName = input.name.trim();
  if (!cleanName) throw new Error("El nombre completo es obligatorio.");
  const cleanPhone = input.phone.trim();
  if (!cleanPhone) throw new Error("El teléfono es obligatorio.");
  if (!isRole(input.role) || input.role === "ADMINISTRADOR" || input.role === "CEO") {
    throw new Error("Selecciona un rol válido para el colaborador.");
  }
  const cleanUsername = input.username.trim();
  if (!cleanUsername) throw new Error("El usuario de acceso es obligatorio.");
  const cleanPassword = input.password.trim();
  if (!cleanPassword) throw new Error("La contraseña es obligatoria.");
  const cleanJobTitle = input.jobTitle.trim();
  if (!cleanJobTitle) throw new Error("El puesto es obligatorio.");
  const hireKind: HireKind = input.hireKind === "MIGRADO" ? "MIGRADO" : "NUEVO";
  const vacationBalance = vacationBalanceForHire(hireKind, input.vacationBalance ?? 0);
  const cleanHiredAt = input.hiredAt.trim();
  if (!cleanHiredAt) throw new Error("La fecha de ingreso es obligatoria.");
  const cleanSchedule = input.workSchedule.trim();
  if (!cleanSchedule) throw new Error("El horario o jornada es obligatorio.");
  const cleanRfc = input.rfc.trim().toUpperCase();
  if (!cleanRfc) throw new Error("El RFC es obligatorio.");
  const cleanCurp = input.curp.trim().toUpperCase();
  if (!cleanCurp) throw new Error("La CURP es obligatoria.");
  const cleanNss = input.nss.trim();
  if (!cleanNss) throw new Error("El NSS es obligatorio.");
  const salaries = requireDailySalaries(input.dailyStamped, input.dailyCash);
  const cleanBankName = input.bankName.trim();
  if (!cleanBankName) throw new Error("El banco es obligatorio.");
  const cleanBankAccount = input.bankAccount.trim();
  if (!cleanBankAccount) throw new Error("La cuenta o CLABE es obligatoria.");

  const profile = laborProfile(input.role);
  const bossUserId = input.bossUserId?.trim() || null;
  if (!profile.exempt && !bossUserId) {
    throw new Error("El jefe directo es obligatorio.");
  }
  if (bossUserId) {
    const boss = await prisma.user.findFirst({ where: { id: bossUserId, active: true } });
    if (!boss) throw new Error("El jefe directo seleccionado no existe.");
  }

  const existingUser = await prisma.user.findUnique({ where: { username: cleanUsername } });
  if (existingUser) {
    throw new Error(`El usuario "${cleanUsername}" ya está registrado. Elige otro identificador.`);
  }

  const sortedTiers = normalizeCommissionTiers(input.commissionTiers ?? []);
  const normalizedActs = normalizeActivities(input.activities ?? []);

  const user = await prisma.user.create({
    data: {
      username: cleanUsername,
      name: cleanName,
      passwordHash: hashPassword(cleanPassword),
      role: input.role,
      companyId: companiesForRole(input.role) === "both" ? null : actor.activeCompanyId,
      active: true,
      monthlyPurchaseBudget: isPurchaseManager(input.role) ? DEFAULT_MONTHLY_PURCHASE : null,
      purchaseLimit: isPurchaseManager(input.role) ? DEFAULT_PURCHASE_LIMIT : null,
      discountLimitPct: input.role === "VENTAS" ? 15 : null,
    },
  });

  const row = await prisma.collaborator.create({
    data: {
      companyId: actor.activeCompanyId,
      userId: user.id,
      bossUserId,
      hireKind,
      status: "ACTIVO",
      hiredAt: noonUtc(cleanHiredAt),
      vacationBalance,
      birthDate: input.birthDate?.trim() || null,
      phone: cleanPhone,
      email: input.email?.trim() || null,
      address: input.address?.trim() || null,
      emergencyContact: input.emergencyContact?.trim() || null,
      jobTitle: cleanJobTitle,
      workSchedule: cleanSchedule,
      rfc: cleanRfc,
      curp: cleanCurp,
      nss: cleanNss,
      dailyStamped: salaries.dailyStamped,
      dailyCash: salaries.dailyCash,
      overtimeRate: 0,
      bankName: cleanBankName,
      bankAccount: cleanBankAccount,
      credentialPasswordPreview: cleanPassword,
      commissionEnabled: Boolean(input.commissionEnabled),
      commissionTiersJson: JSON.stringify(sortedTiers),
      activitiesEnabled: Boolean(input.activitiesEnabled),
      activitiesJson: JSON.stringify(normalizedActs),
      bonusesEnabled: Boolean(input.bonusesEnabled),
      punctualityBonusEnabled: Boolean(input.punctualityBonusEnabled),
      punctualityBonus: roundMoney(Math.max(0, Number(input.punctualityBonus) || 0)),
      productivityBonusEnabled: Boolean(input.productivityBonusEnabled),
      productivityBonus: roundMoney(Math.max(0, Number(input.productivityBonus) || 0)),
      exemptBenefits: profile.exempt,
    },
  });

  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "COLABORADOR",
    entityId: row.id,
    action: "ALTA",
    summary: `Alta de colaborador ${cleanName} (${cleanJobTitle}) con usuario ${cleanUsername}.`,
    authorUserId: actor.userId,
  });

  return row;
}

export async function updateBankAccountSection(
  actor: Actor,
  collaboratorId: string,
  version: number,
  input: { bankName: string; bankAccount: string },
) {
  assertCeo(actor);
  const row = await prisma.collaborator.findFirst({ where: { id: collaboratorId, companyId: actor.activeCompanyId }, include: { user: true } });
  if (!row) throw new Error("Esa ficha no es de esta empresa.");
  const cleanBank = input.bankName.trim();
  const cleanAccount = input.bankAccount.trim();
  if (!cleanBank) throw new Error("El banco es obligatorio.");
  if (!cleanAccount) throw new Error("La cuenta o CLABE es obligatoria.");
  const updated = await prisma.collaborator.updateMany({
    where: { id: row.id, version },
    data: {
      bankName: cleanBank,
      bankAccount: cleanAccount,
      version: { increment: 1 },
    },
  });
  if (updated.count === 0) throw new ConcurrencyError();
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "COLABORADOR",
    entityId: row.id,
    action: "CUENTA_BANCARIA",
    summary: `Actualizó cuenta bancaria de ${row.user.name} (${cleanBank}).`,
    authorUserId: actor.userId,
  });
}

export async function updateCollaboratorCredentialsSection(
  actor: Actor,
  collaboratorId: string,
  version: number,
  input: { username: string; role: string; newPassword?: string | null },
) {
  assertCeo(actor);
  const row = await prisma.collaborator.findFirst({ where: { id: collaboratorId, companyId: actor.activeCompanyId }, include: { user: true } });
  if (!row) throw new Error("Esa ficha no es de esta empresa.");
  const cleanUsername = input.username.trim();
  if (!cleanUsername) throw new Error("El usuario es obligatorio.");
  if (!isRole(input.role) || input.role === "ADMINISTRADOR") {
    throw new Error("Selecciona un rol válido.");
  }
  if (cleanUsername !== row.user.username) {
    const duplicate = await prisma.user.findUnique({ where: { username: cleanUsername } });
    if (duplicate && duplicate.id !== row.userId) {
      throw new Error(`El usuario "${cleanUsername}" ya está en uso.`);
    }
  }
  const cleanPassword = input.newPassword?.trim() || null;
  await prisma.user.update({
    where: { id: row.userId },
    data: {
      username: cleanUsername,
      role: input.role,
      ...(cleanPassword ? { passwordHash: hashPassword(cleanPassword) } : {}),
    },
  });
  const updated = await prisma.collaborator.updateMany({
    where: { id: row.id, version },
    data: {
      ...(cleanPassword ? { credentialPasswordPreview: cleanPassword } : {}),
      version: { increment: 1 },
    },
  });
  if (updated.count === 0) throw new ConcurrencyError();
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "COLABORADOR",
    entityId: row.id,
    action: "CREDENCIALES",
    summary: `Actualizó credenciales de acceso de ${row.user.name} (usuario: ${cleanUsername}).`,
    authorUserId: actor.userId,
  });
}

export async function updatePersonalDataSection(
  actor: Actor,
  collaboratorId: string,
  version: number,
  input: {
    name: string;
    birthDate: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    emergencyContact: string | null;
  },
) {
  assertCeo(actor);
  const row = await prisma.collaborator.findFirst({ where: { id: collaboratorId, companyId: actor.activeCompanyId }, include: { user: true } });
  if (!row) throw new Error("Esa ficha no es de esta empresa.");
  const cleanName = input.name.trim();
  if (!cleanName) throw new Error("El nombre es obligatorio.");
  const updated = await prisma.collaborator.updateMany({
    where: { id: row.id, version },
    data: {
      birthDate: input.birthDate?.trim() || null,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      address: input.address?.trim() || null,
      emergencyContact: input.emergencyContact?.trim() || null,
      version: { increment: 1 },
    },
  });
  if (updated.count === 0) throw new ConcurrencyError();
  if (cleanName !== row.user.name) {
    await prisma.user.update({ where: { id: row.userId }, data: { name: cleanName } });
  }
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "COLABORADOR",
    entityId: row.id,
    action: "DATOS_PERSONALES",
    summary: `Actualizó datos personales de ${cleanName}.`,
    authorUserId: actor.userId,
  });
}

export async function updateLaborDataSection(
  actor: Actor,
  collaboratorId: string,
  version: number,
  input: {
    jobTitle: string | null;
    bossUserId: string | null;
    hiredAt: string;
    workSchedule: string;
  },
) {
  assertCeo(actor);
  const row = await prisma.collaborator.findFirst({
    where: { id: collaboratorId, companyId: actor.activeCompanyId },
    include: { user: true, payrollLines: { include: { period: true }, take: 1 } },
  });
  if (!row) throw new Error("Esa ficha no es de esta empresa.");
  if (input.bossUserId) {
    const boss = await prisma.user.findFirst({ where: { id: input.bossUserId, active: true } });
    if (!boss) throw new Error("El jefe seleccionado no existe.");
  }
  const hasClosedProcesses = row.payrollLines.some(
    (line) => line.period.status === "AUTORIZADA" || line.period.status === "CERRADA",
  );
  const nextHiredAt = hasClosedProcesses ? row.hiredAt : noonUtc(input.hiredAt);
  const updated = await prisma.collaborator.updateMany({
    where: { id: row.id, version },
    data: {
      jobTitle: input.jobTitle?.trim() || null,
      bossUserId: input.bossUserId || null,
      hiredAt: nextHiredAt,
      workSchedule: input.workSchedule.trim() || "Lunes a viernes 09:00 a 18:00",
      version: { increment: 1 },
    },
  });
  if (updated.count === 0) throw new ConcurrencyError();
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "COLABORADOR",
    entityId: row.id,
    action: "DATOS_LABORALES",
    summary: `Actualizó datos laborales de ${row.user.name}.`,
    authorUserId: actor.userId,
  });
}

export async function updateFiscalDataSection(
  actor: Actor,
  collaboratorId: string,
  version: number,
  input: { rfc: string | null; curp: string | null; nss: string | null },
) {
  assertCeo(actor);
  const row = await prisma.collaborator.findFirst({ where: { id: collaboratorId, companyId: actor.activeCompanyId }, include: { user: true } });
  if (!row) throw new Error("Esa ficha no es de esta empresa.");
  const updated = await prisma.collaborator.updateMany({
    where: { id: row.id, version },
    data: {
      rfc: input.rfc?.trim() || null,
      curp: input.curp?.trim() || null,
      nss: input.nss?.trim() || null,
      version: { increment: 1 },
    },
  });
  if (updated.count === 0) throw new ConcurrencyError();
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "COLABORADOR",
    entityId: row.id,
    action: "DATOS_FISCALES",
    summary: `Actualizó datos fiscales y de seguridad social de ${row.user.name}.`,
    authorUserId: actor.userId,
  });
}

export async function updateCommissionSection(
  actor: Actor,
  collaboratorId: string,
  version: number,
  enabled: boolean,
  tiers: CommissionTier[],
) {
  assertCeo(actor);
  const row = await prisma.collaborator.findFirst({ where: { id: collaboratorId, companyId: actor.activeCompanyId }, include: { user: true } });
  if (!row) throw new Error("Esa ficha no es de esta empresa.");
  const sortedTiers = normalizeCommissionTiers(tiers);
  const updated = await prisma.collaborator.updateMany({
    where: { id: row.id, version },
    data: {
      commissionEnabled: enabled,
      commissionTiersJson: JSON.stringify(sortedTiers),
      version: { increment: 1 },
    },
  });
  if (updated.count === 0) throw new ConcurrencyError();
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "COLABORADOR",
    entityId: row.id,
    action: "COMISION",
    summary: `Comisión por facturación de ${row.user.name} quedó ${enabled ? "habilitada" : "deshabilitada"} (${sortedTiers.length} escalafones).`,
    authorUserId: actor.userId,
  });
}

export async function updateActivitiesSection(
  actor: Actor,
  collaboratorId: string,
  version: number,
  enabled: boolean,
  activities: CollaboratorActivity[],
) {
  assertCeo(actor);
  const row = await prisma.collaborator.findFirst({ where: { id: collaboratorId, companyId: actor.activeCompanyId }, include: { user: true } });
  if (!row) throw new Error("Esa ficha no es de esta empresa.");
  const normalized = normalizeActivities(activities);
  const updated = await prisma.collaborator.updateMany({
    where: { id: row.id, version },
    data: {
      activitiesEnabled: enabled,
      activitiesJson: JSON.stringify(normalized),
      version: { increment: 1 },
    },
  });
  if (updated.count === 0) throw new ConcurrencyError();
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "COLABORADOR",
    entityId: row.id,
    action: "ACTIVIDADES",
    summary: `Actividades comerciales de ${row.user.name} quedaron ${enabled ? "habilitadas" : "deshabilitadas"} (${normalized.length} actividades).`,
    authorUserId: actor.userId,
  });
}

export async function updateBonusesSection(
  actor: Actor,
  collaboratorId: string,
  version: number,
  input: {
    bonusesEnabled: boolean;
    punctualityBonusEnabled: boolean;
    punctualityBonus: number;
    productivityBonusEnabled: boolean;
    productivityBonus: number;
  },
) {
  assertCeo(actor);
  const row = await prisma.collaborator.findFirst({ where: { id: collaboratorId, companyId: actor.activeCompanyId }, include: { user: true } });
  if (!row) throw new Error("Esa ficha no es de esta empresa.");
  const updated = await prisma.collaborator.updateMany({
    where: { id: row.id, version },
    data: {
      bonusesEnabled: input.bonusesEnabled,
      punctualityBonusEnabled: input.punctualityBonusEnabled,
      punctualityBonus: roundMoney(Math.max(0, input.punctualityBonus)),
      productivityBonusEnabled: input.productivityBonusEnabled,
      productivityBonus: roundMoney(Math.max(0, input.productivityBonus)),
      version: { increment: 1 },
    },
  });
  if (updated.count === 0) throw new ConcurrencyError();
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "COLABORADOR",
    entityId: row.id,
    action: "BONOS",
    summary: `Bonos de ${row.user.name} actualizados (${input.bonusesEnabled ? "habilitados" : "deshabilitados"}).`,
    authorUserId: actor.userId,
  });
}

export async function toggleCollaboratorActiveStatus(
  actor: Actor,
  collaboratorId: string,
  version: number,
  enable: boolean,
) {
  assertCeo(actor);
  const row = await prisma.collaborator.findFirst({ where: { id: collaboratorId, companyId: actor.activeCompanyId }, include: { user: true } });
  if (!row) throw new Error("Esa ficha no es de esta empresa.");
  const nextStatus = enable ? "ACTIVO" : "INACTIVO";
  const updated = await prisma.collaborator.updateMany({
    where: { id: row.id, version },
    data: { status: nextStatus, version: { increment: 1 } },
  });
  if (updated.count === 0) throw new ConcurrencyError();
  await prisma.user.update({ where: { id: row.userId }, data: { active: enable } });
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "COLABORADOR",
    entityId: row.id,
    action: enable ? "HABILITAR" : "DESHABILITAR",
    summary: enable
      ? `${row.user.name} fue habilitado nuevamente en la operación.`
      : `${row.user.name} fue deshabilitado. Conserva todo su historial e información.`,
    authorUserId: actor.userId,
  });
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
  const salaries = requireDailySalaries(dailyStamped, dailyCash);
  const row = await prisma.collaborator.findFirst({ where: { id: collaboratorId, companyId: actor.activeCompanyId }, include: { user: true } });
  if (!row) throw new Error("Esa ficha no es de esta empresa.");
  const updated = await prisma.collaborator.updateMany({
    where: { id: row.id, version },
    data: { dailyStamped: salaries.dailyStamped, dailyCash: salaries.dailyCash, overtimeRate: row.exemptBenefits ? 0 : overtimeRate, version: { increment: 1 } },
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

export async function requestVacation(actor: Actor, collaboratorId: string, startDate: string, endDate: string, comment?: string | null) {
  const row = await prisma.collaborator.findFirst({ where: { id: collaboratorId, companyId: actor.activeCompanyId, status: "ACTIVO" }, include: { user: true } });
  if (!row || row.exemptBenefits) throw new Error("Ese colaborador no toma vacaciones por este proceso.");
  const isBoss = row.bossUserId === actor.userId;
  const isCeo = actor.role === "CEO" || actor.role === "ADMINISTRADOR";
  const isCoord = actor.role === "COORDINACION_ADMINISTRACION";
  if (!isBoss && !isCeo && !isCoord) throw new Error("Las vacaciones las registra Coordinación, el jefe directo o el CEO.");
  const days = weekdaysBetween(startDate, endDate);
  if (days.length === 0) throw new Error("El rango no tiene días hábiles.");
  if (row.vacationBalance > 0 && days.length > row.vacationBalance) throw new Error("El saldo de vacaciones no alcanza.");
  const auto = isCeo && isBoss && comment === undefined;
  const vacation = await prisma.vacationRequest.create({
    data: {
      collaboratorId: row.id,
      startDate,
      endDate,
      days: days.length,
      comment: comment?.trim() || null,
      status: auto ? "AUTORIZADA" : "PENDIENTE",
      requestedByUserId: actor.userId,
      decidedByUserId: auto ? actor.userId : null,
      decidedAt: auto ? new Date() : null,
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
  const nextBalance = Math.max(0, roundMoney(balance - days.length));
  await prisma.collaborator.update({ where: { id: collaboratorId }, data: { vacationBalance: nextBalance } });
  for (const workDate of days) {
    await prisma.attendanceDay.upsert({
      where: { collaboratorId_workDate: { collaboratorId, workDate } },
      update: { status: "VACACIONES", justified: true, justificationStatus: "JUSTIFICADA", paidLeave: true, entryAt: null, exitAt: null },
      create: { collaboratorId, workDate, status: "VACACIONES", justified: true, justificationStatus: "JUSTIFICADA", paidLeave: true },
    });
  }
}

export async function decideVacation(actor: Actor, vacationId: string, version: number, authorized: boolean) {
  assertCeo(actor);
  const row = await prisma.vacationRequest.findFirst({ where: { id: vacationId, status: "PENDIENTE" }, include: { collaborator: { include: { user: true } } } });
  if (!row || row.collaborator.companyId !== actor.activeCompanyId) throw new Error("Esa solicitud no está pendiente en esta empresa.");
  const days = weekdaysBetween(row.startDate, row.endDate);
  if (authorized && row.collaborator.vacationBalance > 0 && days.length > row.collaborator.vacationBalance) throw new Error("El saldo ya no alcanza.");
  const updated = await prisma.vacationRequest.updateMany({
    where: { id: row.id, version },
    data: {
      status: authorized ? "AUTORIZADA" : "RECHAZADA",
      days: days.length,
      decidedByUserId: actor.userId,
      decidedAt: new Date(),
      version: { increment: 1 },
    },
  });
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

export async function updateAttendanceMode(
  actor: Actor,
  collaboratorId: string,
  version: number,
  mode: "AUTOMATICA" | "MANUAL",
) {
  assertHr(actor);
  const row = await prisma.collaborator.findFirst({ where: { id: collaboratorId, companyId: actor.activeCompanyId }, include: { user: true } });
  if (!row) throw new Error("Esa ficha no es de esta empresa.");
  const updated = await prisma.collaborator.updateMany({
    where: { id: row.id, version },
    data: { attendanceMode: mode, version: { increment: 1 } },
  });
  if (updated.count === 0) throw new ConcurrencyError();
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "ASISTENCIA",
    entityId: row.id,
    action: "MODO",
    summary: `Modo de asistencia de ${row.user.name} cambió a ${mode === "MANUAL" ? "Manual" : "Automática"}.`,
    authorUserId: actor.userId,
  });
}

function buildMexicoTimestamp(workDate: string, timeStr: string) {
  const [h, m] = timeStr.split(":").map(Number);
  const d = noonUtc(workDate);
  d.setUTCHours((Number.isFinite(h) ? h : 9) + 6, Number.isFinite(m) ? m : 0, 0, 0);
  return d;
}

export async function registerManualEntry(
  actor: Actor,
  collaboratorId: string,
  workDate: string,
  entryTime: string,
) {
  assertHr(actor);
  const row = await prisma.collaborator.findFirst({ where: { id: collaboratorId, companyId: actor.activeCompanyId }, include: { user: true } });
  if (!row) throw new Error("Esa ficha no es de esta empresa.");
  const entryAt = buildMexicoTimestamp(workDate, entryTime);
  await prisma.attendanceDay.upsert({
    where: { collaboratorId_workDate: { collaboratorId: row.id, workDate } },
    update: { entryAt, status: "NORMAL", justified: true, justificationStatus: "JUSTIFICADA" },
    create: { collaboratorId: row.id, workDate, entryAt, status: "NORMAL", justified: true, justificationStatus: "JUSTIFICADA" },
  });
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "ASISTENCIA",
    entityId: row.id,
    action: "ENTRADA_MANUAL",
    summary: `Entrada manual de ${row.user.name} el ${workDate} (${entryTime}).`,
    authorUserId: actor.userId,
  });
}

export async function registerManualExit(
  actor: Actor,
  collaboratorId: string,
  workDate: string,
  exitTime: string,
) {
  assertHr(actor);
  const row = await prisma.collaborator.findFirst({ where: { id: collaboratorId, companyId: actor.activeCompanyId }, include: { user: true } });
  if (!row) throw new Error("Esa ficha no es de esta empresa.");
  const existing = await prisma.attendanceDay.findUnique({ where: { collaboratorId_workDate: { collaboratorId: row.id, workDate } } });
  if (!existing || !existing.entryAt) {
    throw new Error("No existe una entrada previa registrada en esa jornada para poder registrar la salida.");
  }
  const exitAt = buildMexicoTimestamp(workDate, exitTime);
  await prisma.attendanceDay.update({
    where: { id: existing.id },
    data: { exitAt, status: existing.status === "EN_JORNADA" ? "NORMAL" : existing.status },
  });
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "ASISTENCIA",
    entityId: row.id,
    action: "SALIDA_MANUAL",
    summary: `Salida manual de ${row.user.name} el ${workDate} (${exitTime}).`,
    authorUserId: actor.userId,
  });
}

export async function registerAttendanceIncidence(
  actor: Actor,
  collaboratorId: string,
  workDate: string,
  kind: "AUSENCIA" | "RETARDO",
  reason: string,
  asksJustification: boolean,
) {
  assertHr(actor);
  const cleanReason = reason.trim();
  if (!cleanReason) throw new Error("El motivo es obligatorio.");
  const row = await prisma.collaborator.findFirst({ where: { id: collaboratorId, companyId: actor.activeCompanyId }, include: { user: true } });
  if (!row) throw new Error("Esa ficha no es de esta empresa.");
  const justificationStatus = asksJustification ? "PENDIENTE_VALIDACION_CEO" : "NO_JUSTIFICADA";
  await prisma.attendanceDay.upsert({
    where: { collaboratorId_workDate: { collaboratorId: row.id, workDate } },
    update: {
      status: kind,
      note: cleanReason,
      justified: false,
      justificationStatus,
      decidedByUserId: null,
      decidedAt: null,
    },
    create: {
      collaboratorId: row.id,
      workDate,
      status: kind,
      note: cleanReason,
      justified: false,
      justificationStatus,
    },
  });
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "ASISTENCIA",
    entityId: row.id,
    action: kind === "AUSENCIA" ? "FALTA" : "RETARDO",
    summary: `${kind === "AUSENCIA" ? "Falta" : "Retardo"} de ${row.user.name} el ${workDate} (${asksJustification ? "pendiente de validación del CEO" : "no justificada"}).`,
    authorUserId: actor.userId,
  });
}

export async function decideAttendanceJustification(
  actor: Actor,
  attendanceId: string,
  version: number,
  approved: boolean,
) {
  assertCeo(actor);
  const row = await prisma.attendanceDay.findFirst({
    where: { id: attendanceId },
    include: { collaborator: { include: { user: true } } },
  });
  if (!row || row.collaborator.companyId !== actor.activeCompanyId) throw new Error("Ese registro de asistencia no es de esta empresa.");
  const updated = await prisma.attendanceDay.updateMany({
    where: { id: row.id, version },
    data: {
      justified: approved,
      justificationStatus: approved ? "JUSTIFICADA" : "NO_JUSTIFICADA",
      decidedByUserId: actor.userId,
      decidedAt: new Date(),
      version: { increment: 1 },
    },
  });
  if (updated.count === 0) throw new ConcurrencyError();
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "ASISTENCIA",
    entityId: row.collaboratorId,
    action: "VALIDACION_JUSTIFICACION",
    summary: `${row.status === "RETARDO" ? "Retardo" : "Falta"} de ${row.collaborator.user.name} el ${row.workDate} fue ${approved ? "validada como justificada" : "rechazada (no justificada)"}.`,
    authorUserId: actor.userId,
  });
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

export async function requestOvertime(
  actor: Actor,
  collaboratorId: string,
  workDate: string,
  startedAtOrHours: string | number,
  endedAtOrReason: string,
  maybeReason?: string,
) {
  if (typeof startedAtOrHours === "number" || maybeReason === undefined) {
    return requestOvertimeByHours(actor, collaboratorId, workDate, Number(startedAtOrHours), endedAtOrReason);
  }
  const hours = hoursBetween(startedAtOrHours, endedAtOrReason);
  return requestOvertimeByHours(actor, collaboratorId, workDate, hours, maybeReason);
}

export async function requestOvertimeByHours(
  actor: Actor,
  collaboratorId: string,
  workDate: string,
  hoursInput: number,
  reason: string,
) {
  const row = await prisma.collaborator.findFirst({ where: { id: collaboratorId, companyId: actor.activeCompanyId }, include: { user: true } });
  if (!row) throw new Error("Esa ficha no es de esta empresa.");
  if (row.exemptBenefits) throw new Error("Ese colaborador no genera horas extra.");
  const isHrOrCeo =
    actor.role === "ADMINISTRADOR" ||
    actor.role === "CEO" ||
    actor.role === "COORDINACION_ADMINISTRACION";
  if (!isHrOrCeo) {
    const profile = laborProfile(row.user.role as Role);
    if (profile.overtimeByManager) {
      if (actor.role !== "GERENTE_OPERATIVO_SERVOMOTORES") {
        throw new Error("Las horas extra del ayudante las registra su gerente.");
      }
    } else if (actor.userId !== row.userId && row.bossUserId !== actor.userId) {
      throw new Error("El empleado o su jefe directo registra sus horas extra.");
    }
  }
  const hours = roundMoney(Number(hoursInput));
  if (!Number.isFinite(hours) || hours <= 0) throw new Error("La cantidad de horas debe ser mayor a cero.");
  const cleanReason = reason.trim();
  if (!cleanReason) throw new Error("El motivo es obligatorio.");
  const overtime = await prisma.overtimeRequest.create({
    data: {
      collaboratorId: row.id,
      workDate,
      startedAt: "18:00",
      endedAt: "19:00",
      hours,
      reason: cleanReason,
      status: "PENDIENTE_CEO",
      requestedByUserId: actor.userId,
    },
  });
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "HORAS",
    entityId: overtime.id,
    action: "ALTA",
    summary: `${row.user.name} tiene ${hours} h extra pendientes de autorización.`,
    authorUserId: actor.userId,
  });
  return overtime;
}

export async function reviewOvertime(actor: Actor, overtimeId: string, version: number, approved: boolean, authorizedHoursOverride?: number) {
  const row = await prisma.overtimeRequest.findFirst({ where: { id: overtimeId }, include: { collaborator: { include: { user: true } } } });
  if (!row || row.collaborator.companyId !== actor.activeCompanyId) throw new Error("Esa solicitud no es de esta empresa.");
  const ceo = actor.role === "CEO" || actor.role === "ADMINISTRADOR";
  if (row.status === "PENDIENTE_JEFE") {
    if (row.collaborator.bossUserId !== actor.userId && !ceo) throw new Error("La valida el jefe directo.");
    if (!approved) {
      await prisma.overtimeRequest.updateMany({
        where: { id: row.id, version },
        data: { status: "RECHAZADA", authorizedByUserId: actor.userId, authorizedAt: new Date(), version: { increment: 1 } },
      });
      return;
    }
    if (ceo && row.collaborator.bossUserId === actor.userId) {
      await authorizeOvertime(actor, row.id, version, authorizedHoursOverride);
      return;
    }
    const updated = await prisma.overtimeRequest.updateMany({ where: { id: row.id, version }, data: { status: "PENDIENTE_CEO", version: { increment: 1 } } });
    if (updated.count === 0) throw new ConcurrencyError();
    return;
  }
  if (row.status === "PENDIENTE_CEO") {
    if (actor.role !== "ADMINISTRADOR" && actor.role !== "CEO" && actor.role !== "COORDINACION_ADMINISTRACION") {
      throw new Error("Esa decisión es del CEO.");
    }
    if (!approved) {
      await prisma.overtimeRequest.updateMany({
        where: { id: row.id, version },
        data: { status: "RECHAZADA", authorizedByUserId: actor.userId, authorizedAt: new Date(), version: { increment: 1 } },
      });
      return;
    }
    await authorizeOvertime(actor, row.id, version, authorizedHoursOverride);
  }
}

async function authorizeOvertime(actor: Actor, overtimeId: string, version: number, authorizedHoursOverride?: number) {
  const row = await prisma.overtimeRequest.findFirst({ where: { id: overtimeId }, include: { collaborator: true } });
  if (!row) throw new Error("No se encontró la solicitud.");
  const finalHours =
    authorizedHoursOverride != null && Number.isFinite(authorizedHoursOverride) && authorizedHoursOverride > 0
      ? roundMoney(authorizedHoursOverride)
      : row.hours;
  const range = weekRange(row.workDate);
  const prior = await prisma.overtimeRequest.findMany({
    where: { collaboratorId: row.collaboratorId, status: { in: ["AUTORIZADA", "PAGADA"] }, workDate: { gte: range.start, lte: range.end }, id: { not: row.id } },
  });
  const previousHours = prior.reduce((sum, item) => sum + (item.authorizedHours ?? item.hours), 0);
  const bands = overtimeBands(previousHours, finalHours);
  const amount = overtimeAmount(bands.doubleHours, bands.tripleHours, row.collaborator.overtimeRate);
  const split = splitBySalary(amount, row.collaborator.dailyStamped, row.collaborator.dailyCash);
  const updated = await prisma.overtimeRequest.updateMany({
    where: { id: row.id, version },
    data: {
      status: "AUTORIZADA",
      authorizedHours: finalHours,
      authorizedByUserId: actor.userId,
      authorizedAt: new Date(),
      frozenRate: row.collaborator.overtimeRate,
      doubleHours: bands.doubleHours,
      tripleHours: bands.tripleHours,
      amountStamped: split.stamped,
      amountCash: split.cash,
      version: { increment: 1 },
    },
  });
  if (updated.count === 0) throw new ConcurrencyError();
  await recordHistory({ companyId: actor.activeCompanyId, entityType: "HORAS", entityId: row.id, action: "AUTORIZACION", summary: `Quedaron ${bands.doubleHours} h dobles y ${bands.tripleHours} h triples (${finalHours} h autorizadas de ${row.hours} h solicitadas). La tarifa quedó congelada.`, authorUserId: actor.userId });
}

export async function requestCompensation(
  actor: Actor,
  collaboratorId: string,
  concept: string,
  requestedAmount: number,
  comment?: string | null,
) {
  assertHr(actor);
  const row = await prisma.collaborator.findFirst({ where: { id: collaboratorId, companyId: actor.activeCompanyId }, include: { user: true } });
  if (!row) throw new Error("Esa ficha no es de esta empresa.");
  const cleanConcept = concept.trim();
  if (!cleanConcept) throw new Error("El concepto o motivo es obligatorio.");
  const amount = roundMoney(Number(requestedAmount));
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("El monto solicitado debe ser mayor a cero.");
  const created = await prisma.compensationRequest.create({
    data: {
      collaboratorId: row.id,
      concept: cleanConcept,
      requestedAmount: amount,
      comment: comment?.trim() || null,
      status: "PENDIENTE",
      requestedByUserId: actor.userId,
    },
  });
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "COMPENSACION",
    entityId: created.id,
    action: "ALTA",
    summary: `Solicitud de compensación para ${row.user.name}: ${cleanConcept} por $${amount}.`,
    authorUserId: actor.userId,
  });
  return created;
}

export async function decideCompensation(
  actor: Actor,
  compensationId: string,
  version: number,
  authorized: boolean,
  authorizedAmountOverride?: number,
) {
  assertCeo(actor);
  const row = await prisma.compensationRequest.findFirst({
    where: { id: compensationId, status: "PENDIENTE" },
    include: { collaborator: { include: { user: true } } },
  });
  if (!row || row.collaborator.companyId !== actor.activeCompanyId) throw new Error("Esa solicitud de compensación no está pendiente en esta empresa.");
  const finalAmount =
    authorized
      ? authorizedAmountOverride != null && Number.isFinite(authorizedAmountOverride) && authorizedAmountOverride >= 0
        ? roundMoney(authorizedAmountOverride)
        : row.requestedAmount
      : null;
  const updated = await prisma.compensationRequest.updateMany({
    where: { id: row.id, version },
    data: {
      status: authorized ? "AUTORIZADA" : "RECHAZADA",
      authorizedAmount: finalAmount,
      decidedByUserId: actor.userId,
      decidedAt: new Date(),
      version: { increment: 1 },
    },
  });
  if (updated.count === 0) throw new ConcurrencyError();
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "COMPENSACION",
    entityId: row.id,
    action: "AUTORIZACION",
    summary: authorized
      ? `Compensación de ${row.collaborator.user.name} autorizada por $${finalAmount} (solicitado $${row.requestedAmount}).`
      : `Compensación de ${row.collaborator.user.name} rechazada.`,
    authorUserId: actor.userId,
  });
}

export async function requestLeavePermission(
  actor: Actor,
  collaboratorId: string,
  startDate: string,
  endDate: string | null,
  reason: string,
  comment?: string | null,
) {
  assertHr(actor);
  const row = await prisma.collaborator.findFirst({ where: { id: collaboratorId, companyId: actor.activeCompanyId }, include: { user: true } });
  if (!row) throw new Error("Esa ficha no es de esta empresa.");
  const cleanReason = reason.trim();
  if (!cleanReason) throw new Error("El motivo del permiso es obligatorio.");
  const finalEndDate = endDate?.trim() || startDate;
  if (finalEndDate < startDate) throw new Error("La fecha final no puede ser anterior a la fecha inicial.");
  const created = await prisma.leavePermissionRequest.create({
    data: {
      collaboratorId: row.id,
      startDate,
      endDate: finalEndDate,
      reason: cleanReason,
      comment: comment?.trim() || null,
      status: "PENDIENTE",
      requestedByUserId: actor.userId,
    },
  });
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "PERMISO_FALTA",
    entityId: created.id,
    action: "ALTA",
    summary: `Solicitud de permiso de falta para ${row.user.name} (${startDate}${finalEndDate !== startDate ? ` a ${finalEndDate}` : ""}).`,
    authorUserId: actor.userId,
  });
  return created;
}

export async function decideLeavePermission(
  actor: Actor,
  permissionId: string,
  version: number,
  authorized: boolean,
) {
  assertCeo(actor);
  const row = await prisma.leavePermissionRequest.findFirst({
    where: { id: permissionId, status: "PENDIENTE" },
    include: { collaborator: { include: { user: true } } },
  });
  if (!row || row.collaborator.companyId !== actor.activeCompanyId) throw new Error("Esa solicitud de permiso no está pendiente en esta empresa.");
  const updated = await prisma.leavePermissionRequest.updateMany({
    where: { id: row.id, version },
    data: {
      status: authorized ? "AUTORIZADO" : "RECHAZADO",
      decidedByUserId: actor.userId,
      decidedAt: new Date(),
      version: { increment: 1 },
    },
  });
  if (updated.count === 0) throw new ConcurrencyError();
  if (authorized) {
    const dates = eachDate(row.startDate, row.endDate);
    for (const workDate of dates) {
      await prisma.attendanceDay.upsert({
        where: { collaboratorId_workDate: { collaboratorId: row.collaboratorId, workDate } },
        update: {
          status: "PERMISO",
          justified: true,
          justificationStatus: "JUSTIFICADA",
          paidLeave: true,
          note: row.reason,
          decidedByUserId: actor.userId,
          decidedAt: new Date(),
        },
        create: {
          collaboratorId: row.collaboratorId,
          workDate,
          status: "PERMISO",
          justified: true,
          justificationStatus: "JUSTIFICADA",
          paidLeave: true,
          note: row.reason,
          decidedByUserId: actor.userId,
          decidedAt: new Date(),
        },
      });
    }
  }
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "PERMISO_FALTA",
    entityId: row.id,
    action: "AUTORIZACION",
    summary: authorized
      ? `Permiso de falta de ${row.collaborator.user.name} autorizado y reflejado como justificado en asistencia.`
      : `Permiso de falta de ${row.collaborator.user.name} rechazado.`,
    authorUserId: actor.userId,
  });
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

export async function addLaborDocument(
  actor: Actor,
  collaboratorId: string,
  kind: "GENERAL" | "ACTA",
  title: string,
  note: string,
  occurredOn: string | null,
  fileMeta?: { fileName?: string | null; mimeType?: string | null; fileDataUrl?: string | null },
) {
  assertHr(actor);
  const row = await prisma.collaborator.findFirst({ where: { id: collaboratorId, companyId: actor.activeCompanyId }, include: { user: true } });
  if (!row) throw new Error("Esa ficha no es de esta empresa.");
  const cleanTitle = title.trim();
  if (!cleanTitle) throw new Error("El nombre del documento es obligatorio.");
  const created = await prisma.laborDocument.create({
    data: {
      collaboratorId,
      kind,
      title: cleanTitle,
      note: note.trim(),
      occurredOn,
      fileName: fileMeta?.fileName ?? null,
      mimeType: fileMeta?.mimeType ?? null,
      fileDataUrl: fileMeta?.fileDataUrl ?? null,
    },
  });
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "DOCUMENTO_LABORAL",
    entityId: created.id,
    action: "SUBIR",
    summary: `Subió documento "${cleanTitle}" para ${row.user.name}.`,
    authorUserId: actor.userId,
  });
  return created;
}
