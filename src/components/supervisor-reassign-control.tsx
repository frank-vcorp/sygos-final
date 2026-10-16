"use client";

import { useState } from "react";
import { FormOverlayDialog } from "@/components/overlay-dialog";
import { Button, controlClass } from "@/components/ui";

type AssignCaseAction = (formData: FormData) => void | Promise<void>;

export function SupervisorReassignControl({
  caseId,
  version,
  assigneeUserId,
  candidates,
  assignCaseAction,
}: {
  caseId: string;
  version: number;
  assigneeUserId: string;
  candidates: Array<{ id: string; name: string }>;
  assignCaseAction: AssignCaseAction;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="ml-2 text-xs font-medium text-[var(--muted)] underline-offset-2 hover:text-[var(--accent)] hover:underline"
        onClick={() => setOpen(true)}
      >
        Reasignar
      </button>
      <FormOverlayDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Reasignar responsable"
        titleId="supervisor-reassign-dialog"
      >
        <form action={assignCaseAction} className="grid gap-3">
          <input type="hidden" name="caseId" value={caseId} />
          <input type="hidden" name="version" value={version} />
          <div>
            <label htmlFor="reassign-assignee" className="text-sm font-medium text-[#0b1f3a]">
              Nuevo técnico responsable
            </label>
            <select
              id="reassign-assignee"
              name="assigneeUserId"
              required
              className={`mt-1 ${controlClass}`}
              defaultValue={assigneeUserId}
            >
              {candidates.map((user) => (
                <option key={user.id} value={user.id}>{user.name}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" tone="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit">Guardar</Button>
          </div>
        </form>
      </FormOverlayDialog>
    </>
  );
}
