import { redirect } from "next/navigation";
import { createEquiAction } from "../actions";
import { EquipmentCatalogFields } from "@/components/equipment-catalog-fields";
import { Button, controlClass, Field, PageHeader } from "@/components/ui";
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
      <PageHeader title="Nuevo EQUI" subtitle="Crea la identidad física. La entrada de almacén se confirma después." />
      <form action={createEquiAction} className="grid max-w-xl gap-4 rounded-lg border border-[var(--line)] bg-white p-4">
        <Field label="Cliente">
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
        <Field label="Serie del fabricante" hint="Opcional. La identidad principal es el folio EQUI."><input name="serial" className={controlClass} /></Field>
        <Button type="submit">Crear folio</Button>
      </form>
    </>
  );
}
