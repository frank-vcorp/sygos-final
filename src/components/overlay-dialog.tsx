"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui";

export function FormOverlayDialog({
  open,
  onClose,
  title,
  titleId,
  children,
  wide,
  documentWide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  titleId: string;
  children: React.ReactNode;
  wide?: boolean;
  /** Documento imprimible (p. ej. salida de almacén). */
  documentWide?: boolean;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? [])].filter((element) => element.getClientRects().length > 0);
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!focusable.includes(document.activeElement as HTMLElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
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
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={`flex w-full max-h-[min(94vh,56rem)] flex-col overflow-hidden rounded-xl border border-[var(--line)] bg-white shadow-xl ${
          documentWide ? "max-w-4xl" : wide ? "max-w-3xl" : "max-w-lg"
        }`}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--line)] bg-white px-4 py-3">
          <h3 id={titleId} className="text-sm font-semibold text-[#0b1f3a]">{title}</h3>
          <Button type="button" tone="ghost" className="min-h-9 px-2 text-xs" onClick={onClose}>
            Cerrar
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}
