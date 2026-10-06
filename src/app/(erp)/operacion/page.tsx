import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge, Empty, MobileCard, PageHeader, ResponsiveData, SegmentedNav, Table, Td, Th } from "@/components/ui";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { compareBySla } from "@/lib/sla";
import { CASE_STATUS_LABEL } from "@/lib/technical";
import { requireCompany } from "@/lib/session";

export default async function OperacionPage({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const session = await requireCompany();
  if (session.role === "ALMACEN" || (!can(session.role, "equi.view", session.activeCompanyCode) && !can(session.role, "mot.view", session.activeCompanyCode))) {
    redirect("/inicio");
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
      ...(session.role === "VENTAS" ? { equipment: { client: { ownerUserId: session.userId } } } : {}),
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
                  <Td><Link href={`/operacion/${row.id}`} className="font-medium text-[var(--accent)]">{row.folio}</Link>{readOnly ? " · lectura" : ""}</Td>
                  <Td>{row.equipment.folio} · {row.equipment.model}</Td>
                  <Td><Badge tone={overdue ? "warn" : "neutral"}>{CASE_STATUS_LABEL[row.status] ?? row.status}</Badge></Td>
                  <Td>{row.attention.priorityName}</Td>
                  <Td>{row.externalSupplierId ? "Servicio externo" : row.assignee?.name ?? "Sin asignar"}</Td>
                  <Td>{row.slaDueAt ? row.slaDueAt.toLocaleString("es-MX", { timeZone: "America/Mexico_City", dateStyle: "medium", timeStyle: "short" }) : "—"}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>} cards={ordered.map((row) => {
          const readOnly = row.serviceCompanyId !== session.activeCompanyId;
          const overdue = row.slaDueAt != null && row.slaDueAt.getTime() < Date.now();
          return <MobileCard key={row.id} href={`/operacion/${row.id}`} title={`${row.folio}${readOnly ? " · lectura" : ""}`} meta={<Badge tone={overdue ? "warn" : "neutral"}>{CASE_STATUS_LABEL[row.status] ?? row.status}</Badge>}><p>{row.equipment.folio} · {row.equipment.model}</p><p>{row.attention.priorityName} · {row.externalSupplierId ? "Servicio externo" : row.assignee?.name ?? "Sin asignar"}</p><p>SLA: {row.slaDueAt ? row.slaDueAt.toLocaleString("es-MX", { timeZone: "America/Mexico_City", dateStyle: "medium", timeStyle: "short" }) : "—"}</p></MobileCard>;
        })} />
      )}
    </>
  );
}
