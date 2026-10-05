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
