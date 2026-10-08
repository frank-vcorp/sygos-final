import Link from "next/link";
import { redirect } from "next/navigation";
import { ClientNameLink } from "@/components/client-entity-links";
import { Badge, Empty, MobileCard, PageHeader, ResponsiveData, Table, Td, Th } from "@/components/ui";
import { homePath } from "@/lib/home";
import { prisma } from "@/lib/db";
import { money } from "@/lib/money";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

const KIND: Record<string, string> = {
  FACTURA: "Factura",
  REMISION: "Remisión",
  FACTURA_LIBRE: "Factura libre",
  FACTURA_INTERCOMPANIA: "Factura a SYSTRON",
};

export default async function FacturacionPage() {
  const session = await requireCompany();
  if (!can(session.role, "invoice.request", session.activeCompanyCode) && !can(session.role, "invoice.issue", session.activeCompanyCode)) redirect(homePath(session.role, session.activeCompanyCode));
  const canEditClient = can(session.role, "client.edit", session.activeCompanyCode);
  const rows = await prisma.billingDocument.findMany({
    where: {
      companyId: session.activeCompanyId,
      ...(session.role === "VENTAS" ? { client: { ownerUserId: session.userId } } : {}),
    },
    include: { client: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return (
    <>
      <PageHeader title="Facturación" subtitle="Solicitud, emisión y remisión de esta empresa. El timbrado no se duplica." action={can(session.role, "invoice.issue", session.activeCompanyCode) ? <Link href="/facturacion/nuevo" className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white">Factura libre</Link> : null} />
      {rows.length === 0 ? <Empty title="Sin documentos" body="Una factura nace de una operación autorizada o de una factura libre." /> : (
        <ResponsiveData
          table={
            <Table>
              <thead><tr><Th>Folio</Th><Th>Tipo</Th><Th>Cliente</Th><Th>Estado</Th><Th>Total</Th></tr></thead>
              <tbody>
                {rows.map((row) => {
                  const statusLabel = row.status === "SOLICITADA" ? "Solicitada" : row.status === "EMITIDA" ? "Emitida" : row.status;
                  return (
                    <tr key={row.id}>
                      <Td><Link href={`/facturacion/${row.id}`} className="font-medium text-[var(--accent)]">{row.folio}</Link></Td>
                      <Td>{KIND[row.kind] ?? row.kind}</Td>
                      <Td><ClientNameLink clientId={row.client.id} name={row.client.name} isSystem={row.client.isSystem} canEdit={canEditClient} /></Td>
                      <Td><Badge>{statusLabel}</Badge></Td>
                      <Td>{money(row.total)}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          }
          cards={rows.map((row) => {
            const statusLabel = row.status === "SOLICITADA" ? "Solicitada" : row.status === "EMITIDA" ? "Emitida" : row.status;
            return (
              <MobileCard
                key={row.id}
                href={`/facturacion/${row.id}`}
                title={row.folio}
                meta={<Badge>{statusLabel}</Badge>}
                footer={<ClientNameLink clientId={row.client.id} name={row.client.name} isSystem={row.client.isSystem} canEdit={canEditClient} />}
              >
                <p>{KIND[row.kind] ?? row.kind} · {money(row.total)}</p>
              </MobileCard>
            );
          })}
        />
      )}
    </>
  );
}
