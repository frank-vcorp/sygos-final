import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge, Empty, PageHeader, Table, Td, Th } from "@/components/ui";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { ATTENTION_LABEL, type AttentionType } from "@/lib/priorities";
import { requireCompany } from "@/lib/session";

const TYPES = {
  diagnostico: "DIAGNOSTICO",
  reparacion: "REPARACION",
  garantia: "DIAGNOSTICO_GARANTIA",
} as const;

export default async function ServiciosPage({ params }: { params: Promise<{ tipo: string }> }) {
  const session = await requireCompany();
  if (session.role === "ALMACEN" || (!can(session.role, "equi.view", session.activeCompanyCode) && !can(session.role, "mot.view", session.activeCompanyCode))) {
    redirect("/inicio");
  }
  const { tipo } = await params;
  const attentionType = TYPES[tipo as keyof typeof TYPES];
  if (!attentionType) notFound();
  const systron = session.activeCompanyCode === "SERVOMOTORES" ? await prisma.company.findUnique({ where: { code: "SYSTRON" } }) : null;
  const rows = await prisma.attention.findMany({
    where: {
      attentionType,
      equipment: {
        ...(session.role === "VENTAS" ? { client: { ownerUserId: session.userId } } : {}),
        ...(session.activeCompanyCode === "SYSTRON"
          ? { originCompanyId: session.activeCompanyId }
          : { kind: "MOT", OR: [{ originCompanyId: session.activeCompanyId }, ...(systron ? [{ originCompanyId: systron.id }] : [])] }),
      },
    },
    include: { equipment: { include: { client: true, originCompany: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return (
    <>
      <PageHeader
        title={ATTENTION_LABEL[attentionType as AttentionType]}
        subtitle="Desde aquí se abre el servicio. El ingreso físico sigue en Taller."
        action={can(session.role, "attention.create", session.activeCompanyCode) ? <Link href={`/servicios/${tipo}/nuevo`} className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white">Nuevo</Link> : null}
      />
      {rows.length === 0 ? <Empty title="Sin servicios de este tipo" body="Al abrirlo puedes dar de alta el cliente y el equipo si todavía no existen." /> : (
        <Table>
          <thead><tr><Th>Equipo</Th><Th>Cliente</Th><Th>Prioridad</Th><Th>Estado</Th></tr></thead>
          <tbody>
            {rows.map((row) => {
              const intercompany = session.activeCompanyCode === "SERVOMOTORES" && row.equipment.originCompany.code === "SYSTRON";
              const href = row.equipment.kind === "MOT" ? `/motores/${row.equipmentId}` : `/equipos/${row.equipmentId}`;
              return (
                <tr key={row.id}>
                  <Td><Link href={href} className="font-medium text-[var(--accent)]">{row.equipment.folio}</Link></Td>
                  <Td>{intercompany ? "SYSTRON · intercompañía" : row.equipment.client.name}</Td>
                  <Td>{row.priorityName}</Td>
                  <Td><Badge>{row.status === "ABIERTA" ? "Espera ingreso" : "En proceso"}</Badge></Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </>
  );
}
