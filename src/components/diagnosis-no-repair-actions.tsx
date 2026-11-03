"use client";

import { useState } from "react";
import { FormOverlayDialog } from "@/components/overlay-dialog";
import { Button, controlClass } from "@/components/ui";

type MarkNoRepairAction = (formData: FormData) => void | Promise<void>;

export function DiagnosisNoRepairActions({
  caseId,
  version,
  markNoRepairAction,
  marked,
  markedReason,
}: {
  caseId: string;
  version: number;
  markNoRepairAction: MarkNoRepairAction;
  marked: boolean;
  markedReason: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {marked ? (
          <span className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm text-amber-950">
            Sin reparación registrado{markedReason ? `: ${markedReason}` : ""}
          </span>
        ) : (
          <Button
            type="button"
            tone="ghost"
            className="border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100"
            onClick={() => setOpen(true)}
          >
            Sin reparación
          </Button>
        )}
      </div>

      <FormOverlayDialog open={open} onClose={() => setOpen(false)} title="Sin reparación" titleId="dx-no-repair-dialog">
        <form action={markNoRepairAction} className="grid gap-3">
          <input type="hidden" name="caseId" value={caseId} />
          <input type="hidden" name="version" value={version} />
          <p className="text-sm text-[var(--muted)]">
            El equipo no se reparará en este diagnóstico. Indica el motivo; aún debes concluir el diagnóstico y pasar la validación del gerente.
          </p>
          <div>
            <label htmlFor="dx-no-repair-reason" className="text-sm font-medium text-[#0b1f3a]">
              Motivo
            </label>
            <textarea
              id="dx-no-repair-reason"
              name="reason"
              required
              rows={4}
              className={`mt-1 ${controlClass}`}
              placeholder="Por qué no procede reparación ni cotización de reparación"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" tone="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" tone="danger">Registrar sin reparación</Button>
          </div>
        </form>
      </FormOverlayDialog>
    </>
  );
}
