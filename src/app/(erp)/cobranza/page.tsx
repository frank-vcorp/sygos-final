import { redirect } from "next/navigation";
import { ClientNameLink } from "@/components/client-entity-links";
import { ActiveFilters, Badge, Empty, MobileCard, PageHeader, RecordLink, ResponsiveData, SegmentedNav, Table, Td, Th } from "@/components/ui";
import { homePath } from "@/lib/home";
import { prisma } from "@/lib/db";
import { formatWhen } from "@/lib/form";
import { money } from "@/lib/money";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function CobranzaPage({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const session = await requireCompany();
  if (!can(session.role, "receivable.view", session.activeCompanyCode)) redirect(homePath(session.role, session.activeCompanyCode));
  const { vista } = await searchParams;
  const canEditClient = can(session.role, "client.edit", session.activeCompanyCode);
  const own = session.role === "VENTAS" ? { sellerUserId: session.userId } : {};
  const now = new Date();
  const balanceFilter =
    vista === "cxc"
      ? { balance: { gt: 0 } }
      : vista === "vencidas"
        ? { balance: { gt: 0 }, dueAt: { lt: now } }
        : {};
  const rows = await prisma.receivable.findMany({
    where: { companyId: session.activeCompanyId, ...own, ...balanceFilter },
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
  const tabs = session.role === "VENTAS"
    ? []
    : [
        { href: "/cobranza", label: "Todas", active: !vista },
        { href: "/cobranza?vista=cxc", label: "Con saldo", active: vista === "cxc" },
        { href: "/cobranza?vista=vencidas", label: "Vencidas", active: vista === "vencidas" },
      ];
  return (
    <>
      <PageHeader title={session.role === "VENTAS" ? "Mi cobranza" : "Cobranza"} subtitle="Saldos de esta empresa. Vencida es saldo después de la fecha." />
      {tabs.length > 0 ? <SegmentedNav items={tabs} /> : null}
      <ActiveFilters
        items={[
          ...(vista === "cxc" ? [{ label: "Con saldo", clearHref: "/cobranza" }] : []),
          ...(vista === "vencidas" ? [{ label: "Vencidas", clearHref: "/cobranza" }] : []),
        ]}
      />
      {ordered.length === 0 ? <Empty title="Sin cuentas por cobrar" body="Aparecen cuando Coordinación emite una factura." /> : (
        <ResponsiveData
          table={
            <Table>
              <thead><tr><Th>Documento</Th><Th>Cliente</Th><Th>Saldo</Th><Th>Vence</Th><Th>Estado</Th></tr></thead>
              <tbody>
                {ordered.map((row) => {
                  const overdue = row.balance > 0 && row.dueAt.getTime() < Date.now();
                  const statusLabel = overdue ? "Vencida" : row.status === "SALDADA" ? "Saldada" : row.status === "PARCIAL" ? "Parcial" : "Abierta";
                  return (
                    <tr key={row.id}>
                      <Td><RecordLink href={`/cobranza/${row.id}`}>{row.document.folio}</RecordLink></Td>
                      <Td><ClientNameLink clientId={row.client.id} name={row.client.name} isSystem={row.client.isSystem} canEdit={canEditClient} /></Td>
                      <Td>{money(row.balance)}</Td>
                      <Td>{formatWhen(row.dueAt)}</Td>
                      <Td><Badge tone={overdue ? "warn" : "neutral"}>{statusLabel}</Badge></Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          }
          cards={ordered.map((row) => {
            const overdue = row.balance > 0 && row.dueAt.getTime() < Date.now();
            const statusLabel = overdue ? "Vencida" : row.status === "SALDADA" ? "Saldada" : row.status === "PARCIAL" ? "Parcial" : "Abierta";
            return (
              <MobileCard
                key={row.id}
                href={`/cobranza/${row.id}`}
                title={row.document.folio}
                meta={<Badge tone={overdue ? "warn" : "neutral"}>{statusLabel}</Badge>}
                footer={<ClientNameLink clientId={row.client.id} name={row.client.name} isSystem={row.client.isSystem} canEdit={canEditClient} />}
              >
                <p>{money(row.balance)} · vence {formatWhen(row.dueAt)}</p>
              </MobileCard>
            );
          })}
        />
      )}
      {payables.length > 0 ? (
        <section className="mt-6">
          <h2 className="mb-2 font-medium">Cuentas por pagar a Servomotores</h2>
          <Table>
            <thead><tr><Th>Documento</Th><Th>Saldo</Th><Th>Estado</Th></tr></thead>
            <tbody>
              {payables.map((row) => (
                <tr key={row.id}>
                  <Td>{row.document?.folio ?? "Compra"}</Td>
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
