"use client";

import Link from "next/link";

const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export function AgendaCalendar({
  view,
  anchor,
  activities,
}: {
  view: "dia" | "semana" | "mes";
  anchor: string;
  activities: Array<{ id: string; note: string; category: string; at: string }>;
}) {
  const anchorDate = parseDay(anchor);
  const days = view === "dia" ? [anchorDate] : view === "semana" ? weekDays(anchorDate) : [];
  if (view === "mes") {
    const { blanks, month } = monthGrid(anchorDate);
    return (
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--line)]">
        {WEEKDAYS.map((label) => <div key={label} className="bg-[#f7f8f9] px-2 py-2 text-xs font-medium">{label}</div>)}
        {Array.from({ length: blanks }, (_, index) => <div key={`blank-${index}`} className="min-h-20 bg-[#f7f8f9]" />)}
        {month.map((day) => {
          const items = activities.filter((item) => sameDay(item.at, day));
          const fecha = mexicoDate(day);
          return (
            <Link key={fecha} href={`/agenda?vista=dia&fecha=${fecha}#nueva`} className="min-h-20 bg-white p-1 text-xs hover:bg-[var(--accent-soft)]">
              <p className="font-medium">{day.getDate()}</p>
              {items.map((item) => <p key={item.id} className="truncate text-[var(--accent)]">{item.note}</p>)}
            </Link>
          );
        })}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--line)] bg-white">
      <div className="grid min-w-[640px]" style={{ gridTemplateColumns: `64px repeat(${days.length}, minmax(88px, 1fr))` }}>
        <div />
        {days.map((day) => (
          <div key={mexicoDate(day)} className="border-b border-l border-[var(--line)] px-2 py-2 text-xs font-medium">
            {day.toLocaleDateString("es-MX", { timeZone: "America/Mexico_City", weekday: "short", day: "numeric", month: "short" })}
          </div>
        ))}
        {HOURS.map((hour) => (
          <div key={hour} className="contents">
            <div className="border-t border-[var(--line)] px-2 py-3 text-xs text-[var(--muted)]">{`${hour}:00`}</div>
            {days.map((day) => {
              const items = activities.filter((item) => sameDay(item.at, day) && hourInMexico(item.at) === hour);
              const slot = `${mexicoDate(day)}T${String(hour).padStart(2, "0")}:00`;
              return (
                <Link key={slot} href={`/agenda?vista=${view}&fecha=${anchor}&slot=${encodeURIComponent(slot)}#nueva`} className="min-h-12 border-l border-t border-[var(--line)] p-1 hover:bg-[#f7f8f9]">
                  {items.map((item) => (
                    <p key={item.id} className="mb-1 rounded bg-[var(--accent-soft)] px-1 py-0.5 text-xs text-[var(--accent)]">
                      {item.category} · {item.note}
                    </p>
                  ))}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function parseDay(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1, 12, 0, 0, 0);
}

function weekDays(anchor: Date) {
  const start = new Date(anchor);
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "America/Mexico_City", weekday: "short" }).format(start);
  const index = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(weekday);
  start.setDate(start.getDate() - (index < 0 ? 0 : index));
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    return day;
  });
}

function monthGrid(anchor: Date) {
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1, 12);
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "America/Mexico_City", weekday: "short" }).format(start);
  const blanks = Math.max(0, ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(weekday));
  const count = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
  const month = Array.from({ length: count }, (_, i) => new Date(anchor.getFullYear(), anchor.getMonth(), i + 1, 12));
  return { blanks, month };
}

function hourInMexico(iso: string) {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Mexico_City", hour: "numeric", hourCycle: "h23" }).format(new Date(iso)));
}

function mexicoDate(day: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" }).format(day);
}

function sameDay(iso: string, day: Date) {
  return mexicoDate(new Date(iso)) === mexicoDate(day);
}
