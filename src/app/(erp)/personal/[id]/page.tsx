import { notFound, redirect } from "next/navigation";
import { bajaAction, bossAction, documentAction, laborIdAction, salaryAction, scheduleAction, vacationBalanceAction, vacationDecisionAction, vacationRequestAction } from "../actions";
import { HistoryTimeline } from "@/components/history-timeline";
import { Badge, Button, Card, controlClass, DetailAnchorButton, EntityDetailHeader, EntityMetaItem, Field, FormActions, FormPanel, FormSection, RecordLink } from "@/components/ui";
import { prisma } from "@/lib/db";
import { historyFor } from "@/lib/history";
import { formatWhen } from "@/lib/form";
import { money } from "@/lib/money";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function ColaboradorPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireCompany();
  if (!can(session.role, "personnel.manage") && !can(session.role, "personnel.authorize")) redirect("/inicio");
  const { id } = await params;
  const row = await prisma.collaborator.findFirst({
    where: { id, companyId: session.activeCompanyId },
    include: { user: true, boss: true, vacations: { include: { primas: true }, orderBy: { createdAt: "desc" } }, attendance: { orderBy: { workDate: "desc" }, take: 14 }, overtime: { orderBy: { createdAt: "desc" }, take: 8 }, documents: { orderBy: { createdAt: "desc" } }, payrollLines: { include: { period: true }, orderBy: { period: { createdAt: "desc" } }, take: 6 } },
  });
  if (!row) notFound();
  const bosses = await prisma.user.findMany({ where: { active: true, role: { in: ["CEO", "GERENTE_OPERATIVO_SYSTRON", "GERENTE_OPERATIVO_SERVOMOTORES", "SUPERVISOR_TECNICO"] } }, orderBy: { name: "asc" } });
  const history = await historyFor("COLABORADOR", row.id);
  const ceo = can(session.role, "personnel.authorize");
  const pendingVacation = row.vacations.find((vacation) => vacation.status === "PENDIENTE");
  const statusLabel = row.status === "ACTIVO" ? "Activo" : "Baja";

  let primaryAction: React.ReactNode = null;
  if (ceo && pendingVacation) {
    primaryAction = <DetailAnchorButton href="#vacaciones-pendientes">Autorizar vacaciones</DetailAnchorButton>;
  } else if (ceo && row.status === "ACTIVO") {
    primaryAction = <DetailAnchorButton href="#salario">Actualizar salario</DetailAnchorButton>;
  }

  return (
    <>
      <EntityDetailHeader
        back={{ href: "/personal", label: "Personal" }}
        title={row.user.name}
        subtitle={row.exemptBenefits ? "Salario fijo · sin prestaciones de ley en el sistema" : row.user.role}
        status={<Badge tone={row.status === "ACTIVO" ? "neutral" : "warn"}>{statusLabel}</Badge>}
        meta={
          <>
            <EntityMetaItem label="Ingreso">{formatWhen(row.hiredAt)} · {row.hireKind === "MIGRADO" ? "Migrado" : "Nuevo"}</EntityMetaItem>
            <EntityMetaItem label="Jefe">{row.boss?.name ?? "Sin jefe"}</EntityMetaItem>
            <EntityMetaItem label="Salario diario">{money(row.dailyStamped + row.dailyCash)}</EntityMetaItem>
            {row.exemptBenefits ? null : <EntityMetaItem label="Vacaciones">{row.vacationBalance} días hábiles</EntityMetaItem>}
            <EntityMetaItem label="Horario">{row.scheduleStart} · tolerancia {row.toleranceMinutes} min</EntityMetaItem>
          </>
        }
        primaryAction={primaryAction}
      />
      <Card className="mb-4 p-4 text-sm">
        <p>Timbrado {money(row.dailyStamped)} · Efectivo {money(row.dailyCash)} · Hora extra {money(row.overtimeRate)}</p>
        <p className="mt-1">Huella: {row.fingerprintNote || "Sin enrolar"}</p>
      </Card>
      <FormPanel action={laborIdAction} className="mb-4 max-w-xl">
        <input type="hidden" name="collaboratorId" value={row.id} />
        <FormSection title="Datos fiscales" columns={2}>
          <Field label="RFC"><input name="rfc" defaultValue={row.rfc ?? ""} className={controlClass} /></Field>
          <Field label="CURP"><input name="curp" defaultValue={row.curp ?? ""} className={controlClass} /></Field>
          <Field label="NSS"><input name="nss" defaultValue={row.nss ?? ""} className={controlClass} /></Field>
          <Field label="Código postal"><input name="fiscalZip" defaultValue={row.fiscalZip ?? ""} className={controlClass} /></Field>
        </FormSection>
        <FormActions><Button type="submit" tone="ghost">Guardar datos fiscales</Button></FormActions>
      </FormPanel>
      {ceo && row.status === "ACTIVO" ? (
        <FormPanel id="salario" action={salaryAction} className="scroll-mt-24 max-w-xl">
          <input type="hidden" name="collaboratorId" value={row.id} />
          <input type="hidden" name="version" value={row.version} />
          <FormSection title="Salario">
            <Field label="Timbrado"><input name="dailyStamped" type="number" step="0.01" defaultValue={row.dailyStamped} className={controlClass} /></Field>
            <Field label="Efectivo"><input name="dailyCash" type="number" step="0.01" defaultValue={row.dailyCash} className={controlClass} /></Field>
            <Field label="Tarifa de hora extra"><input name="overtimeRate" type="number" step="0.01" defaultValue={row.overtimeRate} className={controlClass} /></Field>
          </FormSection>
          <FormActions><Button type="submit" tone="ghost">Guardar salario</Button></FormActions>
        </FormPanel>
      ) : null}
      {ceo && row.status === "ACTIVO" ? (
        <FormPanel action={bossAction} className="mt-4 max-w-xl">
          <input type="hidden" name="collaboratorId" value={row.id} />
          <input type="hidden" name="version" value={row.version} />
          <FormSection title="Jefe inmediato" columns={1}>
            <Field label="Cambiar jefe"><select name="bossUserId" className={controlClass} defaultValue={row.bossUserId ?? ""}>{bosses.map((boss) => <option key={boss.id} value={boss.id}>{boss.name}</option>)}</select></Field>
          </FormSection>
          <FormActions><Button type="submit" tone="ghost">Guardar jefe</Button></FormActions>
        </FormPanel>
      ) : null}
      {row.exemptBenefits ? null : (
        <div id="vacaciones-pendientes" className="mt-4 scroll-mt-24">
        <Card className="p-4">
          <h2 className="font-medium">Vacaciones</h2>
          <FormPanel action={vacationRequestAction} className="mt-3 max-w-none border-0 shadow-none">
            <input type="hidden" name="collaboratorId" value={row.id} />
            <FormSection title="Solicitud" columns={2}>
              <Field label="Del"><input name="startDate" type="date" required className={controlClass} /></Field>
              <Field label="Al"><input name="endDate" type="date" required className={controlClass} /></Field>
            </FormSection>
            <FormActions><Button type="submit">Solicitar como jefe</Button></FormActions>
          </FormPanel>
          {ceo ? (
            <FormPanel action={vacationBalanceAction} className="mt-3 max-w-none border-0 shadow-none">
              <input type="hidden" name="collaboratorId" value={row.id} />
              <input type="hidden" name="version" value={row.version} />
              <FormSection title="Ajuste de saldo" columns={2}>
                <Field label="Ajustar saldo"><input name="balance" type="number" step="0.5" defaultValue={row.vacationBalance} className={controlClass} /></Field>
                <Field label="Motivo"><input name="reason" required className={controlClass} /></Field>
              </FormSection>
              <FormActions><Button type="submit" tone="ghost">Ajustar</Button></FormActions>
            </FormPanel>
          ) : null}
          <ul className="mt-3 space-y-2 text-sm">
            {row.vacations.map((vacation) => (
              <li key={vacation.id}>
                {vacation.startDate} a {vacation.endDate} · {vacation.status}
                {vacation.primas.map((prima) => <span key={prima.id}> · semana {prima.weekStart}: {prima.days} días, prima {money(prima.stamped + prima.cash)}</span>)}
                {vacation.status === "PENDIENTE" && ceo ? (
                  <form action={vacationDecisionAction} className="mt-1 flex gap-2">
                    <input type="hidden" name="vacationId" value={vacation.id} />
                    <input type="hidden" name="collaboratorId" value={row.id} />
                    <input type="hidden" name="version" value={vacation.version} />
                    <Button type="submit" name="decision" value="si" tone="ghost">Autorizar</Button>
                    <Button type="submit" name="decision" value="no" tone="ghost">Rechazar</Button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
        </div>
      )}
      <Card className="mt-4 p-4 text-sm">
        <h2 className="font-medium">Asistencia reciente</h2>
        <ul className="mt-2 space-y-1">{row.attendance.map((day) => <li key={day.id}>{day.workDate} · {day.status}</li>)}</ul>
        <h2 className="mt-3 font-medium">Horas extra</h2>
        <ul className="mt-2 space-y-1">{row.overtime.map((item) => <li key={item.id}>{item.workDate} · {item.hours} h · {item.status}{item.frozenRate != null ? ` · doble ${item.doubleHours} triple ${item.tripleHours}` : ""}</li>)}</ul>
        <h2 className="mt-3 font-medium">Nóminas</h2>
        <ul className="mt-2 space-y-1">{row.payrollLines.map((line) => <li key={line.id}><RecordLink href={`/nomina/${line.periodId}`}>{line.period.folio}</RecordLink> · {money(line.transferTotal + line.cashTotal)}</li>)}</ul>
      </Card>
      <FormPanel action={scheduleAction} className="mt-4 max-w-xl">
        <input type="hidden" name="collaboratorId" value={row.id} />
        <input type="hidden" name="version" value={row.version} />
        <FormSection title="Horario y huella">
          <Field label="Entrada"><input name="scheduleStart" defaultValue={row.scheduleStart} className={controlClass} /></Field>
          <Field label="Tolerancia en minutos"><input name="toleranceMinutes" type="number" defaultValue={row.toleranceMinutes} className={controlClass} /></Field>
          <Field label="Referencia de huella"><input name="fingerprintNote" defaultValue={row.fingerprintNote ?? ""} className={controlClass} /></Field>
        </FormSection>
        <FormActions><Button type="submit" tone="ghost">Guardar</Button></FormActions>
      </FormPanel>
      <FormPanel action={documentAction} className="mt-4 max-w-xl">
        <input type="hidden" name="collaboratorId" value={row.id} />
        <FormSection title="Documento laboral">
          <Field label="Tipo"><select name="kind" className={controlClass}><option value="GENERAL">General</option><option value="ACTA">Acta administrativa</option></select></Field>
          <Field label="Título"><input name="title" required className={controlClass} /></Field>
          <Field label="Descripción"><input name="note" required className={controlClass} /></Field>
          <Field label="Fecha del acta"><input name="occurredOn" type="date" className={controlClass} /></Field>
        </FormSection>
        <FormActions><Button type="submit" tone="ghost">Registrar</Button></FormActions>
      </FormPanel>
      <ul className="mt-3 text-sm">{row.documents.map((doc) => <li key={doc.id}>{doc.kind} · {doc.title} · {doc.note}</li>)}</ul>
      {row.status === "ACTIVO" ? (
        <form action={bajaAction} className="mt-4">
          <input type="hidden" name="collaboratorId" value={row.id} />
          <input type="hidden" name="version" value={row.version} />
          <button className="text-sm text-[var(--danger)]">Registrar baja</button>
        </form>
      ) : null}
      <HistoryTimeline className="mt-6" items={history.map((item) => ({ id: item.id, createdAt: item.createdAt, summary: item.summary, authorName: item.author?.name }))} />
    </>
  );
}
