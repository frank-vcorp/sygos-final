import { redirect } from "next/navigation";
import { vacationRequestAction } from "../actions";
import {
  Badge,
  Button,
  Card,
  controlClass,
  Empty,
  EntityDetailHeader,
  EntityMetaItem,
  Field,
  FormActions,
  FormPanel,
  FormSection,
  PageHeader,
  RecordLink,
} from "@/components/ui";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";
import { VACATION_STATUS_LABEL } from "@/lib/vacation-labels";

function vacationStatusLabel(status: string) {
  return VACATION_STATUS_LABEL[status] ?? status;
}

function MisVacaciones({
  row,
}: {
  row: {
    vacationBalance: number;
    boss: { name: string } | null;
    vacations: Array<{ id: string; startDate: string; endDate: string; status: string; createdAt: Date }>;
  };
}) {
  return (
    <section className="mb-8">
      <Card className="p-5">
        <h2 className="text-base font-bold tracking-tight text-[var(--ink)]">Mis vacaciones</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          No solicitas fechas aquí: las registra tu jefe directo y el CEO o Administrador autoriza.
        </p>
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <EntityMetaItem label="Saldo disponible">{row.vacationBalance} días hábiles</EntityMetaItem>
          <EntityMetaItem label="Jefe directo">{row.boss?.name ?? "Sin jefe asignado"}</EntityMetaItem>
        </div>
      </Card>
      <div className="mt-4">
        <h3 className="text-sm font-semibold text-[var(--ink)]">Solicitudes</h3>
        {row.vacations.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted)]">Aún no hay solicitudes registradas a tu nombre.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {row.vacations.map((vacation) => (
              <li key={vacation.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--line)] bg-white px-4 py-3">
                <span>
                  {vacation.startDate} a {vacation.endDate}
                </span>
                <Badge tone={vacation.status === "AUTORIZADA" ? "ok" : vacation.status === "RECHAZADA" ? "warn" : "neutral"}>
                  {vacationStatusLabel(vacation.status)}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function VacacionesEquipo({
  subordinates,
  pending,
}: {
  subordinates: Array<{ id: string; user: { name: string } }>;
  pending: Array<{
    id: string;
    collaboratorId: string;
    startDate: string;
    endDate: string;
    status: string;
    collaborator: { user: { name: string } };
  }>;
}) {
  return (
    <section>
      <EntityDetailHeader title="Vacaciones del equipo" subtitle="Registra fechas para quienes reportan contigo." />
      <FormPanel action={vacationRequestAction} className="mb-6 max-w-xl">
        <FormSection title="Nueva solicitud" description="Quedan pendientes de autorización del CEO." columns={1}>
          <Field label="Colaborador">
            <select name="collaboratorId" className={controlClass} required>
              {subordinates.map((row) => (
                <option key={row.id} value={row.id}>{row.user.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Del"><input name="startDate" type="date" required className={controlClass} /></Field>
          <Field label="Al"><input name="endDate" type="date" required className={controlClass} /></Field>
        </FormSection>
        <FormActions><Button type="submit">Solicitar vacaciones</Button></FormActions>
      </FormPanel>
      <h3 className="text-sm font-semibold text-[var(--ink)]">Pendientes de autorización</h3>
      {pending.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--muted)]">No hay vacaciones pendientes de tu equipo.</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {pending.map((row) => (
            <li key={row.id} className="rounded-lg border border-[var(--line)] bg-white px-4 py-3">
              <RecordLink href={`/personal/${row.collaboratorId}`}>{row.collaborator.user.name}</RecordLink>
              {" · "}
              {row.startDate} a {row.endDate} · {vacationStatusLabel(row.status)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function VacacionesPage() {
  const session = await requireCompany();
  if (!can(session.role, "overtime.capture", session.activeCompanyCode)) redirect("/inicio");

  const [self, subordinates] = await Promise.all([
    prisma.collaborator.findFirst({
      where: { companyId: session.activeCompanyId, userId: session.userId, status: "ACTIVO" },
      include: {
        boss: true,
        vacations: { orderBy: { createdAt: "desc" }, take: 30 },
      },
    }),
    prisma.collaborator.findMany({
      where: {
        companyId: session.activeCompanyId,
        status: "ACTIVO",
        exemptBenefits: false,
        bossUserId: session.userId,
      },
      include: { user: true },
      orderBy: { user: { name: "asc" } },
    }),
  ]);

  const pending =
    subordinates.length > 0
      ? await prisma.vacationRequest.findMany({
          where: {
            status: "PENDIENTE",
            collaborator: { companyId: session.activeCompanyId, bossUserId: session.userId },
          },
          include: { collaborator: { include: { user: true } } },
          orderBy: { createdAt: "desc" },
          take: 50,
        })
      : [];

  const showSelf = self != null && !self.exemptBenefits;
  const showTeam = subordinates.length > 0;
  const subtitle = showTeam && showSelf
    ? "Consulta tu saldo y registra vacaciones de tu equipo."
    : showTeam
      ? "Registra vacaciones de quienes reportan contigo."
      : "Consulta tu saldo y el estado de tus solicitudes.";

  return (
    <>
      <PageHeader title="Vacaciones" subtitle={subtitle} />
      {showSelf ? <MisVacaciones row={self} /> : null}
      {showTeam ? <VacacionesEquipo subordinates={subordinates} pending={pending} /> : null}
      {!showSelf && !showTeam ? (
        self?.exemptBenefits ? (
          <Empty
            title="Sin prestaciones de vacaciones"
            body="Tu perfil laboral no incluye vacaciones en el sistema (regla de excepción)."
          />
        ) : (
          <Empty
            title="Sin registro de colaborador"
            body="No hay ficha activa de Personal para tu usuario en esta empresa. Vacaciones y saldo los administra Coordinación o tu jefe."
          />
        )
      ) : null}
    </>
  );
}
