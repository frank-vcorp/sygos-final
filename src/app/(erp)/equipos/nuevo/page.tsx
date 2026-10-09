import { redirect } from "next/navigation";
import { createEquiAction } from "../actions";
import { ClientPicker } from "@/components/client-picker";
import { EquipmentCatalogFields } from "@/components/equipment-catalog-fields";
import { Button, controlClass, Field, FormActions, FormPanel, FormSection, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function NuevoEquiPage() {
  const session = await requireCompany();
  if (!can(session.role, "equi.create", session.activeCompanyCode)) redirect("/equipos");
  const [clients, types, brands, models] = await Promise.all([
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
    prisma.catalogType.findMany({ orderBy: { name: "asc" } }),
    prisma.catalogBrand.findMany({ orderBy: { name: "asc" } }),
    prisma.catalogModel.findMany({ include: { type: true, brand: true } }),
  ]);
  return (
    <>
      <PageHeader back={{ href: "/equipos", label: "Equipos" }} title="Nuevo EQUI" subtitle="Crea la identidad física. La entrada de almacén se confirma después." />
      <FormPanel action={createEquiAction}>
        <FormSection title="Propiedad" description="Relaciona la unidad física con el cliente que la entrega.">
          <div className="md:col-span-2">
            <ClientPicker
              clients={clients}
              allowQuickClient={can(session.role, "client.create", session.activeCompanyCode)}
            />
          </div>
        </FormSection>
        <FormSection title="Identificación del equipo" description="Modelo, marca y tipo en el mismo bloque. Enter confirma; lo nuevo queda en catálogo al guardar.">
          <div className="md:col-span-2"><EquipmentCatalogFields types={types.map((type) => type.name)} brands={brands.map((brand) => brand.name)} models={models.map((row) => ({ type: row.type.name, brand: row.brand.name, model: row.name }))} /></div>
          <Field label="Número de serie" hint="Opcional. La identidad principal es el folio EQUI."><input name="serial" className={controlClass} /></Field>
          <Field label="Descripción"><textarea name="description" rows={3} className={controlClass} /></Field>
        </FormSection>
        <FormActions note="La entrada física se confirma posteriormente en Almacén."><Button type="submit">Crear folio EQUI</Button></FormActions>
      </FormPanel>
    </>
  );
}
