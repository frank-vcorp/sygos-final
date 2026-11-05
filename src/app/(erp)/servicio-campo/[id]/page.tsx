import { notFound, redirect } from "next/navigation";
import { ClientNameLink } from "@/components/client-entity-links";
import { HistoryTimeline } from "@/components/history-timeline";
import {
  Badge,
  Card,
  EntityDetailHeader,
  EntityMetaItem,
  PageHeader,
  TextLink,
} from "@/components/ui";
import { prisma } from "@/lib/db";
import { FIELD_SERVICE_CONCEPT, FIELD_SERVICE_STATUS_LABEL, fieldServiceTotal } from "@/lib/field-service";
import { historyFor } from "@/lib/history";
import { homePath } from "@/lib/home";
import { money } from "@/lib/money";
import { can } from "@/lib/permissions";
import { QUOTE_STATUS_LABEL } from "@/lib/quotes";
import { redirectIfSalesNotAssigned } from "@/lib/sales-assignment";
import { requireCompany } from "@/lib/session";

export default async function ServicioCampoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireCompany();
  if (!can(session.role, "quote.follow", session.activeCompanyCode) && !can(session.role, "quote.create", session.activeCompanyCode)) {
    redirect(homePath(session.role, session.activeCompanyCode));
  }
  const { id } = await params;
  const row = await prisma.fieldServiceCase.findFirst({
    where: { id, companyId: session.activeCompanyId },
    include: { client: true, quote: true },
  });
  if (!row) notFound();
  await redirectIfSalesNotAssigned(session, row.sellerUserId, "/servicio-campo");
  const history = await historyFor("SERVICIO_CAMPO", row.id);
  const total = fieldServiceTotal(row.hours, row.unitPrice);

  return (
    <>
      <EntityDetailHeader
        back={{ href: "/servicio-campo", label: "Servicio de campo" }}
        title={row.folio}
        subtitle={FIELD_SERVICE_CONCEPT}
        status={<Badge>{FIELD_SERVICE_STATUS_LABEL[row.status] ?? row.status}</Badge>}
        meta={(
          <>
            <EntityMetaItem label="Cliente">
              <ClientNameLink clientId={row.clientId} name={row.client.name} isSystem={row.client.isSystem} canEdit={can(session.role, "client.edit", session.activeCompanyCode)} />
            </EntityMetaItem>
            <EntityMetaItem label="Cotización">
              <TextLink href={`/cotizaciones/${row.quoteId}`}>{row.quote.folio}</TextLink>
              {" · "}
              {QUOTE_STATUS_LABEL[row.quote.status] ?? row.quote.status}
            </EntityMetaItem>
            <EntityMetaItem label="Total">{money(total)}</EntityMetaItem>
          </>
        )}
      />
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <PageHeader title="Detalle" subtitle="Precio y alcance acordados en COTSC." />
          <dl className="mt-4 grid gap-3 text-sm">
            <div><dt className="text-[var(--muted)]">Concepto</dt><dd>{row.concept}</dd></div>
            <div><dt className="text-[var(--muted)]">Descripción</dt><dd className="whitespace-pre-wrap">{row.description}</dd></div>
            <div><dt className="text-[var(--muted)]">Horas</dt><dd>{row.hours}</dd></div>
            <div><dt className="text-[var(--muted)]">Precio unitario</dt><dd>{money(row.unitPrice)}</dd></div>
            <div><dt className="text-[var(--muted)]">Total</dt><dd>{money(total)}</dd></div>
          </dl>
          <p className="mt-4 text-sm text-[var(--muted)]">
            Facturación FAC ligada a SCA: pendiente de reglas de facturación dedicadas (TODO).
          </p>
        </Card>
        <Card className="p-5">
          <PageHeader title="Historial" />
          <HistoryTimeline items={history.map((item) => ({
            id: item.id,
            createdAt: item.createdAt,
            summary: item.summary,
            authorName: item.author?.name,
          }))} />
        </Card>
      </div>
    </>
  );
}
