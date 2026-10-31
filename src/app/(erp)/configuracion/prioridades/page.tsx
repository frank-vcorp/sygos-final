import type { Priority } from "@prisma/client";
import { saveDiagnosisPriorityAction, saveRepairPriorityAction } from "../ceo-actions";
import { CreateDialog } from "../create-dialog";
import { requireCeoConfig } from "../guard";
import { ActiveSelect, EditorPlaceholder, SelectLink, selectedRowClass } from "../pieces";
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
  PageHeader,
  ResponsiveData,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { prisma } from "@/lib/db";
import { listHref } from "@/lib/list-url";
import { money } from "@/lib/money";

export default async function OperacionTecnicaPage({
  searchParams,
}: {
  searchParams: Promise<{ dx?: string; os?: string }>;
}) {
  const session = await requireCeoConfig();
  const { dx, os } = await searchParams;
  const [diagnosis, repair] = await Promise.all([
    prisma.priority.findMany({
      where: { companyId: session.activeCompanyId, attentionType: "DIAGNOSTICO" },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.priority.findMany({
      where: { companyId: session.activeCompanyId, attentionType: "REPARACION" },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  return (
    <>
      <PageHeader
        back={{ href: "/configuracion", label: "Configuración" }}
        title="Operación técnica"
        subtitle={`${session.activeCompanyName} · Diagnóstico y reparación / OS son listas independientes, aunque el nombre coincida.`}
      />
      <div className="grid items-start gap-8 lg:grid-cols-2">
        <PriorityColumn mode="diagnostico" rows={diagnosis} selectedId={dx} otherId={os} />
        <PriorityColumn mode="reparacion" rows={repair} selectedId={os} otherId={dx} />
      </div>
    </>
  );
}

function PriorityColumn({
  mode,
  rows,
  selectedId,
  otherId,
}: {
  mode: "diagnostico" | "reparacion";
  rows: Priority[];
  selectedId?: string;
  otherId?: string;
}) {
  const diagnosis = mode === "diagnostico";
  const selected = rows.find((row) => row.id === selectedId) ?? null;
  const hrefFor = (id: string) => listHref("/configuracion/prioridades", {
    dx: diagnosis ? id : otherId,
    os: diagnosis ? otherId : id,
  });

  return (
    <section className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900">{diagnosis ? "Diagnóstico" : "Reparación / OS"}</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {diagnosis ? "Nombre, activa, costo fijo y SLA en días." : "Nombre, activa, incremento % y SLA en días."}
          </p>
        </div>
        <CreateDialog
          label="Nueva"
          title={diagnosis ? "Nueva prioridad de diagnóstico" : "Nueva prioridad de reparación / OS"}
          titleId={diagnosis ? "nueva-prioridad-dx" : "nueva-prioridad-os"}
        >
          <form action={diagnosis ? saveDiagnosisPriorityAction : saveRepairPriorityAction}>
            {otherId ? <input type="hidden" name={diagnosis ? "os" : "dx"} value={otherId} /> : null}
            <FormSection title="Prioridad" description="No obliga a que exista el mismo nombre en el otro grupo." columns={1}>
              <Field label="Nombre"><input name="name" required autoFocus className={controlClass} /></Field>
              <Field label="Estado"><ActiveSelect /></Field>
              {diagnosis ? (
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
        <>
          <ResponsiveData
            table={
              <Table>
                <thead>
                  <tr>
                    <Th>Nombre</Th>
                    <Th>Activa</Th>
                    <Th>{diagnosis ? "Costo fijo" : "Incremento %"}</Th>
                    <Th>SLA días</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const isSelected = row.id === selectedId;
                    return (
                      <tr key={row.id} className={selectedRowClass(isSelected)}>
                        <Td><SelectLink href={hrefFor(row.id)} selected={isSelected}>{row.name}</SelectLink></Td>
                        <Td><Badge tone={row.active ? "ok" : "neutral"}>{row.active ? "Sí" : "No"}</Badge></Td>
                        <Td>{diagnosis ? money(row.price) : row.incrementPct == null ? "—" : `${row.incrementPct}%`}</Td>
                        <Td>{row.slaMaxDays}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            }
            cards={rows.map((row) => (
              <MobileCard
                key={row.id}
                href={hrefFor(row.id)}
                title={row.name}
                meta={<Badge tone={row.active ? "ok" : "neutral"}>{row.active ? "Activa" : "Inactiva"}</Badge>}
              >
                <p>{diagnosis ? money(row.price) : row.incrementPct == null ? "—" : `${row.incrementPct}%`}</p>
                <p className="mt-1">SLA {row.slaMaxDays} días</p>
              </MobileCard>
            ))}
          />
          <div className="mt-4">
            {selected ? (
              <PriorityEditor mode={mode} priority={selected} otherId={otherId} />
            ) : (
              <EditorPlaceholder title="Sin selección" body="Elige una prioridad de esta lista para editarla." />
            )}
          </div>
        </>
      )}
    </section>
  );
}

function PriorityEditor({
  mode,
  priority,
  otherId,
}: {
  mode: "diagnostico" | "reparacion";
  priority: Priority;
  otherId?: string;
}) {
  const diagnosis = mode === "diagnostico";
  return (
    <FormPanel action={diagnosis ? saveDiagnosisPriorityAction : saveRepairPriorityAction} className="max-w-none">
      <input type="hidden" name="priorityId" value={priority.id} />
      {otherId ? <input type="hidden" name={diagnosis ? "os" : "dx"} value={otherId} /> : null}
      <FormSection title={priority.name} description={priority.active ? "Activa" : "Inactiva"} columns={1}>
        <Field label="Nombre"><input name="name" required defaultValue={priority.name} className={controlClass} /></Field>
        <Field label="Estado"><ActiveSelect active={priority.active} /></Field>
        {diagnosis ? (
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
