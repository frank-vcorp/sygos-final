import { notFound, redirect } from "next/navigation";
import { startServiceAction } from "../../actions";
import { ServiceStartForm } from "@/components/service-start-form";
import { PageHeader } from "@/components/ui";
import { loadEquipmentCatalogByKind } from "@/lib/catalog";
import { prisma } from "@/lib/db";
import { listCompanySellers } from "@/lib/equipment-service";
import { formatMexicoDateTimeLocalValue } from "@/lib/form";
import { can } from "@/lib/permissions";
import { loadDiagnosisPriorityOptions } from "@/lib/diagnosis-priorities";
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
  const allowOrderOverrides = session.role !== "VENTAS";
  const [clients, equipment, priorities, catalog, repairs, sellers] = await Promise.all([
    prisma.client.findMany({
      where: { companyId: session.activeCompanyId, active: true, isSystem: false, ...(session.role === "VENTAS" ? { ownerUserId: session.userId } : {}) },
      orderBy: { name: "asc" },
      select: { id: true, name: true, ownerUserId: true },
    }),
    prisma.equipment.findMany({
      where: { originCompanyId: session.activeCompanyId, ...(session.role === "VENTAS" ? { client: { ownerUserId: session.userId } } : {}) },
      orderBy: { createdAt: "desc" },
      select: { id: true, folio: true, model: true, clientId: true, kind: true, typeName: true, brandName: true, serial: true },
    }),
    attentionType === "DIAGNOSTICO"
      ? loadDiagnosisPriorityOptions(session.activeCompanyId, session.activeCompanyCode)
      : prisma.priority.findMany({ where: { companyId: session.activeCompanyId, attentionType, active: true }, orderBy: { sortOrder: "asc" } }).then((rows) => rows.map((row) => ({ id: row.id, name: row.name, equipmentKind: "EQUI" as const, label: row.name }))),
    loadEquipmentCatalogByKind(),
    warranty
      ? prisma.technicalCase.findMany({
          where: { kind: "OS", status: "TERMINADA", paidAt: { not: null }, attention: { attentionType: { not: "DIAGNOSTICO_GARANTIA" } }, equipment: { originCompanyId: session.activeCompanyId } },
          select: { id: true, folio: true, equipment: { select: { client: { select: { ownerUserId: true } } } } },
        })
      : Promise.resolve([]),
    allowOrderOverrides ? listCompanySellers(session.activeCompanyId, session.activeCompanyCode) : Promise.resolve([]),
  ]);
  const defaultClientId = clientIdParam && clients.some((row) => row.id === clientIdParam) ? clientIdParam : "";
  const gerenteSystron = session.role === "GERENTE_OPERATIVO_SYSTRON";
  const defaultCreatedAt = gerenteSystron ? formatMexicoDateTimeLocalValue(new Date()) : "";
  const quickEquipmentKinds: Array<"EQUI" | "MOT"> = [
    ...(can(session.role, "equi.create", session.activeCompanyCode) ? ["EQUI" as const] : []),
    ...(can(session.role, "mot.create", session.activeCompanyCode) ? ["MOT" as const] : []),
  ];

  return (
    <>
      <PageHeader
        back={{ href: `/servicios/${tipo}`, label: ATTENTION_LABEL[attentionType as AttentionType] }}
        title={`Nuevo ${ATTENTION_LABEL[attentionType as AttentionType]}`}
        subtitle="El catálogo solo sugiere la etiqueta. Se crea un folio nuevo; el servicio arranca cuando Almacén confirma la entrada."
      />
      <ServiceStartForm
        action={startServiceAction}
        attentionType={attentionType}
        clients={clients}
        equipment={equipment}
        priorities={priorities}
        types={catalog.EQUI.types}
        brands={catalog.EQUI.brands}
        models={catalog.EQUI.models}
        catalogByKind={catalog}
        repairs={repairs.map((r) => ({ id: r.id, folio: r.folio, clientOwnerUserId: r.equipment.client.ownerUserId }))}
        sellers={sellers}
        canSelectSeller={allowOrderOverrides}
        canEditOrderDate={gerenteSystron}
        canConfirmPhysicalReceipt={gerenteSystron && can(session.role, "custody.confirm", session.activeCompanyCode)}
        canCaptureLegacyFolio={session.role === "GERENTE_OPERATIVO_SYSTRON"}
        defaultCreatedAt={defaultCreatedAt}
        defaultClientId={defaultClientId}
        companyCode={session.activeCompanyCode ?? "SYSTRON"}
        allowQuickClient={can(session.role, "client.create", session.activeCompanyCode)}
        allowQuickEquipment={quickEquipmentKinds.length > 0}
        quickEquipmentKinds={quickEquipmentKinds}
        warranty={warranty}
        hidePriority={attentionType === "REPARACION"}
      />
    </>
  );
}
