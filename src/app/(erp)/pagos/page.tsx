import { redirect } from "next/navigation";
import { ClientNameLink } from "@/components/client-entity-links";
import { ActionLink, ActiveFilters, Badge, Empty, MobileCard, PageHeader, RecordLink, ResponsiveData, SegmentedNav, Table, Td, Th } from "@/components/ui";
import { homePath } from "@/lib/home";
import { prisma } from "@/lib/db";
import { money } from "@/lib/money";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function PagosPage({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const session = await requireCompany();
  if (!can(session.role, "payment.register", session.activeCompanyCode) && !can(session.role, "payment.validate", session.activeCompanyCode)) redirect(homePath(session.role, session.activeCompanyCode));
  const { vista } = await searchParams;
  const filter = vista === "pendientes" ? "PENDIENTE" : vista === "validados" ? "VALIDADO" : null;
  const canEditClient = can(session.role, "client.edit", session.activeCompanyCode);
  const own = session.activeCompanyCode === "SERVOMOTORES"
    ? { OR: [{ companyId: session.activeCompanyId }, { kind: "INTERCOMPANIA", status: "PENDIENTE" }] }
    : { companyId: session.activeCompanyId };
  const rows = await prisma.payment.findMany({
    where: { ...own, ...(filter ? { status: filter } : {}) },
    include: { client: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const tabs = [
    { href: "/pagos", label: "Todos", active: !filter },
    { href: "/pagos?vista=pendientes", label: "Por validar", active: filter === "PENDIENTE" },
    { href: "/pagos?vista=validados", label: "Validados", active: filter === "VALIDADO" },
  ];
  return (
    <>
      <PageHeader title="Pagos" subtitle="Un pago pendiente no reduce saldos. Validarlo sí." action={can(session.role, "payment.register", session.activeCompanyCode) ? <ActionLink href="/pagos/nuevo">Registrar pago</ActionLink> : null} />
      <SegmentedNav items={tabs} />
      <ActiveFilters
        items={[
          ...(filter === "PENDIENTE" ? [{ label: "Por validar", clearHref: "/pagos" }] : []),
          ...(filter === "VALIDADO" ? [{ label: "Validados", clearHref: "/pagos" }] : []),
        ]}
      />
      {rows.length === 0 ? <Empty title="Sin pagos" body="El comprobante, el importe y el destino se capturan al registrar." /> : (
        <ResponsiveData
          table={
            <Table>
              <thead><tr><Th>Folio</Th><Th>Cliente</Th><Th>Tipo</Th><Th>Importe</Th><Th>Estado</Th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <Td><RecordLink href={`/pagos/${row.id}`}>{row.folio}</RecordLink></Td>
                    <Td>
                      {row.kind === "INTERCOMPANIA" || !row.client ? "—" : (
                        <ClientNameLink clientId={row.client.id} name={row.client.name} isSystem={row.client.isSystem} canEdit={canEditClient} />
                      )}
                    </Td>
                    <Td>{row.kind === "INTERCOMPANIA" ? "Intercompañía" : "Cliente"}</Td>
                    <Td>{money(row.amount)}</Td>
                    <Td><Badge tone={row.status === "PENDIENTE" ? "warn" : "neutral"}>{row.status === "PENDIENTE" ? "Pendiente" : "Validado"}</Badge></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          }
          cards={rows.map((row) => {
            const kindLabel = row.kind === "INTERCOMPANIA" ? "Intercompañía" : "Cliente";
            const statusLabel = row.status === "PENDIENTE" ? "Pendiente" : "Validado";
            const footer = row.kind === "INTERCOMPANIA" || !row.client
              ? "Intercompañía"
              : <ClientNameLink clientId={row.client.id} name={row.client.name} isSystem={row.client.isSystem} canEdit={canEditClient} />;
            return (
              <MobileCard
                key={row.id}
                href={`/pagos/${row.id}`}
                title={row.folio}
                meta={<Badge tone={row.status === "PENDIENTE" ? "warn" : "neutral"}>{statusLabel}</Badge>}
                footer={footer}
              >
                <p>{kindLabel} · {money(row.amount)}</p>
              </MobileCard>
            );
          })}
        />
      )}
    </>
  );
}
