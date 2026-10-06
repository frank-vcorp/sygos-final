import { redirect } from "next/navigation";
import { createQuoteAction } from "../actions";
import { QuoteDraft } from "@/components/quote-draft";
import { controlClass, Field, FormPanel, FormSection, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { QUOTE_TYPE_LABEL, QUOTE_TYPES } from "@/lib/quotes";
import { requireCompany } from "@/lib/session";

export default async function NuevaCotizacionPage({ searchParams }: { searchParams: Promise<{ clientId?: string }> }) {
  const session = await requireCompany();
  if (!can(session.role, "quote.create", session.activeCompanyCode)) redirect("/cotizaciones");
  const { clientId } = await searchParams;
  const [clients, equipment] = await Promise.all([
    prisma.client.findMany({
      where: { companyId: session.activeCompanyId, active: true, isSystem: false, ...(session.role === "VENTAS" ? { ownerUserId: session.userId } : {}) },
      include: { contacts: { where: { active: true }, orderBy: [{ isPrimary: "desc" }, { name: "asc" }] } },
      orderBy: { name: "asc" },
      take: 200,
    }),
    prisma.equipment.findMany({
      where: { originCompanyId: session.activeCompanyId, ...(session.role === "VENTAS" ? { client: { ownerUserId: session.userId } } : {}) },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);
  return (
    <>
      <PageHeader
        title="Nueva cotización"
        subtitle="Se guarda sin precio. El precio lo asigna CEO o Administrador."
        back={{ href: "/cotizaciones", label: "Cotizaciones" }}
      />
      <FormPanel action={createQuoteAction}>
        <FormSection title="Propuesta comercial" description="Relaciona cliente, equipo y conceptos. El precio se asigna en el siguiente paso.">
          <Field label="Tipo"><select name="quoteType" required className={controlClass}>{QUOTE_TYPES.map((type) => <option key={type} value={type}>{QUOTE_TYPE_LABEL[type]}</option>)}</select></Field>
          <QuoteDraft defaultClientId={clients.some((client) => client.id === clientId) ? clientId : ""} clients={clients.map((client) => ({ id: client.id, name: client.name, contacts: client.contacts.map((contact) => ({ id: contact.id, name: contact.name, isPrimary: contact.isPrimary })) }))} equipment={equipment.map((item) => ({ id: item.id, folio: item.folio, model: item.model, clientId: item.clientId }))} />
        </FormSection>
      </FormPanel>
    </>
  );
}
