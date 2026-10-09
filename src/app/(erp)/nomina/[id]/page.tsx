import { notFound, redirect } from "next/navigation";
import { aguinaldoAdjustAction, authorizePayrollAction, editExtraAction, extraAction, retryPayrollAction } from "../actions";
import { Badge, Button, controlClass, DetailAnchorButton, EntityDetailHeader, EntityMetaItem, Field, RecordLink } from "@/components/ui";
import { prisma } from "@/lib/db";
import { money } from "@/lib/money";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function NominaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireCompany();
  if (!can(session.role, "personnel.manage")) redirect("/inicio");
  const { id } = await params;
  const row = await prisma.payrollPeriod.findFirst({
    where: { id, companyId: session.activeCompanyId },
    include: { lines: { include: { collaborator: { include: { user: true } } } }, adjustments: true },
  });
  if (!row) notFound();
  const open = row.status === "PRELIMINAR";
  const ceo = can(session.role, "personnel.authorize");
  const hasMissing = row.lines.some((line) => line.missing);
  const transferTotal = row.lines.reduce((sum, line) => sum + line.transferTotal, 0);
  const cashTotal = row.lines.reduce((sum, line) => sum + line.cashTotal, 0);

  let primaryAction: React.ReactNode = null;
  if (open && ceo && !hasMissing) {
    primaryAction = (
      <form action={authorizePayrollAction} className="inline">
        <input type="hidden" name="periodId" value={row.id} />
        <input type="hidden" name="version" value={row.version} />
        <Button type="submit">Autorizar nómina</Button>
      </form>
    );
  } else if (open && ceo && hasMissing) {
    primaryAction = <DetailAnchorButton href="#lineas-nomina">Revisar incidencias</DetailAnchorButton>;
  } else if (row.status === "AUTORIZADA") {
    primaryAction = (
      <form action={retryPayrollAction} className="inline">
        <input type="hidden" name="periodId" value={row.id} />
        <Button type="submit" tone="ghost">Reintentar timbrado</Button>
      </form>
    );
  }

  return (
    <>
      <EntityDetailHeader
        back={{ href: "/nomina", label: "Nómina" }}
        title={row.folio}
        subtitle={`${row.kind} · ${row.periodStart} a ${row.periodEnd}`}
        status={<Badge tone={open ? "warn" : "neutral"}>{row.status}</Badge>}
        meta={
          <>
            <EntityMetaItem label="Colaboradores">{row.lines.length}</EntityMetaItem>
            <EntityMetaItem label="Transferencia">{money(transferTotal)}</EntityMetaItem>
            <EntityMetaItem label="Efectivo">{money(cashTotal)}</EntityMetaItem>
            <EntityMetaItem label="Total">{money(transferTotal + cashTotal)}</EntityMetaItem>
          </>
        }
        primaryAction={primaryAction}
      />
      {row.fiscalError ? <p className="mb-4 rounded-md border border-[#efd0d0] bg-[var(--danger-soft)] px-3 py-2 text-sm">{row.fiscalError}</p> : null}
      {hasMissing ? (
        <p className="mb-4 rounded-md bg-[var(--warn-soft)] px-3 py-2 text-sm">Hay colaboradores con datos faltantes. Corrige antes de autorizar.</p>
      ) : null}
      <ul id="lineas-nomina" className="scroll-mt-24 space-y-3">
        {row.lines.map((line) => (
          <li key={line.id} className="rounded-lg border border-[var(--line)] bg-white p-4 text-sm">
            <RecordLink href={`/personal/${line.collaboratorId}`}>{line.collaborator.user.name}</RecordLink>
            {line.collaborator.exemptBenefits ? <span> · solo salario fijo</span> : null}
            {line.missing ? <p className="text-[var(--danger)]">Falta {line.missing}. No se puede autorizar.</p> : null}
            <p className="mt-1">Timbrado {money(line.stampedBase)} · Efectivo {money(line.cashBase)} · Descuento {money(line.discountStamped + line.discountCash)}</p>
            <p>Horas extra {money(line.overtimeStamped + line.overtimeCash)} · Prima {money(line.primaStamped + line.primaCash)} · Bono {money(line.bonus)} · Aguinaldo {money(line.aguinaldoStamped + line.aguinaldoCash)}</p>
            <p>Transferencia {money(line.transferTotal)} · Efectivo {money(line.cashTotal)}</p>
            {open && row.kind === "AGUINALDO" && ceo ? (
              <form action={aguinaldoAdjustAction} className="mt-2 flex flex-wrap gap-2">
                <input type="hidden" name="periodId" value={row.id} />
                <input type="hidden" name="lineId" value={line.id} />
                <input name="stamped" type="number" step="0.01" defaultValue={line.aguinaldoStamped} className="w-28 rounded-md border border-[var(--line)] px-2 py-2" />
                <input name="cash" type="number" step="0.01" defaultValue={line.aguinaldoCash} className="w-28 rounded-md border border-[var(--line)] px-2 py-2" />
                <Button type="submit" tone="ghost">Ajustar aguinaldo</Button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
      {open ? (
        <form action={extraAction} className="mt-4 grid max-w-xl gap-2 rounded-lg border border-[var(--line)] bg-white p-4">
          <h2 className="font-medium">Ingreso o descuento extraordinario</h2>
          <input type="hidden" name="periodId" value={row.id} />
          <Field label="Colaborador"><select name="collaboratorId" className={controlClass}>{row.lines.filter((line) => !line.collaborator.exemptBenefits).map((line) => <option key={line.id} value={line.collaboratorId}>{line.collaborator.user.name}</option>)}</select></Field>
          <Field label="Tipo"><select name="kind" className={controlClass}><option value="INGRESO">Ingreso extra</option><option value="DESCUENTO">Descuento extra</option></select></Field>
          <Field label="Componente"><select name="component" className={controlClass}><option value="TIMBRADO">Timbrado</option><option value="EFECTIVO">Efectivo</option></select></Field>
          <Field label="Importe"><input name="amount" type="number" min="0.01" step="0.01" required className={controlClass} /></Field>
          <Field label="Nota"><input name="note" required className={controlClass} /></Field>
          <Button type="submit" tone="ghost">Agregar movimiento</Button>
        </form>
      ) : null}
      <ul className="mt-3 text-sm">
        {row.adjustments.map((item) => (
          <li key={item.id} className="mt-2">
            {item.kind} {item.component} {money(item.amount)} · {item.note}
            {open && ceo ? (
              <form action={editExtraAction} className="mt-1 flex gap-2">
                <input type="hidden" name="periodId" value={row.id} />
                <input type="hidden" name="adjustmentId" value={item.id} />
                <input name="amount" type="number" step="0.01" defaultValue={item.amount} className="w-28 rounded-md border border-[var(--line)] px-2 py-2" />
                <Button type="submit" tone="ghost">Corregir</Button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}
