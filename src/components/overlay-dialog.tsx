"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui";

export function FormOverlayDialog({
  open,
  onClose,
  title,
  titleId,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  titleId: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className={`max-h-[min(92vh,44rem)] w-full overflow-y-auto rounded-xl border border-[var(--line)] bg-white shadow-xl ${wide ? "max-w-2xl" : "max-w-lg"}`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[var(--line)] bg-white px-4 py-3">
          <h3 id={titleId} className="text-sm font-semibold text-[#0b1f3a]">{title}</h3>
          <Button type="button" tone="ghost" className="min-h-9 px-2 text-xs" onClick={onClose}>
            Cerrar
          </Button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
