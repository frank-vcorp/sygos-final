import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ClientNameLink } from "@/components/client-entity-links";
import { PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { money } from "@/lib/money";
import { can } from "@/lib/permissions";
import { QUOTE_STATUS_LABEL } from "@/lib/quotes";
import { PART_REQUEST_STATUS_LABEL } from "@/lib/case-labels";
import { homePath } from "@/lib/home";
import { requireCompany } from "@/lib/session";

const CLOSED = ["VALIDADO", "TERMINADA", "SIN_REPARACION"];

function Block({ title, empty, rows }: { title: string; empty: string; rows: Array<{ key?: string; href: string; label: string; detail: ReactNode }> }) {
  return (
    <section className="rounded-lg border border-[var(--line)] bg-white p-4">
      <h2 className="font-medium">{title}</h2>
      {rows.length === 0 ? <p className="mt-2 text-sm text-[var(--muted)]">{empty}</p> : (
        <ul className="mt-2 space-y-2 text-sm">
          {rows.map((row) => <li key={row.key ?? row.href + row.label}><Link href={row.href} className="font-medium text-[var(--accent)]">{row.label}</Link> · {row.detail}</li>)}
        </ul>
      )}
    </section>
  );
}

function panelClientLink(client: { id: string; name: string; isSystem: boolean }) {
  return <ClientNameLink clientId={client.id} name={client.name} isSystem={client.isSystem} canEdit />;
}

export default async function PanelPage({ searchParams }: { searchParams: Promise<{ vista?: string; filtro?: string }> }) {
  const session = await requireCompany();
  if (!can(session.role, "panel.view", session.activeCompanyCode)) redirect(homePath(session.role, session.activeCompanyCode));
  const { vista } = await searchParams;
  const companyId = session.activeCompanyId;
  if (session.role === "TECNICO") return <Technician companyId={companyId} userId={session.userId} history={vista === "historial"} />;
  if (session.role === "VENTAS") return <Sales companyId={companyId} userId={session.userId} />;
  if (session.role === "COORDINACION_ADMINISTRACION") return <Coordination companyId={companyId} code={session.activeCompanyCode} />;
  if (session.role === "GERENTE_OPERATIVO_SERVOMOTORES") return <Servomotores companyId={companyId} />;
  if (session.role === "SUPERVISOR_TECNICO") {
    return <SupervisorShop companyId={companyId} userId={session.userId} />;
  }
  if (session.role === "GERENTE_OPERATIVO_SYSTRON") {
    return <Shop companyId={companyId} manager history={vista === "historial"} />;
  }
  return <Executive companyId={companyId} name={session.activeCompanyName} />;
}

async function Technician({ companyId, userId, history }: { companyId: string; userId: string; history: boolean }) {
  const rows = await prisma.technicalCase.findMany({
    where: {
      serviceCompanyId: companyId,
      ...(history
        ? {
            status: { in: CLOSED },
            OR: [{ assigneeUserId: userId }, { finishedByUserId: userId }],
          }
        : { status: { notIn: CLOSED }, assigneeUserId: userId }),
    },
    include: { equipment: { include: { client: true } }, attention: true },
    orderBy: { slaDueAt: "asc" },
    take: 80,
  });
  return (
    <>
      <PageHeader
        title="Inicio"
        subtitle="Trabajos asignados a ti. Por tipo usa Servicios; el folio abre la operación."
        action={
          <Link href={history ? "/panel" : "/panel?vista=historial"} className="text-sm text-[var(--accent)]">
            {history ? "Ver activos" : "Ver historial"}
          </Link>
        }
      />
      <Block
        title={history ? "Historial" : "Asignados a ti"}
        empty={history ? "No hay trabajos cerrados en tu historial." : "No tienes operaciones activas asignadas."}
        rows={rows.map((row) => ({
          href: `/operacion/${row.id}`,
          label: row.folio,
          detail: `${row.equipment.client?.name ?? "Equipo"} · ${row.equipment.folio} · ${row.attention.priorityName} · ${row.status}`,
        }))}
      />
    </>
  );
}

function caseRowMap(list: Array<{
  id: string;
  folio: string;
  equipment: { folio: string; client: { name: string } | null };
  attention: { priorityName: string };
  externalSupplierId: string | null;
  assignee: { name: string } | null;
}>) {
  return list.map((row) => ({
    href: `/operacion/${row.id}`,
    label: row.folio,
    detail: `${row.equipment.client?.name ?? "Equipo"} · ${row.equipment.folio} · ${row.attention.priorityName} · ${row.externalSupplierId ? "Proveedor externo" : row.assignee?.name ?? "Sin asignar"}`,
  }));
}

async function SupervisorShop({ companyId, userId }: { companyId: string; userId: string }) {
  const [rows, assignedHistory] = await Promise.all([
    prisma.technicalCase.findMany({
      where: { serviceCompanyId: companyId, status: { notIn: CLOSED } },
      include: { equipment: { include: { client: true } }, attention: true, assignee: true },
      orderBy: { slaDueAt: "asc" },
      take: 120,
    }),
    prisma.functionalHistory.findMany({
      where: { entityType: "OPERACION", action: "ASIGNACION", authorUserId: userId },
      select: { entityId: true },
      distinct: ["entityId"],
    }),
  ]);
  const assignedBySupervisor = new Set(assignedHistory.map((entry) => entry.entityId));
  const pending = rows.filter((row) => !row.assigneeUserId && !row.externalSupplierId);
  const coordinated = rows.filter((row) => {
    if (!row.assigneeUserId && !row.externalSupplierId) return false;
    return row.assigneeUserId === userId || assignedBySupervisor.has(row.id);
  });
  return (
    <>
      <PageHeader
        title="Inicio"
        subtitle="Operaciones activas de tu taller. Asigna responsable o proveedor desde el detalle de cada folio."
      />
      <div className="grid gap-3">
        <Block title="Pendientes de asignación" empty="Todo lo activo tiene responsable o proveedor." rows={caseRowMap(pending)} />
        <Block
          title="Asignaciones realizadas y/o asignadas por el propio supervisor"
          empty="No hay operaciones activas bajo tu coordinación."
          rows={caseRowMap(coordinated)}
        />
      </div>
    </>
  );
}

function partRequestRowMap(
  list: Array<{
    id: string;
    partNumber: string;
    description: string;
    qtyRequested: number;
    qtyReceived: number;
    qtyIssued: number;
    status: string;
    case: { id: string; folio: string };
  }>,
) {
  return list.map((row) => {
    const pendingIssue = Math.max(0, row.qtyReceived - row.qtyIssued);
    const pendingTotal = Math.max(0, row.qtyRequested - row.qtyIssued);
    const pending = pendingIssue > 0 ? `pend. surtir ${pendingIssue}` : `pend. ${pendingTotal}`;
    const status = PART_REQUEST_STATUS_LABEL[row.status] ?? row.status;
    return {
      key: row.id,
      href: `/operacion/${row.case.id}`,
      label: row.case.folio,
      detail: `${row.partNumber} · ${row.description} · sol. ${row.qtyRequested} · rec. ${row.qtyReceived} · surt. ${row.qtyIssued} · ${pending} · ${status}`,
    };
  });
}

async function Shop({ companyId, manager, history }: { companyId: string; manager: boolean; history: boolean }) {
  const [rows, partRequests] = await Promise.all([
    prisma.technicalCase.findMany({
      where: { serviceCompanyId: companyId, ...(history ? { status: { in: CLOSED } } : { status: { notIn: CLOSED } }) },
      include: { equipment: { include: { client: true } }, attention: true, assignee: true },
      orderBy: { slaDueAt: "asc" },
      take: 100,
    }),
    manager && !history
      ? prisma.partRequest.findMany({
          where: { companyId, case: { status: { notIn: CLOSED } } },
          include: { case: { select: { id: true, folio: true } } },
          orderBy: { updatedAt: "desc" },
          take: 120,
        })
      : Promise.resolve([]),
  ]);
  const openPartRequests = partRequests.filter((row) => row.qtyIssued < row.qtyRequested);
  const now = Date.now();
  return (
    <>
      <PageHeader title={manager ? "Panel del gerente" : "Panel de supervisión"} subtitle="Activos de esta empresa. Validar o devolver se hace en el detalle." action={<Link href={history ? "/panel" : "/panel?vista=historial"} className="text-sm text-[var(--accent)]">{history ? "Ver activos" : "Ver historial"}</Link>} />
      <div className="grid gap-3">
        <Block title="Pendientes de asignación" empty="Todo lo activo tiene responsable o proveedor." rows={caseRowMap(rows.filter((row) => !row.assigneeUserId && !row.externalSupplierId))} />
        <Block title="Diagnósticos activos" empty="Sin diagnósticos activos." rows={caseRowMap(rows.filter((row) => row.kind === "DIAGNOSTICO"))} />
        <Block title="Reparaciones activas" empty="Sin reparaciones activas." rows={caseRowMap(rows.filter((row) => row.kind === "OS"))} />
        <Block title="Vencidos" empty="Nada vencido." rows={caseRowMap(rows.filter((row) => row.slaDueAt != null && row.slaDueAt.getTime() < now))} />
        <Block title="En espera de refacciones" empty="Ninguna orden espera refacción." rows={caseRowMap(rows.filter((row) => row.status === "EN_ESPERA_REFACCIONES"))} />
        {manager && !history ? (
          <Block title="Refacciones solicitadas" empty="No hay solicitudes de refacción abiertas." rows={partRequestRowMap(openPartRequests)} />
        ) : null}
        <Block title="Proveedor externo" empty="Nada está en proveedor externo." rows={caseRowMap(rows.filter((row) => row.externalSupplierId))} />
        {manager ? <Block title="Diagnósticos pendientes de validación" empty="No hay diagnósticos por validar." rows={caseRowMap(rows.filter((row) => row.status === "PENDIENTE_VALIDACION"))} /> : null}
      </div>
    </>
  );
}

async function Servomotores({ companyId }: { companyId: string }) {
  const [income, active, quotes, purchases, exits] = await Promise.all([
    prisma.equipment.count({ where: { kind: "MOT", custody: "PENDIENTE_INGRESO", OR: [{ originCompanyId: companyId }, { originCompany: { code: "SYSTRON" } }] } }),
    prisma.technicalCase.count({ where: { serviceCompanyId: companyId, status: { notIn: CLOSED } } }),
    prisma.quote.count({ where: { companyId, status: "PENDIENTE_COTIZAR" } }),
    prisma.purchase.count({ where: { companyId, status: { in: ["PENDIENTE_VALIDAR", "AUTORIZADA"] } } }),
    prisma.equipment.count({ where: { kind: "MOT", custody: "EN_RESGUARDO", originCompanyId: { not: companyId } } }),
  ]);
  const links = [
    { href: "/motores", label: "Ingresos físicos pendientes", detail: String(income) },
    { href: "/operacion", label: "Diagnósticos y reparaciones activas", detail: String(active) },
    { href: "/servicios/garantia", label: "Garantías", detail: "Abrir módulo" },
    { href: "/cotizaciones?vista=cotizar", label: "Pendientes de cotizar", detail: String(quotes) },
    { href: "/compras", label: "Compras", detail: String(purchases) },
    { href: "/custodia", label: "Entregas y egresos", detail: String(exits) },
  ];
  return (
    <>
      <PageHeader title="Panel de Servomotores" subtitle="Cada bloque abre el módulo real. No hay una copia de los registros." />
      <Block title="Pendientes operativos" empty="Sin pendientes." rows={links} />
    </>
  );
}

async function Sales({ companyId, userId }: { companyId: string; userId: string }) {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const [quotes, waitingPrice, receivables, activities, invoices, sales, goals, authorizedMonth, pendingDecision] = await Promise.all([
    prisma.quote.findMany({ where: { companyId, sellerUserId: userId, status: { in: ["PENDIENTE_DECISION", "AUTORIZADA", "AUTORIZADA_PENDIENTE_EQUIPO"] } }, include: { client: true }, take: 12, orderBy: { updatedAt: "desc" } }),
    prisma.quote.findMany({ where: { companyId, sellerUserId: userId, status: "PENDIENTE_COTIZAR" }, include: { client: true }, take: 8, orderBy: { updatedAt: "desc" } }),
    prisma.receivable.findMany({ where: { companyId, sellerUserId: userId, balance: { gt: 0 } }, include: { document: true, client: true }, take: 12 }),
    prisma.agendaActivity.findMany({
      where: { companyId, authorUserId: userId, scheduledAt: { gte: new Date() } },
      include: { client: { select: { id: true, name: true, isSystem: true } } },
      orderBy: { scheduledAt: "asc" },
      take: 6,
    }),
    prisma.quote.findMany({ where: { companyId, sellerUserId: userId, status: { startsWith: "AUTORIZADA" }, client: { requiresInvoice: true }, billingDocuments: { none: { kind: "FACTURA", status: "EMITIDA" } } }, include: { client: true }, take: 12 }),
    prisma.sale.findMany({ where: { companyId, quote: { sellerUserId: userId } }, include: { client: true, lines: true }, take: 20, orderBy: { createdAt: "desc" } }),
    prisma.salesGoal.findMany({ where: { companyId, userId, year: new Date().getFullYear(), month: new Date().getMonth() + 1 }, include: { goalType: true } }),
    prisma.quote.count({ where: { companyId, sellerUserId: userId, status: { startsWith: "AUTORIZADA" }, updatedAt: { gte: monthStart } } }),
    prisma.quote.count({ where: { companyId, sellerUserId: userId, status: "PENDIENTE_DECISION" } }),
  ]);
  const deliveries = sales.filter((sale) => sale.lines.some((line) => line.qtyReceived < line.qtySold || line.qtyDelivered < line.qtyReceived));
  return (
    <>
      <PageHeader title="Inicio" subtitle="Tus pendientes comerciales y tu desempeño. Solo lo asignado a ti; sin costos internos ni base Servomotores." />
      <section className="mb-4 grid gap-3 sm:grid-cols-3">
        <MetricCard label="Cotizaciones autorizadas (mes)" value={String(authorizedMonth)} />
        <MetricCard label="Esperando decisión del cliente" value={String(pendingDecision)} />
        <MetricCard label="Saldo en cobranza" value={money(receivables.reduce((sum, row) => sum + row.balance, 0))} />
      </section>
      {goals.length > 0 ? (
        <section className="mb-4 rounded-lg border border-[var(--line)] bg-white p-4">
          <h2 className="font-medium">Mi desempeño — metas del mes</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {goals.map((goal) => <li key={goal.id}>{goal.goalType.name}: objetivo {goal.target}</li>)}
          </ul>
        </section>
      ) : null}
      <div className="grid gap-3">
        <Block title="Cotizaciones por seguimiento" empty="Nada por seguir." rows={quotes.map((row) => ({ href: `/cotizaciones/${row.id}`, label: row.folio, detail: <>{QUOTE_STATUS_LABEL[row.status] ?? row.status} · {panelClientLink(row.client)}</> }))} />
        <Block title="Esperando precio (CEO/Administrador)" empty="No hay cotizaciones sin precio." rows={waitingPrice.map((row) => ({ href: `/cotizaciones/${row.id}`, label: row.folio, detail: panelClientLink(row.client) }))} />
        <Block title="Entregas pendientes" empty="Sin mercancía ni entregas por cerrar." rows={deliveries.map((row) => {
          const pendingReceive = row.lines.reduce((sum, line) => sum + Math.max(0, line.qtySold - line.qtyReceived), 0);
          const pendingDeliver = row.lines.reduce((sum, line) => sum + Math.max(0, line.qtyReceived - line.qtyDelivered), 0);
          const detail = pendingReceive > 0 ? `por recibir ${pendingReceive}` : `por entregar ${pendingDeliver}`;
          return { href: `/ventas/${row.id}`, label: row.folio, detail: <>{panelClientLink(row.client)} · {detail}</> };
        })} />
        <Block title="Cobranza" empty="Sin saldos propios." rows={receivables.map((row) => ({ href: `/cobranza/${row.id}`, label: row.document.folio, detail: <>{panelClientLink(row.client)} · {money(row.balance)}</> }))} />
        <Block title="Facturación pendiente" empty="No hay operaciones con factura obligatoria sin emitir." rows={invoices.map((row) => ({ href: `/cotizaciones/${row.id}`, label: row.folio, detail: panelClientLink(row.client) }))} />
        <Block title="Agenda / próximas actividades" empty="Sin actividades próximas." rows={activities.map((row) => {
          const when = row.scheduledAt.toLocaleDateString("es-MX", { timeZone: "America/Mexico_City" });
          const href = row.clientId ? `/clientes/${row.clientId}` : row.prospectId ? `/prospectos/${row.prospectId}` : "/agenda";
          const detail = row.client
            ? <>{panelClientLink(row.client)} · {when}</>
            : row.prospectId
              ? <><Link href={`/prospectos/${row.prospectId}`} className="text-[var(--accent)]">Prospecto</Link> · {when}</>
              : when;
          return { href, label: row.note, detail };
        })} />
        <p className="text-sm"><Link href="/agenda" className="text-[var(--accent)]">Abrir agenda comercial</Link></p>
      </div>
    </>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-[#0b1f3a]">{value}</p>
    </div>
  );
}

async function Coordination({ companyId, code }: { companyId: string; code: string }) {
  const [invoices, remissions, payments, purchases, orders, proofs, payrolls, dueReceivables] = await Promise.all([
    prisma.billingDocument.findMany({ where: { companyId, status: "SOLICITADA", kind: { not: "REMISION" } }, take: 12 }),
    prisma.billingDocument.findMany({ where: { companyId, status: "SOLICITADA", kind: "REMISION" }, take: 12 }),
    prisma.payment.findMany({ where: { companyId, status: "PENDIENTE" }, orderBy: { createdAt: "asc" }, take: 12 }),
    prisma.purchase.findMany({ where: { companyId, kind: "DIRECTA", status: "PENDIENTE_VALIDAR" }, take: 12 }),
    prisma.purchase.findMany({ where: { companyId, kind: "OC", status: "AUTORIZADA" }, take: 12 }),
    prisma.financeMovement.findMany({ where: { companyId, pendingProof: true }, take: 12 }),
    prisma.payrollPeriod.findMany({ where: { companyId, status: "PRELIMINAR" }, include: { lines: true }, take: 6 }),
    prisma.receivable.findMany({ where: { companyId, balance: { gt: 0 }, dueAt: { lt: new Date() } }, include: { document: true }, take: 12 }),
  ]);
  return (
    <>
      <PageHeader title="Panel de coordinación" subtitle={`${code === "SERVOMOTORES" ? "Servomotores" : "SYSTRON"}. La bandeja es de esta empresa.`} />
      <div className="grid gap-3">
        <Block title="Facturas solicitadas" empty="Sin solicitudes." rows={invoices.map((row) => ({ href: `/facturacion/${row.id}`, label: row.folio, detail: row.kind }))} />
        <Block title="Remisiones solicitadas" empty="Sin remisiones por generar." rows={remissions.map((row) => ({ href: `/facturacion/${row.id}`, label: row.folio, detail: "Remisión" }))} />
        <Block title="Pagos por validar" empty="Sin pagos pendientes." rows={payments.map((row) => ({ href: `/pagos/${row.id}`, label: row.folio, detail: money(row.amount) }))} />
        <Block title="Compras directas" empty="Nada por cuadrar." rows={purchases.map((row) => ({ href: `/compras/${row.id}`, label: row.folio, detail: money(row.amount) }))} />
        <Block title="Órdenes autorizadas" empty="Nada por procesar." rows={orders.map((row) => ({ href: `/compras/${row.id}`, label: row.folio, detail: money(row.amount) }))} />
        <Block title="Cobranza vencida" empty="Sin cuentas vencidas." rows={dueReceivables.map((row) => ({ href: `/cobranza/${row.id}`, label: row.document.folio, detail: money(row.balance) }))} />
        <Block title="Nómina preliminar" empty="No hay una semana abierta." rows={payrolls.map((row) => ({ href: `/nomina/${row.id}`, label: row.folio, detail: row.lines.some((line) => line.missing) ? "Falta un dato para timbrar" : row.status }))} />
        {code === "SERVOMOTORES" || proofs.length > 0 ? <Block title="Pendientes de comprobación" empty="Sin comprobantes pendientes." rows={proofs.map((row) => ({ href: "/finanzas", label: money(row.amount), detail: row.note ?? "Egreso" }))} /> : null}
      </div>
    </>
  );
}

async function Executive({ companyId, name }: { companyId: string; name: string }) {
  const [quotes, orders, warranties, payrolls, commissions, overtime, overdue, invoiced] = await Promise.all([
    prisma.quote.findMany({ where: { companyId, status: "PENDIENTE_COTIZAR" }, take: 12 }),
    prisma.purchase.findMany({ where: { companyId, kind: "OC", status: "PENDIENTE_AUTORIZACION" }, take: 12 }),
    prisma.technicalCase.findMany({ where: { serviceCompanyId: companyId, warrantyDecision: "NO_PROCEDENTE", commercialDecision: null }, take: 12 }),
    prisma.payrollPeriod.findMany({ where: { companyId, status: "PRELIMINAR" }, take: 6 }),
    prisma.commissionRun.findMany({ where: { companyId, status: "PRELIMINAR" }, take: 6 }),
    prisma.overtimeRequest.findMany({ where: { status: "PENDIENTE_CEO", collaborator: { companyId } }, include: { collaborator: { include: { user: true } } }, take: 12 }),
    prisma.technicalCase.count({ where: { serviceCompanyId: companyId, status: { notIn: CLOSED }, slaDueAt: { lt: new Date() } } }),
    prisma.billingDocument.aggregate({ where: { companyId, status: "EMITIDA", kind: { not: "REMISION" } }, _sum: { total: true } }),
  ]);
  return (
    <>
      <PageHeader title={`Panel ${name}`} subtitle="Solo esta empresa. No hay suma con la otra." />
      <div className="grid gap-3">
        <Block title="Pendientes de cotizar" empty="Nada por cotizar." rows={quotes.map((row) => ({ href: `/cotizaciones/${row.id}`, label: row.folio, detail: "Asignar precio" }))} />
        <Block title="Órdenes por autorizar" empty="Sin órdenes pendientes." rows={orders.map((row) => ({ href: `/compras/${row.id}`, label: row.folio, detail: money(row.amount) }))} />
        <Block title="Garantías no procedentes" empty="Sin decisión comercial pendiente." rows={warranties.map((row) => ({ href: `/operacion/${row.id}`, label: row.folio, detail: "Decidir comercialmente" }))} />
        <Block title="Nómina" empty="Sin preliminar." rows={payrolls.map((row) => ({ href: `/nomina/${row.id}`, label: row.folio, detail: "Autorizar" }))} />
        <Block title="Comisiones" empty="Sin preliminar." rows={commissions.map((row) => ({ href: `/comisiones/${row.id}`, label: row.month, detail: "Validar" }))} />
        <Block title="Horas extra" empty="Nada espera autorización final." rows={overtime.map((row) => ({ href: "/personal/horas", label: row.collaborator.user.name, detail: `${row.hours} h` }))} />
        <section className="rounded-lg border border-[var(--line)] bg-white p-4 text-sm">
          <h2 className="font-medium">Resúmenes</h2>
          <p className="mt-2"><Link href="/operacion" className="text-[var(--accent)]">Operación</Link> · {overdue} vencidos</p>
          <p className="mt-1"><Link href="/produccion" className="text-[var(--accent)]">Producción técnica</Link></p>
          <p className="mt-1"><Link href="/finanzas" className="text-[var(--accent)]">Finanzas</Link> · facturado {money(invoiced._sum.total ?? 0)}</p>
        </section>
      </div>
    </>
  );
}

