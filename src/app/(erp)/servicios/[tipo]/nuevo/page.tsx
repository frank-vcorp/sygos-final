import { notFound, redirect } from "next/navigation";
import { startServiceAction } from "../../actions";
import { EquipmentCatalogFields } from "@/components/equipment-catalog-fields";
import { QuickPanel } from "@/components/quick-panel";
import { Button, controlClass, Field, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { ATTENTION_LABEL, type AttentionType } from "@/lib/priorities";
import { requireCompany } from "@/lib/session";

const TYPES = {
  diagnostico: "DIAGNOSTICO",
  reparacion: "REPARACION",
  garantia: "DIAGNOSTICO_GARANTIA",
} as const;

export default async function NuevoServicioPage({ params }: { params: Promise<{ tipo: string }> }) {
  const session = await requireCompany();
  if (!can(session.role, "attention.create", session.activeCompanyCode)) redirect("/inicio");
  const { tipo } = await params;
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
      take: 100,
    }),
    prisma.priority.findMany({ where: { companyId: session.activeCompanyId, attentionType, active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.catalogType.findMany({ orderBy: { name: "asc" } }),
    prisma.catalogBrand.findMany({ orderBy: { name: "asc" } }),
    prisma.catalogModel.findMany({ include: { type: true, brand: true } }),
    warranty
      ? prisma.technicalCase.findMany({
          where: { kind: "OS", status: "TERMINADA", paidAt: { not: null }, spawnedFromId: null, equipment: { originCompanyId: session.activeCompanyId } },
          select: { id: true, folio: true },
        })
      : Promise.resolve([]),
  ]);
  return (
    <>
      <PageHeader back={{ href: `/servicios/${tipo}`, label: ATTENTION_LABEL[attentionType as AttentionType] }} title={`Nuevo ${ATTENTION_LABEL[attentionType as AttentionType]}`} subtitle="Si el cliente o el equipo no existen, se dan de alta aquí y el flujo sigue en Taller. El SLA inicia con la entrada física." />
      <form action={startServiceAction} className="grid max-w-2xl gap-4 rounded-lg border border-[var(--line)] bg-white p-4">
        <input type="hidden" name="attentionType" value={attentionType} />
        <Field label="Cliente existente">
          <select name="clientId" className={controlClass} defaultValue="">
            <option value="">Crear cliente en este paso</option>
            {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
          </select>
        </Field>
        {warranty ? null : (
          <QuickPanel label="Alta rápida de cliente" defaultOpen>
            <Field label="Nombre del cliente"><input name="newClientName" className={controlClass} /></Field>
            <Field label="Contacto"><input name="contactName" className={controlClass} /></Field>
          </QuickPanel>
        )}
        <Field label="Equipo existente" hint={warranty ? "La garantía exige un equipo que ya tuvo una reparación pagada." : "Vacío para dar de alta el equipo ahora."}>
          <select name="equipmentId" className={controlClass} defaultValue="" required={warranty}>
            <option value="">{warranty ? "Selecciona" : "Crear equipo en este paso"}</option>
            {equipment.map((item) => <option key={item.id} value={item.id}>{item.folio} · {item.model}</option>)}
          </select>
        </Field>
        {warranty ? null : (
          <QuickPanel label="Alta rápida de equipo" defaultOpen>
            <Field label="EQUI o MOT">
              <select name="equipmentKind" className={controlClass} defaultValue={session.activeCompanyCode === "SERVOMOTORES" ? "MOT" : "EQUI"}>
                {session.activeCompanyCode === "SYSTRON" ? <option value="EQUI">EQUI</option> : null}
                <option value="MOT">MOT</option>
              </select>
            </Field>
            <EquipmentCatalogFields
              types={types.map((type) => type.name)}
              brands={brands.map((brand) => brand.name)}
              models={models.map((row) => ({ type: row.type.name, brand: row.brand.name, model: row.name }))}
            />
            <Field label="Serie"><input name="serial" className={controlClass} /></Field>
          </QuickPanel>
        )}
        <Field label="Prioridad">
          <select name="priorityId" required className={controlClass}>
            <option value="">Selecciona</option>
            {priorities.map((priority) => <option key={priority.id} value={priority.id}>{priority.name}</option>)}
          </select>
        </Field>
        <Field label="Falla reportada"><textarea name="reportedFault" required rows={3} className={controlClass} /></Field>
        {warranty ? (
          <>
            <Field label="Reparación pagada de origen">
              <select name="originalCaseId" required className={controlClass}>
                <option value="">Selecciona</option>
                {repairs.map((repair) => <option key={repair.id} value={repair.id}>{repair.folio}</option>)}
              </select>
            </Field>
            <Field label="Antecedente"><input name="antecedent" required className={controlClass} /></Field>
          </>
        ) : null}
        <Field label="Instrucciones de entrega"><textarea name="deliveryInstructions" rows={2} className={controlClass} /></Field>
        <Button type="submit">Abrir servicio</Button>
      </form>
    </>
  );
}
