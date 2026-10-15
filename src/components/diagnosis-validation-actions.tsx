"use client";

import { useState } from "react";
import { FormOverlayDialog } from "@/components/overlay-dialog";
import { Button, controlClass } from "@/components/ui";

type ValidationAction = (formData: FormData) => void | Promise<void>;

export function DiagnosisValidationActions({
  caseId,
  version,
  warranty,
  validateAction,
}: {
  caseId: string;
  version: number;
  warranty: boolean;
  validateAction: ValidationAction;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <form action={validateAction} className="inline">
          <input type="hidden" name="caseId" value={caseId} />
          <input type="hidden" name="version" value={version} />
          <input type="hidden" name="decision" value={warranty ? "VALIDA" : "VALIDAR"} />
          <Button type="submit">{warranty ? "Validar garantía" : "Validar diagnóstico"}</Button>
        </form>
        <Button type="button" tone="ghost" onClick={() => setOpen(true)}>
          Devolver a corrección
        </Button>
      </div>
      <FormOverlayDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Devolver a corrección"
        titleId="diagnosis-return-dialog"
      >
        <form action={validateAction} className="grid gap-3">
          <input type="hidden" name="caseId" value={caseId} />
          <input type="hidden" name="version" value={version} />
          <input type="hidden" name="decision" value="DEVOLVER" />
          <div>
            <label htmlFor="diagnosis-return-reason" className="text-sm font-medium text-[#0b1f3a]">
              Motivo de la devolución
            </label>
            <textarea
              id="diagnosis-return-reason"
              name="reason"
              required
              rows={4}
              className={`mt-1 ${controlClass}`}
              placeholder="Indica qué debe corregirse o completarse"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" tone="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" tone="danger">
              Devolver a corrección
            </Button>
          </div>
        </form>
      </FormOverlayDialog>
    </>
  );
}
