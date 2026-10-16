"use client";

import { useState } from "react";
import { FormOverlayDialog } from "@/components/overlay-dialog";
import { Button, controlClass } from "@/components/ui";

type FinishRepairAction = (formData: FormData) => void | Promise<void>;

export function RepairClosureActions({
  caseId,
  version,
  finishRepairAction,
}: {
  caseId: string;
  version: number;
  finishRepairAction: FinishRepairAction;
}) {
  const [withoutRepairOpen, setWithoutRepairOpen] = useState(false);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <form action={finishRepairAction} className="inline">
          <input type="hidden" name="caseId" value={caseId} />
          <input type="hidden" name="version" value={version} />
          <input type="hidden" name="outcome" value="TERMINADA" />
          <Button type="submit">Terminar reparación</Button>
        </form>
        <Button
          type="button"
          tone="ghost"
          className="border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100"
          onClick={() => setWithoutRepairOpen(true)}
        >
          Sin reparación
        </Button>
      </div>

      <FormOverlayDialog
        open={withoutRepairOpen}
        onClose={() => setWithoutRepairOpen(false)}
        title="Sin reparación"
        titleId="repair-without-dialog"
      >
        <form action={finishRepairAction} className="grid gap-3">
          <input type="hidden" name="caseId" value={caseId} />
          <input type="hidden" name="version" value={version} />
          <input type="hidden" name="outcome" value="SIN_REPARACION" />
          <p className="text-sm text-[var(--muted)]">
            El equipo no se reparó. Indica el motivo; el caso quedará en sin reparación para la decisión comercial.
          </p>
          <div>
            <label htmlFor="repair-without-reason" className="text-sm font-medium text-[#0b1f3a]">
              Motivo
            </label>
            <textarea
              id="repair-without-reason"
              name="resultText"
              required
              rows={4}
              className={`mt-1 ${controlClass}`}
              placeholder="Por qué no procede la reparación"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" tone="ghost" onClick={() => setWithoutRepairOpen(false)}>Cancelar</Button>
            <Button type="submit" tone="danger">Registrar sin reparación</Button>
          </div>
        </form>
      </FormOverlayDialog>
    </>
  );
}
