import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge, Empty, PageHeader, Table, Td, Th } from "@/components/ui";
import { prisma } from "@/lib/db";
import { formatWhen } from "@/lib/form";
import { money } from "@/lib/money";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function CobranzaPage() {
  const session = await requireCompany();
  if (!can(session.role, "receivable.view", session.activeCompanyCode)) redirect("/inicio");
  const own = session.role === "VENTAS" ? { sellerUserId: session.userId } : {};
  const rows = await prisma.receivable.findMany({
    where: { companyId: session.activeCompanyId, ...own },
    include: { client: true, document: true },
    orderBy: { dueAt: "asc" },
    take: 100,
  });
  const payables = session.activeCompanyCode === "SYSTRON" && (session.role === "ADMINISTRADOR" || session.role === "CEO" || session.role === "COORDINACION_ADMINISTRACION")
    ? await prisma.payable.findMany({ where: { companyId: session.activeCompanyId }, include: { supplier: true, document: true }, orderBy: { dueAt: "asc" } })
    : [];
  const ordered = [...rows].sort((a, b) => {
    const late = (row: typeof a) => row.balance > 0 && row.dueAt.getTime() < Date.now() ? Date.now() - row.dueAt.getTime() : 0;
    return late(b) - late(a);
  });
  return (
    <>
      <PageHeader title={session.role === "VENTAS" ? "Mi cobranza" : "Cobranza"} subtitle="Saldos de esta empresa. Vencida es saldo después de la fecha." />
      {ordered.length === 0 ? <Empty title="Sin cuentas por cobrar" body="Aparecen cuando Coordinación emite una factura." /> : (
        <Table>
          <thead><tr><Th>Documento</Th><Th>Cliente</Th><Th>Saldo</Th><Th>Vence</Th><Th>Estado</Th></tr></thead>
          <tbody>
            {ordered.map((row) => {
              const overdue = row.balance > 0 && row.dueAt.getTime() < Date.now();
              return (
                <tr key={row.id}>
                  <Td><Link href={`/cobranza/${row.id}`} className="font-medium text-[var(--accent)]">{row.document.folio}</Link></Td>
                  <Td>{row.client.isSystem ? "SYSTRON · intercompañía" : row.client.name}</Td>
                  <Td>{money(row.balance)}</Td>
                  <Td>{formatWhen(row.dueAt)}</Td>
                  <Td><Badge tone={overdue ? "warn" : "neutral"}>{overdue ? "Vencida" : row.status === "SALDADA" ? "Saldada" : row.status === "PARCIAL" ? "Parcial" : "Abierta"}</Badge></Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
      {payables.length > 0 ? (
        <section className="mt-6">
          <h2 className="mb-2 font-medium">Cuentas por pagar a Servomotores</h2>
          <Table>
            <thead><tr><Th>Documento</Th><Th>Saldo</Th><Th>Estado</Th></tr></thead>
            <tbody>
              {payables.map((row) => (
                <tr key={row.id}>
                  <Td>{row.document.folio}</Td>
                  <Td>{money(row.balance)}</Td>
                  <Td><Badge>{row.status === "SALDADA" ? "Saldada" : row.status === "PARCIAL" ? "Parcial" : "Abierta"}</Badge></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </section>
      ) : null}
    </>
  );
}
