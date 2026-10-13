import { notFound, redirect } from "next/navigation";
import { DetailAnchorButton, DetailGrid, EntityDetailHeader, EntityMetaItem, Card, Badge, TextLink } from "@/components/ui";
import { ClientNameLink } from "@/components/client-entity-links";
import { prisma } from "@/lib/db";
import { formatWhen } from "@/lib/form";
import { can } from "@/lib/permissions";
import { ATTENTION_LABEL, type AttentionType } from "@/lib/priorities";
import { openPendingCases } from "@/lib/technical";
import { redirectIfSalesNotAssigned } from "@/lib/sales-assignment";
import { requireCompany } from "@/lib/session";

export default async function AtencionDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireCompany();
  const { id } = await params;
  const initial = await prisma.attention.findUnique({
    where: { id },
    select: { equipmentId: true },
  });
  if (!initial) notFound();
  try {
    await openPendingCases(initial.equipmentId, new Date());
  } catch {
    // La atención sigue disponible aunque el caso técnico aún no pueda abrirse.
  }
  const attention = await prisma.attention.findUnique({
    where: { id },
    include: {
      equipment: { include: { client: true, originCompany: true } },
      serviceCompany: true,
      technicalCases: { orderBy: { createdAt: "asc" }, select: { id: true, folio: true } },
    },
  });
  if (!attention) notFound();
  if (attention.technicalCases[0]) redirect(`/operacion/${attention.technicalCases[0].id}`);
  const kindAction = attention.equipment.kind === "MOT" ? "mot.view" : "equi.view";
  if (!can(session.role, kindAction, session.activeCompanyCode) && !can(session.role, "attention.catalog", session.activeCompanyCode)) notFound();
  await redirectIfSalesNotAssigned(session, attention.equipment.client.ownerUserId, "/inicio");
  const seller = attention.sellerUserId
    ? await prisma.user.findUnique({ where: { id: attention.sellerUserId }, select: { name: true } })
    : null;
  const equipmentHref = attention.equipment.kind === "MOT" ? `/motores/${attention.equipment.id}` : `/equipos/${attention.equipment.id}`;
  const identity = [attention.equipment.typeName, attention.equipment.brandName, attention.equipment.model].filter(Boolean).join(" · ");
  const label = ATTENTION_LABEL[attention.attentionType as AttentionType] ?? attention.attentionType;

  return (
    <>
      <EntityDetailHeader
        back={{ href: equipmentHref, label: "Equipo" }}
        title={`Atención · ${label}`}
        subtitle={`${attention.equipment.folio} · ${attention.serviceCompany.name}`}
        status={<Badge tone="warn">Pendiente de ingreso físico</Badge>}
        meta={
          <>
            <EntityMetaItem label="Identificación del equipo">
              <TextLink href={equipmentHref}>{identity || attention.equipment.folio}</TextLink>
              <span className="block text-xs text-[var(--muted)]">{attention.equipment.folio}{attention.equipment.serial ? ` · Serie ${attention.equipment.serial}` : ""}</span>
            </EntityMetaItem>
            <EntityMetaItem label="Cliente">
              <ClientNameLink clientId={attention.equipment.client.id} name={attention.equipment.client.name} isSystem={attention.equipment.client.isSystem} canEdit={can(session.role, "client.edit", session.activeCompanyCode)} />
            </EntityMetaItem>
            <EntityMetaItem label="Vendedor">{seller?.name ?? "Sin vendedor asignado"}</EntityMetaItem>
            <EntityMetaItem label="Prioridad">{attention.priorityName}</EntityMetaItem>
            <EntityMetaItem label="Capturada">{formatWhen(attention.createdAt)}</EntityMetaItem>
          </>
        }
        secondaryActions={
          <nav className="flex flex-wrap gap-2" aria-label="Relaciones de la atención">
            <TextLink href={equipmentHref}>Equipo</TextLink>
            <TextLink href={`/clientes/${attention.equipment.client.id}`}>Cliente</TextLink>
          </nav>
        }
      />
      <DetailGrid>
        <div className="space-y-4">
          <Card className="p-5 text-sm">
            <h2 className="font-medium text-[#0b1f3a]">Detalle de la atención</h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <div><dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Falla reportada</dt><dd className="mt-1">{attention.reportedFault}</dd></div>
              <div><dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">SLA</dt><dd className="mt-1">Inicia con la entrada física del equipo.</dd></div>
              {attention.antecedent ? <div className="sm:col-span-2"><dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Antecedente</dt><dd className="mt-1">{attention.antecedent}</dd></div> : null}
            </dl>
          </Card>
          <Card className="p-5 text-sm">
            <h2 className="font-medium text-[#0b1f3a]">Información adicional</h2>
            {attention.initialLog ? <p className="mt-3 whitespace-pre-wrap leading-6">{attention.initialLog}</p> : <p className="mt-3 text-[var(--muted)]">No se capturó una bitácora inicial.</p>}
          </Card>
        </div>
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <Card className="p-5 text-sm">
            <h2 className="font-medium text-[#0b1f3a]">Seguimiento</h2>
            <p className="mt-2 leading-6 text-[var(--muted)]">La atención ya fue capturada por Ventas. El caso técnico y su bitácora aparecerán cuando Almacén confirme la entrada física.</p>
            <div className="mt-4"><DetailAnchorButton href={equipmentHref}>Ver ficha del equipo</DetailAnchorButton></div>
          </Card>
        </aside>
      </DetailGrid>
    </>
  );
}
