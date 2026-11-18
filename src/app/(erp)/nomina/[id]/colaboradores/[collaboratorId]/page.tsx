import { notFound, redirect } from "next/navigation";
import { retryPayrollAction } from "../../../actions";
import { CollaboratorPayrollBreakdown } from "./collaborator-payroll-breakdown";
import { Badge, Button, Card, EntityDetailHeader, EntityMetaItem } from "@/components/ui";
import { payrollFiscalBadgeInfo } from "@/lib/billing-badges";
import { prisma } from "@/lib/db";
import { money } from "@/lib/money";
import {
  canAdjustPayrollAmounts,
  isPayrollClosed,
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
  const closed = isPayrollClosed(period.status);
  const lineBadge = closed || line.fiscalStatus ? payrollFiscalBadgeInfo(line) : null;
  const canDownloadLine =
    line.fiscalStatus === "TIMBRADA" || Boolean(line.xmlContent) || Boolean(line.pdfContent);
  const canRetryLine =
    closed
    && line.transferTotal > 0
    && line.fiscalStatus !== "TIMBRADA"
    && line.fiscalStatus !== "CANCELADA";

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
          <span className="flex flex-wrap gap-1.5">
            <Badge tone={payrollStatusTone(period.status)}>
              {payrollStatusLabel(period.status)}
            </Badge>
            {lineBadge ? <Badge tone={lineBadge.tone}>{lineBadge.label}</Badge> : null}
          </span>
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

      {closed || line.fiscalStatus ? (
        <Card className="mb-4 p-4 text-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold text-slate-900">Recibo CFDI de nómina (tipo N)</h2>
                {lineBadge ? <Badge tone={lineBadge.tone}>{lineBadge.label}</Badge> : null}
              </div>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Importe timbrable (transferencia): {money(line.transferTotal)}
                {line.fiscalUuid ? ` · UUID: ${line.fiscalUuid}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {canDownloadLine ? (
                <>
                  <a
                    href={`/api/payroll/lines/${line.id}/pdf?download=1`}
                    className="inline-flex min-h-9 items-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    Descargar PDF
                  </a>
                  <a
                    href={`/api/payroll/lines/${line.id}/pdf`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-9 items-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    Ver PDF
                  </a>
                  <a
                    href={`/api/payroll/lines/${line.id}/xml`}
                    className="inline-flex min-h-9 items-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    Descargar XML
                  </a>
                  <a
                    href={`/api/payroll/lines/${line.id}/zip`}
                    className="inline-flex min-h-9 items-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    Descargar ZIP
                  </a>
                </>
              ) : null}
              {canRetryLine ? (
                <form action={retryPayrollAction}>
                  <input type="hidden" name="periodId" value={period.id} />
                  <input type="hidden" name="lineId" value={line.id} />
                  <input type="hidden" name="returnTo" value={`/nomina/${period.id}/colaboradores/${line.collaboratorId}`} />
                  <Button type="submit" tone="ghost">
                    {line.fiscalStatus === "PROCESANDO" ? "Consultar estatus" : "Reintentar timbrado"}
                  </Button>
                </form>
              ) : null}
            </div>
          </div>
          {line.fiscalEnv === "TEST" && line.fiscalStatus === "TIMBRADA" ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
              TIMBRE DE PRUEBA (SANDBOX): Este recibo se timbró con una llave sk_test_ de Facturapi y no tiene validez ante el SAT.
            </div>
          ) : null}
          {line.fiscalError ? (
            <p className="rounded-md bg-[var(--warn-soft)] px-3 py-2 text-xs">{line.fiscalError}</p>
          ) : null}
        </Card>
      ) : null}

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
