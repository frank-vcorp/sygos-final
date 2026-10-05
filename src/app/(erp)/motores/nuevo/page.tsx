import { redirect } from "next/navigation";
import { createMotAction } from "@/app/(erp)/equipos/actions";
import { EquipmentCatalogFields } from "@/components/equipment-catalog-fields";
import { ServiceTypePriority } from "@/components/service-type-priority";
import { Button, controlClass, Field, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { ATTENTION_LABEL, ATTENTION_TYPES, prioritySummary } from "@/lib/priorities";
import { requireCompany } from "@/lib/session";

export default async function NuevoMotPage() {
  const session = await requireCompany();
  if (!can(session.role, "mot.create", session.activeCompanyCode)) redirect("/motores");
  const [clients, priorities, types, brands, models] = await Promise.all([
    prisma.client.findMany({
      where: {
        companyId: session.activeCompanyId,
        active: true,
        isSystem: false,
        ...(session.role === "VENTAS" ? { ownerUserId: session.userId } : {}),
      },
      orderBy: { name: "asc" },
      take: 200,
    }),
    prisma.priority.findMany({ where: { companyId: session.activeCompanyId, active: true }, orderBy: [{ attentionType: "asc" }, { sortOrder: "asc" }] }),
    prisma.catalogType.findMany({ orderBy: { name: "asc" } }),
    prisma.catalogBrand.findMany({ orderBy: { name: "asc" } }),
    prisma.catalogModel.findMany({ include: { type: true, brand: true } }),
  ]);
  return (
    <>
      <PageHeader
        back={{ href: "/motores", label: "Motores" }}
        title="Nuevo MOT"
        subtitle={session.activeCompanyCode === "SYSTRON"
          ? "La identidad es global. El trabajo físico queda pendiente de ingreso en Servomotores y no entra al almacén SYSTRON."
          : "Cliente directo de Servomotores. Después se confirma el ingreso físico."}
      />
      <form action={createMotAction} className="grid max-w-xl gap-4 rounded-lg border border-[var(--line)] bg-white p-4">
        <Field label={session.activeCompanyCode === "SYSTRON" ? "Cliente final" : "Cliente"}>
          <select name="clientId" required className={controlClass}>
            <option value="">Selecciona</option>
            {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
          </select>
        </Field>
        <EquipmentCatalogFields
          types={types.map((type) => type.name)}
          brands={brands.map((brand) => brand.name)}
          models={models.map((row) => ({ type: row.type.name, brand: row.brand.name, model: row.name }))}
        />
        <Field label="Descripción"><textarea name="description" rows={2} className={controlClass} /></Field>
        <Field label="Serie"><input name="serial" className={controlClass} /></Field>
        <ServiceTypePriority
          hint="La garantía se abre desde Servicios, sobre un equipo que ya tuvo una reparación pagada."
          types={ATTENTION_TYPES.filter((type) => type !== "DIAGNOSTICO_GARANTIA").map((type) => ({ value: type, label: ATTENTION_LABEL[type] }))}
          priorities={priorities.filter((row) => row.attentionType !== "DIAGNOSTICO_GARANTIA").map((row) => ({ id: row.id, attentionType: row.attentionType, label: prioritySummary(row) }))}
        />
        <Field label="Falla reportada"><textarea name="reportedFault" required rows={3} className={controlClass} /></Field>
        <Field label="Instrucciones de entrega"><textarea name="deliveryInstructions" rows={2} className={controlClass} /></Field>
        <Button type="submit">Crear folio MOT</Button>
      </form>
    </>
  );
}
