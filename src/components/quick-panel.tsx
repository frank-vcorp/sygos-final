"use client";

import { useState } from "react";

export function QuickPanel({
  label,
  children,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
}: {
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  return (
    <div>
      <button type="button" className="text-sm font-medium text-[var(--accent)]" onClick={() => setOpen(!open)}>
        {open ? "Ocultar campos" : `+ ${label}`}
      </button>
      <div className={open ? "mt-2 grid gap-3 rounded-md border border-[var(--line)] p-3" : "hidden"}>
        {children}
      </div>
    </div>
  );
}
