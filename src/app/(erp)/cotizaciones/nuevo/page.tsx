import { redirect } from "next/navigation";
import { createQuoteAction } from "../actions";
import { QuoteDraft } from "@/components/quote-draft";
import { SubmitButton } from "@/components/submit-button";
import { FormActions, FormPanel, PageHeader } from "@/components/ui";
import { loadEquipmentCatalogByKind } from "@/lib/catalog";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";
import { loadDiagnosisPriorityOptions, loadMantenimientoPreventivoPriorityOptions } from "@/lib/diagnosis-priorities";
import { QUOTE_TYPES, type QuoteType } from "@/lib/quote-meta";
import { listPricedServices } from "@/lib/service-bundle-quote";

export default async function NuevaCotizacionPage({ searchParams }: { searchParams: Promise<{ clientId?: string; tipo?: string; servicio?: string }> }) {
  const session = await requireCompany();
  if (!can(session.role, "quote.create", session.activeCompanyCode)) redirect("/cotizaciones");
  const { clientId, tipo, servicio } = await searchParams;
  const initialQuoteType = (QUOTE_TYPES as readonly string[]).includes(tipo ?? "") ? tipo as QuoteType : undefined;
  const [clients, equipment, catalog, diagnosisPriorities, mantenimientoPriorities, pricedServices] = await Promise.all([
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
    loadEquipmentCatalogByKind(),
    loadDiagnosisPriorityOptions(session.activeCompanyId, session.activeCompanyCode),
    loadMantenimientoPreventivoPriorityOptions(session.activeCompanyId, session.activeCompanyCode),
    listPricedServices(session.activeCompanyId, session.role === "VENTAS" ? session.userId : null),
  ]);
  const quickEquipmentKinds: Array<"EQUI" | "MOT"> = [
    ...(can(session.role, "equi.create", session.activeCompanyCode) ? ["EQUI" as const] : []),
    ...(can(session.role, "mot.create", session.activeCompanyCode) ? ["MOT" as const] : []),
  ];
  return (
    <>
      <PageHeader
        title="Nueva cotización"
        subtitle="COTDX/COTMP usan catálogo de prioridad. Servicios existentes: elige un cliente y los DX/OS que ya tienen precio. COTVT captura precio aquí. COTOS y COTSC siguen con precio de gerencia."
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
            types={catalog.EQUI.types}
            brands={catalog.EQUI.brands}
            models={catalog.EQUI.models}
            catalogByKind={catalog}
            diagnosisPriorities={diagnosisPriorities}
            mantenimientoPriorities={mantenimientoPriorities}
            initialQuoteType={initialQuoteType}
            defaultServiceIds={servicio ? [servicio] : []}
            pricedServices={pricedServices
              .filter((row) => !row.onAuthorizedQuote && !row.openQuote)
              .map((row) => ({
                technicalCaseId: row.technicalCaseId,
                folio: row.folio,
                clientId: row.clientId,
                concept: row.concept,
                amountLabel: row.amountLabel,
                equipmentLabel: row.equipmentLabel,
              }))}
          />
        </div>
        <FormActions note="Venta de equipo: guarda con precio del vendedor. Servicio de campo: gerencia cotiza horas y tarifa después.">
          <SubmitButton pendingLabel="Guardando…">Guardar cotización</SubmitButton>
        </FormActions>
      </FormPanel>
    </>
  );
}
