"use client";

import Link from "next/link";
import { useState } from "react";
import { ClientInvoiceFields } from "@/components/client-invoice-fields";
import { ConfirmSubmit } from "@/components/submit-button";
import {
  Badge,
  Button,
  Card,
  Empty,
  MobileCard,
  ResponsiveData,
  Table,
  Td,
  TextLink,
  Th,
  controlClass,
  Field,
} from "@/components/ui";
import { CUSTODY_LABEL, type Custody } from "@/lib/custody";
import { ATTENTION_LABEL, type AttentionType } from "@/lib/priorities";
import { CASE_STATUS_LABEL } from "@/lib/case-labels";
import { QUOTE_STATUS_LABEL, QUOTE_TYPE_LABEL, type QuoteType } from "@/lib/quote-meta";
import { regimenLabel } from "@/lib/sat-regimen";

type ClientData = {
  id: string;
  version: number;
  name: string;
  classification: string | null;
  requiresInvoice: boolean | null;
  rfc: string | null;
  taxRegime: string | null;
  fiscalZip: string | null;
  fiscalAddress: string | null;
  creditDays: number | null;
  deliveryAddress: string | null;
  active: boolean;
};

type ContactRow = {
  id: string;
  name: string;
  roleTitle: string | null;
  phone: string | null;
  email: string | null;
  isPrimary: boolean;
};

type ProspectRow = { id: string; name: string };

type QuoteRow = {
  id: string;
  folio: string;
  status: string;
  quoteType: string;
  updatedAt: string;
};

type AttentionRow = {
  id: string;
  attentionType: string;
  priorityName: string;
  status: string;
  reportedFault: string;
  createdAt: string;
  equipment: { id: string; folio: string; kind: string; model: string };
  technicalCases: Array<{ id: string; folio: string; kind: string; status: string }>;
};

type EquipmentRow = {
  id: string;
  folio: string;
  kind: string;
  model: string;
  custody: string;
};

function classificationLabel(value: string | null) {
  if (value === "PREMIUM") return "Premium";
  if (value === "NORMAL") return "Normal";
  return "Sin clasificación";
}

function attentionStatusLabel(status: string) {
  if (status === "ABIERTA") return { label: "Espera ingreso", tone: "warn" as const };
  return { label: "En proceso", tone: "ok" as const };
}

function formatWhen(iso: string) {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-[var(--line)] py-3 last:border-0 sm:grid-cols-[minmax(0,11rem)_1fr] sm:gap-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</dt>
      <dd className="text-sm leading-6 text-[#0b1f3a]">{value}</dd>
    </div>
  );
}

export function ClientProfileSection({
  client,
  ownerName,
  updateAction,
}: {
  client: ClientData;
  ownerName: string | null;
  updateAction: (formData: FormData) => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <Card className="p-5 md:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[#0b1f3a]">Editar cliente</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">Los cambios se guardan al enviar el formulario.</p>
          </div>
          <Button type="button" tone="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
        </div>
        <form action={updateAction} className="grid gap-4">
          <input type="hidden" name="id" value={client.id} />
          <input type="hidden" name="version" value={client.version} />
          <Field label="Nombre o razón social"><input name="name" defaultValue={client.name} className={controlClass} required /></Field>
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
          <p className="text-sm text-[var(--muted)]">Responsable comercial: {ownerName ?? "Sin asignar"}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="submit">Guardar cambios</Button>
            <Button type="button" tone="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
          </div>
        </form>
      </Card>
    );
  }

  return (
    <Card className="p-5 md:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#0b1f3a]">Ficha del cliente</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Resumen de datos comerciales y fiscales.</p>
        </div>
        <Button type="button" tone="ghost" onClick={() => setEditing(true)}>Editar</Button>
      </div>
      <dl>
        <InfoRow label="Nombre" value={client.name} />
        <InfoRow label="Clasificación" value={classificationLabel(client.classification)} />
        <InfoRow label="Responsable" value={ownerName ?? "Sin asignar"} />
        <InfoRow
          label="Facturación"
          value={
            client.requiresInvoice == null
              ? "Sin definir"
              : client.requiresInvoice
                ? `Requiere factura · RFC ${client.rfc ?? "—"} · ${regimenLabel(client.taxRegime)}`
                : "No requiere factura"
          }
        />
        {client.requiresInvoice ? (
          <>
            <InfoRow label="CP fiscal" value={client.fiscalZip ?? "—"} />
            <InfoRow label="Domicilio fiscal" value={client.fiscalAddress ?? "—"} />
          </>
        ) : null}
        <InfoRow label="Crédito" value={client.creditDays != null ? `${client.creditDays} días` : "—"} />
        <InfoRow label="Entrega" value={client.deliveryAddress?.trim() ? client.deliveryAddress : "—"} />
      </dl>
    </Card>
  );
}

