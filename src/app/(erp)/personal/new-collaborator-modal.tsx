"use client";

import { useState } from "react";
import { hireAction } from "./actions";
import { FormOverlayDialog } from "@/components/overlay-dialog";
import { Button, controlClass, Field, MoneyInput } from "@/components/ui";

export function NewCollaboratorModal({
  users,
  bosses,
  defaultOpen = false,
  today,
}: {
  users: Array<{ id: string; name: string; role: string }>;
  bosses: Array<{ id: string; name: string }>;
  defaultOpen?: boolean;
  today: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        Nuevo colaborador
      </Button>
      <FormOverlayDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Nuevo colaborador"
        titleId="nuevo-colaborador-dialog"
        wide
      >
        <form action={hireAction} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Usuario de esta empresa">
              <select name="userId" required className={controlClass} defaultValue="">
                <option value="">Selecciona</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Puesto">
              <input name="jobTitle" placeholder="Ej. Ejecutivo de ventas" className={controlClass} />
            </Field>
            <Field label="Tipo de ingreso">
              <select name="hireKind" className={controlClass} defaultValue="NUEVO">
                <option value="NUEVO">Nuevo</option>
                <option value="MIGRADO">Migrado</option>
              </select>
            </Field>
            <Field label="Fecha de ingreso">
              <input name="hiredAt" type="date" required defaultValue={today} className={controlClass} />
            </Field>
            <Field label="Jefe directo">
              <select name="bossUserId" className={controlClass} defaultValue="">
                <option value="">Selecciona jefe directo</option>
                {bosses.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Horario / jornada">
              <input
                name="workSchedule"
                defaultValue="Lunes a viernes 09:00 a 18:00"
                className={controlClass}
              />
            </Field>
            <Field label="Teléfono">
              <input name="phone" className={controlClass} />
            </Field>
            <Field label="Correo">
              <input name="email" type="email" className={controlClass} />
            </Field>
            <Field label="Sueldo diario timbrado">
              <MoneyInput name="dailyStamped" min="0" defaultValue="0" />
            </Field>
            <Field label="Sueldo diario efectivo">
              <MoneyInput name="dailyCash" min="0" defaultValue="0" />
            </Field>
            <Field label="Tarifa hora extra">
              <MoneyInput name="overtimeRate" min="0" defaultValue="0" />
            </Field>
            <Field label="RFC">
              <input name="rfc" className={controlClass} />
            </Field>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <Button type="button" tone="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Guardar colaborador</Button>
          </div>
        </form>
      </FormOverlayDialog>
    </>
  );
}
