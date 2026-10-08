"use client";

import { useEffect, useState } from "react";
import { formatSlaCountdown } from "@/lib/sla";

function dueMs(dueAt: Date | string) {
  return new Date(dueAt).getTime();
}

function tickIntervalMs(dueMs: number, now: number) {
  const remaining = dueMs - now;
  return remaining > 0 && remaining < 24 * 60 * 60 * 1000 ? 1000 : 60_000;
}

export function SlaCountdown({
  dueAt,
  className,
}: {
  dueAt: Date | string | null | undefined;
  className?: string;
}) {
  const ms = dueAt != null ? dueMs(dueAt) : null;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (ms == null || Number.isNaN(ms)) return;
    let id = 0;
    const schedule = () => {
      const next = tickIntervalMs(ms, Date.now());
      id = window.setTimeout(() => {
        setNow(Date.now());
        schedule();
      }, next);
    };
    schedule();
    return () => window.clearTimeout(id);
  }, [ms]);

  if (dueAt == null || ms == null || Number.isNaN(ms)) {
    return <span className={className}>—</span>;
  }

  const { text, overdue } = formatSlaCountdown(new Date(ms), now);
  const title = new Date(ms).toLocaleString("es-MX", {
    timeZone: "America/Mexico_City",
    dateStyle: "full",
    timeStyle: "short",
  });

  return (
    <span
      className={`tabular-nums ${overdue ? "font-medium text-[#c2410c]" : ""} ${className ?? ""}`}
      title={`Vence: ${title}`}
    >
      {text}
    </span>
  );
}
