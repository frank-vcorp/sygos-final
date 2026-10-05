"use client";

import { useState } from "react";

export function QuickPanel({
  label,
  children,
  defaultOpen = false,
}: {
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button type="button" className="text-sm font-medium text-[var(--accent)]" onClick={() => setOpen((value) => !value)}>
        {open ? "Ocultar campos" : `+ ${label}`}
      </button>
      <div className={open ? "mt-2 grid gap-3 rounded-md border border-[var(--line)] p-3" : "hidden"}>
        {children}
      </div>
    </div>
  );
}
