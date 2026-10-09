import { redirect } from "next/navigation";
import { hireAction } from "../actions";
import { Button, controlClass, Field, FormActions, FormPanel, FormSection, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function NuevoColaboradorPage() {
  const session = await requireCompany();
  if (!can(session.role, "personnel.manage")) redirect("/personal");
  const [users, bosses] = await Promise.all([
    prisma.user.findMany({ where: { companyId: session.activeCompanyId, active: true, collaborator: null, role: { not: "KIOSCO_ASISTENCIA" } }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { active: true, role: { in: ["CEO", "GERENTE_OPERATIVO_SYSTRON", "GERENTE_OPERATIVO_SERVOMOTORES", "SUPERVISOR_TECNICO", "COORDINACION_ADMINISTRACION"] } }, orderBy: { name: "asc" } }),
  ]);
  return (
    <>
      <PageHeader back={{ href: "/personal", label: "Personal" }} title="Alta de colaborador" subtitle="Nuevo empieza sin saldo. Migrado conserva la fecha original y el saldo inicial." />
      <FormPanel action={hireAction}>
        <FormSection title="Persona y puesto" description="Vincula un usuario existente de la empresa y define jefe y fecha de ingreso.">
          <Field label="Usuario de esta empresa">
            <select name="userId" required className={controlClass} defaultValue="">
              <option value="">Selecciona</option>
              {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
            </select>
          </Field>
          <Field label="Tipo"><select name="hireKind" className={controlClass}><option value="NUEVO">Nuevo</option><option value="MIGRADO">Migrado</option></select></Field>
          <Field label="Fecha de ingreso"><input name="hiredAt" type="date" required className={controlClass} /></Field>
          <Field label="Jefe directo">
            <select name="bossUserId" className={controlClass} defaultValue="">
              <option value="">Sin jefe, solo si la regla lo permite</option>
              {bosses.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
            </select>
          </Field>
        </FormSection>
        <FormSection title="Compensación" description="Salarios diarios y hora extra. El saldo de vacaciones aplica en altas migradas.">
          <Field label="Salario diario timbrado"><input name="dailyStamped" type="number" min="0" step="0.01" defaultValue="0" className={controlClass} /></Field>
          <Field label="Salario diario en efectivo"><input name="dailyCash" type="number" min="0" step="0.01" defaultValue="0" className={controlClass} /></Field>
          <Field label="Saldo inicial de vacaciones, si es migrado"><input name="vacationBalance" type="number" min="0" step="0.5" defaultValue="0" className={controlClass} /></Field>
          <Field label="Tarifa base de hora extra"><input name="overtimeRate" type="number" min="0" step="0.01" defaultValue="0" className={controlClass} /></Field>
        </FormSection>
        <FormSection title="Timbrado" description="RFC requerido cuando se genere nómina.">
          <Field label="RFC para timbrar"><input name="rfc" className={controlClass} /></Field>
        </FormSection>
        <FormActions><Button type="submit">Guardar ficha</Button></FormActions>
      </FormPanel>
    </>
  );
}
