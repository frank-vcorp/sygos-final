import { redirect } from "next/navigation";
import { SlaCountdown } from "@/components/sla-countdown";
import { ActiveFilters, Badge, Empty, MobileCard, PageHeader, RecordLink, ResponsiveData, SegmentedNav, Table, Td, Th } from "@/components/ui";
import { homePath } from "@/lib/home";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { compareBySla } from "@/lib/sla";
import { CASE_STATUS_LABEL } from "@/lib/technical";
import { salesPortfolioEquipmentWhere } from "@/lib/sales-assignment";
import { requireCompany } from "@/lib/session";

export default async function OperacionPage({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const session = await requireCompany();
  if (!can(session.role, "operation.queue", session.activeCompanyCode)) {
    redirect(homePath(session.role, session.activeCompanyCode));
  }
  const { vista } = await searchParams;
  const view = vista === "validacion" || vista === "cotizar" ? vista : "activas";
  const servomotores = await prisma.company.findUnique({ where: { code: "SERVOMOTORES" } });
  const rows = await prisma.technicalCase.findMany({
    where: {
      ...(view === "validacion" ? { status: "PENDIENTE_VALIDACION" } : {}),
      ...(view === "cotizar" ? { quotePending: true } : {}),
      ...(view === "activas" ? { status: { notIn: ["VALIDADO", "TERMINADA", "SIN_REPARACION"] } } : {}),
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
      attention: { select: { slaStartedAt: true, priorityName: true, attentionType: true } },
      serviceCompany: { select: { code: true, name: true } },
      assignee: { select: { name: true } },
    },
    take: 200,
  });
  const ordered = rows
    .map((row) => ({ ...row, slaStartedAt: row.attention.slaStartedAt, createdAt: row.createdAt }))
    .sort((a, b) => compareBySla(a, b));
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
        <ResponsiveData table={<Table>
          <thead><tr><Th>Folio</Th><Th>Equipo</Th><Th>Estado</Th><Th>Prioridad</Th><Th>Responsable</Th><Th>SLA</Th></tr></thead>
          <tbody>
            {ordered.map((row) => {
              const readOnly = row.serviceCompanyId !== session.activeCompanyId;
              const overdue = row.slaDueAt != null && row.slaDueAt.getTime() < Date.now();
              return (
                <tr key={row.id}>
                  <Td><RecordLink href={`/operacion/${row.id}`}>{row.folio}</RecordLink>{readOnly ? " · lectura" : ""}</Td>
                  <Td>{row.equipment.folio} · {row.equipment.model}</Td>
                  <Td><Badge tone={overdue ? "warn" : "neutral"}>{CASE_STATUS_LABEL[row.status] ?? row.status}</Badge></Td>
                  <Td>{row.attention.priorityName}</Td>
                  <Td>{row.externalSupplierId ? "Servicio externo" : row.assignee?.name ?? "Sin asignar"}</Td>
                  <Td><SlaCountdown dueAt={row.slaDueAt} /></Td>
                </tr>
              );
            })}
          </tbody>
        </Table>} cards={ordered.map((row) => {
          const readOnly = row.serviceCompanyId !== session.activeCompanyId;
          const overdue = row.slaDueAt != null && row.slaDueAt.getTime() < Date.now();
          return <MobileCard key={row.id} href={`/operacion/${row.id}`} title={`${row.folio}${readOnly ? " · lectura" : ""}`} meta={<Badge tone={overdue ? "warn" : "neutral"}>{CASE_STATUS_LABEL[row.status] ?? row.status}</Badge>}><p>{row.equipment.folio} · {row.equipment.model}</p><p>{row.attention.priorityName} · {row.externalSupplierId ? "Servicio externo" : row.assignee?.name ?? "Sin asignar"}</p><p>SLA: <SlaCountdown dueAt={row.slaDueAt} /></p></MobileCard>;
        })} />
      )}
    </>
  );
}
