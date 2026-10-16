"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui";
import { readNamedFormFields, type QuickFormFieldMap } from "@/lib/quick-form-persist";

export function FormQuickModal({
  open,
  title,
  titleId,
  onClose,
  onCommit,
  doneLabel = "Listo",
  children,
}: {
  open: boolean;
  title: string;
  titleId: string;
  onClose: () => void;
  /** Lee los campos con `name` del modal; si devuelve texto, no se cierra. */
  onCommit?: (fields: QuickFormFieldMap) => string | null | void | Promise<string | null | void>;
  doneLabel?: string;
  children: React.ReactNode;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  if (!open) return null;

  const handleDone = async () => {
    if (saving) return;
    if (onCommit && bodyRef.current) {
      setSaving(true);
      let message: string | null | void;
      try {
        message = await onCommit(readNamedFormFields(bodyRef.current));
      } catch (error) {
        message = error instanceof Error ? error.message : "No se pudo guardar.";
      } finally {
        setSaving(false);
      }
      if (message) {
        setCommitError(message);
        return;
      }
    }
    setCommitError(null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onKeyDown={(event) => {
        if (event.key === "Enter" && !(event.target instanceof HTMLTextAreaElement) && !(event.target instanceof HTMLButtonElement)) {
          event.preventDefault();
          void handleDone();
        }
      }}
    >
      <div className="max-h-[min(90vh,40rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--line)] bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between gap-3 border-b border-[var(--line)] bg-white px-4 py-3">
          <h3 id={titleId} className="text-sm font-semibold text-[#0b1f3a]">{title}</h3>
          <Button type="button" tone="ghost" className="min-h-9 px-2 text-xs" onClick={onClose}>
            Cerrar
          </Button>
        </div>
        <div ref={bodyRef} className="grid gap-3 p-4">
          {children}
          {commitError ? <p className="text-sm text-[var(--danger)]">{commitError}</p> : null}
        </div>
        <div className="sticky bottom-0 z-10 border-t border-[var(--line)] bg-white/95 px-4 py-3 shadow-[0_-8px_20px_rgba(20,45,75,0.1)] backdrop-blur-md" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          <Button type="button" className="w-full sm:w-auto" disabled={saving} onClick={handleDone}>
            {saving ? "Guardando…" : doneLabel}
          </Button>
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
    <div className="flex flex-col gap-1 sm:shrink-0">
      <Button
        type="button"
        tone="ghost"
        className="min-h-11 whitespace-nowrap border border-[var(--line)] bg-white px-3 text-[var(--accent)] shadow-sm hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
        disabled={disabled}
        onClick={onClick}
      >
        {label}
      </Button>
      {disabled && disabledHint ? <span className="text-xs text-[var(--muted)]">{disabledHint}</span> : null}
    </div>
  );
}
