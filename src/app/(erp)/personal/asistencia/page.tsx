import { redirect } from "next/navigation";
import { attendanceAction } from "../actions";
import {
  ActiveFilters,
  Button,
  controlClass,
  Field,
  FormActions,
  FormPanel,
  FormSection,
  PageHeader,
  RecordLink,
  SegmentedNav,
} from "@/components/ui";
import { listHref } from "@/lib/list-url";
import { prisma } from "@/lib/db";
import { mexicoToday } from "@/lib/personnel";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function AsistenciaPage({ searchParams }: { searchParams: Promise<{ dia?: string; vista?: string }> }) {
  const session = await requireCompany();
  if (!can(session.role, "personnel.manage")) redirect("/inicio");
  const { dia, vista } = await searchParams;
  const today = mexicoToday();
  const day = dia && /^\d{4}-\d{2}-\d{2}$/.test(dia) ? dia : today;
  const vacations = vista === "vacaciones";
  const people = await prisma.collaborator.findMany({
    where: { companyId: session.activeCompanyId, status: "ACTIVO", exemptBenefits: false },
    include: { user: true, attendance: { where: { workDate: day } } },
    orderBy: { user: { name: "asc" } },
  });
  const listed = vacations ? people.filter((person) => person.attendance[0]?.status === "VACACIONES") : people;

  return (
    <>
      <PageHeader
        back={{ href: "/personal", label: "Personal" }}
        title={vacations ? "Vacaciones del día" : "Asistencia"}
        subtitle="Normal, retardo, ausencia, vacaciones, permiso y salida faltante. La salida faltante no descuenta."
      />
      <SegmentedNav
        items={[
          { href: listHref("/personal/asistencia", { dia: day !== today ? day : undefined }), label: "Asistencia", active: !vacations },
          { href: listHref("/personal/asistencia", { vista: "vacaciones", dia: day !== today ? day : undefined }), label: "Vacaciones", active: vacations },
        ]}
      />
      <form className="mb-4 flex flex-wrap items-end gap-2 rounded-xl border border-[var(--line)] bg-white p-4">
        <Field label="Día">
          <input name="dia" type="date" defaultValue={day} className={controlClass} />
        </Field>
        {vacations ? <input type="hidden" name="vista" value="vacaciones" /> : null}
        <Button type="submit" tone="ghost">Ver día</Button>
      </form>
      <ActiveFilters
        items={[
          ...(vacations ? [{ label: "Vacaciones", clearHref: listHref("/personal/asistencia", { dia: day !== today ? day : undefined }) }] : []),
          ...(day !== today ? [{ label: `Día ${day}`, clearHref: listHref("/personal/asistencia", { vista: vacations ? "vacaciones" : undefined }) }] : []),
        ]}
      />
      <ul className="space-y-2 text-sm">
        {listed.length === 0 ? (
          <li className="rounded-md border border-dashed border-[var(--line)] bg-white px-3 py-6 text-center text-[var(--muted)]">Sin registros para este día.</li>
        ) : (
          listed.map((person) => {
            const mark = person.attendance[0];
            return (
              <li key={person.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--line)] bg-white px-3 py-2">
                <RecordLink href={`/personal/${person.id}`}>{person.user.name}</RecordLink>
                <span className="text-[var(--muted)]">{mark?.status ?? "Sin marca"}</span>
              </li>
            );
          })
        )}
      </ul>
      <FormPanel id="registro-manual" action={attendanceAction} className="mt-4 scroll-mt-24">
        <FormSection title="Registro manual" description="Captura permisos, ausencias y correcciones con motivo obligatorio." columns={1}>
          <Field label="Colaborador">
            <select name="collaboratorId" className={controlClass}>
              {people.map((person) => <option key={person.id} value={person.id}>{person.user.name}</option>)}
            </select>
          </Field>
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
        </FormSection>
        <FormActions><Button type="submit">Guardar marca</Button></FormActions>
      </FormPanel>
    </>
  );
}
