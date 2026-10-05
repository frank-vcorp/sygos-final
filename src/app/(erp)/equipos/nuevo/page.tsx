import { redirect } from "next/navigation";
import { createEquiAction } from "../actions";
import { Button, controlClass, Field, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function NuevoEquiPage() {
  const session = await requireCompany();
  if (!can(session.role, "equi.create", session.activeCompanyCode)) redirect("/equipos");
  const [clients, types, brands] = await Promise.all([
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
    prisma.equipmentType.findMany({ where: { companyId: session.activeCompanyId, active: true }, orderBy: { name: "asc" } }),
    prisma.equipmentBrand.findMany({ where: { companyId: session.activeCompanyId, active: true }, orderBy: { name: "asc" } }),
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
        <Field label="Tipo">
          <select name="typeId" className={controlClass} defaultValue="">
            <option value="">Selecciona</option>
            {types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
          </select>
        </Field>
        <Field label="O crear tipo" hint="Alta rápida. Queda disponible para el siguiente equipo.">
          <input name="newType" className={controlClass} />
        </Field>
        <Field label="Marca">
          <select name="brandId" className={controlClass} defaultValue="">
            <option value="">Selecciona</option>
            {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
          </select>
        </Field>
        <Field label="O crear marca"><input name="newBrand" className={controlClass} /></Field>
        <Field label="Modelo"><input name="model" required className={controlClass} /></Field>
        <Field label="Descripción"><textarea name="description" rows={2} className={controlClass} /></Field>
        <Field label="Serie del fabricante" hint="Opcional. La identidad principal es el folio EQUI."><input name="serial" className={controlClass} /></Field>
        <Button type="submit">Crear folio</Button>
      </form>
    </>
  );
}
