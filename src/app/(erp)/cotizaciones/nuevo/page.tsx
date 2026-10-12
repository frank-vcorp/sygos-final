import { redirect } from "next/navigation";
import { createQuoteAction } from "../actions";
import { QuoteDraft } from "@/components/quote-draft";
import { SubmitButton } from "@/components/submit-button";
import { FormActions, FormPanel, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function NuevaCotizacionPage({ searchParams }: { searchParams: Promise<{ clientId?: string }> }) {
  const session = await requireCompany();
  if (!can(session.role, "quote.create", session.activeCompanyCode)) redirect("/cotizaciones");
  const { clientId } = await searchParams;
  const [clients, equipment, types, brands, models] = await Promise.all([
    prisma.client.findMany({
      where: { companyId: session.activeCompanyId, active: true, isSystem: false, ...(session.role === "VENTAS" ? { ownerUserId: session.userId } : {}) },
      include: { contacts: { where: { active: true }, orderBy: [{ isPrimary: "desc" }, { name: "asc" }] } },
      orderBy: { name: "asc" },
    }),
    prisma.equipment.findMany({
      where: { originCompanyId: session.activeCompanyId, ...(session.role === "VENTAS" ? { client: { ownerUserId: session.userId } } : {}) },
      orderBy: { createdAt: "desc" },
      select: { id: true, folio: true, model: true, clientId: true, kind: true, typeName: true, brandName: true, serial: true },
    }),
    prisma.catalogType.findMany({ orderBy: { name: "asc" } }),
    prisma.catalogBrand.findMany({ orderBy: { name: "asc" } }),
    prisma.catalogModel.findMany({ include: { type: true, brand: true } }),
  ]);
  const quickEquipmentKinds: Array<"EQUI" | "MOT"> = [
    ...(can(session.role, "equi.create", session.activeCompanyCode) ? ["EQUI" as const] : []),
    ...(can(session.role, "mot.create", session.activeCompanyCode) ? ["MOT" as const] : []),
  ];
  return (
    <>
      <PageHeader
        title="Nueva cotización"
        subtitle="Completa cliente, equipo, conceptos y destinatarios. Podrás revisar el precio en el siguiente paso."
        back={{ href: "/cotizaciones", label: "Cotizaciones" }}
      />
      <FormPanel action={createQuoteAction}>
        <div className="grid gap-5 p-5 md:p-7">
          <QuoteDraft
            allowQuickClient={can(session.role, "client.create", session.activeCompanyCode)}
            allowQuickEquipment={quickEquipmentKinds.length > 0}
            quickEquipmentKinds={quickEquipmentKinds}
            canEditClient={can(session.role, "client.edit", session.activeCompanyCode)}
            companyCode={session.activeCompanyCode ?? "SYSTRON"}
            defaultClientId={clients.some((client) => client.id === clientId) ? clientId : ""}
            clients={clients.map((client) => ({ id: client.id, name: client.name, contacts: client.contacts.map((contact) => ({ id: contact.id, name: contact.name, isPrimary: contact.isPrimary })) }))}
            equipment={equipment}
            types={types.map((type) => type.name)}
            brands={brands.map((brand) => brand.name)}
            models={models.map((row) => ({ type: row.type.name, brand: row.brand.name, model: row.name }))}
          />
        </div>
        <FormActions note="La cotización se guarda sin precio; coordinación o gerencia la completa después.">
          <SubmitButton pendingLabel="Guardando…">Guardar sin precio</SubmitButton>
        </FormActions>
      </FormPanel>
    </>
  );
}
