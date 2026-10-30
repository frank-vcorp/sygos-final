"use client";

import { useState } from "react";
import { generatePayrollAction } from "./actions";
import { FormOverlayDialog } from "@/components/overlay-dialog";
import { Button, controlClass, Field } from "@/components/ui";
import { formatPayrollFolio } from "@/lib/payroll";

export function GeneratePayrollModal({
  companyCode,
  defaultIsoWeek,
  defaultPaymentDate,
}: {
  companyCode: string;
  defaultIsoWeek: string;
  defaultPaymentDate: string;
}) {
  const [open, setOpen] = useState(false);
  const [periodInput, setPeriodInput] = useState(defaultIsoWeek);

  const match = /^(\d{4})-W(\d{1,2})$/i.exec(periodInput);
  const previewFolio = match
    ? formatPayrollFolio(companyCode, Number(match[1]), Number(match[2]))
    : `NOM-${companyCode}-AAAA-S00`;

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        Generar nómina
      </Button>
      <FormOverlayDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Generar nómina"
        titleId="modal-generar-nomina"
      >
        <form action={generatePayrollAction} className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-xs text-slate-600">
            <span className="font-medium text-slate-500">Folio automático asignado: </span>
            <strong className="font-mono font-bold text-slate-900">{previewFolio}</strong>
            <p className="mt-1 text-[11px] text-slate-500">
              Si ya existe la nómina de esa semana para esta empresa, se abrirá el registro existente sin duplicarla.
            </p>
          </div>
          <Field label="Semana / periodo">
            <input
              name="periodInput"
              type="week"
              required
              value={periodInput}
              onChange={(e) => setPeriodInput(e.target.value)}
              className={controlClass}
            />
          </Field>
          <Field label="Fecha de pago">
            <input
              name="paymentDate"
              type="date"
              required
              defaultValue={defaultPaymentDate}
              className={controlClass}
            />
          </Field>
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <Button type="button" tone="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Generar nómina</Button>
          </div>
        </form>
      </FormOverlayDialog>
    </>
  );
}
