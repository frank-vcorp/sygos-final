import { redirect } from "next/navigation";
import { vacationRequestAction } from "../actions";
import {
  Button,
  controlClass,
  Empty,
  EntityDetailHeader,
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

export default async function VacacionesPage() {
  const session = await requireCompany();
  if (!can(session.role, "overtime.capture", session.activeCompanyCode)) redirect("/inicio");

  const subordinates = await prisma.collaborator.findMany({
    where: {
      companyId: session.activeCompanyId,
      status: "ACTIVO",
      exemptBenefits: false,
      bossUserId: session.userId,
    },
    include: { user: true },
    orderBy: { user: { name: "asc" } },
  });

  const pending = await prisma.vacationRequest.findMany({
    where: {
      status: "PENDIENTE",
      collaborator: { companyId: session.activeCompanyId, bossUserId: session.userId },
    },
    include: { collaborator: { include: { user: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <>
      <PageHeader
        title="Vacaciones"
        subtitle="Registra vacaciones de tu equipo. Solo días hábiles consumen saldo."
      />
      {subordinates.length === 0 ? (
        <Empty title="Sin colaboradores a tu cargo" body="Las solicitudes de vacaciones las registra el jefe directo de cada colaborador." />
      ) : (
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
      )}
      <EntityDetailHeader title="Pendientes" subtitle="Solicitudes en espera de autorización." />
      {pending.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--muted)]">No hay vacaciones pendientes de tu equipo.</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {pending.map((row) => (
            <li key={row.id} className="rounded-lg border border-[var(--line)] bg-white px-4 py-3">
              <RecordLink href={`/personal/${row.collaboratorId}`}>{row.collaborator.user.name}</RecordLink>
              {" · "}
              {row.startDate} a {row.endDate} · {row.status}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
