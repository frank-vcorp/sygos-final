import { redirect } from "next/navigation";
import { overtimeAction, overtimeReviewAction, vacationRequestAction } from "../actions";
import {
  ActionLink,
  Button,
  controlClass,
  DetailAnchorButton,
  EntityDetailHeader,
  Field,
  FormActions,
  FormPanel,
  FormSection,
  MobileCard,
  RecordLink,
  ResponsiveData,
} from "@/components/ui";
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
    : await prisma.collaborator.findMany({
        where: {
          companyId: session.activeCompanyId,
          status: "ACTIVO",
          exemptBenefits: false,
          OR: [{ userId: session.userId }, { bossUserId: session.userId }],
        },
        include: { user: true },
      });
  const subordinates = mine.filter((row) => row.bossUserId === session.userId);
  const pending = await prisma.overtimeRequest.findMany({
    where: { collaborator: { companyId: session.activeCompanyId }, status: { in: ["PENDIENTE_JEFE", "PENDIENTE_CEO", "AUTORIZADA"] } },
    include: { collaborator: { include: { user: true } } },
    orderBy: { createdAt: "desc" },
  });
  const awaitingReview = pending.filter((row) => row.status !== "AUTORIZADA");

  return (
    <>
      <EntityDetailHeader
        back={{ href: "/personal", label: "Personal" }}
        title="Horas extra"
        subtitle="De la 1 a la 9 de la semana son dobles; de la 10 en adelante, triples. El empleado no elige el factor."
        primaryAction={
          <>
            <DetailAnchorButton href="#registrar-horas">Registrar horas</DetailAnchorButton>
            {awaitingReview.length > 0 ? (
              <ActionLink href="#pendientes-horas" tone="ghost">Revisar pendientes ({awaitingReview.length})</ActionLink>
            ) : null}
          </>
        }
      />
      {subordinates.length > 0 ? (
        <FormPanel action={vacationRequestAction} className="mb-4">
          <FormSection title="Vacaciones de un subordinado" description="Las pide el jefe. Solo lunes a viernes consumen saldo." columns={1}>
            <Field label="Colaborador">
              <select name="collaboratorId" className={controlClass}>
                {subordinates.map((row) => <option key={row.id} value={row.id}>{row.user.name}</option>)}
              </select>
            </Field>
            <Field label="Del"><input name="startDate" type="date" required className={controlClass} /></Field>
            <Field label="Al"><input name="endDate" type="date" required className={controlClass} /></Field>
          </FormSection>
          <FormActions><Button type="submit" tone="ghost">Solicitar vacaciones</Button></FormActions>
        </FormPanel>
      ) : null}
      <FormPanel id="registrar-horas" action={overtimeAction} className="scroll-mt-24">
        <FormSection title="Registro de horas extra" description="Indica colaborador, fecha, horario y motivo.">
          <Field label="Colaborador">
            <select name="collaboratorId" className={controlClass}>
              {mine.map((row) => <option key={row.id} value={row.id}>{row.user.name}</option>)}
            </select>
          </Field>
          <Field label="Fecha"><input name="workDate" type="date" required defaultValue={mexicoToday()} className={controlClass} /></Field>
          <Field label="Inicio"><input name="startedAt" type="time" required className={controlClass} /></Field>
          <Field label="Fin"><input name="endedAt" type="time" required className={controlClass} /></Field>
          <Field label="Motivo"><input name="reason" required className={controlClass} /></Field>
        </FormSection>
        <FormActions><Button type="submit">Registrar</Button></FormActions>
      </FormPanel>
      <section id="pendientes-horas" className="mt-6 scroll-mt-24">
        <h2 className="font-medium">Solicitudes</h2>
        {pending.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted)]">No hay horas extra en curso.</p>
        ) : (
          <div className="mt-3">
            <ResponsiveData
              table={
                <ul className="space-y-2 text-sm">
                  {pending.map((row) => (
                    <li key={row.id} className="rounded-lg border border-[var(--line)] bg-white px-4 py-3">
                      <p>
                        <RecordLink href={`/personal/${row.collaboratorId}`}>{row.collaborator.user.name}</RecordLink>
                        {" · "}
                        {row.workDate} · {row.startedAt} a {row.endedAt} · {row.hours} h · {row.status}
                      </p>
                      {row.status === "AUTORIZADA" ? (
                        <p className="mt-1 text-[var(--muted)]">Doble {row.doubleHours} · triple {row.tripleHours}</p>
                      ) : (
                        <form action={overtimeReviewAction} className="mt-2 flex gap-2">
                          <input type="hidden" name="overtimeId" value={row.id} />
                          <input type="hidden" name="version" value={row.version} />
                          <Button type="submit" name="decision" value="si" tone="ghost">Aprobar</Button>
                          <Button type="submit" name="decision" value="no" tone="ghost">Rechazar</Button>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              }
              cards={pending.map((row) => (
                <MobileCard
                  key={row.id}
                  href={`/personal/${row.collaboratorId}`}
                  title={row.collaborator.user.name}
                  meta={<span className="text-xs">{row.status}</span>}
                  footer={
                    row.status === "AUTORIZADA"
                      ? undefined
                      : (
                        <form action={overtimeReviewAction} className="flex flex-wrap gap-2">
                          <input type="hidden" name="overtimeId" value={row.id} />
                          <input type="hidden" name="version" value={row.version} />
                          <Button type="submit" name="decision" value="si" tone="ghost">Aprobar</Button>
                          <Button type="submit" name="decision" value="no" tone="ghost">Rechazar</Button>
                        </form>
                      )
                  }
                >
                  <p>{row.workDate} · {row.startedAt} a {row.endedAt} · {row.hours} h</p>
                  {row.status === "AUTORIZADA" ? <p>Doble {row.doubleHours} · triple {row.tripleHours}</p> : null}
                </MobileCard>
              ))}
            />
          </div>
        )}
      </section>
    </>
  );
}
