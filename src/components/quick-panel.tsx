"use client";

import { useState } from "react";

export function QuickPanel({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" className="text-sm font-medium text-[var(--accent)]" onClick={() => setOpen((value) => !value)}>
        {open ? "Cerrar alta rápida" : `+ ${label}`}
      </button>
      {open ? <div className="mt-2 grid gap-3 rounded-md border border-[var(--line)] p-3">{children}</div> : null}
    </div>
  );
}
