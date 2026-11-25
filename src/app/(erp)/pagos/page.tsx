import { redirect } from "next/navigation";
import { RegisterPaymentDialog } from "./register-payment-dialog";
import { getPaymentFormOptions } from "./payment-form-data";
import { ActionLink, ActiveFilters, Badge, Empty, MobileCard, PageHeader, RecordLink, ResponsiveData, SegmentedNav, Table, Td, Th } from "@/components/ui";
import { ClientNameLink } from "@/components/client-entity-links";
import { repBadgeInfo } from "@/lib/billing-badges";
import { homePath } from "@/lib/home";
import { prisma } from "@/lib/db";
import { money } from "@/lib/money";
import { coordFilterChips, coordPageSubtitle, coordPageTitle, coordUsesSidebarNav } from "@/lib/coordination-ui";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function PagosPage({ searchParams }: { searchParams: Promise<{ vista?: string; nuevo?: string }> }) {
  const session = await requireCompany();
  if (!can(session.role, "payment.register", session.activeCompanyCode) && !can(session.role, "payment.validate", session.activeCompanyCode)) redirect(homePath(session.role, session.activeCompanyCode));
  const { vista, nuevo } = await searchParams;
  const filter = vista === "pendientes" ? "PENDIENTE" : vista === "validados" ? "VALIDADO" : null;
  const canRegister = can(session.role, "payment.register", session.activeCompanyCode);
  const paymentFormOptions = canRegister ? await getPaymentFormOptions(session) : { receivables: [], payables: [] };
  const canEditClient = can(session.role, "client.edit", session.activeCompanyCode);
  const own = session.activeCompanyCode === "SERVOMOTORES"
    ? { OR: [{ companyId: session.activeCompanyId }, { kind: "INTERCOMPANIA" }] }
    : { companyId: session.activeCompanyId };
  const rows = await prisma.payment.findMany({
    where: { ...own, ...(filter ? { status: filter } : {}) },
    include: {
      client: true,
      paymentComplement: { select: { id: true, fiscalStatus: true, fiscalEnv: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const tabs = [
    { href: "/pagos", label: "Todos", active: !filter },
    { href: "/pagos?vista=pendientes", label: "Por validar", active: filter === "PENDIENTE" },
    { href: "/pagos?vista=validados", label: "Validados", active: filter === "VALIDADO" },
  ];
  const sidebarNav = coordUsesSidebarNav(session.role);
  const vistaTitle = filter === "PENDIENTE" ? "Pagos por validar" : filter === "VALIDADO" ? "Pagos validados" : undefined;
  const listHref = filter === "PENDIENTE" ? "/pagos?vista=pendientes" : filter === "VALIDADO" ? "/pagos?vista=validados" : "/pagos";
  return (
    <>
      <PageHeader
        title={coordPageTitle(sidebarNav, vistaTitle, "Pagos")}
        subtitle={coordPageSubtitle(sidebarNav, session.activeCompanyCode, "Un pago pendiente no reduce saldos. Validarlo sí.", "Comprobante, importe y destino")}
        action={
          <span className="flex flex-wrap items-center gap-2">
            {can(session.role, "invoice.issue", session.activeCompanyCode) ? (
              <ActionLink href="/facturacion/complemento" tone="ghost">Complemento de varias facturas</ActionLink>
            ) : null}
            {canRegister ? (
              <RegisterPaymentDialog
                receivables={paymentFormOptions.receivables}
                payables={paymentFormOptions.payables}
                initiallyOpen={nuevo === "1"}
                returnHref={nuevo === "1" ? listHref : undefined}
              />
            ) : null}
          </span>
        }
      />
      {sidebarNav ? null : <SegmentedNav items={tabs} />}
      <ActiveFilters
        items={coordFilterChips(sidebarNav, [
          ...(filter === "PENDIENTE" ? [{ label: "Por validar", clearHref: "/pagos" }] : []),
          ...(filter === "VALIDADO" ? [{ label: "Validados", clearHref: "/pagos" }] : []),
        ])}
      />
      {rows.length === 0 ? <Empty title="Sin pagos" body="El comprobante, el importe y el destino se capturan al registrar." /> : (
        <ResponsiveData
          table={
            <Table>
              <thead><tr><Th>Folio</Th><Th>Cliente</Th><Th>Tipo</Th><Th>Importe</Th><Th>Estado</Th><Th>REP</Th></tr></thead>
              <tbody>
                {rows.map((row) => {
                  const repBadge = row.paymentComplement ? repBadgeInfo(row.paymentComplement) : null;
                  return (
                    <tr key={row.id}>
                      <Td><RecordLink href={`/pagos/${row.id}`}>{row.folio}</RecordLink></Td>
                      <Td>
                        {row.kind === "INTERCOMPANIA" || !row.client ? "SYSTRON (intercompañía)" : (
                          <ClientNameLink clientId={row.client.id} name={row.client.name} isSystem={row.client.isSystem} canEdit={canEditClient} />
                        )}
                      </Td>
                      <Td>{row.kind === "INTERCOMPANIA" ? "Intercompañía" : "Cliente"}</Td>
                      <Td>{money(row.amount)}</Td>
                      <Td><Badge tone={row.status === "PENDIENTE" ? "warn" : "neutral"}>{row.status === "PENDIENTE" ? "Pendiente" : "Validado"}</Badge></Td>
                      <Td>{repBadge ? <Badge tone={repBadge.tone}>{repBadge.label}</Badge> : "—"}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          }
          cards={rows.map((row) => {
            const kindLabel = row.kind === "INTERCOMPANIA" ? "Intercompañía" : "Cliente";
            const statusLabel = row.status === "PENDIENTE" ? "Pendiente" : "Validado";
            const repBadge = row.paymentComplement ? repBadgeInfo(row.paymentComplement) : null;
            const footer = row.kind === "INTERCOMPANIA" || !row.client
              ? "Intercompañía"
              : <ClientNameLink clientId={row.client.id} name={row.client.name} isSystem={row.client.isSystem} canEdit={canEditClient} />;
            return (
              <MobileCard
                key={row.id}
                href={`/pagos/${row.id}`}
                title={row.folio}
                meta={
                  <span className="flex flex-wrap gap-1.5">
                    <Badge tone={row.status === "PENDIENTE" ? "warn" : "neutral"}>{statusLabel}</Badge>
                    {repBadge ? <Badge tone={repBadge.tone}>{repBadge.label}</Badge> : null}
                  </span>
                }
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
