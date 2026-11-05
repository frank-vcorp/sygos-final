import { redirect } from "next/navigation";
import { ClientNameLink } from "@/components/client-entity-links";
import {
  Badge,
  Empty,
  MobileCard,
  PageHeader,
  RecordLink,
  ResponsiveData,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { prisma } from "@/lib/db";
import { FIELD_SERVICE_STATUS_LABEL, fieldServiceTotal } from "@/lib/field-service";
import { homePath } from "@/lib/home";
import { money } from "@/lib/money";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function ServicioCampoListPage() {
  const session = await requireCompany();
  if (!can(session.role, "quote.follow", session.activeCompanyCode) && !can(session.role, "quote.create", session.activeCompanyCode)) {
    redirect(homePath(session.role, session.activeCompanyCode));
  }
  const own = session.role === "VENTAS" ? { sellerUserId: session.userId } : {};
  const rows = await prisma.fieldServiceCase.findMany({
    where: { companyId: session.activeCompanyId, ...own },
    include: { client: true, quote: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <>
      <PageHeader
        title="Servicio de campo"
        subtitle="Casos SCA abiertos desde cotizaciones COTSC autorizadas."
        back={session.role === "VENTAS" ? { href: "/panel", label: "Inicio" } : undefined}
      />
      {rows.length === 0 ? (
        <Empty title="Sin casos SCA" body="Autoriza una cotización COTSC para generar el folio SCA." />
      ) : (
        <ResponsiveData
          table={(
            <Table>
              <thead>
                <tr>
                  <Th>Folio</Th>
                  <Th>Cliente</Th>
                  <Th>Cotización</Th>
                  <Th>Total</Th>
                  <Th>Estado</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <Td><RecordLink href={`/servicio-campo/${row.id}`}>{row.folio}</RecordLink></Td>
                    <Td><ClientNameLink clientId={row.clientId} name={row.client.name} isSystem={row.client.isSystem} canEdit={false} /></Td>
                    <Td>{row.quote.folio}</Td>
                    <Td>{money(fieldServiceTotal(row.hours, row.unitPrice))}</Td>
                    <Td><Badge>{FIELD_SERVICE_STATUS_LABEL[row.status] ?? row.status}</Badge></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          cards={rows.map((row) => (
            <MobileCard
              key={row.id}
              href={`/servicio-campo/${row.id}`}
              title={row.folio}
              meta={<Badge>{FIELD_SERVICE_STATUS_LABEL[row.status] ?? row.status}</Badge>}
            >
              <p>{row.client.name}</p>
              <p className="text-sm text-[var(--muted)]">COT {row.quote.folio} · {money(fieldServiceTotal(row.hours, row.unitPrice))}</p>
            </MobileCard>
          ))}
        />
      )}
    </>
  );
}
