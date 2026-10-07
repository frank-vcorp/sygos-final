import { notFound, redirect } from "next/navigation";
import { startServiceAction } from "../../actions";
import { ServiceStartForm } from "@/components/service-start-form";
import { PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { ATTENTION_LABEL, type AttentionType } from "@/lib/priorities";
import { requireCompany } from "@/lib/session";

const TYPES = {
  diagnostico: "DIAGNOSTICO",
  reparacion: "REPARACION",
  garantia: "DIAGNOSTICO_GARANTIA",
} as const;

export default async function NuevoServicioPage({
  params,
  searchParams,
}: {
  params: Promise<{ tipo: string }>;
  searchParams: Promise<{ clientId?: string }>;
}) {
  const session = await requireCompany();
  if (!can(session.role, "attention.create", session.activeCompanyCode)) redirect("/inicio");
  const { tipo } = await params;
  const { clientId: clientIdParam } = await searchParams;
  const attentionType = TYPES[tipo as keyof typeof TYPES];
  if (!attentionType) notFound();
  const warranty = attentionType === "DIAGNOSTICO_GARANTIA";
  const [clients, equipment, priorities, types, brands, models, repairs] = await Promise.all([
    prisma.client.findMany({
      where: { companyId: session.activeCompanyId, active: true, isSystem: false, ...(session.role === "VENTAS" ? { ownerUserId: session.userId } : {}) },
      orderBy: { name: "asc" },
      take: 200,
    }),
    prisma.equipment.findMany({
      where: { originCompanyId: session.activeCompanyId, ...(session.role === "VENTAS" ? { client: { ownerUserId: session.userId } } : {}) },
      orderBy: { createdAt: "desc" },
      take: 300,
      select: { id: true, folio: true, model: true, clientId: true, kind: true },
    }),
    prisma.priority.findMany({ where: { companyId: session.activeCompanyId, attentionType, active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.catalogType.findMany({ orderBy: { name: "asc" } }),
    prisma.catalogBrand.findMany({ orderBy: { name: "asc" } }),
    prisma.catalogModel.findMany({ include: { type: true, brand: true } }),
    warranty
      ? prisma.technicalCase.findMany({
          where: { kind: "OS", status: "TERMINADA", paidAt: { not: null }, attention: { attentionType: { not: "DIAGNOSTICO_GARANTIA" } }, equipment: { originCompanyId: session.activeCompanyId } },
          select: { id: true, folio: true },
        })
      : Promise.resolve([]),
  ]);
  const defaultClientId = clientIdParam && clients.some((row) => row.id === clientIdParam) ? clientIdParam : "";

  return (
    <>
      <PageHeader
        back={{ href: `/servicios/${tipo}`, label: ATTENTION_LABEL[attentionType as AttentionType] }}
        title={`Nuevo ${ATTENTION_LABEL[attentionType as AttentionType]}`}
        subtitle="Elige cliente y equipo, o registra uno nuevo. El SLA inicia con la entrada física en taller."
      />
      <ServiceStartForm
        action={startServiceAction}
        attentionType={attentionType}
        clients={clients}
        equipment={equipment}
        priorities={priorities}
        types={types.map((type) => type.name)}
        brands={brands.map((brand) => brand.name)}
        models={models.map((row) => ({ type: row.type.name, brand: row.brand.name, model: row.name }))}
        repairs={repairs}
        defaultClientId={defaultClientId}
        companyCode={session.activeCompanyCode ?? "SYSTRON"}
        allowQuickClient={can(session.role, "client.create", session.activeCompanyCode)}
        warranty={warranty}
      />
    </>
  );
}
