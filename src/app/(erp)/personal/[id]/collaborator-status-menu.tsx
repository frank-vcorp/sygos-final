"use client";

import { useState } from "react";
import { toggleCollaboratorStatusAction } from "../actions";
import { FormOverlayDialog } from "@/components/overlay-dialog";
import { Button } from "@/components/ui";

export function CollaboratorStatusMenu({
  collaboratorId,
  collaboratorName,
  version,
  isActive,
}: {
  collaboratorId: string;
  collaboratorName: string;
  version: number;
  isActive: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <div className="relative inline-block text-left">
      <Button
        type="button"
        tone="ghost"
        className="min-h-9 px-3 py-1.5 text-xs"
        onClick={() => setMenuOpen((prev) => !prev)}
        aria-expanded={menuOpen}
      >
        ⋯ Más opciones
      </Button>
      {menuOpen ? (
        <div className="absolute right-0 z-30 mt-1.5 w-56 rounded-xl border border-slate-200/90 bg-white p-1.5 shadow-lg">
          {isActive ? (
            <button
              type="button"
              className="flex w-full items-center rounded-lg px-3 py-2 text-left text-xs font-semibold text-rose-700 hover:bg-rose-50"
              onClick={() => {
                setMenuOpen(false);
                setConfirmOpen(true);
              }}
            >
              Deshabilitar colaborador
            </button>
          ) : (
            <form action={toggleCollaboratorStatusAction}>
              <input type="hidden" name="collaboratorId" value={collaboratorId} />
              <input type="hidden" name="version" value={version} />
              <input type="hidden" name="enable" value="1" />
              <button
                type="submit"
                className="flex w-full items-center rounded-lg px-3 py-2 text-left text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
              >
                Habilitar colaborador
              </button>
            </form>
          )}
        </div>
      ) : null}

      <FormOverlayDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={`¿Deshabilitar a ${collaboratorName}?`}
        titleId="confirm-disable-collaborator-dialog"
      >
        <div className="space-y-4">
          <p className="text-sm leading-6 text-slate-700">
            El colaborador dejará de estar activo en la operación, pero conservará todo su historial e información.
          </p>
          <form action={toggleCollaboratorStatusAction} className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <input type="hidden" name="collaboratorId" value={collaboratorId} />
            <input type="hidden" name="version" value={version} />
            <input type="hidden" name="enable" value="0" />
            <Button type="button" tone="ghost" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" tone="danger">
              Deshabilitar
            </Button>
          </form>
        </div>
      </FormOverlayDialog>
    </div>
  );
}
