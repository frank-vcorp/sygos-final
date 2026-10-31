"use client";

import { useState } from "react";
import { updatePayrollLineAmountsAction } from "../../../actions";
import { FormOverlayDialog } from "@/components/overlay-dialog";
import { Badge, Button, Card, Field, MoneyInput, Table, Td, Th } from "@/components/ui";
import { money, roundMoney } from "@/lib/money";
import type { PayrollConceptOrigins } from "@/lib/payroll";

export type CollaboratorPayrollData = {
  periodId: string;
  collaboratorId: string;
  editable: boolean;
  calcSueldo: number;
  calcHorasExtra: number;
  calcBonos: number;
  calcComision: number;
  calcCompensaciones: number;
  calcPrimaVacacional: number;
  sueldo: number;
  horasExtra: number;
  bonos: number;
  comision: number;
  compensaciones: number;
  primaVacacional: number;
  origins: PayrollConceptOrigins;
};

export function CollaboratorPayrollBreakdown({ data }: { data: CollaboratorPayrollData }) {
  const [open, setOpen] = useState(false);

  const concepts: Array<{
    key: keyof PayrollConceptOrigins;
    label: string;
    calculated: number;
    applied: number;
    origin: string;
  }> = [
    {
      key: "sueldo",
      label: "Sueldo",
      calculated: data.calcSueldo,
      applied: data.sueldo,
      origin: data.origins.sueldo,
    },
    {
      key: "horasExtra",
      label: "Horas extra",
      calculated: data.calcHorasExtra,
      applied: data.horasExtra,
      origin: data.origins.horasExtra,
    },
    {
      key: "bonos",
      label: "Bonos",
      calculated: data.calcBonos,
      applied: data.bonos,
      origin: data.origins.bonos,
    },
    {
      key: "comision",
      label: "Comisión",
      calculated: data.calcComision,
      applied: data.comision,
      origin: data.origins.comision,
    },
    {
      key: "compensaciones",
      label: "Compensaciones",
      calculated: data.calcCompensaciones,
      applied: data.compensaciones,
      origin: data.origins.compensaciones,
    },
    {
      key: "primaVacacional",
      label: "Prima vacacional",
      calculated: data.calcPrimaVacacional,
      applied: data.primaVacacional,
      origin: data.origins.primaVacacional,
    },
  ];

  const calcTotal = roundMoney(concepts.reduce((sum, concept) => sum + concept.calculated, 0));
  const appliedTotal = roundMoney(concepts.reduce((sum, concept) => sum + concept.applied, 0));

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold tracking-tight text-slate-900">
              Desglose de cálculo y procedencia
            </h2>
            <p className="text-xs text-slate-500">
              Cada concepto muestra su origen en Personal, el valor calculado originalmente y el valor aplicado en esta nómina.
            </p>
          </div>
          {data.editable ? (
            <Button type="button" onClick={() => setOpen(true)}>
              Ajustar importes
            </Button>
          ) : (
            <Badge tone="neutral">Importes congelados</Badge>
          )}
        </div>

        <Table>
          <thead>
            <tr>
              <Th>Concepto</Th>
              <Th>Procedencia / origen</Th>
              <Th>Valor calculado</Th>
              <Th>Valor aplicado</Th>
            </tr>
          </thead>
          <tbody>
            {concepts.map((c) => {
              const adjusted = Math.abs(c.calculated - c.applied) > 0.005;
              return (
                <tr key={c.key}>
                  <Td className="font-semibold text-slate-900">
                    <div className="flex items-center gap-2">
                      <span>{c.label}</span>
                      {adjusted ? <Badge tone="warn">Ajustado</Badge> : null}
                    </div>
                  </Td>
                  <Td className="max-w-md text-xs text-slate-600">{c.origin}</Td>
                  <Td className="tabular-nums text-slate-500">{money(c.calculated)}</Td>
                  <Td className="font-semibold tabular-nums text-slate-900">{money(c.applied)}</Td>
                </tr>
              );
            })}
            <tr className="bg-slate-50/90">
              <Td className="font-bold text-slate-900">TOTAL</Td>
              <Td className="text-xs font-medium text-slate-500">
                Sueldo, horas extra, bonos, comisión, compensaciones y prima vacacional.
              </Td>
              <Td className="font-semibold tabular-nums text-slate-500">{money(calcTotal)}</Td>
              <Td className="text-base font-bold text-[#0a477e] tabular-nums">{money(appliedTotal)}</Td>
            </tr>
          </tbody>
        </Table>
      </Card>

      <FormOverlayDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Ajustar importes aplicados en esta nómina"
        titleId="modal-ajustar-importes-nomina"
        wide
      >
        <form action={updatePayrollLineAmountsAction} className="space-y-4">
          <input type="hidden" name="periodId" value={data.periodId} />
          <input type="hidden" name="collaboratorId" value={data.collaboratorId} />
          <p className="text-xs text-slate-500">
            Los ajustes modifican únicamente el Valor aplicado de este colaborador en esta nómina y no alteran su configuración general en Personal. No se requiere capturar motivo.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Sueldo" hint={`Valor calculado: ${money(data.calcSueldo)}`}>
              <MoneyInput name="sueldo" defaultValue={data.sueldo} min="0" />
            </Field>
            <Field label="Horas extra" hint={`Valor calculado: ${money(data.calcHorasExtra)}`}>
              <MoneyInput name="horasExtra" defaultValue={data.horasExtra} min="0" />
            </Field>
            <Field label="Bonos" hint={`Valor calculado: ${money(data.calcBonos)}`}>
              <MoneyInput name="bonos" defaultValue={data.bonos} min="0" />
            </Field>
            <Field label="Comisión" hint={`Valor calculado: ${money(data.calcComision)}`}>
              <MoneyInput name="comision" defaultValue={data.comision} min="0" />
            </Field>
            <Field label="Compensaciones" hint={`Valor calculado: ${money(data.calcCompensaciones)}`}>
              <MoneyInput name="compensaciones" defaultValue={data.compensaciones} min="0" />
            </Field>
            <Field label="Prima vacacional" hint={`Valor calculado: ${money(data.calcPrimaVacacional)}`}>
              <MoneyInput name="primaVacacional" defaultValue={data.primaVacacional} min="0" />
            </Field>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <Button type="button" tone="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Guardar importes aplicados</Button>
          </div>
        </form>
      </FormOverlayDialog>
    </div>
  );
}
