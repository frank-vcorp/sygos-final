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
import { MOVEMENT_LABEL, type MovementKind } from "@/lib/custody";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function EntradaDocumentoPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireCompany();
  const { id } = await params;
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
  if (!movement || !movement.folio || (movement.kind !== "ENTRADA" && movement.kind !== "INGRESO")) notFound();
  const author = await prisma.user.findUnique({ where: { id: movement.authorUserId }, select: { name: true } });
  const seller = movement.attention?.sellerUserId
    ? await prisma.user.findUnique({ where: { id: movement.attention.sellerUserId }, select: { name: true } })
    : null;
  const backHref = movement.equipment.kind === "MOT" ? `/motores/${movement.equipmentId}` : `/equipos/${movement.equipmentId}`;
  const canPrint = can(session.role, "custody.confirm", session.activeCompanyCode) || can(session.role, "quote.follow", session.activeCompanyCode);
  if (!canPrint) notFound();

  const title = movement.kind === "INGRESO" ? "Ingreso físico" : "Entrada a almacén";
  const shownClient = movement.attention
    ? serviceClientForCompany(session.activeCompanyId, movement.attention, movement.equipment.client)
    : movement.equipment.client;
  const issued = movement.occurredAt.toLocaleDateString("es-MX", { timeZone: "America/Mexico_City", dateStyle: "long" });
  const clientContacts =
    shownClient.id === movement.equipment.client.id
      ? movement.equipment.client.contacts
      : (movement.attention?.adminClient?.contacts ?? movement.equipment.client.contacts);
  const contact = primaryContact(clientContacts);
  const clientParty = buildCommercialClientParty(shownClient, contact);

  return (
    <DocumentPrintShell companyCode={movement.company.code} backHref={backHref} backLabel="Volver al equipo">
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
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Servicio</p>
            <p className="mt-1 font-medium">{movement.reason}</p>
            {movement.attention ? <p className="mt-1 text-[var(--muted)]">Falla: {movement.attention.reportedFault}</p> : null}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Movimiento</p>
            <p className="mt-1">{MOVEMENT_LABEL[movement.kind as MovementKind] ?? movement.kind}</p>
            <p className="mt-1 text-[var(--muted)]">Confirmó almacén: {author?.name ?? "—"}</p>
            {seller ? <p className="text-[var(--muted)]">Vendedor: {seller.name}</p> : null}
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
            { key: "deliver", label: "Entrega (vendedor / quien trae el equipo)", caption: "Nombre y firma" },
            { key: "warehouse", label: "Recibe almacén", caption: `${author?.name ?? "—"} · firma` },
          ]}
        />

        <p className="mt-8 text-xs text-[var(--muted)]">
          Documento generado al confirmar la {MOVEMENT_LABEL[movement.kind as MovementKind]?.toLowerCase() ?? "recepción"} física.
          Conserva una copia firmada para el expediente del equipo.
        </p>

        <DocumentFooter issuerName={companyDisplayName(movement.company)} folio={movement.folio} />
      </div>
    </DocumentPrintShell>
  );
}