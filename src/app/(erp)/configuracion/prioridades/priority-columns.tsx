"use client";

import { saveDiagnosisPriorityAction, saveMantenimientoPriorityAction, saveRepairPriorityAction } from "../ceo-actions";
import { CreateDialog } from "../create-dialog";
import { ConfigEditDialog } from "../edit-dialog";
import { ActiveSelect } from "../pieces";
import {
  Badge,
  Button,
  controlClass,
  Empty,
  Field,
  FormActions,
  FormPanel,
  FormSection,
  MobileCard,
  MoneyInput,
  ResponsiveData,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { money } from "@/lib/money";

type PriorityRow = {
  id: string;
  name: string;
  active: boolean;
  price: number | null;
  incrementPct: number | null;
  slaMaxDays: number;
};

export function PriorityColumns({
  diagnosis,
  diagnosisMot = [],
  maintenance,
  maintenanceMot = [],
  repair,
}: {
  diagnosis: PriorityRow[];
  diagnosisMot?: PriorityRow[];
  maintenance?: PriorityRow[];
  maintenanceMot?: PriorityRow[];
  repair: PriorityRow[];
}) {
  return (
    <div className="grid items-start gap-8 lg:grid-cols-2 xl:grid-cols-3">
      <PriorityColumn mode="diagnostico" equipmentKind="EQUI" title="Diagnóstico · equipos (EQUI)" rows={diagnosis} />
      {diagnosisMot.length > 0 ? (
        <PriorityColumn mode="diagnostico" equipmentKind="MOT" title="Diagnóstico · motores (MOT)" rows={diagnosisMot} />
      ) : null}
      {maintenance && maintenance.length > 0 ? (
        <PriorityColumn mode="mantenimiento" equipmentKind="EQUI" title="Mantenimiento preventivo · EQUI" rows={maintenance} />
      ) : null}
      {maintenanceMot.length > 0 ? (
        <PriorityColumn mode="mantenimiento" equipmentKind="MOT" title="Mantenimiento preventivo · MOT" rows={maintenanceMot} />
      ) : null}
      <PriorityColumn mode="reparacion" equipmentKind="EQUI" title="Reparación / OS" rows={repair} />
    </div>
  );
}

function PriorityColumn({
  mode,
  rows,
  title,
  equipmentKind,
}: {
  mode: "diagnostico" | "reparacion" | "mantenimiento";
  rows: PriorityRow[];
  title: string;
  equipmentKind: "EQUI" | "MOT";
}) {
  const diagnosis = mode === "diagnostico";
  const mantenimiento = mode === "mantenimiento";
  const catalogPrice = diagnosis || mantenimiento;
  const saveAction = diagnosis ? saveDiagnosisPriorityAction : mantenimiento ? saveMantenimientoPriorityAction : saveRepairPriorityAction;

  return (
    <section className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900">{title}</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {catalogPrice ? "Nombre, activa, costo fijo y SLA en días." : "Nombre, activa, incremento % y SLA en días."}
          </p>
        </div>
        <CreateDialog
          label="Nueva"
          title={catalogPrice ? `Nueva prioridad · ${equipmentKind}` : "Nueva prioridad de reparación / OS"}
          titleId={diagnosis ? `nueva-prioridad-dx-${equipmentKind}` : mantenimiento ? `nueva-prioridad-mp-${equipmentKind}` : "nueva-prioridad-os"}
        >
          <form action={saveAction}>
            {catalogPrice ? <input type="hidden" name="equipmentKind" value={equipmentKind} /> : null}
            <FormSection title="Prioridad" description="No obliga a que exista el mismo nombre en el otro grupo." columns={1}>
              <Field label="Nombre"><input name="name" required autoFocus className={controlClass} /></Field>
              <Field label="Estado"><ActiveSelect /></Field>
              {catalogPrice ? (
                <Field label="Costo fijo"><MoneyInput name="price" defaultValue={0} /></Field>
              ) : (
                <Field label="Incremento %">
                  <input name="incrementPct" required defaultValue={0} inputMode="decimal" className={controlClass} />
                </Field>
              )}
              <Field label="SLA días">
                <input name="slaMaxDays" required type="number" min={1} step={1} className={controlClass} />
              </Field>
            </FormSection>
            <FormActions><Button type="submit">Crear prioridad</Button></FormActions>
          </form>
        </CreateDialog>
      </div>
      {rows.length === 0 ? (
        <Empty title="Sin prioridades" body="Agrega la primera con Nueva. El otro grupo no se copia solo." />
      ) : (
        <ResponsiveData
          table={
            <Table>
              <thead>
                <tr>
                  <Th>Nombre</Th>
                  <Th>Activa</Th>
                  <Th>{catalogPrice ? "Costo fijo" : "Incremento %"}</Th>
                  <Th>SLA días</Th>
                  <Th>Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <Td className="font-semibold text-slate-900">{row.name}</Td>
                    <Td><Badge tone={row.active ? "ok" : "neutral"}>{row.active ? "Sí" : "No"}</Badge></Td>
                    <Td>{catalogPrice ? money(row.price) : row.incrementPct == null ? "—" : `${row.incrementPct}%`}</Td>
                    <Td>{row.slaMaxDays}</Td>
                    <Td>
                      <ConfigEditDialog
                        title={diagnosis ? `Editar prioridad · ${row.name}` : `Editar prioridad · ${row.name}`}
                        titleId={`editar-prioridad-${mode}-${row.id}`}
                      >
                        <PriorityEditor mode={mode} priority={row} />
                      </ConfigEditDialog>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          }
          cards={rows.map((row) => (
            <MobileCard
              key={row.id}
              title={row.name}
              meta={<Badge tone={row.active ? "ok" : "neutral"}>{row.active ? "Activa" : "Inactiva"}</Badge>}
              footer={
                <div className="flex justify-end">
                  <ConfigEditDialog
                    title={`Editar prioridad · ${row.name}`}
                    titleId={`editar-prioridad-${mode}-m-${row.id}`}
                  >
                    <PriorityEditor mode={mode} priority={row} />
                  </ConfigEditDialog>
                </div>
              }
            >
              <p>{catalogPrice ? money(row.price) : row.incrementPct == null ? "—" : `${row.incrementPct}%`}</p>
              <p className="mt-1">SLA {row.slaMaxDays} días</p>
            </MobileCard>
          ))}
        />
      )}
    </section>
  );
}

function PriorityEditor({ mode, priority }: { mode: "diagnostico" | "reparacion" | "mantenimiento"; priority: PriorityRow }) {
  const catalogPrice = mode === "diagnostico" || mode === "mantenimiento";
  const saveAction = mode === "diagnostico" ? saveDiagnosisPriorityAction : mode === "mantenimiento" ? saveMantenimientoPriorityAction : saveRepairPriorityAction;
  return (
    <FormPanel action={saveAction} className="max-w-none border-0 shadow-none">
      <input type="hidden" name="priorityId" value={priority.id} />
      <FormSection title={priority.name} description={priority.active ? "Activa" : "Inactiva"} columns={1}>
        <Field label="Nombre"><input name="name" required defaultValue={priority.name} className={controlClass} /></Field>
        <Field label="Estado"><ActiveSelect active={priority.active} /></Field>
        {catalogPrice ? (
          <Field label="Costo fijo"><MoneyInput name="price" defaultValue={priority.price ?? 0} /></Field>
        ) : (
          <Field label="Incremento %">
            <input name="incrementPct" required defaultValue={priority.incrementPct ?? 0} inputMode="decimal" className={controlClass} />
          </Field>
        )}
        <Field label="SLA días">
          <input name="slaMaxDays" required type="number" min={1} step={1} defaultValue={priority.slaMaxDays} className={controlClass} />
        </Field>
      </FormSection>
      <FormActions>
        <Button type="submit">Guardar prioridad</Button>
      </FormActions>
    </FormPanel>
  );
}
