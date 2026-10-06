import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge, Empty, PageHeader, Table, Td, Th } from "@/components/ui";
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
  const view = vista === "autorizar" ? "autorizar" : vista === "procesar" ? "procesar" : "directas";
  const where = view === "autorizar"
    ? { kind: "OC", status: "PENDIENTE_AUTORIZACION" }
    : view === "procesar"
      ? { OR: [{ kind: "DIRECTA", status: "PENDIENTE_VALIDAR" }, { kind: "OC", status: "AUTORIZADA" }] }
      : { kind: "DIRECTA", status: { not: "ELIMINADA" } };
  const rows = await prisma.purchase.findMany({
    where: { companyId: session.activeCompanyId, ...where },
    include: { supplier: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const tabs = [
    ["directas", "Compras directas"],
    ["procesar", "Por procesar"],
    ["autorizar", "Por autorizar"],
  ];
  return (
    <>
      <PageHeader title="Compras" subtitle="Cada compra termina en un egreso o en una cuenta por pagar, nunca en ambos." action={<Link href="/compras/nueva" className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white">Nueva</Link>} />
      <div className="mb-4 flex gap-2">
        {tabs.map(([key, label]) => <Link key={key} href={`/compras?vista=${key}`} className={`rounded-md px-3 py-2 text-sm ${view === key ? "bg-[var(--accent)] text-white" : "border border-[var(--line)] bg-white"}`}>{label}</Link>)}
        <Link href="/compras/oc" className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm">Nueva orden</Link>
      </div>
      {rows.length === 0 ? <Empty title="Sin compras en esta vista" body="La compra directa consume el presupuesto del mes desde que se registra." /> : (
        <Table>
          <thead><tr><Th>Folio</Th><Th>Proveedor</Th><Th>Importe</Th><Th>Estado</Th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <Td><Link href={`/compras/${row.id}`} className="font-medium text-[var(--accent)]">{row.folio}</Link></Td>
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
