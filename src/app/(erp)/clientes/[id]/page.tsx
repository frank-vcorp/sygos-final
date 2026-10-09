import { notFound, redirect } from "next/navigation";
import {
  addContactAction,
  inactivateClientAction,
  inactivateContactAction,
  reassignClientAction,
  updateClientAction,
  updateContactAction,
} from "../actions";
import {
  ClientDataAccordion,
  ClientRelationsHub,
} from "@/components/client-detail-panels";
import { HistoryTimeline } from "@/components/history-timeline";
import { ActionLink, Badge, Card, EntityDetailHeader, EntityMetaItem, RecordLink } from "@/components/ui";
import { prisma } from "@/lib/db";
import { historyFor } from "@/lib/history";
import { can } from "@/lib/permissions";
import { regimenLabel } from "@/lib/sat-regimen";
import { redirectIfSalesNotAssigned } from "@/lib/sales-assignment";
import { requireCompany } from "@/lib/session";

export default async function ClienteDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireCompany();
  const { id } = await params;
  const client = await prisma.client.findFirst({
    where: { id, companyId: session.activeCompanyId },
    include: {
      contacts: { where: { active: true }, orderBy: [{ isPrimary: "desc" }, { name: "asc" }] },
      prospects: true,
      equipments: {
        where: { originCompanyId: session.activeCompanyId },
        orderBy: { createdAt: "desc" },
        take: 100,
      },
    },
  });
  if (!client) notFound();
  if (client.isSystem) {
    const motors = await prisma.equipment.findMany({
      where: { kind: "MOT", originCompany: { code: "SYSTRON" } },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    return (
      <>
        <EntityDetailHeader
          back={{ href: "/clientes", label: "Clientes" }}
          title={client.name}
          subtitle="Cliente intercompañía fijo"
          status={<Badge>Intercompañía</Badge>}
        />
        <Card className="max-w-xl p-4 text-sm">
          <p>Las operaciones que SYSTRON envía a Servomotores usan este cliente. No se edita ni se inactiva.</p>
          <p className="mt-3">Régimen fiscal: {regimenLabel(client.taxRegime)}</p>
          <p className="mt-1">Requiere factura: {client.requiresInvoice ? "Sí" : "No"}</p>
        </Card>
        <section className="mt-4 max-w-xl">
          <h2 className="mb-2 font-medium">MOT intercompañía</h2>
          {motors.length === 0 ? <p className="text-sm text-[var(--muted)]">Sin motores enviados por SYSTRON.</p> : (
            <ul className="space-y-1 text-sm">
              {motors.map((motor) => <li key={motor.id}><RecordLink href={`/motores/${motor.id}`}>{motor.folio}</RecordLink> · {motor.model}</li>)}
            </ul>
          )}
        </section>
      </>
    );
  }
  await redirectIfSalesNotAssigned(session, client.ownerUserId, "/clientes");
  if (!can(session.role, "client.edit", session.activeCompanyCode)) redirect("/inicio");

  const equipmentFilter = {
    clientId: client.id,
    ...(session.role === "VENTAS" ? { client: { ownerUserId: session.userId } } : {}),
  };

  const [owner, quotes, attentions, history] = await Promise.all([
    client.ownerUserId ? prisma.user.findUnique({ where: { id: client.ownerUserId } }) : Promise.resolve(null),
    prisma.quote.findMany({
      where: { clientId: client.id, companyId: session.activeCompanyId, ...(session.role === "VENTAS" ? { sellerUserId: session.userId } : {}) },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
    prisma.attention.findMany({
      where: { originCompanyId: session.activeCompanyId, equipment: equipmentFilter },
      include: {
        equipment: { select: { id: true, folio: true, kind: true, model: true } },
        technicalCases: { select: { id: true, folio: true, kind: true, status: true }, orderBy: { createdAt: "desc" }, take: 3 },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    historyFor("CLIENTE", client.id),
  ]);

  const candidates = can(session.role, "client.reassign")
    ? await prisma.user.findMany({
        where: {
          active: true,
          role: session.activeCompanyCode === "SYSTRON" ? { in: ["VENTAS", "CEO"] } : { in: ["GERENTE_OPERATIVO_SERVOMOTORES", "CEO"] },
        },
        orderBy: { name: "asc" },
      })
    : [];

  const clientData = {
    id: client.id,
    version: client.version,
    name: client.name,
    classification: client.classification,
    requiresInvoice: client.requiresInvoice,
    rfc: client.rfc,
    taxRegime: client.taxRegime,
    cfdiUse: client.cfdiUse,
    paymentMethod: client.paymentMethod,
    fiscalZip: client.fiscalZip,
    fiscalAddress: client.fiscalAddress,
    creditDays: client.creditDays,
    deliveryAddress: client.deliveryAddress,
    active: client.active,
  };

  const canQuote = can(session.role, "quote.create", session.activeCompanyCode);
  const canService = can(session.role, "attention.create", session.activeCompanyCode);
  const ownerLabel = owner?.name ?? null;

  const primaryAction =
    canQuote || canService ? (
      <>
        {canService ? <ActionLink href={`/servicios/diagnostico/nuevo?clientId=${client.id}`}>Nueva atención</ActionLink> : null}
        {canQuote ? (
          <ActionLink
            href={`/cotizaciones/nuevo?clientId=${client.id}`}
            tone="ghost"
            className="border-[var(--accent)] font-semibold text-[var(--accent)]"
          >
            Nueva cotización
          </ActionLink>
        ) : null}
      </>
    ) : null;

  return (
    <>
      <EntityDetailHeader
        back={{ href: "/clientes", label: "Clientes" }}
        title={client.name}
        subtitle={client.classification ?? "Cliente"}
        status={client.active ? <Badge tone="ok">Activo</Badge> : <Badge tone="danger">Inactivo</Badge>}
        meta={
          <>
            {ownerLabel ? <EntityMetaItem label="Ejecutivo">{ownerLabel}</EntityMetaItem> : null}
            {client.rfc ? <EntityMetaItem label="RFC">{client.rfc}</EntityMetaItem> : null}
            <EntityMetaItem label="Factura">{client.requiresInvoice ? "Requiere CFDI" : "Sin factura obligatoria"}</EntityMetaItem>
            {client.creditDays != null ? <EntityMetaItem label="Crédito">{client.creditDays} días</EntityMetaItem> : null}
          </>
        }
        primaryAction={primaryAction}
      />

      <ClientRelationsHub
        clientId={client.id}
        quotes={quotes.map((quote) => ({
          id: quote.id,
          folio: quote.folio,
          status: quote.status,
          quoteType: quote.quoteType,
          updatedAt: quote.updatedAt.toISOString(),
        }))}
        attentions={attentions.map((row) => ({
          id: row.id,
          attentionType: row.attentionType,
          priorityName: row.priorityName,
          status: row.status,
          reportedFault: row.reportedFault,
          createdAt: row.createdAt.toISOString(),
          equipment: row.equipment,
          technicalCases: row.technicalCases,
        }))}
        equipments={client.equipments.map((equipment) => ({
          id: equipment.id,
          folio: equipment.folio,
          kind: equipment.kind,
          model: equipment.model,
          custody: equipment.custody,
        }))}
        canQuote={canQuote}
        canService={canService}
      />

      <div className="mt-3">
        <ClientDataAccordion
          client={clientData}
          ownerName={ownerLabel}
          contacts={client.contacts.map((contact) => ({
            id: contact.id,
            name: contact.name,
            roleTitle: contact.roleTitle,
            phone: contact.phone,
            email: contact.email,
            isPrimary: contact.isPrimary,
          }))}
          clientId={client.id}
          version={client.version}
          ownerUserId={client.ownerUserId}
          prospects={client.prospects.map((prospect) => ({ id: prospect.id, name: prospect.name }))}
          updateAction={updateClientAction}
          addContactAction={addContactAction}
          updateContactAction={updateContactAction}
          inactivateContactAction={inactivateContactAction}
          reassignAction={reassignClientAction}
          inactivateAction={inactivateClientAction}
          canReassign={can(session.role, "client.reassign")}
          canInactivate={can(session.role, "client.inactivate") && client.active}
          candidates={candidates.map((user) => ({ id: user.id, name: user.name }))}
        />
      </div>

      {history.length > 0 ? (
        <HistoryTimeline
          className="mt-4"
          items={history.map((item) => ({ id: item.id, createdAt: item.createdAt, summary: item.summary, authorName: item.author?.name }))}
        />
      ) : null}
    </>
  );
}
