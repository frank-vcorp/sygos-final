import { redirect } from "next/navigation";
import { createMotAction } from "@/app/(erp)/equipos/actions";
import { ClientPicker } from "@/components/client-picker";
import { EquipmentCatalogFields } from "@/components/equipment-catalog-fields";
import { ServiceTypePriority } from "@/components/service-type-priority";
import { Button, controlClass, Field, FormActions, FormPanel, FormSection, PageHeader } from "@/components/ui";
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
      <FormPanel action={createMotAction}>
        <FormSection title="Cliente e identificación" description="Define a quién pertenece el motor y su identidad técnica.">
          <div className="md:col-span-2">
            <ClientPicker
              label={session.activeCompanyCode === "SYSTRON" ? "Cliente final" : "Cliente"}
              clients={clients}
              allowQuickClient={can(session.role, "client.create", session.activeCompanyCode)}
            />
          </div>
          <div className="md:col-span-2"><EquipmentCatalogFields types={types.map((type) => type.name)} brands={brands.map((brand) => brand.name)} models={models.map((row) => ({ type: row.type.name, brand: row.brand.name, model: row.name }))} /></div>
          <Field label="Serie"><input name="serial" className={controlClass} /></Field>
          <Field label="Descripción"><textarea name="description" rows={3} className={controlClass} /></Field>
        </FormSection>
        <FormSection title="Servicio solicitado" description="La prioridad y la falla quedan fotografiadas al crear la atención.">
          <div className="md:col-span-2"><ServiceTypePriority hint="La garantía se abre desde Servicios, sobre un equipo que ya tuvo una reparación pagada." types={ATTENTION_TYPES.filter((type) => type !== "DIAGNOSTICO_GARANTIA").map((type) => ({ value: type, label: ATTENTION_LABEL[type] }))} priorities={priorities.filter((row) => row.attentionType !== "DIAGNOSTICO_GARANTIA").map((row) => ({ id: row.id, attentionType: row.attentionType, label: prioritySummary(row) }))} /></div>
          <Field label="Falla reportada"><textarea name="reportedFault" required rows={4} className={controlClass} /></Field>
          <Field label="Instrucciones de entrega"><textarea name="deliveryInstructions" rows={4} className={controlClass} /></Field>
        </FormSection>
        <FormActions note="El folio MOT es global y no se reutiliza."><Button type="submit">Crear folio MOT</Button></FormActions>
      </FormPanel>
    </>
  );
}
