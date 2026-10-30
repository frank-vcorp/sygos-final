import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ClientNameLink } from "@/components/client-entity-links";
import {
  SalesPanelServiciosGrouped,
  SalesPanelServiciosSection,
} from "@/components/sales-panel-bandeja";
import { RequirementListSection } from "@/app/(erp)/compras/requerimientos/requirement-list-section";
import { Card, KpiCard, PageHeader, RecordLink, TextLink } from "@/components/ui";
import { prisma } from "@/lib/db";
import { money } from "@/lib/money";
import { purchaseListHref } from "@/lib/purchase-filter-links";
import { can } from "@/lib/permissions";
import { homePath } from "@/lib/home";
import {
  loadRequirementListContexts,
  syncPendingPartRequestRequirements,
} from "@/lib/requirement-list-enrichment";
import { shoppingListKindFromList } from "@/lib/shopping-list-display";
import {
  receivableEsVigente,
  servicioCotizadaSinAutorizacion,
  servicioOsValidadaAutorizada,
  servicioOsValidadaPendienteEntrega,
  servicioPendienteAutorizacion,
} from "@/lib/sales-panel";
import type { Role } from "@/lib/roles";
import {
  GERENTE_SERVICIO_PANEL_FILTROS,
  gerentePanelSections,
  loadGerenteServicioPanelContext,
} from "@/lib/gerente-servicios-panel-filters";
import { serviciosBandejaHref } from "@/lib/servicios-catalog";
import {
  listActiveServicios,
  listHistorialServicios,
  listServiciosForBillingLinks,
  servicioRowHighlight,
  type ServicioBandejaRow,
} from "@/lib/servicios-supervisor";
import {
  batchLoadBillingDocumentServiceLinks,
  formatBillingDocumentServiceLinksDetail,
  linksForBillingDocument,
  pickBillingDocumentTechnicalCaseId,
  type BillingDocumentServiceLinks,
} from "@/lib/billing-document-service-links";
import { requireCompany } from "@/lib/session";

const CLOSED = ["VALIDADO", "TERMINADA", "SIN_REPARACION"];

type PanelRow = { key?: string; href: string; label: string; detail: ReactNode; highlight?: boolean };

function billingDocumentPanelDetail(
  row: { technicalCaseId: string | null; quote?: { technicalCaseId: string | null } | null },
  baseDetail: ReactNode,
  linkMap: Map<string, BillingDocumentServiceLinks>,
): ReactNode {
  const serviceDetail = formatBillingDocumentServiceLinksDetail(linksForBillingDocument(row, linkMap));
  if (!serviceDetail) return baseDetail;
  return (
    <>
      {baseDetail}
      {" · "}
      {serviceDetail}
    </>
  );
}

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
  return <ClientNameLink clientId={client.id} name={client.name} isSystem={client.isSystem} />;
}

function panelClientRef(client: { id: string; name: string; isSystem: boolean } | null) {
  if (!client) return "Equipo";
  return panelClientLink(client);
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
    return (
      <GerenteSystronPanel
        companyId={companyId}
        companyCode={session.activeCompanyCode}
        history={vista === "historial"}
      />
    );
  }
  if (session.role === "CEO") {
    if (vista) redirect("/panel");
    return <CeoExecutive companyId={companyId} name={session.activeCompanyName ?? "Empresa"} />;
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
        action={<TextLink href={history ? "/panel" : "/panel?vista=historial"}>{history ? "Ver activos" : "Ver historial"}</TextLink>}
      />
      <Block
        title={history ? "Historial" : "Asignados a ti"}
        empty={history ? "No hay trabajos cerrados en tu historial." : "No tienes operaciones activas asignadas."}
        rows={rows.map((row) => ({
          href: `/operacion/${row.id}`,
          label: row.folio,
          detail: (
            <>
              {panelClientRef(row.equipment.client)} · {row.equipment.folio} · {row.attention.priorityName} · {row.status}
            </>
          ),
        }))}
      />
    </>
  );
}

