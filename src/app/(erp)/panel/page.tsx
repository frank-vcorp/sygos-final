import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ClientNameLink } from "@/components/client-entity-links";
import { AuthorizeExitWithoutDocumentButton } from "@/components/exit-without-document-actions";
import { SalesPanelServiciosGrouped, SalesPanelServiciosSection } from "@/components/sales-panel-bandeja";
import { ActionLink, Card, KpiCard, PageHeader, RecordLink, TextLink } from "@/components/ui";
import { prisma } from "@/lib/db";
import { money } from "@/lib/money";
import { can } from "@/lib/permissions";
import { PART_REQUEST_STATUS_LABEL } from "@/lib/case-labels";
import { homePath } from "@/lib/home";
import {
  receivableEsVigente,
  servicioCotizadaSinAutorizacion,
  servicioOsValidadaAutorizada,
  servicioOsValidadaPendienteEntrega,
  servicioPendienteAutorizacion,
} from "@/lib/sales-panel";
import type { Role } from "@/lib/roles";
import { serviciosBandejaHref } from "@/lib/servicios-catalog";
import {
  listActiveServicios,
  listServiciosForBillingLinks,
  type ServicioBandejaRow,
} from "@/lib/servicios-supervisor";
import { requireCompany } from "@/lib/session";

const CLOSED = ["VALIDADO", "TERMINADA", "SIN_REPARACION"];

type PanelRow = { key?: string; href: string; label: string; detail: ReactNode; highlight?: boolean };

