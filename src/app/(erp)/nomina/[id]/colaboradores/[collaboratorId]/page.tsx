import { notFound, redirect } from "next/navigation";
import { CollaboratorPayrollBreakdown } from "./collaborator-payroll-breakdown";
import { Badge, EntityDetailHeader, EntityMetaItem } from "@/components/ui";
import { prisma } from "@/lib/db";
import { money } from "@/lib/money";
import {
  canAdjustPayrollAmounts,
  parsePayrollOrigins,
  payrollStatusLabel,
  payrollStatusTone,
  visiblePayrollAmounts,
} from "@/lib/payroll";
import { can } from "@/lib/permissions";
import { ROLE_LABEL, isRole } from "@/lib/roles";
import { requireCompany } from "@/lib/session";

export default async function NominaColaboradorDetallePage({
  params,
}: {
  params: Promise<{ id: string; collaboratorId: string }>;
}) {
  const session = await requireCompany();
  if (!can(session.role, "personnel.manage") && !can(session.role, "personnel.authorize")) {
    redirect("/inicio");
  }
  const { id, collaboratorId } = await params;

  const period = await prisma.payrollPeriod.findFirst({
    where: { id, companyId: session.activeCompanyId },
  });
  if (!period) notFound();

  const line = await prisma.payrollLine.findUnique({
    where: { periodId_collaboratorId: { periodId: period.id, collaboratorId } },
    include: { collaborator: { include: { user: true } } },
  });
  if (!line) notFound();

  const editable = canAdjustPayrollAmounts(session.role, period.status);
  const origins = parsePayrollOrigins(line.originsJson);
  const jobLabel =
    (line.collaborator.jobTitle && line.collaborator.jobTitle.trim()) ||
    (isRole(line.collaborator.user.role)
      ? ROLE_LABEL[line.collaborator.user.role]
      : line.collaborator.user.role);

  const periodDisplay = period.periodLabel || `${period.periodStart} a ${period.periodEnd}`;
  const paymentDisplay = period.paymentDate || period.periodEnd;

  const amounts = visiblePayrollAmounts(line);

  return (
    <>
      <EntityDetailHeader
        back={{
          href: `/nomina/${period.id}?tab=colaboradores`,
          label: `Personal > Nómina > ${period.folio}`,
        }}
        title={line.collaborator.user.name}
        subtitle={`Personal > Nómina > ${period.folio} > ${line.collaborator.user.name} · ${jobLabel}`}
        status={
          <Badge tone={payrollStatusTone(period.status)}>
            {payrollStatusLabel(period.status)}
          </Badge>
        }
        meta={
          <>
            <EntityMetaItem label="Nómina">{period.folio}</EntityMetaItem>
            <EntityMetaItem label="Periodo">{periodDisplay}</EntityMetaItem>
            <EntityMetaItem label="Fecha de pago">{paymentDisplay}</EntityMetaItem>
            <EntityMetaItem label="Total aplicado">{money(amounts.total)}</EntityMetaItem>
          </>
        }
      />

      <CollaboratorPayrollBreakdown
        data={{
          periodId: period.id,
          collaboratorId: line.collaboratorId,
          editable,
          calcSueldo: amounts.calcSueldo,
          calcHorasExtra: amounts.calcHorasExtra,
          calcBonos: amounts.calcBonos,
          calcComision: amounts.calcComision,
          calcCompensaciones: amounts.calcCompensaciones,
          calcPrimaVacacional: amounts.calcPrimaVacacional,
          sueldo: amounts.sueldo,
          horasExtra: amounts.horasExtra,
          bonos: amounts.bonos,
          comision: amounts.comision,
          compensaciones: amounts.compensaciones,
          primaVacacional: amounts.primaVacacional,
          origins,
        }}
      />
    </>
  );
}
