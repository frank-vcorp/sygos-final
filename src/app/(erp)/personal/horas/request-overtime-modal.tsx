"use client";

import { useState } from "react";
import { overtimeAction } from "../actions";
import { FormOverlayDialog } from "@/components/overlay-dialog";
import { Button, controlClass, Field } from "@/components/ui";

export function RequestOvertimeModal({
  collaborators,
  today,
}: {
  collaborators: Array<{ id: string; name: string }>;
  today: string;
}) {
  const [open, setOpen] = useState(false);

  if (collaborators.length === 0) return null;

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        Solicitar horas extra
      </Button>
      <FormOverlayDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Solicitar horas extra"
        titleId="modal-horas-extra"
      >
        <form action={overtimeAction} className="space-y-4">
          {collaborators.length === 1 ? (
            <input type="hidden" name="collaboratorId" value={collaborators[0]!.id} />
          ) : (
            <Field label="Colaborador">
              <select name="collaboratorId" required className={controlClass} defaultValue={collaborators[0]!.id}>
                {collaborators.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Fecha">
            <input name="workDate" type="date" required defaultValue={today} className={controlClass} />
          </Field>
          <Field
            label="Cantidad de horas"
            hint="El sistema clasifica las horas extra automáticamente según las reglas vigentes."
          >
            <input
              name="hours"
              type="number"
              min="0.5"
              step="0.5"
              required
              defaultValue="1"
              className={controlClass}
            />
          </Field>
          <Field label="Motivo">
            <input name="reason" required className={controlClass} />
          </Field>
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <Button type="button" tone="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Solicitar horas extra</Button>
          </div>
        </form>
      </FormOverlayDialog>
    </>
  );
}