async function GerenteSystronPanel({
  companyId,
  companyCode,
  history,
}: {
  companyId: string;
  companyCode: string | null;
  history: boolean;
}) {
  const role: Role = "GERENTE_OPERATIVO_SYSTRON";
  const bandejaHistorial = serviciosBandejaHref({ vista: "historial" });

  if (history) {
    const rows = await listHistorialServicios(companyId, "");
    const servicioRows = rows.filter((row): row is ServicioBandejaRow => row.kind === "servicio");
    return (
      <>
        <PageHeader
          title="Inicio"
          subtitle="Servicios cerrados o concluidos. El detalle completo está en Servicios."
          action={<TextLink href="/panel">Ver activos</TextLink>}
        />
        <SalesPanelServiciosSection
          title="Historial"
          empty="No hay servicios en historial."
          bandejaHref={bandejaHistorial}
          rows={servicioRows}
          role={role}
        />
      </>
    );
  }

  await syncPendingPartRequestRequirements(companyId);

  const canManageRequirements = can(role, "purchase.operate", companyCode);
  const allowQuickSupplier = can(role, "supplier.operate", companyCode);

  const [
    activeRows,
    panelCtx,
    refaccionRows,
    suppliers,
    categories,
    accounts,
    shoppingLists,
  ] = await Promise.all([
    listActiveServicios(companyId, ""),
    loadGerenteServicioPanelContext(companyId),
    prisma.requirement.findMany({
      where: { companyId, kind: "REFACCION", status: "PENDIENTE" },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    canManageRequirements
      ? prisma.supplier.findMany({
          where: { companyId, active: true },
          orderBy: { name: "asc" },
          select: { id: true, name: true, currency: true },
        })
      : Promise.resolve([]),
    canManageRequirements
      ? prisma.expenseCategory.findMany({
          where: { companyId, active: true },
          include: { subcategories: { where: { active: true } } },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    canManageRequirements
      ? prisma.financeAccount.findMany({
          where: { companyId, active: true },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    canManageRequirements
      ? prisma.shoppingList.findMany({
          where: { companyId, status: "ABIERTA" },
          include: { supplier: true, lines: { include: { requirement: { select: { kind: true } } } } },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
  ]);

  const [contexts, rowRequesters] = await Promise.all([
    loadRequirementListContexts(companyId, refaccionRows),
    refaccionRows.length
      ? prisma.user.findMany({
          where: { id: { in: refaccionRows.map((row) => row.requesterUserId) } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  const requesterName = new Map(rowRequesters.map((user) => [user.id, user.name]));
  const refaccionListRows = refaccionRows.map((row) => ({
    id: row.id,
    quantity: row.quantity,
    partNumber: row.partNumber,
    description: row.description,
    kind: row.kind,
    status: row.status,
    requesterName: requesterName.get(row.requesterUserId) ?? "—",
    shoppingListId: row.shoppingListId,
    purchaseId: row.purchaseId,
    context: contexts.get(row.id)!,
  }));

  const servicioRows = activeRows.filter((row): row is ServicioBandejaRow => row.kind === "servicio");
  const sections = gerentePanelSections(servicioRows, panelCtx);
  const emptyByFiltro: Record<keyof typeof GERENTE_SERVICIO_PANEL_FILTROS, string> = {
    validacion: "No hay diagnósticos por validar.",
    vencidos: "Nada vencido.",
    refacciones: "No hay solicitudes de refacción abiertas.",
    compras: "No hay compras pendientes ligadas a un servicio activo.",
    asignacion: "Todo lo activo tiene responsable o proveedor.",
  };

  return (
    <>
      <PageHeader
        title="Inicio"
        subtitle="Pendientes del taller con el mismo detalle que Servicios activos."
        action={<TextLink href="/panel?vista=historial">Ver historial</TextLink>}
      />
      <section className="flex w-full max-w-none flex-col gap-4">
        {sections.map(({ filtro, rows }) =>
          filtro === "refacciones" ? (
            <RequirementListSection
              key={filtro}
              title={GERENTE_SERVICIO_PANEL_FILTROS[filtro]}
              empty={emptyByFiltro[filtro]}
              bandejaHref="/compras/requerimientos"
              variant="panel"
              rows={refaccionListRows}
              canManage={canManageRequirements}
              showRequester={canManageRequirements}
              suppliers={suppliers}
              categories={categories}
              accounts={accounts}
              allowQuickSupplier={allowQuickSupplier}
              shoppingLists={shoppingLists.map((list) => ({
                id: list.id,
                folio: list.folio,
                kind: shoppingListKindFromList(list),
                supplierId: list.supplierId,
                supplierName: list.supplier?.name ?? null,
              }))}
            />
          ) : (
            <SalesPanelServiciosSection
              key={filtro}
              title={GERENTE_SERVICIO_PANEL_FILTROS[filtro]}
              empty={emptyByFiltro[filtro]}
              bandejaHref={serviciosBandejaHref({ vista: "activos", filtro })}
              rows={rows}
              role={role}
              highlightRow={
                filtro === "vencidos"
                  ? (row) => servicioRowHighlight(row, panelCtx.now).markers.includes("Vencido")
                  : undefined
              }
            />
          ),
        )}
      </section>
    </>
  );
}

async function SupervisorShop({ companyId, userId }: { companyId: string; userId: string }) {
  const role: Role = "SUPERVISOR_TECNICO";
  const [activeRows, assignedAttentions] = await Promise.all([
    listActiveServicios(companyId, ""),
    prisma.technicalCase.findMany({
      where: { serviceCompanyId: companyId, assigneeUserId: userId, status: { notIn: CLOSED } },
      select: { attentionId: true },
      distinct: ["attentionId"],
    }),
  ]);
  const servicioRows = activeRows.filter((row): row is ServicioBandejaRow => row.kind === "servicio");
  const pending = servicioRows.filter((row) => row.technicianName === null);
  const assignedAttentionIds = new Set(assignedAttentions.map((row) => row.attentionId));
  const mine = servicioRows.filter((row) => assignedAttentionIds.has(row.id));
  const bandejaActivos = serviciosBandejaHref({ vista: "activos" });

  return (
    <>
      <PageHeader
        title="Inicio"
        subtitle="Pendientes de asignar en el taller y operaciones activas asignadas a ti. El resto está en Servicios."
      />
      <section className="flex w-full max-w-none flex-col gap-4">
        <SalesPanelServiciosSection
          title="Pendientes de asignación"
          empty="Todo lo activo tiene responsable o proveedor."
          bandejaHref={bandejaActivos}
          rows={pending}
          role={role}
        />
        <SalesPanelServiciosSection
          title="Asignadas a ti"
          empty="No tienes operaciones activas asignadas."
          bandejaHref={bandejaActivos}
          rows={mine}
          role={role}
        />
      </section>
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
      <PageHeader title="Inicio" subtitle="Pendientes comerciales de tu cartera." />
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
          columnOptions={{ quoteMonto: false, cotizacionFirst: true, tallerColumns: true }}
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
  const comprasPendientesHref = purchaseListHref({
    vista: "compras",
    q: "",
    estado: "PENDIENTE_VALIDAR",
    fecha: "",
    categoria: "",
    proveedor: "",
    solicitante: "",
  });
  const [invoices, remissions, payments, purchases, openPayables, payableSum] = await Promise.all([
    prisma.billingDocument.findMany({
      where: { companyId, status: "SOLICITADA", kind: { not: "REMISION" } },
      select: { id: true, folio: true, kind: true, technicalCaseId: true, quote: { select: { technicalCaseId: true } } },
      take: 12,
    }),
    prisma.billingDocument.findMany({
      where: { companyId, status: "SOLICITADA", kind: "REMISION" },
      select: { id: true, folio: true, kind: true, technicalCaseId: true, quote: { select: { technicalCaseId: true } } },
      take: 12,
    }),
    prisma.payment.findMany({ where: { companyId, status: "PENDIENTE" }, orderBy: { createdAt: "asc" }, take: 12 }),
    prisma.purchase.findMany({ where: { companyId, kind: "DIRECTA", status: "PENDIENTE_VALIDAR" }, take: 12 }),
    prisma.payable.findMany({
      where: { companyId, balance: { gt: 0 } },
      include: { supplier: true, document: true },
      orderBy: { dueAt: "asc" },
      take: 12,
    }),
    prisma.payable.aggregate({ where: { companyId, balance: { gt: 0 } }, _sum: { balance: true } }),
  ]);
  const billingServiceLinkMap = await batchLoadBillingDocumentServiceLinks([
    ...invoices.map((row) => pickBillingDocumentTechnicalCaseId(row)),
    ...remissions.map((row) => pickBillingDocumentTechnicalCaseId(row)),
  ]);
  const billingPending = invoices.length + remissions.length;
  const subtitle =
    vista === "pendientes"
      ? "Pendientes administrativos de la empresa activa."
      : vista === "accesos"
        ? "Atajos a los módulos que más usa Coordinación."
        : `${code === "SERVOMOTORES" ? "Servomotores" : "SYSTRON"}. La bandeja es de esta empresa.`;
  const quickLinks = [
    { href: "/facturacion?vista=solicitudes", label: "Facturación pendiente" },
    { href: "/pagos?vista=pendientes", label: "Pagos por validar" },
    { href: comprasPendientesHref, label: "Compras por validar" },
    { href: "/finanzas?vista=cxp", label: "Cuentas por pagar" },
    { href: "/finanzas?vista=ingresos", label: "Finanzas" },
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
          <KpiCard label="Facturas y remisiones" value={String(billingPending)} href="/facturacion?vista=solicitudes" />
          <KpiCard label="Pagos por validar" value={String(payments.length)} href="/pagos?vista=pendientes" />
          <KpiCard label="Compras por validar" value={String(purchases.length)} href={comprasPendientesHref} />
          <KpiCard label="CxP abierta" value={money(payableSum._sum.balance ?? 0)} href="/finanzas?vista=cxp" />
        </section>
      )}
      <div className="grid gap-3">
        <Block title="Facturas solicitadas" empty="Sin solicitudes." bandejaHref="/facturacion?vista=solicitudes" rows={invoices.map((row) => ({ href: `/facturacion/${row.id}`, label: row.folio, detail: billingDocumentPanelDetail(row, row.kind, billingServiceLinkMap) }))} />
        <Block title="Remisiones solicitadas" empty="Sin remisiones por generar." bandejaHref="/facturacion?vista=remisiones" rows={remissions.map((row) => ({ href: `/facturacion/${row.id}`, label: row.folio, detail: billingDocumentPanelDetail(row, "Remisión", billingServiceLinkMap) }))} />
        <Block title="Pagos por validar" empty="Sin pagos pendientes." bandejaHref="/pagos?vista=pendientes" rows={payments.map((row) => ({ href: `/pagos/${row.id}`, label: row.folio, detail: money(row.amount) }))} />
        <Block title="Compras por validar" empty="Nada pendiente de validación." bandejaHref={comprasPendientesHref} rows={purchases.map((row) => ({ href: `/compras/${row.id}`, label: row.folio, detail: money(row.amount) }))} />
        <Block
          title="Cuentas por pagar"
          empty="Sin saldos por pagar."
          bandejaHref="/finanzas?vista=cxp"
          rows={openPayables.map((row) => ({
            href: "/finanzas?vista=cxp",
            label: row.document?.folio ?? row.supplier.name,
            detail: money(row.balance),
          }))}
        />
      </div>
    </>
  );
}

async function CeoExecutive({ companyId, name }: { companyId: string; name: string }) {
  const [quotes, payrolls, overtime, vacations, commissions] = await Promise.all([
    prisma.quote.findMany({ where: { companyId, status: "PENDIENTE_COTIZAR" }, take: 12 }),
    prisma.payrollPeriod.findMany({ where: { companyId, status: "PRELIMINAR" }, take: 6 }),
    prisma.overtimeRequest.findMany({
      where: { status: "PENDIENTE_CEO", collaborator: { companyId } },
      include: { collaborator: { include: { user: true } } },
      take: 12,
    }),
    prisma.vacationRequest.findMany({
      where: { status: "PENDIENTE", collaborator: { companyId } },
      include: { collaborator: { include: { user: true } } },
      take: 12,
    }),
    prisma.commissionRun.findMany({ where: { companyId, status: "PRELIMINAR" }, take: 6 }),
  ]);

  return (
    <>
      <PageHeader title={`Panel ${name}`} subtitle="Solo esta empresa. No hay suma con la otra." />
      <div className="grid gap-3">
        <Block
          title="Cotizaciones pendientes de precio"
          empty="Nada por cotizar."
          bandejaHref="/cotizaciones?vista=pendientes"
          rows={quotes.map((row) => ({ href: `/cotizaciones/${row.id}`, label: row.folio, detail: "Asignar precio" }))}
        />
        <Block
          title="Nóminas"
          empty="Sin preliminar."
          bandejaHref="/nomina"
          rows={payrolls.map((row) => ({ href: `/nomina/${row.id}`, label: row.folio, detail: "Autorizar" }))}
        />
        <GroupedBlock
          title="Colaboradores"
          sections={[
            {
              subtitle: "Horas extra",
              empty: "Nada espera autorización final.",
              bandejaHref: "/personal/horas",
              rows: overtime.map((row) => ({
                href: "/personal/horas",
                label: row.collaborator.user.name,
                detail: `${row.hours} h`,
              })),
            },
            {
              subtitle: "Vacaciones",
              empty: "Sin solicitudes pendientes.",
              bandejaHref: "/personal/asistencia?vista=vacaciones",
              rows: vacations.map((row) => ({
                href: `/personal/${row.collaboratorId}`,
                label: row.collaborator.user.name,
                detail: `${row.startDate} – ${row.endDate}`,
              })),
            },
            {
              subtitle: "Compensaciones",
              empty: "Sin preliminar.",
              bandejaHref: "/comisiones",
              rows: commissions.map((row) => ({ href: `/comisiones/${row.id}`, label: row.month, detail: "Validar" })),
            },
          ]}
        />
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

