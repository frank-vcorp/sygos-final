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
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-4 backdrop-blur-[2px] sm:items-center"
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
        className={`flex w-full max-h-[min(94vh,56rem)] flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl ${
          documentWide ? "max-w-4xl" : wide ? "max-w-3xl" : "max-w-lg"
        }`}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200/80 bg-slate-50/70 px-5 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white text-slate-500 ring-1 ring-slate-200/80" aria-hidden>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                <rect x="2.5" y="2.5" width="11" height="11" rx="2" />
                <path d="M5.5 6h5M5.5 9h3.5" />
              </svg>
            </span>
            <h3 id={titleId} className="truncate text-sm font-bold tracking-tight text-slate-900">{title}</h3>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <kbd className="hidden rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-400 shadow-2xs sm:inline-block" aria-hidden>
              Esc
            </kbd>
            <Button type="button" tone="ghost" className="min-h-8 px-2.5 text-xs" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
