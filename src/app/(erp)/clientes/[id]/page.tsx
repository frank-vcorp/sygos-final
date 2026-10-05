import { notFound, redirect } from "next/navigation";
import {
  addContactAction,
  inactivateClientAction,
  inactivateContactAction,
  reassignClientAction,
  updateClientAction,
} from "../actions";
import { RegimenSelect } from "@/components/regimen-select";
import { Badge, Button, controlClass, Field, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { formatWhen } from "@/lib/form";
import { historyFor } from "@/lib/history";
import { can } from "@/lib/permissions";
import { regimenLabel } from "@/lib/sat-regimen";
import { requireCompany } from "@/lib/session";

export default async function ClienteDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireCompany();
  const { id } = await params;
  const client = await prisma.client.findFirst({
    where: { id, companyId: session.activeCompanyId },
    include: { contacts: { orderBy: [{ isPrimary: "desc" }, { name: "asc" }] }, prospects: true },
  });
  if (!client) notFound();
  if (client.isSystem) {
    return (
      <>
        <PageHeader title={client.name} subtitle="Cliente intercompañía fijo" action={<Badge>Intercompañía</Badge>} />
        <section className="max-w-xl rounded-lg border border-[var(--line)] bg-white p-4 text-sm">
          <p>Las operaciones que SYSTRON envía a Servomotores usan este cliente. No se edita ni se inactiva.</p>
          <p className="mt-3">Régimen fiscal: {regimenLabel(client.taxRegime)}</p>
          <p className="mt-1">Requiere factura: {client.requiresInvoice ? "Sí" : "No"}</p>
        </section>
      </>
    );
  }
  if (session.role === "VENTAS" && client.ownerUserId !== session.userId) notFound();
  if (!can(session.role, "client.edit", session.activeCompanyCode)) redirect("/inicio");
  const owner = client.ownerUserId ? await prisma.user.findUnique({ where: { id: client.ownerUserId } }) : null;
  const history = await historyFor("CLIENTE", client.id);
  const candidates = can(session.role, "client.reassign")
    ? await prisma.user.findMany({
        where: {
          active: true,
          role: session.activeCompanyCode === "SYSTRON" ? { in: ["VENTAS", "CEO"] } : { in: ["GERENTE_OPERATIVO_SERVOMOTORES", "CEO"] },
        },
        orderBy: { name: "asc" },
      })
    : [];

  return (
    <>
      <PageHeader
        title={client.name}
        subtitle={client.active ? "Cliente activo" : "Cliente inactivo"}
        action={client.active ? <Badge tone="ok">Activo</Badge> : <Badge tone="danger">Inactivo</Badge>}
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <form action={updateClientAction} className="grid gap-4 rounded-lg border border-[var(--line)] bg-white p-4">
          <input type="hidden" name="id" value={client.id} />
          <input type="hidden" name="version" value={client.version} />
          <Field label="Nombre o razón social"><input name="name" defaultValue={client.name} className={controlClass} /></Field>
          <Field label="Clasificación">
            <select name="classification" defaultValue={client.classification ?? ""} className={controlClass}>
              <option value="">Sin clasificación</option>
              <option value="NORMAL">Normal</option>
              <option value="PREMIUM">Premium</option>
            </select>
          </Field>
          <Field label="Requiere factura" hint="Puede cambiar en operaciones abiertas. No reescribe facturas ya emitidas.">
            <select name="requiresInvoice" defaultValue={client.requiresInvoice == null ? "" : client.requiresInvoice ? "si" : "no"} className={controlClass}>
              <option value="">Sin definir</option>
              <option value="si">Sí</option>
              <option value="no">No</option>
            </select>
          </Field>
          <Field label="Días de crédito"><input name="creditDays" defaultValue={client.creditDays ?? ""} className={controlClass} /></Field>
          <Field label="RFC"><input name="rfc" defaultValue={client.rfc ?? ""} className={controlClass} /></Field>
          <Field label="Régimen fiscal" hint="Catálogo c_RegimenFiscal del SAT."><RegimenSelect name="taxRegime" defaultValue={client.taxRegime} /></Field>
          <Field label="Código postal fiscal"><input name="fiscalZip" defaultValue={client.fiscalZip ?? ""} className={controlClass} /></Field>
          <Field label="Domicilio fiscal"><textarea name="fiscalAddress" defaultValue={client.fiscalAddress ?? ""} className={controlClass} rows={2} /></Field>
          <Field label="Dirección de entrega"><textarea name="deliveryAddress" defaultValue={client.deliveryAddress ?? ""} className={controlClass} rows={2} /></Field>
          <p className="text-sm text-[var(--muted)]">Responsable comercial: {owner?.name ?? "Sin asignar"}</p>
          <Button type="submit">Guardar</Button>
        </form>
        <div className="space-y-4">
          {can(session.role, "client.reassign") ? (
            <form action={reassignClientAction} className="space-y-3 rounded-lg border border-[var(--line)] bg-white p-4">
              <input type="hidden" name="id" value={client.id} />
              <input type="hidden" name="version" value={client.version} />
              <Field label="Reasignar responsable">
                <select name="ownerUserId" className={controlClass} defaultValue={client.ownerUserId ?? ""}>
                  <option value="" disabled>Selecciona</option>
                  {candidates.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
                </select>
              </Field>
              <Button type="submit" tone="ghost">Reasignar</Button>
            </form>
          ) : null}
          {can(session.role, "client.inactivate") && client.active ? (
            <form action={inactivateClientAction} className="rounded-lg border border-[var(--line)] bg-white p-4">
              <input type="hidden" name="id" value={client.id} />
              <input type="hidden" name="version" value={client.version} />
              <p className="mb-3 text-sm">Inactivar conserva el historial y lo saca de los listados activos.</p>
              <Button type="submit" tone="danger">Inactivar cliente</Button>
            </form>
          ) : null}
          <section className="rounded-lg border border-[var(--line)] bg-white p-4">
            <h2 className="font-medium">Relaciones</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {client.prospects.length === 0 ? <li className="text-[var(--muted)]">Sin prospecto de origen.</li> : client.prospects.map((prospect) => (
                <li key={prospect.id}><a className="text-[var(--accent)]" href={`/prospectos/${prospect.id}`}>{prospect.name}</a></li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-[var(--muted)]">Equipos, cotizaciones, ventas y cobranza aparecen aquí cuando existan.</p>
          </section>
        </div>
      </div>

      <section className="mt-6 rounded-lg border border-[var(--line)] bg-white p-4">
        <h2 className="font-medium">Contactos</h2>
        <ul className="mt-3 divide-y divide-[var(--line)]">
          {client.contacts.filter((contact) => contact.active).length === 0 ? <li className="py-2 text-sm text-[var(--muted)]">Sin contactos activos.</li> : null}
          {client.contacts.filter((contact) => contact.active).map((contact) => (
            <li key={contact.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span>{contact.name}{contact.isPrimary ? " · principal" : ""}{contact.roleTitle ? ` · ${contact.roleTitle}` : ""}{contact.phone ? ` · ${contact.phone}` : ""}{contact.email ? ` · ${contact.email}` : ""}</span>
              <form action={inactivateContactAction}>
                <input type="hidden" name="contactId" value={contact.id} />
                <button className="text-[var(--danger)]" type="submit">Inactivar</button>
              </form>
            </li>
          ))}
        </ul>
        <form action={addContactAction} className="mt-4 grid gap-3 md:grid-cols-2">
          <input type="hidden" name="clientId" value={client.id} />
          <Field label="Nombre"><input name="name" className={controlClass} /></Field>
          <Field label="Puesto"><input name="roleTitle" className={controlClass} /></Field>
          <Field label="Teléfono"><input name="phone" className={controlClass} /></Field>
          <Field label="Correo"><input name="email" className={controlClass} /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isPrimary" value="si" /> Contacto principal</label>
          <Button type="submit" tone="ghost">Agregar contacto</Button>
        </form>
      </section>

      <History items={history} />
    </>
  );
}

function History({ items }: { items: Awaited<ReturnType<typeof historyFor>> }) {
  if (items.length === 0) return null;
  return (
    <section className="mt-6">
      <h2 className="mb-2 font-medium">Historial</h2>
      <ul className="space-y-2 text-sm">
        {items.map((item) => (
          <li key={item.id} className="rounded-md border border-[var(--line)] bg-white px-3 py-2">
            <span className="text-[var(--muted)]">{formatWhen(item.createdAt)} · {item.author?.name ?? "Sistema"}</span>
            <p>{item.summary}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
