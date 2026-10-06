import { redirect } from "next/navigation";
import { overtimeAction, overtimeReviewAction } from "../actions";
import { controlClass, Field, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { mexicoToday } from "@/lib/personnel";
import { requireCompany } from "@/lib/session";

export default async function HorasPage() {
  const session = await requireCompany();
  const capture = can(session.role, "overtime.capture", session.activeCompanyCode) || can(session.role, "personnel.authorize");
  if (!capture) redirect("/inicio");
  const mine = session.role === "GERENTE_OPERATIVO_SERVOMOTORES"
    ? await prisma.collaborator.findMany({ where: { companyId: session.activeCompanyId, status: "ACTIVO", user: { role: "AYUDANTE_GENERAL" } }, include: { user: true } })
    : await prisma.collaborator.findMany({ where: { companyId: session.activeCompanyId, status: "ACTIVO", exemptBenefits: false, OR: [{ userId: session.userId }, { bossUserId: session.userId }] }, include: { user: true } });
  const pending = await prisma.overtimeRequest.findMany({
    where: { collaborator: { companyId: session.activeCompanyId }, status: { in: ["PENDIENTE_JEFE", "PENDIENTE_CEO", "AUTORIZADA"] } },
    include: { collaborator: { include: { user: true } } },
    orderBy: { createdAt: "desc" },
  });
  return (
    <>
      <PageHeader title="Horas extra" subtitle="El empleado no elige doble o triple. De la 1 a la 9 de la semana son dobles; de la 10 en adelante, triples." />
      <form action={overtimeAction} className="grid max-w-xl gap-2 rounded-lg border border-[var(--line)] bg-white p-4">
        <Field label="Colaborador">
          <select name="collaboratorId" className={controlClass}>
            {mine.map((row) => <option key={row.id} value={row.id}>{row.user.name}</option>)}
          </select>
        </Field>
        <Field label="Fecha"><input name="workDate" type="date" required defaultValue={mexicoToday()} className={controlClass} /></Field>
        <Field label="Inicio"><input name="startedAt" type="time" required className={controlClass} /></Field>
        <Field label="Fin"><input name="endedAt" type="time" required className={controlClass} /></Field>
        <Field label="Motivo"><input name="reason" required className={controlClass} /></Field>
        <button className="w-fit rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white">Registrar</button>
      </form>
      <ul className="mt-4 space-y-3 text-sm">
        {pending.map((row) => (
          <li key={row.id} className="rounded-md border border-[var(--line)] bg-white px-3 py-2">
            {row.collaborator.user.name} · {row.workDate} · {row.startedAt} a {row.endedAt} · {row.hours} h · {row.status}
            {row.status === "AUTORIZADA" ? ` · doble ${row.doubleHours} · triple ${row.tripleHours}` : null}
            {row.status !== "AUTORIZADA" ? (
              <form action={overtimeReviewAction} className="mt-2 flex gap-2">
                <input type="hidden" name="overtimeId" value={row.id} />
                <input type="hidden" name="version" value={row.version} />
                <button name="decision" value="si" className="text-[var(--accent)]">Aprobar</button>
                <button name="decision" value="no">Rechazar</button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}
