"use client";

import { saveActivityTypeAction } from "../ceo-actions";
import { ConfigEditDialog } from "../edit-dialog";
import { ActiveSelect, HiddenFields } from "../pieces";
import {
  Badge,
  Button,
  controlClass,
  FormActions,
  FormPanel,
  FormSection,
  Field,
  MobileCard,
  ResponsiveData,
  Table,
  Td,
  Th,
} from "@/components/ui";

type ActivityRow = {
  id: string;
  name: string;
  active: boolean;
};

export function ActividadesPanel({
  activities,
  filters,
}: {
  activities: ActivityRow[];
  filters: { q: string; estado?: string };
}) {
  return (
    <ResponsiveData
      table={
        <Table stickyHeader>
          <thead><tr><Th>Nombre</Th><Th>Estado</Th><Th>Acciones</Th></tr></thead>
          <tbody>
            {activities.map((activity) => (
              <tr key={activity.id}>
                <Td className="font-semibold text-slate-900">{activity.name}</Td>
                <Td><Badge tone={activity.active ? "ok" : "neutral"}>{activity.active ? "Activa" : "Inactiva"}</Badge></Td>
                <Td>
                  <ConfigEditDialog title={`Editar actividad · ${activity.name}`} titleId={`editar-actividad-${activity.id}`}>
                    <ActivityEditor activity={activity} filters={filters} />
                  </ConfigEditDialog>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      }
      cards={activities.map((activity) => (
        <MobileCard
          key={activity.id}
          title={activity.name}
          meta={<Badge tone={activity.active ? "ok" : "neutral"}>{activity.active ? "Activa" : "Inactiva"}</Badge>}
          footer={
            <div className="flex justify-end">
              <ConfigEditDialog title={`Editar actividad · ${activity.name}`} titleId={`editar-actividad-m-${activity.id}`}>
                <ActivityEditor activity={activity} filters={filters} />
              </ConfigEditDialog>
            </div>
          }
        />
      ))}
    />
  );
}

function ActivityEditor({ activity, filters }: { activity: ActivityRow; filters: { q: string; estado?: string } }) {
  return (
    <FormPanel action={saveActivityTypeAction} className="max-w-none border-0 shadow-none">
      <HiddenFields fields={{ id: activity.id, ...filters }} />
      <FormSection title={activity.name} description={activity.active ? "Activa" : "Inactiva"} columns={1}>
        <Field label="Nombre"><input name="name" required defaultValue={activity.name} className={controlClass} /></Field>
        <Field label="Estado"><ActiveSelect active={activity.active} /></Field>
      </FormSection>
      <FormActions><Button type="submit">Guardar actividad</Button></FormActions>
    </FormPanel>
  );
}
