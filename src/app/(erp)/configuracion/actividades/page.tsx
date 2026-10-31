import { redirect } from "next/navigation";
import { saveActivityTypeAction } from "../ceo-actions";
import { Button, controlClass, Field, FormActions, FormPanel, FormSection, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { requireCompany } from "@/lib/session";

export default async function ActividadesComercialesPage() {
  const session = await requireCompany();
  if (session.role !== "CEO") redirect("/inicio");
  const activities = await prisma.agendaCategory.findMany({
    where: { companyId: session.activeCompanyId },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <PageHeader
        title="Actividades comerciales"
        subtitle={`${session.activeCompanyName} · Tipos que ya usa la agenda.`}
      />
      <div className="max-w-3xl space-y-4">
        <FormPanel action={saveActivityTypeAction}>
          <FormSection title="Nuevo tipo" columns={1}>
            <Field label="Nombre"><input name="name" required className={controlClass} /></Field>
            <Field label="Estado">
              <select name="active" defaultValue="si" className={controlClass}>
                <option value="si">Activa</option>
                <option value="no">Inactiva</option>
              </select>
            </Field>
          </FormSection>
          <FormActions><Button type="submit">Agregar actividad</Button></FormActions>
        </FormPanel>
        {activities.map((activity) => (
          <FormPanel key={activity.id} action={saveActivityTypeAction}>
            <input type="hidden" name="id" value={activity.id} />
            <FormSection title={activity.name} description={activity.active ? "Activa" : "Inactiva"}>
              <Field label="Nombre"><input name="name" required defaultValue={activity.name} className={controlClass} /></Field>
              <Field label="Estado">
                <select name="active" defaultValue={activity.active ? "si" : "no"} className={controlClass}>
                  <option value="si">Activa</option>
                  <option value="no">Inactiva</option>
                </select>
              </Field>
            </FormSection>
            <FormActions><Button type="submit" tone="ghost">Guardar actividad</Button></FormActions>
          </FormPanel>
        ))}
      </div>
    </>
  );
}
