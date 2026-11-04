const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MEXICO_TZ = "America/Mexico_City";
const SLA_OPEN_HOUR = 8;
const SLA_CLOSE_HOUR = 18;

export function weekdayInMexico(date: Date): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: MEXICO_TZ, weekday: "short" }).format(date);
  const index = WEEKDAYS.indexOf(name);
  return index < 0 ? 0 : index;
}

/** Advances N Monday–Friday days and keeps the clock time of the physical receipt. */
export function addBusinessDays(start: Date, days: number): Date {
  const result = new Date(start);
  let left = days;
  while (left > 0) {
    result.setTime(result.getTime() + 24 * 60 * 60 * 1000);
    const weekday = weekdayInMexico(result);
    if (weekday !== 0 && weekday !== 6) left -= 1;
  }
  return result;
}

function mexicoYmd(date: Date): { y: number; m: number; d: number } {
  const iso = new Intl.DateTimeFormat("en-CA", { timeZone: MEXICO_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}

function mexicoHourMinute(date: Date): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MEXICO_TZ,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return { hour, minute };
}

/** Local wall time in Mexico City (UTC−6, no DST). */
export function atMexicoCityLocal(y: number, m: number, d: number, hour: number, minute = 0): Date {
  return new Date(Date.UTC(y, m - 1, d, hour + 6, minute, 0, 0));
}

function isWithinRepairQuoteSlaBusinessHours(capturedAt: Date): boolean {
  const weekday = weekdayInMexico(capturedAt);
  if (weekday === 0 || weekday === 6) return false;
  const { hour, minute } = mexicoHourMinute(capturedAt);
  const minutes = hour * 60 + minute;
  return minutes >= SLA_OPEN_HOUR * 60 && minutes < SLA_CLOSE_HOUR * 60;
}

function nextMexicoBusinessDayYmd(from: Date): { y: number; m: number; d: number } {
  let cursor = new Date(from.getTime() + 24 * 60 * 60 * 1000);
  while (true) {
    const weekday = weekdayInMexico(cursor);
    if (weekday !== 0 && weekday !== 6) return mexicoYmd(cursor);
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }
}

/**
 * SLA for repair quotes starts when Ventas authorizes. Outside Mon–Fri 8:00–18:00 (Mexico City)
 * the clock starts the next business day at 8:00; before 8:00 on a weekday starts same day at 8:00.
 */
export function normalizeSlaStartFromAuthorization(capturedAt: Date): Date {
  if (isWithinRepairQuoteSlaBusinessHours(capturedAt)) return capturedAt;
  const { hour } = mexicoHourMinute(capturedAt);
  const weekday = weekdayInMexico(capturedAt);
  const sameDayMorning = weekday >= 1 && weekday <= 5 && hour < SLA_OPEN_HOUR;
  const target = sameDayMorning ? mexicoYmd(capturedAt) : nextMexicoBusinessDayYmd(capturedAt);
  return atMexicoCityLocal(target.y, target.m, target.d, SLA_OPEN_HOUR);
}

export function warrantyDeadline(exitAt: Date): Date {
  const deadline = new Date(exitAt);
  deadline.setMonth(deadline.getMonth() + 6);
  return deadline;
}

export type SlaCountdown = { text: string; overdue: boolean };

/** Texto de cuenta regresiva (o tiempo vencido) respecto al plazo SLA. */
export function formatSlaCountdown(dueAt: Date, now = Date.now()): SlaCountdown {
  const diffMs = dueAt.getTime() - now;
  const overdue = diffMs < 0;
  const abs = Math.abs(diffMs);
  const totalSec = Math.floor(abs / 1000);
  const min = Math.floor(totalSec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);

  if (!overdue && abs < 24 * 60 * 60 * 1000) {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const pad = (n: number) => String(n).padStart(2, "0");
    return { text: `${h}:${pad(m)}:${pad(s)}`, overdue: false };
  }

  if (!overdue) {
    if (day > 0) return { text: `${day} d ${hr % 24} h`, overdue: false };
    if (hr > 0) return { text: `${hr} h ${min % 60} min`, overdue: false };
    if (min > 0) return { text: `${min} min`, overdue: false };
    return { text: "menos de 1 min", overdue: false };
  }

  if (day > 0) return { text: `Hace ${day} d ${hr % 24} h`, overdue: true };
  if (hr > 0) return { text: `Hace ${hr} h ${min % 60} min`, overdue: true };
  if (min > 0) return { text: `Hace ${min} min`, overdue: true };
  return { text: "Vencido", overdue: true };
}

export function compareBySla<
  T extends { slaDueAt: Date | null; slaStartedAt: Date | null; createdAt: Date; express?: boolean },
>(a: T, b: T, now = Date.now()): number {
  const aExpress = a.express === true;
  const bExpress = b.express === true;
  if (aExpress !== bExpress) return aExpress ? -1 : 1;
  const aOver = a.slaDueAt != null && a.slaDueAt.getTime() < now;
  const bOver = b.slaDueAt != null && b.slaDueAt.getTime() < now;
  if (aOver !== bOver) return aOver ? -1 : 1;
  const aDue = a.slaDueAt?.getTime() ?? Number.POSITIVE_INFINITY;
  const bDue = b.slaDueAt?.getTime() ?? Number.POSITIVE_INFINITY;
  if (aDue !== bDue) return aDue - bDue;
  const aStart = a.slaStartedAt?.getTime() ?? a.createdAt.getTime();
  const bStart = b.slaStartedAt?.getTime() ?? b.createdAt.getTime();
  return aStart - bStart;
}
