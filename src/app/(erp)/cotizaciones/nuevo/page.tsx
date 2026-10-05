import { redirect } from "next/navigation";
import { createQuoteAction } from "../actions";
import { Button, controlClass, Field, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { QUOTE_TYPE_LABEL, QUOTE_TYPES } from "@/lib/quotes";
import { requireCompany } from "@/lib/session";

export default async function NuevaCotizacionPage() {
  const session = await requireCompany();
  if (!can(session.role, "quote.create", session.activeCompanyCode)) redirect("/cotizaciones");
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
      <PageHeader title="Nueva cotización" subtitle="Se guarda sin precio. El precio lo asigna CEO o Administrador." />
      <form action={createQuoteAction} className="grid max-w-2xl gap-4 rounded-lg border border-[var(--line)] bg-white p-4">
        <Field label="Cliente">
          <select name="clientId" required className={controlClass}>
            <option value="">Selecciona</option>
            {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
          </select>
        </Field>
        <Field label="Tipo">
          <select name="quoteType" required className={controlClass}>
            {QUOTE_TYPES.map((type) => <option key={type} value={type}>{QUOTE_TYPE_LABEL[type]}</option>)}
          </select>
        </Field>
        <Field label="Equipo existente" hint="Vacío si todavía no ingresó, o si es servicio en campo o venta de equipo.">
          <select name="equipmentId" className={controlClass} defaultValue="">
            <option value="">Sin equipo físico</option>
            {equipment.map((item) => <option key={item.id} value={item.id}>{item.folio} · {item.model}</option>)}
          </select>
        </Field>
        <Field label="Tipo preliminar"><input name="preliminaryType" className={controlClass} /></Field>
        <Field label="Marca preliminar"><input name="preliminaryBrand" className={controlClass} /></Field>
        <Field label="Modelo preliminar"><input name="preliminaryModel" className={controlClass} /></Field>
        <Field label="Serie preliminar"><input name="preliminarySerial" className={controlClass} /></Field>
        <Field label="Conceptos" hint="Una línea por concepto: descripción|cantidad. Si omites la cantidad, se usa 1.">
          <textarea name="concepts" required rows={4} className={controlClass} placeholder={"Diagnóstico de variador|1"} />
        </Field>
        <Field label="Referencia comercial"><input name="reference" className={controlClass} /></Field>
        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium">Contactos destinatarios</legend>
          {clients.flatMap((client) => client.contacts.map((contact) => (
            <label key={contact.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="contactId" value={contact.id} />
              {client.name}: {contact.name}{contact.isPrimary ? " · principal" : ""}
            </label>
          )))}
        </fieldset>
        <Button type="submit">Guardar sin precio</Button>
      </form>
    </>
  );
}