function Block({
  title,
  empty,
  rows,
  bandejaHref,
}: {
  title: string;
  empty: string;
  rows: PanelRow[];
  bandejaHref?: string;
}) {
  const shownLabel =
    rows.length === 0
      ? "Sin pendientes"
      : rows.length === 1
        ? "1 pendiente mostrado"
        : `${rows.length} pendientes mostrados`;
  return (
    <Card className="flex h-full flex-col overflow-hidden p-0">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--line)] bg-[#fbfdff] px-5 py-4">
        <div>
          <h2 className="text-base font-bold tracking-tight text-[var(--ink)]">{title}</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">{shownLabel}</p>
        </div>
        {bandejaHref ? <TextLink href={bandejaHref}>Ver bandeja</TextLink> : null}
      </div>
      {rows.length === 0 ? (
        <p className="m-5 rounded-lg bg-[#f5f8fb] px-4 py-3 text-sm text-[var(--muted)]">{empty}</p>
      ) : (
        <ul className="divide-y divide-[var(--line)] text-sm">
          {rows.map((row) => (
            <li
              key={row.key ?? row.href + row.label}
              className={`flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-start sm:gap-4 ${row.highlight ? "bg-[#f0fdf4] ring-1 ring-inset ring-[#86efac]/60" : ""}`}
            >
              <RecordLink href={row.href} className="shrink-0">{row.label}</RecordLink>
              <span className="min-w-0 leading-5 text-[var(--muted)]">{row.detail}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function GroupedBlock({
  title,
  sections,
}: {
  title: string;
  sections: Array<{ subtitle: string; empty: string; bandejaHref?: string; rows: PanelRow[] }>;
}) {
  const total = sections.reduce((sum, section) => sum + section.rows.length, 0);
  const shownLabel =
    total === 0 ? "Sin pendientes" : total === 1 ? "1 pendiente mostrado" : `${total} pendientes mostrados`;
  return (
    <Card className="flex h-full flex-col overflow-hidden p-0">
      <div className="border-b border-[var(--line)] bg-[#fbfdff] px-5 py-4">
        <h2 className="text-base font-bold tracking-tight text-[var(--ink)]">{title}</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">{shownLabel}</p>
      </div>
      {sections.map((section, index) => (
        <section key={section.subtitle} className={index > 0 ? "border-t border-[var(--line)]" : ""}>
          <div className="flex flex-wrap items-start justify-between gap-3 bg-[#f8fbfd] px-5 py-3">
            <h3 className="text-sm font-semibold text-[var(--ink)]">{section.subtitle}</h3>
            {section.bandejaHref ? <TextLink href={section.bandejaHref}>Ver bandeja</TextLink> : null}
          </div>
          {section.rows.length === 0 ? (
            <p className="m-5 rounded-lg bg-[#f5f8fb] px-4 py-3 text-sm text-[var(--muted)]">{section.empty}</p>
          ) : (
            <ul className="divide-y divide-[var(--line)] text-sm">
              {section.rows.map((row) => (
                <li
                  key={row.key ?? row.href + row.label}
                  className={`flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-start sm:gap-4 ${row.highlight ? "bg-[#f0fdf4] ring-1 ring-inset ring-[#86efac]/60" : ""}`}
                >
                  <RecordLink href={row.href} className="shrink-0">{row.label}</RecordLink>
                  <span className="min-w-0 leading-5 text-[var(--muted)]">{row.detail}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </Card>
  );
}

function panelClientLink(client: { id: string; name: string; isSystem: boolean }) {
  return <ClientNameLink clientId={client.id} name={client.name} isSystem={client.isSystem} canEdit />;
}

function SalesMetric({ label, value, href }: { label: string; value: ReactNode; href: string }) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-[var(--line)] bg-white px-4 py-3 outline-none transition-colors hover:border-[#91b7cf] hover:bg-[#f8fbfd] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
    >
      <span className="block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</span>
      <span className="mt-1 block text-xl font-bold text-[var(--ink)]">{value}</span>
    </Link>
  );
}
export default async function PanelPage({ searchParams }: { searchParams: Promise<{ vista?: string; filtro?: string }> }) {
  const session = await requireCompany();
  if (!can(session.role, "panel.view", session.activeCompanyCode)) redirect(homePath(session.role, session.activeCompanyCode));
  const { vista } = await searchParams;
  const companyId = session.activeCompanyId;
  if (session.role === "TECNICO") return <Technician companyId={companyId} userId={session.userId} history={vista === "historial"} />;
  if (session.role === "VENTAS") {
    return (
      <Sales
        companyId={companyId}
        userId={session.userId}
        role={session.role}
        companyCode={session.activeCompanyCode}
      />
    );
  }
  if (session.role === "COORDINACION_ADMINISTRACION") return <Coordination companyId={companyId} code={session.activeCompanyCode} vista={vista} />;
  if (session.role === "GERENTE_OPERATIVO_SERVOMOTORES") return <Servomotores companyId={companyId} />;
  if (session.role === "SUPERVISOR_TECNICO") {
    return <SupervisorShop companyId={companyId} userId={session.userId} />;
  }
  if (session.role === "GERENTE_OPERATIVO_SYSTRON") {
    return <Shop companyId={companyId} manager history={vista === "historial"} />;
  }
  if (session.role === "CEO") return <CeoExecutive companyId={companyId} name={session.activeCompanyName ?? "Empresa"} vista={vista} />;
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
        action={<TextLink href={history ? "/panel" : "/panel?vista=historial"}>{history ? "Ver activos" : "Ver historial"}</TextLink>}
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
  const rows = await prisma.technicalCase.findMany({
    where: { serviceCompanyId: companyId, status: { notIn: CLOSED } },
    include: { equipment: { include: { client: true } }, attention: true, assignee: true },
    orderBy: { slaDueAt: "asc" },
    take: 120,
  });
  const pending = rows.filter((row) => !row.assigneeUserId && !row.externalSupplierId);
  const mine = rows.filter((row) => row.assigneeUserId === userId);
  return (
    <>
      <PageHeader
        title="Inicio"
        subtitle="Pendientes de asignar en el taller y operaciones activas asignadas a ti. El resto está en Servicios."
      />
      <div className="grid gap-3">
        <Block title="Pendientes de asignación" empty="Todo lo activo tiene responsable o proveedor." bandejaHref="/operacion" rows={caseRowMap(pending)} />
        <Block title="Asignadas a ti" empty="No tienes operaciones activas asignadas." bandejaHref="/operacion" rows={caseRowMap(mine)} />
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
      <PageHeader title={manager ? "Panel del gerente" : "Panel de supervisión"} subtitle="Activos de esta empresa. Validar o devolver se hace en el detalle." action={<TextLink href={history ? "/panel" : "/panel?vista=historial"}>{history ? "Ver activos" : "Ver historial"}</TextLink>} />
      <div className="grid gap-3">
        <Block title="Pendientes de asignación" empty="Todo lo activo tiene responsable o proveedor." bandejaHref="/operacion" rows={caseRowMap(rows.filter((row) => !row.assigneeUserId && !row.externalSupplierId))} />
        <Block title="Diagnósticos activos" empty="Sin diagnósticos activos." bandejaHref="/operacion" rows={caseRowMap(rows.filter((row) => row.kind === "DIAGNOSTICO"))} />
        <Block title="Reparaciones activas" empty="Sin reparaciones activas." bandejaHref="/operacion" rows={caseRowMap(rows.filter((row) => row.kind === "OS"))} />
        <Block title="Vencidos" empty="Nada vencido." bandejaHref="/operacion" rows={caseRowMap(rows.filter((row) => row.slaDueAt != null && row.slaDueAt.getTime() < now))} />
        <Block title="En espera de refacciones" empty="Ninguna orden espera refacción." bandejaHref="/operacion" rows={caseRowMap(rows.filter((row) => row.status === "EN_ESPERA_REFACCIONES"))} />
        {manager && !history ? (
          <Block title="Refacciones solicitadas" empty="No hay solicitudes de refacción abiertas." bandejaHref="/produccion" rows={partRequestRowMap(openPartRequests)} />
        ) : null}
        <Block title="Proveedor externo" empty="Nada está en proveedor externo." bandejaHref="/operacion" rows={caseRowMap(rows.filter((row) => row.externalSupplierId))} />
        {manager ? <Block title="Diagnósticos pendientes de validación" empty="No hay diagnósticos por validar." bandejaHref="/operacion?vista=validacion" rows={caseRowMap(rows.filter((row) => row.status === "PENDIENTE_VALIDACION"))} /> : null}
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
      <section className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard label="Ingresos físicos pendientes" value={String(income)} href="/motores" />
        <KpiCard label="Operación activa" value={String(active)} href="/operacion" />
        <KpiCard label="Pendientes de cotizar" value={String(quotes)} href="/cotizaciones?vista=pendientes" />
        <KpiCard label="Compras por procesar" value={String(purchases)} href="/compras?vista=procesar" />
        <KpiCard label="En resguardo (egresos)" value={String(exits)} href="/custodia?vista=resguardo" />
      </section>
      <Block title="Pendientes operativos" empty="Sin pendientes." rows={links} />
    </>
  );
}

async function Sales({
  companyId,
  userId,
  role,
  companyCode,
}: {
  companyId: string;
  userId: string;
  role: Role;
  companyCode: string | null;
}) {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const now = new Date();
  const [
    receivables,
    goals,
    invoicedMonth,
    collectedMonth,
    newClientsMonth,
    activeServicios,
    osSinFacturaQuotes,
  ] = await Promise.all([
    prisma.receivable.findMany({
      where: { companyId, sellerUserId: userId, balance: { gt: 0 } },
      include: {
        document: { select: { folio: true, technicalCaseId: true, equipmentId: true } },
        client: true,
      },
      take: 100,
      orderBy: { dueAt: "asc" },
    }),
    prisma.salesGoal.findMany({
      where: { companyId, userId, year: now.getFullYear(), month: now.getMonth() + 1 },
      include: { goalType: true },
    }),
    prisma.billingDocument.aggregate({
      where: {
        companyId,
        status: "EMITIDA",
        kind: { not: "REMISION" },
        issuedAt: { gte: monthStart },
        OR: [{ quote: { sellerUserId: userId } }, { client: { ownerUserId: userId, isSystem: false } }],
      },
      _sum: { total: true },
    }),
    prisma.paymentApplication.aggregate({
      where: {
        confirmedAt: { gte: monthStart },
        payment: { companyId, status: "VALIDADO" },
        receivable: { companyId, sellerUserId: userId },
      },
      _sum: { amount: true },
    }),
    prisma.client.count({
      where: { companyId, ownerUserId: userId, isSystem: false, createdAt: { gte: monthStart } },
    }),
    listActiveServicios(companyId, "", { clientOwnerUserId: userId }),
    prisma.quote.findMany({
      where: {
        companyId,
        sellerUserId: userId,
        technicalCaseId: { not: null },
        billingDocuments: { none: { kind: { in: ["FACTURA", "FACTURA_LIBRE"] }, status: "EMITIDA" } },
      },
      select: { technicalCaseId: true },
      take: 100,
    }),
  ]);

  const overdueBalance = receivables
    .filter((row) => row.balance > 0 && row.dueAt.getTime() < now.getTime())
    .reduce((sum, row) => sum + row.balance, 0);

  const servicioRows = activeServicios.filter((row): row is ServicioBandejaRow => row.kind === "servicio");
  const osSinFacturaCaseIds = [
    ...new Set(
      osSinFacturaQuotes.map((row) => row.technicalCaseId).filter((id): id is string => Boolean(id)),
    ),
  ];
  const osSinFacturaFolios = new Set(
    osSinFacturaCaseIds.length
      ? (
          await prisma.technicalCase.findMany({
            where: {
              id: { in: osSinFacturaCaseIds },
              kind: "OS",
              status: "VALIDADO",
              equipment: { client: { ownerUserId: userId, isSystem: false } },
            },
            select: { folio: true },
          })
        ).map((row) => row.folio)
      : [],
  );
  const cotizadasSinAutorizacion = servicioRows.filter(servicioCotizadaSinAutorizacion);
  const pendientesAutorizacion = servicioRows.filter(servicioPendienteAutorizacion);
  const facturacionPendiente = servicioRows.filter(
    (row) => servicioOsValidadaAutorizada(row) && row.osFolio != null && osSinFacturaFolios.has(row.osFolio),
  );
  const entregasOsValidadas = servicioRows.filter(servicioOsValidadaPendienteEntrega);
  const cobranzaServicios = await listServiciosForBillingLinks(
    companyId,
    receivables.map((row) => ({
      technicalCaseId: row.document.technicalCaseId,
      equipmentId: row.document.equipmentId,
    })),
  );
  const vigenteEquipmentIds = new Set(
    receivables
      .filter((row) => receivableEsVigente(row.dueAt, row.balance) && row.document.equipmentId)
      .map((row) => row.document.equipmentId as string),
  );

  return (
    <>
      <PageHeader
        title="Inicio"
        subtitle="Pendientes comerciales de tu cartera."
        action={<ActionLink href="/cotizaciones/nuevo">Nueva cotización</ActionLink>}
      />
      <Card className="mb-4 p-5">
        <div>
          <h2 className="text-base font-bold tracking-tight text-[var(--ink)]">Mi desempeño</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Indicadores del mes en curso de tu cartera.</p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SalesMetric label="Facturación" value={money(invoicedMonth._sum.total ?? 0)} href="/facturacion?vista=facturas" />
          <SalesMetric label="Cobranza" value={money(collectedMonth._sum.amount ?? 0)} href="/cobranza?vista=cxc" />
          <SalesMetric label="Saldo vencido" value={money(overdueBalance)} href="/cobranza?vista=vencidas" />
          <SalesMetric label="Clientes nuevos" value={newClientsMonth} href="/clientes" />
        </div>
        {goals.length > 0 ? (
          <div className="mt-4 border-t border-[var(--line)] pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Metas del mes</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {goals.map((goal) => (
                <li key={goal.id} className="rounded-full border border-[var(--line)] bg-[#f7fafc] px-3 py-1.5 text-sm text-[var(--ink)]">
                  {goal.goalType.name}: objetivo {goal.target}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>
      <section className="flex w-full max-w-none flex-col gap-4">
        <SalesPanelServiciosGrouped
          title="Cotizaciones / seguimientos"
          role={role}
          sections={[
            {
              subtitle: "Cotizadas / sin autorización",
              empty: "No hay servicios «Cotizado» sin subestado (aún sin autorización del cliente).",
              bandejaHref: serviciosBandejaHref({ vista: "activos" }),
              rows: cotizadasSinAutorizacion,
            },
            {
              subtitle: "Pendientes de autorización",
              empty: "No hay servicios «Cotizado» con subestado «No autorizado».",
              bandejaHref: serviciosBandejaHref({ vista: "activos" }),
              rows: pendientesAutorizacion,
            },
          ]}
        />
        <SalesPanelServiciosSection
          title="Facturación"
          empty="No hay OS validadas sin factura emitida en servicios activos."
          bandejaHref="/facturacion?vista=solicitudes"
          rows={facturacionPendiente}
          role={role}
        />
        <SalesPanelServiciosSection
          title="Cobranza"
          empty="No hay servicios ligados a facturas con saldo pendiente."
          bandejaHref="/cobranza?vista=cxc"
          rows={cobranzaServicios}
          role={role}
          highlightRow={(row) => row.kind === "servicio" && vigenteEquipmentIds.has(row.equipmentId)}
        />
        <SalesPanelServiciosSection
          title="Entregas pendientes"
          empty="No hay OS validadas pendientes de entrega."
          bandejaHref={serviciosBandejaHref({ vista: "activos" })}
          rows={entregasOsValidadas}
          role={role}
        />
      </section>
    </>
  );
}

async function Coordination({ companyId, code, vista }: { companyId: string; code: string; vista?: string }) {
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
  const subtitle =
    vista === "pendientes"
      ? "Pendientes administrativos de la empresa activa."
      : vista === "accesos"
        ? "Atajos a los módulos que más usa Coordinación."
        : `${code === "SERVOMOTORES" ? "Servomotores" : "SYSTRON"}. La bandeja es de esta empresa.`;
  const quickLinks = [
    { href: "/facturacion?vista=solicitudes", label: "Facturación pendiente" },
    { href: "/pagos?vista=pendientes", label: "Pagos por validar" },
    { href: "/compras?vista=procesar", label: "Compras y O.C. por procesar" },
    { href: "/cobranza?vista=vencidas", label: "Cobranza vencida" },
    { href: "/finanzas", label: "Finanzas" },
    { href: "/nomina", label: "Nómina" },
  ];
  return (
    <>
      <PageHeader title="Panel de coordinación" subtitle={subtitle} />
      {vista === "accesos" ? (
        <section className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quickLinks.map((link) => (
            <KpiCard key={link.href} label={link.label} value="Abrir" href={link.href} />
          ))}
        </section>
      ) : (
        <section className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Facturas solicitadas" value={String(invoices.length)} href="/facturacion?vista=solicitudes" />
          <KpiCard label="Pagos por validar" value={String(payments.length)} href="/pagos?vista=pendientes" />
          <KpiCard label="Cobranza vencida" value={String(dueReceivables.length)} href="/cobranza?vista=vencidas" />
          <KpiCard label="Nómina preliminar" value={String(payrolls.length)} href="/nomina" />
        </section>
      )}
      <div className="grid gap-3">
        <Block title="Facturas solicitadas" empty="Sin solicitudes." bandejaHref="/facturacion?vista=solicitudes" rows={invoices.map((row) => ({ href: `/facturacion/${row.id}`, label: row.folio, detail: row.kind }))} />
        <Block title="Remisiones solicitadas" empty="Sin remisiones por generar." bandejaHref="/facturacion?vista=remisiones" rows={remissions.map((row) => ({ href: `/facturacion/${row.id}`, label: row.folio, detail: "Remisión" }))} />
        <Block title="Pagos por validar" empty="Sin pagos pendientes." bandejaHref="/pagos?vista=pendientes" rows={payments.map((row) => ({ href: `/pagos/${row.id}`, label: row.folio, detail: money(row.amount) }))} />
        <Block title="Compras directas" empty="Nada por cuadrar." bandejaHref="/compras?vista=procesar" rows={purchases.map((row) => ({ href: `/compras/${row.id}`, label: row.folio, detail: money(row.amount) }))} />
        <Block title="Órdenes autorizadas" empty="Nada por procesar." bandejaHref="/compras?vista=procesar" rows={orders.map((row) => ({ href: `/compras/${row.id}`, label: row.folio, detail: money(row.amount) }))} />
        <Block title="Cobranza vencida" empty="Sin cuentas vencidas." bandejaHref="/cobranza?vista=vencidas" rows={dueReceivables.map((row) => ({ href: `/cobranza/${row.id}`, label: row.document.folio, detail: money(row.balance) }))} />
        <Block title="Nómina preliminar" empty="No hay una semana abierta." bandejaHref="/nomina" rows={payrolls.map((row) => ({ href: `/nomina/${row.id}`, label: row.folio, detail: row.lines.some((line) => line.missing) ? "Falta un dato para timbrar" : row.status }))} />
        {code === "SERVOMOTORES" || proofs.length > 0 ? <Block title="Pendientes de comprobación" empty="Sin comprobantes pendientes." rows={proofs.map((row) => ({ href: "/finanzas", label: money(row.amount), detail: row.note ?? "Egreso" }))} /> : null}
      </div>
    </>
  );
}

async function CeoExecutive({ companyId, name, vista }: { companyId: string; name: string; vista?: string }) {
  const [
    quotes,
    orders,
    warranties,
    payrolls,
    commissions,
    overtime,
    overdue,
    invoiced,
    validations,
    exitWithoutDocumentRequests,
    invoices,
    payments,
    dueReceivables,
    receivableSum,
    payableSum,
  ] = await Promise.all([
    prisma.quote.findMany({ where: { companyId, status: "PENDIENTE_COTIZAR" }, take: 12 }),
    prisma.purchase.findMany({ where: { companyId, kind: "OC", status: "PENDIENTE_AUTORIZACION" }, take: 12 }),
    prisma.technicalCase.findMany({ where: { serviceCompanyId: companyId, warrantyDecision: "NO_PROCEDENTE", commercialDecision: null }, take: 12 }),
    prisma.payrollPeriod.findMany({ where: { companyId, status: "PRELIMINAR" }, take: 6 }),
    prisma.commissionRun.findMany({ where: { companyId, status: "PRELIMINAR" }, take: 6 }),
    prisma.overtimeRequest.findMany({ where: { status: "PENDIENTE_CEO", collaborator: { companyId } }, include: { collaborator: { include: { user: true } } }, take: 12 }),
    prisma.technicalCase.count({ where: { serviceCompanyId: companyId, status: { notIn: CLOSED }, slaDueAt: { lt: new Date() } } }),
    prisma.billingDocument.aggregate({ where: { companyId, status: "EMITIDA", kind: { not: "REMISION" } }, _sum: { total: true } }),
    prisma.technicalCase.findMany({ where: { serviceCompanyId: companyId, status: "PENDIENTE_VALIDACION" }, take: 12 }),
    prisma.technicalCase.findMany({
      where: {
        serviceCompanyId: companyId,
        kind: "OS",
        status: "TERMINADA",
        exitWithoutDocumentRequestedAt: { not: null },
        exitWithoutDocumentAuthorizedAt: null,
      },
      include: { equipment: { include: { client: true } } },
      orderBy: { exitWithoutDocumentRequestedAt: "asc" },
      take: 12,
    }),
    prisma.billingDocument.findMany({ where: { companyId, status: "SOLICITADA", kind: { not: "REMISION" } }, take: 12 }),
    prisma.payment.findMany({ where: { companyId, status: "PENDIENTE" }, orderBy: { createdAt: "asc" }, take: 12 }),
    prisma.receivable.findMany({ where: { companyId, balance: { gt: 0 }, dueAt: { lt: new Date() } }, include: { document: true }, take: 12 }),
    prisma.receivable.aggregate({ where: { companyId, balance: { gt: 0 } }, _sum: { balance: true } }),
    prisma.payable.aggregate({ where: { companyId, balance: { gt: 0 } }, _sum: { balance: true } }),
  ]);
  const show = (section: string) => !vista || vista === section;
  const subtitle =
    vista === "autorizacion"
      ? "Órdenes de compra, nómina, comisiones y horas extra que esperan tu decisión."
      : vista === "comercial"
        ? "Cotizaciones sin precio y garantías con decisión comercial pendiente."
        : vista === "tecnico"
          ? "Validaciones y SLA de la operación técnica de esta empresa."
          : vista === "admin"
            ? "Supervisión de facturación, pagos y cobranza vencida."
            : vista === "finanzas"
              ? "Indicadores de la empresa activa. No hay consolidado entre empresas."
              : vista === "empresa"
                ? "Usa el selector de empresa activa en la barra superior."
                : "Solo esta empresa. No hay suma con la otra.";
  return (
    <>
      <PageHeader title={`Panel ${name}`} subtitle={subtitle} />
      {vista === "empresa" ? (
        <Card className="p-4 text-sm text-[var(--muted)]">
          El CEO y Coordinación trabajan en SYSTRON o Servomotores cambiando la empresa activa arriba. Todas las cifras y listas de esta pantalla corresponden solo a la empresa seleccionada.
        </Card>
      ) : null}
      {!vista ? (
        <section className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Por cotizar" value={String(quotes.length)} href="/cotizaciones?vista=pendientes" />
          <KpiCard label="O.C. por autorizar" value={String(orders.length)} href="/compras?vista=autorizar" />
          <KpiCard label="SLA vencidos" value={String(overdue)} href="/operacion" />
          <KpiCard label="Pagos por validar" value={String(payments.length)} href="/pagos?vista=pendientes" />
          <KpiCard label="Salidas sin documento" value={String(exitWithoutDocumentRequests.length)} href="/panel?vista=autorizacion" />
        </section>
      ) : null}
      <div className="grid gap-3">
        {show("comercial") ? (
          <>
            <Block title="Pendientes de cotizar" empty="Nada por cotizar." bandejaHref="/cotizaciones?vista=pendientes" rows={quotes.map((row) => ({ href: `/cotizaciones/${row.id}`, label: row.folio, detail: "Asignar precio" }))} />
            <Block title="Garantías no procedentes" empty="Sin decisión comercial pendiente." bandejaHref="/operacion" rows={warranties.map((row) => ({ href: `/operacion/${row.id}`, label: row.folio, detail: "Decidir comercialmente" }))} />
          </>
        ) : null}
        {show("autorizacion") ? (
          <>
            <Block title="Órdenes por autorizar" empty="Sin órdenes pendientes." bandejaHref="/compras?vista=autorizar" rows={orders.map((row) => ({ href: `/compras/${row.id}`, label: row.folio, detail: money(row.amount) }))} />
            <Block title="Nómina" empty="Sin preliminar." bandejaHref="/nomina" rows={payrolls.map((row) => ({ href: `/nomina/${row.id}`, label: row.folio, detail: "Autorizar" }))} />
            <Block title="Comisiones" empty="Sin preliminar." bandejaHref="/comisiones" rows={commissions.map((row) => ({ href: `/comisiones/${row.id}`, label: row.month, detail: "Validar" }))} />
            <Block title="Horas extra" empty="Nada espera autorización final." bandejaHref="/personal/horas" rows={overtime.map((row) => ({ href: "/personal/horas", label: row.collaborator.user.name, detail: `${row.hours} h` }))} />
            <Block
              title="Salidas sin documento solicitadas"
              empty="Ninguna OS espera tu autorización de salida."
              bandejaHref="/operacion"
              rows={exitWithoutDocumentRequests.map((row) => ({
                href: `/operacion/${row.id}`,
                label: row.folio,
                detail: (
                  <>
                    {row.equipment.client.name} · {row.equipment.folio}
                    <span className="ml-2 inline-flex">
                      <AuthorizeExitWithoutDocumentButton caseId={row.id} version={row.version} />
                    </span>
                  </>
                ),
              }))}
            />
          </>
        ) : null}
        {show("tecnico") ? (
          <>
            <Block title="Diagnósticos por validar" empty="Sin validaciones pendientes." bandejaHref="/operacion?vista=validacion" rows={validations.map((row) => ({ href: `/operacion/${row.id}`, label: row.folio, detail: "Revisar" }))} />
            <section className="grid gap-3 sm:grid-cols-2">
              <KpiCard label="SLA vencidos" value={String(overdue)} href="/operacion" />
              <KpiCard label="Producción técnica" value="Ver reporte" href="/produccion" />
            </section>
          </>
        ) : null}
        {show("admin") ? (
          <>
            <Block title="Facturas solicitadas" empty="Sin solicitudes." bandejaHref="/facturacion?vista=solicitudes" rows={invoices.map((row) => ({ href: `/facturacion/${row.id}`, label: row.folio, detail: row.kind }))} />
            <Block title="Pagos por validar" empty="Sin pagos pendientes." bandejaHref="/pagos?vista=pendientes" rows={payments.map((row) => ({ href: `/pagos/${row.id}`, label: row.folio, detail: money(row.amount) }))} />
            <Block title="Cobranza vencida" empty="Sin cuentas vencidas." bandejaHref="/cobranza?vista=vencidas" rows={dueReceivables.map((row) => ({ href: `/cobranza/${row.id}`, label: row.document.folio, detail: money(row.balance) }))} />
          </>
        ) : null}
        {show("finanzas") ? (
          <section className="grid gap-3 sm:grid-cols-3">
            <KpiCard label="Facturado (histórico)" value={money(invoiced._sum.total ?? 0)} href="/finanzas" />
            <KpiCard label="CxC abierta" value={money(receivableSum._sum.balance ?? 0)} href="/cobranza?vista=cxc" />
            <KpiCard label="CxP abierta" value={money(payableSum._sum.balance ?? 0)} href="/finanzas?vista=cxp" />
          </section>
        ) : null}
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
      <section className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Por cotizar" value={String(quotes.length)} href="/cotizaciones?vista=pendientes" />
        <KpiCard label="O.C. por autorizar" value={String(orders.length)} href="/compras?vista=autorizar" />
        <KpiCard label="SLA vencidos" value={String(overdue)} href="/operacion" />
        <KpiCard label="Facturado" value={money(invoiced._sum.total ?? 0)} href="/finanzas" />
      </section>
      <div className="grid gap-3">
        <Block title="Pendientes de cotizar" empty="Nada por cotizar." bandejaHref="/cotizaciones?vista=pendientes" rows={quotes.map((row) => ({ href: `/cotizaciones/${row.id}`, label: row.folio, detail: "Asignar precio" }))} />
        <Block title="Órdenes por autorizar" empty="Sin órdenes pendientes." bandejaHref="/compras?vista=autorizar" rows={orders.map((row) => ({ href: `/compras/${row.id}`, label: row.folio, detail: money(row.amount) }))} />
        <Block title="Garantías no procedentes" empty="Sin decisión comercial pendiente." bandejaHref="/operacion" rows={warranties.map((row) => ({ href: `/operacion/${row.id}`, label: row.folio, detail: "Decidir comercialmente" }))} />
        <Block title="Nómina" empty="Sin preliminar." bandejaHref="/nomina" rows={payrolls.map((row) => ({ href: `/nomina/${row.id}`, label: row.folio, detail: "Autorizar" }))} />
        <Block title="Comisiones" empty="Sin preliminar." bandejaHref="/comisiones" rows={commissions.map((row) => ({ href: `/comisiones/${row.id}`, label: row.month, detail: "Validar" }))} />
        <Block title="Horas extra" empty="Nada espera autorización final." bandejaHref="/personal/horas" rows={overtime.map((row) => ({ href: "/personal/horas", label: row.collaborator.user.name, detail: `${row.hours} h` }))} />
        <section className="grid gap-3 sm:grid-cols-2">
          <KpiCard label="Operación vencida" value={String(overdue)} href="/operacion" />
          <KpiCard label="Producción técnica" value="Ver reporte" href="/produccion" />
        </section>
      </div>
    </>
  );
}

