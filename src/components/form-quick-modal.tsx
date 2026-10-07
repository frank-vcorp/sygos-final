"use client";

import { Button } from "@/components/ui";

export function FormQuickModal({
  open,
  title,
  titleId,
  onClose,
  doneLabel = "Listo",
  children,
}: {
  open: boolean;
  title: string;
  titleId: string;
  onClose: () => void;
  doneLabel?: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="max-h-[min(90vh,40rem)] w-full max-w-lg overflow-y-auto rounded-xl border border-[var(--line)] bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between gap-3 border-b border-[var(--line)] bg-white px-4 py-3">
          <h3 id={titleId} className="text-sm font-semibold text-[#0b1f3a]">{title}</h3>
          <Button type="button" tone="ghost" className="min-h-9 px-2 text-xs" onClick={onClose}>
            Cerrar
          </Button>
        </div>
        <div className="grid gap-3 p-4">
          {children}
          <Button type="button" className="w-full sm:w-auto" onClick={onClose}>{doneLabel}</Button>
        </div>
      </div>
    </div>
  );
}

export function QuickCreateButton({
  label,
  disabled,
  disabledHint,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  disabledHint?: string;
  onClick: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        tone="ghost"
        className="min-h-10 border border-dashed border-[var(--accent)] text-[var(--accent)]"
        disabled={disabled}
        onClick={onClick}
      >
        {label}
      </Button>
      {disabled && disabledHint ? <span className="text-xs text-[var(--muted)]">{disabledHint}</span> : null}
    </div>
  );
}
