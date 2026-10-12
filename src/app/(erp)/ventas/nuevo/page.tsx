import { redirect } from "next/navigation";
import { createQuoteAction } from "@/app/(erp)/cotizaciones/actions";
import { QuoteDraft } from "@/components/quote-draft";
import { SubmitButton } from "@/components/submit-button";
import { FormActions, FormPanel, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { homePath } from "@/lib/home";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function NuevaVentaEquipoPage({ searchParams }: { searchParams: Promise<{ clientId?: string }> }) {
  const session = await requireCompany();
  if (!can(session.role, "quote.create", session.activeCompanyCode)) {
    redirect(homePath(session.role, session.activeCompanyCode));
  }
  const { clientId } = await searchParams;
  const [clients, equipment, types, brands, models] = await Promise.all([
    prisma.client.findMany({
      where: { companyId: session.activeCompanyId, active: true, isSystem: false, ...(session.role === "VENTAS" ? { ownerUserId: session.userId } : {}) },
      include: { contacts: { where: { active: true }, orderBy: [{ isPrimary: "desc" }, { name: "asc" }] } },
      orderBy: { name: "asc" },
    }),
    prisma.equipment.findMany({
      where: { originCompanyId: session.activeCompanyId, kind: "EQUI", ...(session.role === "VENTAS" ? { client: { ownerUserId: session.userId } } : {}) },
      orderBy: { createdAt: "desc" },
      select: { id: true, folio: true, model: true, clientId: true, kind: true },
    }),
    prisma.catalogType.findMany({ orderBy: { name: "asc" } }),
    prisma.catalogBrand.findMany({ orderBy: { name: "asc" } }),
    prisma.catalogModel.findMany({ include: { type: true, brand: true } }),
  ]);
  const allowQuickEquipment = can(session.role, "equi.create", session.activeCompanyCode);
  return (
    <>
      <PageHeader
        title="Nueva venta de equipo"
        subtitle="Prepara la propuesta para el cliente. Al autorizarla aparecerá en tu bandeja de ventas."
        back={{ href: "/ventas", label: "Venta de equipos" }}
      />
      <FormPanel action={createQuoteAction}>
        <input type="hidden" name="origin" value="ventas" />
        <div className="grid gap-5 p-5 md:p-7">
          <div className="rounded-xl border border-[#cbe3ef] bg-[#f1f8fc] px-4 py-3 text-sm text-[var(--ink)]">
            <strong>Venta de equipo</strong> · Coordinación asignará el precio antes de enviarla al cliente.
          </div>
          <QuoteDraft
            fixedQuoteType="VENTA_EQUIPO"
            allowQuickClient={can(session.role, "client.create", session.activeCompanyCode)}
            allowQuickEquipment={allowQuickEquipment}
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
        <FormActions note="Al autorizarla, la propuesta aparece en tu bandeja de ventas de equipos.">
          <SubmitButton pendingLabel="Guardando…">Guardar sin precio</SubmitButton>
        </FormActions>
      </FormPanel>
    </>
  );
}
