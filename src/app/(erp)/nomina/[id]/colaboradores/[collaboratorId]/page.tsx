import { notFound, redirect } from "next/navigation";
import { CollaboratorPayrollBreakdown } from "./collaborator-payroll-breakdown";
import { Badge, EntityDetailHeader, EntityMetaItem } from "@/components/ui";
import { prisma } from "@/lib/db";
import { money } from "@/lib/money";
import {
  isPayrollEditable,
  parsePayrollOrigins,
  payrollStatusLabel,
  payrollStatusTone,
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

  const editable = isPayrollEditable(period.status);
  const origins = parsePayrollOrigins(line.originsJson);
  const jobLabel =
    (line.collaborator.jobTitle && line.collaborator.jobTitle.trim()) ||
    (isRole(line.collaborator.user.role)
      ? ROLE_LABEL[line.collaborator.user.role]
      : line.collaborator.user.role);

  const periodDisplay = period.periodLabel || `${period.periodStart} a ${period.periodEnd}`;
  const paymentDisplay = period.paymentDate || period.periodEnd;

  const sueldo = line.sueldo !== 0 || line.calcSueldo !== 0 ? line.sueldo : line.stampedBase + line.cashBase;
  const calcSueldo = line.calcSueldo !== 0 ? line.calcSueldo : sueldo;
  const horasExtra = line.horasExtra !== 0 || line.calcHorasExtra !== 0 ? line.horasExtra : line.overtimeStamped + line.overtimeCash;
  const calcHorasExtra = line.calcHorasExtra !== 0 ? line.calcHorasExtra : horasExtra;
  const bonos = line.bonos !== 0 || line.calcBonos !== 0 ? line.bonos : line.bonus;
  const calcBonos = line.calcBonos !== 0 ? line.calcBonos : bonos;
  const descuentos = line.descuentos !== 0 || line.calcDescuentos !== 0 ? line.descuentos : line.discountStamped + line.discountCash;
  const calcDescuentos = line.calcDescuentos !== 0 ? line.calcDescuentos : descuentos;
  const totalPagar = line.totalPagar !== 0 || line.totalPercepciones !== 0 ? line.totalPagar : line.transferTotal + line.cashTotal;
  const totalPercepciones =
    line.totalPercepciones !== 0 ? line.totalPercepciones : totalPagar + descuentos;

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
            <EntityMetaItem label="Total aplicado">{money(totalPagar)}</EntityMetaItem>
          </>
        }
      />

      <CollaboratorPayrollBreakdown
        data={{
          periodId: period.id,
          collaboratorId: line.collaboratorId,
          editable,
          calcSueldo,
          calcHorasExtra,
          calcBonos,
          calcComision: line.calcComision,
          calcCompensaciones: line.calcCompensaciones,
          calcPrimaVacacional: line.calcPrimaVacacional,
          calcOtrosConceptos: line.calcOtrosConceptos,
          calcDescuentos,
          sueldo,
          horasExtra,
          bonos,
          comision: line.comision,
          compensaciones: line.compensaciones,
          primaVacacional: line.primaVacacional,
          otrosConceptos: line.otrosConceptos,
          descuentos,
          totalPercepciones,
          totalPagar,
          origins,
        }}
      />
    </>
  );
}
