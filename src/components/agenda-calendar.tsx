"use client";

const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

export function AgendaCalendar({
  view,
  activities,
}: {
  view: "dia" | "semana" | "mes";
  activities: Array<{ id: string; note: string; category: string; at: string }>;
}) {
  const anchor = new Date();
  const days = view === "dia" ? [anchor] : view === "semana" ? weekDays(anchor) : [];
  if (view === "mes") {
    const month = monthDays(anchor);
    return (
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--line)]">
        {month.map((day) => {
          const items = activities.filter((item) => sameDay(item.at, day));
          return (
            <div key={day.toISOString()} className="min-h-20 bg-white p-1 text-xs">
              <p className="font-medium">{day.getDate()}</p>
              {items.map((item) => <p key={item.id} className="truncate text-[var(--accent)]">{item.note}</p>)}
            </div>
          );
        })}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--line)] bg-white">
      <div className="grid" style={{ gridTemplateColumns: `64px repeat(${days.length}, minmax(88px, 1fr))` }}>
        <div />
        {days.map((day) => (
          <div key={day.toISOString()} className="border-b border-l border-[var(--line)] px-2 py-2 text-xs font-medium">
            {day.toLocaleDateString("es-MX", { timeZone: "America/Mexico_City", weekday: "short", day: "numeric" })}
          </div>
        ))}
        {HOURS.map((hour) => (
          <div key={hour} className="contents">
            <div className="border-t border-[var(--line)] px-2 py-3 text-xs text-[var(--muted)]">{`${hour}:00`}</div>
            {days.map((day) => {
              const items = activities.filter((item) => sameDay(item.at, day) && hourInMexico(item.at) === hour);
              return (
                <div key={`${day.toISOString()}-${hour}`} className="min-h-12 border-l border-t border-[var(--line)] p-1">
                  {items.map((item) => (
                    <p key={item.id} className="mb-1 rounded bg-[var(--accent-soft)] px-1 py-0.5 text-xs text-[var(--accent)]">
                      {item.category} · {item.note}
                    </p>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
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

function monthDays(anchor: Date) {
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const days = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
  return Array.from({ length: days }, (_, i) => new Date(start.getFullYear(), start.getMonth(), i + 1));
}

function hourInMexico(iso: string) {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Mexico_City", hour: "numeric", hourCycle: "h23" }).format(new Date(iso)));
}

function sameDay(iso: string, day: Date) {
  const formatted = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
  const target = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" }).format(day);
  return formatted === target;
}
