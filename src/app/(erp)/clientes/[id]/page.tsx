import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  addContactAction,
  inactivateClientAction,
  inactivateContactAction,
  reassignClientAction,
  updateClientAction,
} from "../actions";
import { ClientInvoiceFields } from "@/components/client-invoice-fields";
import { HistoryTimeline } from "@/components/history-timeline";
import { ConfirmSubmit, SubmitButton } from "@/components/submit-button";
import { Badge, Button, controlClass, DetailGrid, Field, PageHeader, TextLink } from "@/components/ui";
import { prisma } from "@/lib/db";
import { historyFor } from "@/lib/history";
import { can } from "@/lib/permissions";
import { regimenLabel } from "@/lib/sat-regimen";
import { requireCompany } from "@/lib/session";

export default async function ClienteDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireCompany();
  const { id } = await params;
  const client = await prisma.client.findFirst({
    where: { id, companyId: session.activeCompanyId },
    include: {
      contacts: { orderBy: [{ isPrimary: "desc" }, { name: "asc" }] },
      prospects: true,
      equipments: { where: { originCompanyId: session.activeCompanyId }, orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!client) notFound();
  if (client.isSystem) {
    const motors = await prisma.equipment.findMany({
      where: { kind: "MOT", originCompany: { code: "SYSTRON" } },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    return (
      <>
        <PageHeader back={{ href: "/clientes", label: "Clientes" }} title={client.name} subtitle="Cliente intercompañía fijo" action={<Badge>Intercompañía</Badge>} />
        <section className="max-w-xl rounded-lg border border-[var(--line)] bg-white p-4 text-sm">
          <p>Las operaciones que SYSTRON envía a Servomotores usan este cliente. No se edita ni se inactiva.</p>
          <p className="mt-3">Régimen fiscal: {regimenLabel(client.taxRegime)}</p>
          <p className="mt-1">Requiere factura: {client.requiresInvoice ? "Sí" : "No"}</p>
        </section>
        <section className="mt-4 max-w-xl">
          <h2 className="mb-2 font-medium">MOT intercompañía</h2>
          {motors.length === 0 ? <p className="text-sm text-[var(--muted)]">Sin motores enviados por SYSTRON.</p> : (
            <ul className="space-y-1 text-sm">
              {motors.map((motor) => <li key={motor.id}><Link href={`/motores/${motor.id}`} className="text-[var(--accent)]">{motor.folio}</Link> · {motor.model}</li>)}
            </ul>
          )}
        </section>
      </>
    );
  }
  if (session.role === "VENTAS" && client.ownerUserId !== session.userId) notFound();
  if (!can(session.role, "client.edit", session.activeCompanyCode)) redirect("/inicio");
  const [owner, quotes] = await Promise.all([
    client.ownerUserId ? prisma.user.findUnique({ where: { id: client.ownerUserId } }) : Promise.resolve(null),
    prisma.quote.findMany({
      where: { clientId: client.id, companyId: session.activeCompanyId, ...(session.role === "VENTAS" ? { sellerUserId: session.userId } : {}) },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);
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
        back={{ href: "/clientes", label: "Clientes" }}
        title={client.name}
        subtitle={client.active ? "Cliente activo" : "Cliente inactivo"}
        action={client.active ? <Badge tone="ok">Activo</Badge> : <Badge tone="danger">Inactivo</Badge>}
      />
      <DetailGrid>
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
          <ClientInvoiceFields
            defaultRequires={client.requiresInvoice == null ? "" : client.requiresInvoice ? "si" : "no"}
            rfc={client.rfc ?? ""}
            taxRegime={client.taxRegime ?? ""}
            fiscalZip={client.fiscalZip ?? ""}
            fiscalAddress={client.fiscalAddress ?? ""}
          />
          <Field label="Días de crédito"><input name="creditDays" defaultValue={client.creditDays ?? ""} className={controlClass} /></Field>
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
              <ConfirmSubmit message="El cliente quedará inactivo. El historial se conserva.">Inactivar cliente</ConfirmSubmit>
            </form>
          ) : null}
          <section className="rounded-lg border border-[var(--line)] bg-white p-4">
            <h2 className="font-medium">Relaciones</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {client.prospects.length === 0 ? <li className="text-[var(--muted)]">Sin prospecto de origen.</li> : client.prospects.map((prospect) => (
                <li key={prospect.id}><a className="text-[var(--accent)]" href={`/prospectos/${prospect.id}`}>{prospect.name}</a></li>
              ))}
            </ul>
            <h3 className="mt-4 font-medium">Cotizaciones</h3>
            {quotes.length === 0 ? <p className="mt-1 text-sm text-[var(--muted)]">Todavía no hay cotizaciones de este cliente.</p> : (
              <ul className="mt-1 space-y-1 text-sm">
                {quotes.map((quote) => <li key={quote.id}><Link className="text-[var(--accent)]" href={`/cotizaciones/${quote.id}`}>{quote.folio}</Link> · {quote.status}</li>)}
              </ul>
            )}
            {can(session.role, "quote.create", session.activeCompanyCode) ? <p className="mt-2"><TextLink href={`/cotizaciones/nuevo?clientId=${client.id}`}>Nueva cotización</TextLink></p> : null}
          </section>
        </div>
      </DetailGrid>

      <section className="mt-6 rounded-lg border border-[var(--line)] bg-white p-4">
        <h2 className="font-medium">Contactos</h2>
        <ul className="mt-3 divide-y divide-[var(--line)]">
          {client.contacts.filter((contact) => contact.active).length === 0 ? <li className="py-2 text-sm text-[var(--danger)]">Falta el contacto obligatorio.</li> : null}
          {client.contacts.filter((contact) => contact.active).map((contact) => (
            <li key={contact.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium">{contact.name}{contact.isPrimary ? " · principal" : ""}</p>
                {contact.roleTitle ? <p className="text-[var(--muted)]">{contact.roleTitle}</p> : null}
                <p className="break-words text-[var(--muted)]">{[contact.phone, contact.email].filter(Boolean).join(" · ") || "Sin teléfono ni correo"}</p>
              </div>
              <form action={inactivateContactAction}>
                <input type="hidden" name="contactId" value={contact.id} />
                <ConfirmSubmit message="El contacto quedará inactivo. Debe quedar al menos un contacto activo.">Inactivar</ConfirmSubmit>
              </form>
            </li>
          ))}
        </ul>
        <form action={addContactAction} className="mt-4 grid gap-3 md:grid-cols-2">
          <input type="hidden" name="clientId" value={client.id} />
          <Field label="Nombre"><input name="name" required className={controlClass} /></Field>
          <Field label="Puesto"><input name="roleTitle" className={controlClass} /></Field>
          <Field label="Teléfono"><input name="phone" className={controlClass} /></Field>
          <Field label="Correo"><input name="email" className={controlClass} /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isPrimary" value="si" /> Contacto principal</label>
          <Button type="submit" tone="ghost">Agregar contacto</Button>
        </form>
      </section>

      {client.equipments.length > 0 ? (
        <section className="mt-6">
          <h2 className="mb-2 font-medium">Equipos</h2>
          <ul className="space-y-1 text-sm">
            {client.equipments.map((equipment) => (
              <li key={equipment.id}>
                <Link href={equipment.kind === "MOT" ? `/motores/${equipment.id}` : `/equipos/${equipment.id}`} className="text-[var(--accent)]">{equipment.folio}</Link>
                {" · "}{equipment.model}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <History items={history} />
    </>
  );
}

function History({ items }: { items: Awaited<ReturnType<typeof historyFor>> }) {
  if (items.length === 0) return null;
  return <HistoryTimeline className="mt-6" items={items.map((item) => ({ id: item.id, createdAt: item.createdAt, summary: item.summary, authorName: item.author?.name }))} />;
}
