import { notFound } from "next/navigation";
import { DocumentFooter } from "@/components/documents/document-footer";
import { DocumentHeader } from "@/components/documents/document-header";
import { DocumentPartyGrid, buildCommercialClientParty } from "@/components/documents/document-party-grid";
import { DocumentPrintShell } from "@/components/documents/document-print-shell";
import { DocumentSignatureRow } from "@/components/documents/document-signature-row";
import { prisma } from "@/lib/db";
import { companyDisplayName, primaryContact } from "@/lib/document-print";
import { serviceClientForCompany } from "@/lib/intercompany-client";
import { formatWhen } from "@/lib/form";
import { isWarehouseExitDocument, MOVEMENT_LABEL, type MovementKind } from "@/lib/custody";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function SalidaDocumentoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ embed?: string }>;
}) {
  const session = await requireCompany();
  const { id } = await params;
  const query = await searchParams;
  const embedded = query.embed === "1";
  const movement = await prisma.custodyMovement.findFirst({
    where: { id, companyId: session.activeCompanyId },
    include: {
      company: true,
      attention: {
        include: {
          adminClient: { include: { contacts: { where: { active: true }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] } } },
        },
      },
      equipment: { include: { client: { include: { contacts: { where: { active: true }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] } } } } },
    },
  });
  if (!movement || !movement.folio || !isWarehouseExitDocument(movement.kind as MovementKind)) notFound();
  const author = await prisma.user.findUnique({ where: { id: movement.authorUserId }, select: { name: true } });
  const seller = movement.attention?.sellerUserId
    ? await prisma.user.findUnique({ where: { id: movement.attention.sellerUserId }, select: { name: true } })
    : null;
  const backHref = movement.equipment.kind === "MOT" ? `/motores/${movement.equipmentId}` : `/equipos/${movement.equipmentId}`;
  const canPrint = can(session.role, "custody.confirm", session.activeCompanyCode) || can(session.role, "quote.follow", session.activeCompanyCode);
  if (!canPrint) notFound();

  const title = movement.kind === "SALIDA_PRUEBA" ? "Salida a prueba" : movement.kind === "EGRESO" ? "Egreso" : "Salida de almacén";
  const shownClient = movement.attention
    ? serviceClientForCompany(session.activeCompanyId, movement.attention, movement.equipment.client)
    : movement.equipment.client;
  const issued = movement.occurredAt.toLocaleDateString("es-MX", { timeZone: "America/Mexico_City", dateStyle: "long" });
  const receiver = movement.receiverName ?? seller?.name ?? "—";
  const clientContacts =
    shownClient.id === movement.equipment.client.id
      ? movement.equipment.client.contacts
      : (movement.attention?.adminClient?.contacts ?? movement.equipment.client.contacts);
  const contact = primaryContact(clientContacts);
  const clientParty = buildCommercialClientParty(shownClient, contact);

  return (
    <DocumentPrintShell
      companyCode={movement.company.code}
      backHref={embedded ? undefined : backHref}
      backLabel="Volver al equipo"
      embedded={embedded}
    >
      <DocumentHeader
        company={movement.company}
        docTitle={title}
        folio={movement.folio}
        issued={issued}
        timeLine={formatWhen(movement.occurredAt)}
      />

      <div className="px-6 py-6 sm:px-10">
        <DocumentPartyGrid
          clientName={clientParty.clientName}
          clientLines={clientParty.clientLines}
          right={
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Equipo</p>
              <p className="mt-1 font-medium">{movement.equipment.folio}</p>
              <p className="text-sm text-[var(--muted)]">
                {[movement.equipment.typeName, movement.equipment.brandName, movement.equipment.model].filter(Boolean).join(" · ")}
              </p>
              {movement.equipment.serial ? <p className="text-sm text-[var(--muted)]">Serie: {movement.equipment.serial}</p> : null}
            </>
          }
        />

        <section className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Motivo / servicio</p>
            <p className="mt-1 font-medium">{movement.reason}</p>
            {movement.attention ? <p className="mt-1 text-[var(--muted)]">Falla: {movement.attention.reportedFault}</p> : null}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Movimiento</p>
            <p className="mt-1">{MOVEMENT_LABEL[movement.kind as MovementKind] ?? movement.kind}</p>
            <p className="mt-1 text-[var(--muted)]">Entrega almacén: {author?.name ?? "—"}</p>
            <p className="text-[var(--muted)]">Recibe: {receiver}</p>
            {movement.deliveryMode ? <p className="text-[var(--muted)]">Modo: {movement.deliveryMode}</p> : null}
            {movement.enablingDocument ? <p className="text-[var(--muted)]">Documento habilitante: {movement.enablingDocument}</p> : null}
          </div>
        </section>

        {movement.notes ? (
          <section className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Observaciones</p>
            <p className="mt-1 whitespace-pre-wrap">{movement.notes}</p>
          </section>
        ) : null}

        <DocumentSignatureRow
          slots={[
            { key: "warehouse", label: "Entrega almacén", caption: `${author?.name ?? "—"} · firma` },
            { key: "receiver", label: "Recibe equipo", caption: `${receiver} · firma` },
          ]}
        />

        <p className="mt-8 text-xs text-[var(--muted)]">
          Documento generado al confirmar la salida física. Conserva una copia firmada para el expediente del equipo.
        </p>

        <DocumentFooter issuerName={companyDisplayName(movement.company)} folio={movement.folio} />
      </div>
    </DocumentPrintShell>
  );
}