export function ClientAdminAside({
  clientId,
  version,
  ownerUserId,
  canReassign,
  canInactivate,
  candidates,
  reassignAction,
  inactivateAction,
}: {
  clientId: string;
  version: number;
  ownerUserId: string | null;
  canReassign: boolean;
  canInactivate: boolean;
  candidates: Array<{ id: string; name: string }>;
  reassignAction: (formData: FormData) => void | Promise<void>;
  inactivateAction: (formData: FormData) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  if (!canReassign && !canInactivate) return null;

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-medium"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        Administración
        <span className="text-[var(--muted)]">{open ? "▲" : "▼"}</span>
      </button>
      {open ? (
        <div className="space-y-4 border-t border-[var(--line)] px-5 py-4">
          {canReassign ? (
            <form action={reassignAction} className="space-y-3">
              <input type="hidden" name="id" value={clientId} />
              <input type="hidden" name="version" value={version} />
              <Field label="Reasignar responsable">
                <select name="ownerUserId" className={controlClass} defaultValue={ownerUserId ?? ""}>
                  <option value="" disabled>Selecciona</option>
                  {candidates.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
                </select>
              </Field>
              <Button type="submit" tone="ghost">Reasignar</Button>
            </form>
          ) : null}
          {canInactivate ? (
            <form action={inactivateAction} className="rounded-md border border-[var(--line)] bg-[#f7fafc] p-3">
              <input type="hidden" name="id" value={clientId} />
              <input type="hidden" name="version" value={version} />
              <p className="mb-3 text-sm text-[var(--muted)]">Inactivar conserva el historial y lo saca de los listados activos.</p>
              <ConfirmSubmit message="El cliente quedará inactivo. El historial se conserva.">Inactivar cliente</ConfirmSubmit>
            </form>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

export function ClientContactsPanel({
  clientId,
  contacts,
  addAction,
  inactivateAction,
}: {
  clientId: string;
  contacts: ContactRow[];
  addAction: (formData: FormData) => void | Promise<void>;
  inactivateAction: (formData: FormData) => void | Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const active = contacts;

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#0b1f3a]">Contactos</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Personas de contacto del cliente.</p>
        </div>
        <Button type="button" tone="ghost" onClick={() => setAdding((value) => !value)}>
          {adding ? "Cerrar alta" : "Agregar contacto"}
        </Button>
      </div>
      {active.length === 0 ? (
        <Empty title="Sin contactos activos" body="Agrega al menos un contacto para operar con este cliente." action={<Button type="button" onClick={() => setAdding(true)}>Agregar contacto</Button>} />
      ) : (
        <ResponsiveData
          table={
            <Table>
              <thead>
                <tr>
                  <Th>Nombre</Th>
                  <Th>Puesto</Th>
                  <Th>Teléfono</Th>
                  <Th>Correo</Th>
                  <Th>Principal</Th>
                  <Th><span className="sr-only">Acciones</span></Th>
                </tr>
              </thead>
              <tbody>
                {active.map((contact) => (
                  <tr key={contact.id}>
                    <Td><span className="font-medium">{contact.name}</span></Td>
                    <Td>{contact.roleTitle ?? "—"}</Td>
                    <Td>{contact.phone ?? "—"}</Td>
                    <Td>{contact.email ?? "—"}</Td>
                    <Td>{contact.isPrimary ? <Badge tone="ok">Sí</Badge> : "—"}</Td>
                    <Td>
                      <form action={inactivateAction}>
                        <input type="hidden" name="contactId" value={contact.id} />
                        <ConfirmSubmit message="El contacto quedará inactivo. Debe quedar al menos un contacto activo." tone="ghost">
                          Inactivar
                        </ConfirmSubmit>
                      </form>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          }
          cards={active.map((contact) => (
            <div key={contact.id} className="rounded-lg border border-[var(--line)] bg-white p-4 text-sm">
              <p className="font-semibold">{contact.name}{contact.isPrimary ? " · principal" : ""}</p>
              {contact.roleTitle ? <p className="text-[var(--muted)]">{contact.roleTitle}</p> : null}
              <p className="mt-1 break-words">{[contact.phone, contact.email].filter(Boolean).join(" · ") || "Sin teléfono ni correo"}</p>
              <form action={inactivateAction} className="mt-3">
                <input type="hidden" name="contactId" value={contact.id} />
                <ConfirmSubmit message="El contacto quedará inactivo.">Inactivar</ConfirmSubmit>
              </form>
            </div>
          ))}
        />
      )}
      {adding ? (
        <Card className="mt-4 p-5">
          <h3 className="mb-4 font-medium">Nuevo contacto</h3>
          <form action={addAction} className="grid gap-3 md:grid-cols-2">
            <input type="hidden" name="clientId" value={clientId} />
            <Field label="Nombre"><input name="name" required className={controlClass} /></Field>
            <Field label="Puesto"><input name="roleTitle" className={controlClass} /></Field>
            <Field label="Teléfono"><input name="phone" className={controlClass} /></Field>
            <Field label="Correo"><input name="email" className={controlClass} /></Field>
            <label className="flex items-center gap-2 text-sm md:col-span-2"><input type="checkbox" name="isPrimary" value="si" /> Contacto principal</label>
            <div className="flex gap-2 md:col-span-2">
              <Button type="submit">Guardar contacto</Button>
              <Button type="button" tone="ghost" onClick={() => setAdding(false)}>Cancelar</Button>
            </div>
          </form>
        </Card>
      ) : null}
    </section>
  );
}

function RelationSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
        <div>
          <h3 className="font-semibold text-[#0b1f3a]">{title}</h3>
          {description ? <p className="mt-1 text-sm text-[var(--muted)]">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className="p-0">{children}</div>
    </Card>
  );
}

export function ClientRelationsHub({
  clientId,
  prospects,
  quotes,
  attentions,
  equipments,
  canQuote,
  canService,
}: {
  clientId: string;
  prospects: ProspectRow[];
  quotes: QuoteRow[];
  attentions: AttentionRow[];
  equipments: EquipmentRow[];
  canQuote: boolean;
  canService: boolean;
}) {
  const attentionGroups = (["DIAGNOSTICO", "REPARACION", "DIAGNOSTICO_GARANTIA"] as AttentionType[]).map((type) => ({
    type,
    label: ATTENTION_LABEL[type],
    rows: attentions.filter((row) => row.attentionType === type),
  }));

  const quickActions = (
    <div className="flex flex-wrap gap-2">
      {canService ? <TextLink href={`/servicios/diagnostico/nuevo?clientId=${clientId}`}>Nueva atención</TextLink> : null}
      {canQuote ? <TextLink href={`/cotizaciones/nuevo?clientId=${clientId}`}>Nueva cotización</TextLink> : null}
    </div>
  );

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#0b1f3a]">Relaciones</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Cotizaciones, servicios y equipos vinculados a este cliente.</p>
        </div>
        {quickActions}
      </div>

      <RelationSection title="Cotizaciones" description="Propuestas comerciales">
        {quotes.length === 0 ? (
          <p className="px-5 py-6 text-sm text-[var(--muted)]">Todavía no hay cotizaciones.</p>
        ) : (
          <ResponsiveData
            table={
              <Table>
                <thead>
                  <tr>
                    <Th>Folio</Th>
                    <Th>Tipo</Th>
                    <Th>Estado</Th>
                    <Th>Actualización</Th>
                  </tr>
                </thead>
                <tbody>
                  {quotes.map((quote) => (
                    <tr key={quote.id}>
                      <Td><Link href={`/cotizaciones/${quote.id}`} className="font-medium text-[var(--accent)]">{quote.folio}</Link></Td>
                      <Td>{QUOTE_TYPE_LABEL[quote.quoteType as QuoteType] ?? quote.quoteType}</Td>
                      <Td><Badge>{QUOTE_STATUS_LABEL[quote.status] ?? quote.status}</Badge></Td>
                      <Td><span className="text-[var(--muted)]">{formatWhen(quote.updatedAt)}</span></Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            }
            cards={quotes.map((quote) => (
              <MobileCard key={quote.id} href={`/cotizaciones/${quote.id}`} title={quote.folio} meta={<Badge>{QUOTE_STATUS_LABEL[quote.status] ?? quote.status}</Badge>}>
                <p>{QUOTE_TYPE_LABEL[quote.quoteType as QuoteType] ?? quote.quoteType}</p>
                <p>{formatWhen(quote.updatedAt)}</p>
              </MobileCard>
            ))}
          />
        )}
      </RelationSection>

      {attentionGroups.map((group) => (
        <RelationSection key={group.type} title={`Servicios · ${group.label}`} description="Episodios de atención en taller">
          {group.rows.length === 0 ? (
            <p className="px-5 py-6 text-sm text-[var(--muted)]">Sin registros de este tipo.</p>
          ) : (
            <ResponsiveData
              table={
                <Table>
                  <thead>
                    <tr>
                      <Th>Equipo</Th>
                      <Th>Prioridad</Th>
                      <Th>Estado</Th>
                      <Th>Operación</Th>
                      <Th>Falla</Th>
                      <Th>Abierto</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row) => {
                      const st = attentionStatusLabel(row.status);
                      const equipHref = row.equipment.kind === "MOT" ? `/motores/${row.equipment.id}` : `/equipos/${row.equipment.id}`;
                      return (
                        <tr key={row.id}>
                          <Td>
                            <Link href={equipHref} className="font-medium text-[var(--accent)]">{row.equipment.folio}</Link>
                            <span className="block text-xs text-[var(--muted)]">{row.equipment.model}</span>
                          </Td>
                          <Td>{row.priorityName}</Td>
                          <Td><Badge tone={st.tone}>{st.label}</Badge></Td>
                          <Td>
                            {row.technicalCases.length === 0 ? (
                              <span className="text-[var(--muted)]">—</span>
                            ) : (
                              <span className="flex flex-wrap gap-2">
                                {row.technicalCases.map((caseRow) => (
                                  <Link key={caseRow.id} href={`/operacion/${caseRow.id}`} className="text-[var(--accent)]">
                                    {caseRow.folio}
                                  </Link>
                                ))}
                              </span>
                            )}
                            {row.technicalCases[0] ? (
                              <span className="block text-xs text-[var(--muted)]">{CASE_STATUS_LABEL[row.technicalCases[0].status] ?? row.technicalCases[0].status}</span>
                            ) : null}
                          </Td>
                          <Td><span className="block max-w-[14rem] truncate" title={row.reportedFault}>{row.reportedFault}</span></Td>
                          <Td><span className="text-[var(--muted)]">{formatWhen(row.createdAt)}</span></Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              }
              cards={group.rows.map((row) => {
                const equipHref = row.equipment.kind === "MOT" ? `/motores/${row.equipment.id}` : `/equipos/${row.equipment.id}`;
                const st = attentionStatusLabel(row.status);
                const caseLink = row.technicalCases[0];
                return (
                  <MobileCard
                    key={row.id}
                    href={caseLink ? `/operacion/${caseLink.id}` : equipHref}
                    title={`${row.equipment.folio} · ${row.priorityName}`}
                    meta={<Badge tone={st.tone}>{st.label}</Badge>}
                  >
                    <p>{row.reportedFault}</p>
                    {caseLink ? <p>{caseLink.folio} · {CASE_STATUS_LABEL[caseLink.status] ?? caseLink.status}</p> : null}
                    <p>{formatWhen(row.createdAt)}</p>
                  </MobileCard>
                );
              })}
            />
          )}
        </RelationSection>
      ))}

      <RelationSection title="Equipos y motores" description="Identidades físicas del cliente">
        {equipments.length === 0 ? (
          <p className="px-5 py-6 text-sm text-[var(--muted)]">Sin equipos registrados.</p>
        ) : (
          <ResponsiveData
            table={
              <Table>
                <thead>
                  <tr>
                    <Th>Folio</Th>
                    <Th>Tipo</Th>
                    <Th>Modelo</Th>
                    <Th>Custodia</Th>
                  </tr>
                </thead>
                <tbody>
                  {equipments.map((equipment) => (
                    <tr key={equipment.id}>
                      <Td>
                        <Link href={equipment.kind === "MOT" ? `/motores/${equipment.id}` : `/equipos/${equipment.id}`} className="font-medium text-[var(--accent)]">
                          {equipment.folio}
                        </Link>
                      </Td>
                      <Td>{equipment.kind}</Td>
                      <Td>{equipment.model}</Td>
                      <Td>{CUSTODY_LABEL[equipment.custody as Custody] ?? equipment.custody}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            }
            cards={equipments.map((equipment) => (
              <MobileCard
                key={equipment.id}
                href={equipment.kind === "MOT" ? `/motores/${equipment.id}` : `/equipos/${equipment.id}`}
                title={equipment.folio}
                meta={<Badge>{equipment.kind}</Badge>}
              >
                <p>{equipment.model}</p>
                <p>{CUSTODY_LABEL[equipment.custody as Custody] ?? equipment.custody}</p>
              </MobileCard>
            ))}
          />
        )}
      </RelationSection>

      {prospects.length > 0 ? (
        <RelationSection title="Prospectos de origen" description="Oportunidades que derivaron en este cliente">
          <ResponsiveData
            table={
              <Table>
                <thead><tr><Th>Nombre</Th></tr></thead>
                <tbody>
                  {prospects.map((prospect) => (
                    <tr key={prospect.id}>
                      <Td><Link href={`/prospectos/${prospect.id}`} className="text-[var(--accent)]">{prospect.name}</Link></Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            }
            cards={prospects.map((prospect) => (
              <MobileCard key={prospect.id} href={`/prospectos/${prospect.id}`} title={prospect.name} />
            ))}
          />
        </RelationSection>
      ) : null}
    </section>
  );
}
