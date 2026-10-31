import { notFound, redirect } from "next/navigation";
import {
  returnPayrollToCorrectionAction,
  sendPayrollToValidationAction,
  validateAndClosePayrollAction,
} from "../actions";
import { PayrollDocumentosTab } from "./payroll-documentos-tab";
import {
  Badge,
  Button,
  Card,
  Empty,
  EntityDetailHeader,
  EntityMetaItem,
  MobileCard,
  RecordLink,
  ResponsiveData,
  SegmentedNav,
  Table,
  Td,
  Th,
  TextLink,
} from "@/components/ui";
import { prisma } from "@/lib/db";
import { money, roundMoney } from "@/lib/money";
import {
  getPayrollPendingWarnings,
  isPayrollEditable,
  payrollStatusLabel,
  payrollStatusTone,
  visiblePayrollAmounts,
} from "@/lib/payroll";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function NominaDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await requireCompany();
  if (!can(session.role, "personnel.manage") && !can(session.role, "personnel.authorize")) {
    redirect("/inicio");
  }
  const { id } = await params;
  const query = await searchParams;
  const activeTab =
    query.tab === "colaboradores" || query.tab === "documentos"
      ? query.tab
      : "resumen";

  const row = await prisma.payrollPeriod.findFirst({
    where: { id, companyId: session.activeCompanyId },
    include: {
      lines: {
        include: { collaborator: { include: { user: true } } },
        orderBy: { collaborator: { user: { name: "asc" } } },
      },
      documents: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!row) notFound();

  const isCeo = can(session.role, "personnel.authorize");
  const editable = isPayrollEditable(row.status);
  const pendingValidation = row.status === "PENDIENTE_VALIDACION";

  const warnings = await getPayrollPendingWarnings(
    session.activeCompanyId,
    row.periodStart,
    row.periodEnd,
    row.lines.map((l) => l.collaboratorId),
  );

  const periodDisplay = row.periodLabel || `${row.periodStart} a ${row.periodEnd}`;
  const paymentDisplay = row.paymentDate || row.periodEnd;

  const totalPercepciones = roundMoney(
    row.lines.reduce(
      (sum, l) =>
        sum +
        (l.totalPercepciones !== 0
          ? l.totalPercepciones
          : l.stampedBase + l.cashBase + l.overtimeStamped + l.overtimeCash + l.primaStamped + l.primaCash + l.bonus + l.extraStamped + l.extraCash),
      0,
    ),
  );
  const totalDescuentos = roundMoney(
    row.lines.reduce(
      (sum, l) =>
        sum + (l.descuentos !== 0 ? l.descuentos : l.discountStamped + l.discountCash),
      0,
    ),
  );
  const totalPagar = roundMoney(
    row.lines.reduce(
      (sum, l) =>
        sum + (l.totalPagar !== 0 ? l.totalPagar : l.transferTotal + l.cashTotal),
      0,
    ),
  );

  let primaryAction: React.ReactNode = null;
  let secondaryActions: React.ReactNode = null;

  if (editable) {
    primaryAction = (
      <form action={sendPayrollToValidationAction} className="inline">
        <input type="hidden" name="periodId" value={row.id} />
        <input type="hidden" name="version" value={row.version} />
        <Button type="submit">Enviar a validación</Button>
      </form>
    );
  } else if (pendingValidation && isCeo) {
    primaryAction = (
      <div className="flex flex-wrap items-center gap-2">
        <form action={validateAndClosePayrollAction} className="inline">
          <input type="hidden" name="periodId" value={row.id} />
          <input type="hidden" name="version" value={row.version} />
          <Button type="submit">Validar nómina</Button>
        </form>
        <form action={returnPayrollToCorrectionAction} className="inline">
          <input type="hidden" name="periodId" value={row.id} />
          <input type="hidden" name="version" value={row.version} />
          <Button type="submit" tone="ghost">
            Regresar a corrección
          </Button>
        </form>
      </div>
    );
  }

  const baseHref = `/nomina/${row.id}`;

  return (
    <>
      <EntityDetailHeader
        back={{ href: "/nomina", label: "Personal > Nómina" }}
        title={row.folio}
        subtitle={`Personal > Nómina > ${row.folio} · ${periodDisplay}`}
        status={
          <Badge tone={payrollStatusTone(row.status)}>
            {payrollStatusLabel(row.status)}
          </Badge>
        }
        meta={
          <>
            <EntityMetaItem label="Periodo">{periodDisplay}</EntityMetaItem>
            <EntityMetaItem label="Fecha de pago">{paymentDisplay}</EntityMetaItem>
            <EntityMetaItem label="Estado">{payrollStatusLabel(row.status)}</EntityMetaItem>
          </>
        }
        primaryAction={primaryAction}
        secondaryActions={secondaryActions}
      />

      {warnings.length > 0 ? (
        <div className="mb-4 rounded-xl border border-amber-300/90 bg-amber-50/90 p-4 text-sm text-amber-950">
          <p className="font-bold">
            Elementos pendientes de validación antes de cerrar el periodo ({warnings.length})
          </p>
          <p className="mt-0.5 text-xs text-amber-800">
            Revisa o autoriza estos registros pendientes de los colaboradores antes de validar la nómina:
          </p>
          <ul className="mt-2.5 space-y-1.5 text-xs">
            {warnings.map((w, idx) => (
              <li key={idx} className="flex flex-wrap items-center gap-2">
                <Badge tone="warn">{w.concept}</Badge>
                <TextLink href={w.href}>{w.collaboratorName}</TextLink>
                <span className="text-amber-900">· {w.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <SegmentedNav
        items={[
          { href: baseHref, label: "Resumen", active: activeTab === "resumen" },
          { href: `${baseHref}?tab=colaboradores`, label: "Colaboradores", active: activeTab === "colaboradores" },
          { href: `${baseHref}?tab=documentos`, label: "Documentos", active: activeTab === "documentos" },
        ]}
      />

      {activeTab === "resumen" ? (
        <Card className="p-5">
          <h2 className="mb-4 border-b border-slate-100 pb-3 text-base font-bold tracking-tight text-slate-900">
            Resumen general de la nómina
          </h2>
          <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-xs font-medium text-slate-400">Periodo</dt>
              <dd className="mt-1 text-sm font-semibold text-slate-900">{periodDisplay}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-400">Fecha de pago</dt>
              <dd className="mt-1 text-sm font-semibold text-slate-900">{paymentDisplay}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-400">Número de colaboradores</dt>
              <dd className="mt-1 text-sm font-semibold text-slate-900">{row.lines.length}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-400">Estado</dt>
              <dd className="mt-1">
                <Badge tone={payrollStatusTone(row.status)}>
                  {payrollStatusLabel(row.status)}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-400">Total de percepciones</dt>
              <dd className="mt-1 text-lg font-bold text-slate-900 tabular-nums">
                {money(totalPercepciones)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-400">Total de descuentos</dt>
              <dd className="mt-1 text-lg font-bold text-rose-700 tabular-nums">
                {money(totalDescuentos)}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium text-slate-400">Total a pagar</dt>
              <dd className="mt-1 text-2xl font-bold text-[#0a477e] tabular-nums">
                {money(totalPagar)}
              </dd>
            </div>
          </dl>
        </Card>
      ) : null}

      {activeTab === "colaboradores" ? (
        <Card className="p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold tracking-tight text-slate-900">
                Colaboradores incluidos en la nómina
              </h2>
              <p className="text-xs text-slate-500">
                Haz clic sobre el nombre del colaborador para ver la procedencia de cada concepto y ajustar importes.
              </p>
            </div>
          </div>
          {row.lines.length === 0 ? (
            <Empty
              title="Sin colaboradores en esta nómina"
              body="No había colaboradores activos al generar el periodo."
            />
          ) : (
            <ResponsiveData
              table={
                <Table>
                  <thead>
                    <tr>
                      <Th>Colaborador</Th>
                      <Th>Sueldo</Th>
                      <Th>Horas extra</Th>
                      <Th>Bonos</Th>
                      <Th>Comisión</Th>
                      <Th>Compensaciones</Th>
                      <Th>Prima vacacional</Th>
                      <Th>Total</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {row.lines.map((line) => {
                      const amounts = visiblePayrollAmounts(line);
                      return (
                        <tr key={line.id}>
                          <Td>
                            <RecordLink href={`/nomina/${row.id}/colaboradores/${line.collaboratorId}`}>
                              {line.collaborator.user.name}
                            </RecordLink>
                          </Td>
                          <Td className="tabular-nums">{money(amounts.sueldo)}</Td>
                          <Td className="tabular-nums">{money(amounts.horasExtra)}</Td>
                          <Td className="tabular-nums">{money(amounts.bonos)}</Td>
                          <Td className="tabular-nums">{money(amounts.comision)}</Td>
                          <Td className="tabular-nums">{money(amounts.compensaciones)}</Td>
                          <Td className="tabular-nums">{money(amounts.primaVacacional)}</Td>
                          <Td className="font-bold text-slate-900 tabular-nums">{money(amounts.total)}</Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              }
              cards={row.lines.map((line) => {
                const amounts = visiblePayrollAmounts(line);
                return (
                  <MobileCard
                    key={line.id}
                    href={`/nomina/${row.id}/colaboradores/${line.collaboratorId}`}
                    title={line.collaborator.user.name}
                    meta={<strong className="tabular-nums">{money(amounts.total)}</strong>}
                  >
                    <p>
                      Sueldo: {money(amounts.sueldo)} · Horas extra: {money(amounts.horasExtra)} · Bonos:{" "}
                      {money(amounts.bonos)}
                    </p>
                    <p className="mt-1">
                      Comisión: {money(amounts.comision)} · Compensaciones: {money(amounts.compensaciones)} · Prima
                      vacacional: {money(amounts.primaVacacional)}
                    </p>
                  </MobileCard>
                );
              })}
            />
          )}
        </Card>
      ) : null}

      {activeTab === "documentos" ? (
        <PayrollDocumentosTab
          periodId={row.id}
          documents={row.documents.map((d) => ({
            id: d.id,
            title: d.title,
          }))}
        />
      ) : null}
    </>
  );
}
