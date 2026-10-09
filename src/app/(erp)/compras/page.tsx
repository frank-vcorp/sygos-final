import { redirect } from "next/navigation";
import { ActionLink, Badge, Empty, PageHeader, RecordLink, SegmentedNav, Table, Td, Th, TextLink } from "@/components/ui";
import { prisma } from "@/lib/db";
import { money } from "@/lib/money";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

const STATUS: Record<string, string> = {
  PENDIENTE_VALIDAR: "Pendiente de validar",
  PENDIENTE_AUTORIZACION: "Pendiente de autorización",
  AUTORIZADA: "Autorizada",
  RECHAZADA: "Rechazada",
  PROCESADA: "Procesada",
  CANCELADA: "Cancelada",
  ELIMINADA: "Eliminada",
};

export default async function ComprasPage({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const session = await requireCompany();
  if (!can(session.role, "purchase.operate", session.activeCompanyCode)) redirect("/inicio");
  const { vista } = await searchParams;
  const view = vista === "autorizar" ? "autorizar" : vista === "procesar" ? "procesar" : vista === "oc" ? "oc" : "directas";
  const where = view === "autorizar"
    ? { kind: "OC", status: "PENDIENTE_AUTORIZACION" }
    : view === "procesar"
      ? { OR: [{ kind: "DIRECTA", status: "PENDIENTE_VALIDAR" }, { kind: "OC", status: "AUTORIZADA" }] }
      : view === "oc"
        ? { kind: "OC", status: { not: "ELIMINADA" } }
        : { kind: "DIRECTA", status: { not: "ELIMINADA" } };
  const rows = await prisma.purchase.findMany({
    where: { companyId: session.activeCompanyId, ...where },
    include: { supplier: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const tabs = [
    ["directas", "Compras directas"],
    ["oc", "Órdenes de compra"],
    ["procesar", "Por procesar"],
    ...(session.role === "CEO" || session.role === "ADMINISTRADOR" ? [["autorizar", "Por autorizar"] as const] : []),
  ];
  return (
    <>
      <PageHeader title="Compras" subtitle="Cada compra termina en un egreso o en una cuenta por pagar, nunca en ambos." action={<ActionLink href="/compras/nueva">Nueva compra</ActionLink>} />
      <SegmentedNav items={tabs.map(([key, label]) => ({ href: `/compras?vista=${key}`, label, active: view === key }))} />
      <p className="mb-4 text-sm"><TextLink href="/compras/oc">Nueva orden de compra</TextLink></p>
      {rows.length === 0 ? <Empty title="Sin compras en esta vista" body="La compra directa consume el presupuesto del mes desde que se registra." /> : (
        <Table>
          <thead><tr><Th>Folio</Th><Th>Proveedor</Th><Th>Importe</Th><Th>Estado</Th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <Td><RecordLink href={`/compras/${row.id}`}>{row.folio}</RecordLink></Td>
                <Td>{row.supplier?.name ?? "Sin proveedor"}</Td>
                <Td>{money(row.amount)}</Td>
                <Td><Badge>{STATUS[row.status] ?? row.status}</Badge></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
