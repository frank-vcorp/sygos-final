import { redirect } from "next/navigation";
import { attendanceAction } from "../actions";
import { controlClass, Field, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { mexicoToday } from "@/lib/personnel";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function AsistenciaPage({ searchParams }: { searchParams: Promise<{ dia?: string; vista?: string }> }) {
  const session = await requireCompany();
  if (!can(session.role, "personnel.manage")) redirect("/inicio");
  const { dia, vista } = await searchParams;
  const day = dia && /^\d{4}-\d{2}-\d{2}$/.test(dia) ? dia : mexicoToday();
  const people = await prisma.collaborator.findMany({ where: { companyId: session.activeCompanyId, status: "ACTIVO", exemptBenefits: false }, include: { user: true, attendance: { where: { workDate: day } } }, orderBy: { user: { name: "asc" } } });
  const listed = vista === "vacaciones" ? people.filter((person) => person.attendance[0]?.status === "VACACIONES") : people;
  return (
    <>
      <PageHeader title={vista === "vacaciones" ? "Vacaciones" : "Asistencia"} subtitle="Normal, retardo, ausencia, vacaciones, permiso y salida faltante. La salida faltante no descuenta." />
      <form className="mb-4">
        <input name="dia" type="date" defaultValue={day} className="rounded-md border border-[var(--line)] px-3 py-2 text-sm" />
        {vista === "vacaciones" ? <input type="hidden" name="vista" value="vacaciones" /> : null}
        <button className="ml-2 rounded-md border border-[var(--line)] px-3 py-2 text-sm">Ver día</button>
      </form>
      <ul className="space-y-2 text-sm">
        {listed.map((person) => {
          const mark = person.attendance[0];
          return <li key={person.id} className="rounded-md border border-[var(--line)] bg-white px-3 py-2">{person.user.name} · {mark?.status ?? "Sin marca"}</li>;
        })}
      </ul>
      <form action={attendanceAction} className="mt-4 grid max-w-xl gap-2 rounded-lg border border-[var(--line)] bg-white p-4">
        <h2 className="font-medium">Registro manual</h2>
        <Field label="Colaborador"><select name="collaboratorId" className={controlClass}>{people.map((person) => <option key={person.id} value={person.id}>{person.user.name}</option>)}</select></Field>
        <Field label="Fecha"><input name="workDate" type="date" required defaultValue={day} className={controlClass} /></Field>
        <Field label="Resultado">
          <select name="status" className={controlClass}>
            <option value="PERMISO">Permiso</option>
            <option value="AUSENCIA">Ausencia</option>
            <option value="RETARDO">Retardo</option>
            <option value="NORMAL">Normal</option>
            <option value="SALIDA_FALTANTE">Salida faltante</option>
          </select>
        </Field>
        <Field label="Motivo"><input name="note" required className={controlClass} /></Field>
        <label className="text-sm"><input type="checkbox" name="justified" value="si" /> Justificada, no descalifica bono</label>
        <label className="text-sm"><input type="checkbox" name="paidLeave" value="si" /> Permiso con goce</label>
        <button className="w-fit rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white">Guardar</button>
      </form>
    </>
  );
}
