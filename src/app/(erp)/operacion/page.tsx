import { redirect } from "next/navigation";
import { parseGerenteServicioPanelFiltro } from "@/lib/gerente-servicios-panel-filters";
import { OperacionQueueList } from "@/components/operacion-queue-list";
import { ActiveFilters, Empty, PageHeader, SegmentedNav } from "@/components/ui";
import { homePath } from "@/lib/home";
import { prisma } from "@/lib/db";
import { displayCompanyCaseFolio, ensureOriginCompanyServiceNumbers, revealAuthorizedIntercompanyOrders } from "@/lib/folios";
import { can } from "@/lib/permissions";
import { compareBySla } from "@/lib/sla";
import { isReparacionExpressAttentionType } from "@/lib/priorities";
import { serviciosBandejaHref } from "@/lib/servicios-catalog";
import { openOperationCaseWhere, hiddenReservedOsStubCaseWhere } from "@/lib/servicios-supervisor";
import { salesPortfolioEquipmentWhere } from "@/lib/sales-assignment";
import { requireCompany } from "@/lib/session";

export default async function OperacionPage({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const session = await requireCompany();
  if (!can(session.role, "operation.queue", session.activeCompanyCode)) {
    redirect(homePath(session.role, session.activeCompanyCode));
  }
  const { vista } = await searchParams;
  if (session.role === "GERENTE_OPERATIVO_SYSTRON" && session.activeCompanyCode === "SYSTRON") {
    const filtro = vista === "validacion" ? "validacion" : undefined;
    if (filtro && parseGerenteServicioPanelFiltro(filtro)) {
      redirect(serviciosBandejaHref({ vista: "activos", filtro }));
    }
    redirect(serviciosBandejaHref({ vista: "activos" }));
  }
  const view = vista === "validacion" || vista === "cotizar" ? vista : "activas";
  await revealAuthorizedIntercompanyOrders();
  const servomotores = await prisma.company.findUnique({ where: { code: "SERVOMOTORES" } });
  const rows = await prisma.technicalCase.findMany({
    where: {
      ...(view === "validacion" ? { status: "PENDIENTE_VALIDACION" } : {}),
      ...(view === "cotizar" ? { quotePending: true } : {}),
      ...(view === "activas" ? openOperationCaseWhere() : {}),
      ...hiddenReservedOsStubCaseWhere(),
      ...(session.role === "TECNICO" ? { assigneeUserId: session.userId } : {}),
      ...(session.role === "VENTAS" ? { equipment: salesPortfolioEquipmentWhere(session.role, session.userId) } : {}),
      OR: [
        { serviceCompanyId: session.activeCompanyId },
        ...(session.activeCompanyCode === "SYSTRON" && servomotores
          ? [{ equipment: { originCompanyId: session.activeCompanyId, kind: "MOT" }, serviceCompanyId: servomotores.id }]
          : []),
      ],
    },
    include: {
      equipment: { select: { folio: true, kind: true, model: true, originCompanyId: true } },
      attention: {
        select: {
          slaStartedAt: true,
          priorityName: true,
          attentionType: true,
          originCompanyId: true,
          serviceCompanyId: true,
          serviceNumber: true,
          originServiceNumber: true,
        },
      },
      serviceCompany: { select: { code: true, name: true } },
      assignee: { select: { name: true } },
    },
    take: 200,
  });
  const originNumbers = await ensureOriginCompanyServiceNumbers(rows.map((row) => row.attentionId));
  const ordered = rows
    .map((row) => {
      const originServiceNumber = originNumbers.get(row.attentionId) ?? row.attention.originServiceNumber;
      const attention = { ...row.attention, originServiceNumber };
      return {
        ...row,
        folio: displayCompanyCaseFolio(row.folio, attention, session.activeCompanyId),
        slaStartedAt: row.attention.slaStartedAt,
        createdAt: row.createdAt,
        express: isReparacionExpressAttentionType(row.attention.attentionType),
      };
    })
    .sort((a, b) => compareBySla(a, b));
  const listRows = ordered.map((row) => ({
    id: row.id,
    folio: row.folio,
    equipmentFolio: row.equipment.folio,
    equipmentModel: row.equipment.model ?? "",
    status: row.status,
    priorityName: row.attention.priorityName,
    assigneeName: row.assignee?.name ?? null,
    externalSupplierId: row.externalSupplierId,
    slaDueAt: row.slaDueAt?.toISOString() ?? null,
    express: row.express ?? false,
    readOnly: row.serviceCompanyId !== session.activeCompanyId,
    createdAt: row.createdAt.toISOString(),
  }));
  const tabs = [
    ["activas", "Activas"],
    ["validacion", "Por validar"],
    ["cotizar", "Pendientes de cotizar"],
  ];
  return (
    <>
      <PageHeader title="Operación técnica" subtitle="Diagnósticos, garantías y órdenes de servicio. El orden sigue el SLA: vencidos primero." />
      <SegmentedNav items={tabs.map(([key, label]) => ({ href: `/operacion?vista=${key}`, label, active: view === key }))} />
      <ActiveFilters
        items={[
          ...(view === "validacion" ? [{ label: "Por validar", clearHref: "/operacion" }] : []),
          ...(view === "cotizar" ? [{ label: "Pendientes de cotizar", clearHref: "/operacion" }] : []),
        ]}
      />
      {ordered.length === 0 ? (
        <Empty title="Sin operaciones en esta vista" body="El trabajo técnico aparece cuando el equipo ya tuvo entrada o ingreso físico." />
      ) : (
        <OperacionQueueList rows={listRows} />
      )}
    </>
  );
}
