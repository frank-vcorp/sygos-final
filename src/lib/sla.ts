const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function weekdayInMexico(date: Date): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: "America/Mexico_City", weekday: "short" }).format(date);
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

export function compareBySla<T extends { slaDueAt: Date | null; slaStartedAt: Date | null; createdAt: Date }>(a: T, b: T, now = Date.now()): number {
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
