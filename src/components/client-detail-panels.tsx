"use client";

import Link from "next/link";
import { useState } from "react";
import { ClientInvoiceFields } from "@/components/client-invoice-fields";
import { ConfirmSubmit } from "@/components/submit-button";
import {
  ActionLink,
  Badge,
  Button,
  Card,
  MobileCard,
  ResponsiveData,
  Table,
  Td,
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

const denseTable = "[&_th]:px-2 [&_th]:py-1.5 [&_th]:text-[10px] [&_td]:px-2 [&_td]:py-1.5 [&_td]:text-xs";

function classificationLabel(value: string | null) {
  if (value === "PREMIUM") return "Premium";
  if (value === "NORMAL") return "Normal";
  return "—";
}

function attentionStatusLabel(status: string) {
  if (status === "ABIERTA") return { label: "Espera ingreso", tone: "warn" as const };
  return { label: "En proceso", tone: "ok" as const };
}

function formatWhen(iso: string) {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

function CollapseBlock({
  title,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group rounded-lg border border-[var(--line)] bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-sm font-medium text-[#0b1f3a] marker:content-none [&::-webkit-details-marker]:hidden">
        <span>{title}{count != null ? ` (${count})` : ""}</span>
        <span className="text-xs text-[var(--muted)] group-open:rotate-180 transition-transform">▼</span>
      </summary>
      <div className="border-t border-[var(--line)]">{children}</div>
    </details>
  );
}

export function ClientQuickActionBar({
  clientId,
  canQuote,
  canService,
}: {
  clientId: string;
  canQuote: boolean;
  canService: boolean;
}) {
  if (!canQuote && !canService) return null;
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-xl border border-[#cfe0f0] bg-[linear-gradient(135deg,#f4f9fd_0%,#ffffff_55%)] p-3 shadow-[0_2px_12px_rgba(7,59,120,0.08)] sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-[var(--muted)] sm:max-w-xs">
        <span className="font-semibold text-[#0b1f3a]">Operar con este cliente</span>
        {" · "}
        Abre un servicio en taller o prepara una cotización.
      </p>
      <div className="flex flex-wrap gap-2">
        {canService ? (
          <ActionLink href={`/servicios/diagnostico/nuevo?clientId=${clientId}`} className="shadow-sm">
            Nueva atención
          </ActionLink>
        ) : null}
        {canQuote ? (
          <ActionLink
            href={`/cotizaciones/nuevo?clientId=${clientId}`}
            tone="ghost"
            className="border-[var(--accent)] bg-white font-semibold text-[var(--accent)] shadow-sm"
          >
            Nueva cotización
          </ActionLink>
        ) : null}
      </div>
    </div>
  );
}

export function ClientProfileSection({
  client,
  ownerName,
  updateAction,
  compact = false,
}: {
  client: ClientData;
  ownerName: string | null;
  updateAction: (formData: FormData) => void | Promise<void>;
  compact?: boolean;
}) {
  const [editing, setEditing] = useState(false);

  const invoiceSummary =
    client.requiresInvoice == null
      ? "Factura sin definir"
      : client.requiresInvoice
        ? `Factura · ${client.rfc ?? "sin RFC"}`
        : "Sin factura";

  if (editing) {
    return (
      <form action={updateAction} className="grid gap-3 p-3">
        <input type="hidden" name="id" value={client.id} />
        <input type="hidden" name="version" value={client.version} />
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">Editar datos</p>
          <Button type="button" tone="ghost" className="min-h-9 px-2 text-xs" onClick={() => setEditing(false)}>Cancelar</Button>
        </div>
        <Field label="Nombre"><input name="name" defaultValue={client.name} className={controlClass} required /></Field>
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
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Días de crédito"><input name="creditDays" defaultValue={client.creditDays ?? ""} className={controlClass} /></Field>
          <Field label="Entrega"><input name="deliveryAddress" defaultValue={client.deliveryAddress ?? ""} className={controlClass} /></Field>
        </div>
        <p className="text-xs text-[var(--muted)]">Responsable: {ownerName ?? "Sin asignar"}</p>
        <Button type="submit" className="w-fit">Guardar</Button>
      </form>
    );
  }

  if (compact) {
    return (
      <div className="flex flex-wrap items-start justify-between gap-2 p-3 text-xs">
        <dl className="grid flex-1 gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
          <div><dt className="text-[var(--muted)]">Responsable</dt><dd className="font-medium">{ownerName ?? "—"}</dd></div>
          <div><dt className="text-[var(--muted)]">Clasificación</dt><dd>{classificationLabel(client.classification)}</dd></div>
          <div><dt className="text-[var(--muted)]">Crédito</dt><dd>{client.creditDays != null ? `${client.creditDays} días` : "—"}</dd></div>
          <div className="sm:col-span-2 lg:col-span-3"><dt className="text-[var(--muted)]">Fiscal</dt><dd>{invoiceSummary}{client.requiresInvoice ? ` · ${regimenLabel(client.taxRegime)}` : ""}</dd></div>
        </dl>
        <Button type="button" tone="ghost" className="min-h-9 shrink-0 px-2 text-xs" onClick={() => setEditing(true)}>Editar</Button>
      </div>
    );
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Ficha del cliente</h2>
        <Button type="button" tone="ghost" className="min-h-9 px-2 text-xs" onClick={() => setEditing(true)}>Editar</Button>
      </div>
      <dl className="grid gap-2 text-xs sm:grid-cols-2">
        <div><dt className="text-[var(--muted)]">Clasificación</dt><dd>{classificationLabel(client.classification)}</dd></div>
        <div><dt className="text-[var(--muted)]">Responsable</dt><dd>{ownerName ?? "—"}</dd></div>
        <div className="sm:col-span-2"><dt className="text-[var(--muted)]">Fiscal</dt><dd>{invoiceSummary}</dd></div>
        <div><dt className="text-[var(--muted)]">Crédito</dt><dd>{client.creditDays != null ? `${client.creditDays} días` : "—"}</dd></div>
        <div><dt className="text-[var(--muted)]">Entrega</dt><dd>{client.deliveryAddress?.trim() || "—"}</dd></div>
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
  if (!canReassign && !canInactivate) return null;
  return (
    <div className="space-y-3 border-t border-[var(--line)] p-3 text-xs">
      {canReassign ? (
        <form action={reassignAction} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="id" value={clientId} />
          <input type="hidden" name="version" value={version} />
          <Field label="Reasignar">
            <select name="ownerUserId" className={controlClass} defaultValue={ownerUserId ?? ""}>
              <option value="" disabled>Responsable</option>
              {candidates.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
            </select>
          </Field>
          <Button type="submit" tone="ghost" className="min-h-9">Aplicar</Button>
        </form>
      ) : null}
      {canInactivate ? (
        <form action={inactivateAction}>
          <input type="hidden" name="id" value={clientId} />
          <input type="hidden" name="version" value={version} />
          <ConfirmSubmit message="El cliente quedará inactivo. El historial se conserva." tone="ghost">
            Inactivar cliente
          </ConfirmSubmit>
        </form>
      ) : null}
    </div>
  );
}

export function ClientContactsPanel({
  clientId,
  contacts,
  addAction,
  inactivateAction,
  embedded = false,
}: {
  clientId: string;
  contacts: ContactRow[];
  addAction: (formData: FormData) => void | Promise<void>;
  inactivateAction: (formData: FormData) => void | Promise<void>;
  embedded?: boolean;
}) {
  const [adding, setAdding] = useState(false);

  const body = (
    <>
      {contacts.length === 0 ? (
        <p className="px-3 py-2 text-xs text-[var(--muted)]">Sin contactos activos.</p>
      ) : (
        <div className={denseTable}>
          <ResponsiveData
            table={
              <Table>
                <thead>
                  <tr>
                    <Th>Nombre</Th>
                    <Th>Tel / correo</Th>
                    <Th><span className="sr-only">Acciones</span></Th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((contact) => (
                    <tr key={contact.id}>
                      <Td>
                        <span className="font-medium">{contact.name}</span>
                        {contact.isPrimary ? <Badge tone="ok">Principal</Badge> : null}
                        {contact.roleTitle ? <span className="block text-[var(--muted)]">{contact.roleTitle}</span> : null}
                      </Td>
                      <Td>{[contact.phone, contact.email].filter(Boolean).join(" · ") || "—"}</Td>
                      <Td>
                        <form action={inactivateAction}>
                          <input type="hidden" name="contactId" value={contact.id} />
                          <ConfirmSubmit message="¿Inactivar contacto?" tone="ghost">
                            <span className="text-xs">Inactivar</span>
                          </ConfirmSubmit>
                        </form>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            }
            cards={contacts.map((contact) => (
              <div key={contact.id} className="border-b border-[var(--line)] px-3 py-2 text-xs last:border-0">
                <p className="font-medium">{contact.name}</p>
                <p className="text-[var(--muted)]">{[contact.phone, contact.email].filter(Boolean).join(" · ")}</p>
              </div>
            ))}
          />
        </div>
      )}
      <div className="border-t border-[var(--line)] px-3 py-2">
        {adding ? (
          <form action={addAction} className="grid gap-2 sm:grid-cols-2">
            <input type="hidden" name="clientId" value={clientId} />
            <Field label="Nombre"><input name="name" required className={controlClass} /></Field>
            <Field label="Teléfono"><input name="phone" className={controlClass} /></Field>
            <Field label="Correo"><input name="email" className={controlClass} /></Field>
            <Field label="Puesto"><input name="roleTitle" className={controlClass} /></Field>
            <label className="flex items-center gap-2 text-xs sm:col-span-2"><input type="checkbox" name="isPrimary" value="si" /> Principal</label>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" className="min-h-9 text-xs">Guardar</Button>
              <Button type="button" tone="ghost" className="min-h-9 text-xs" onClick={() => setAdding(false)}>Cancelar</Button>
            </div>
          </form>
        ) : (
          <Button type="button" tone="ghost" className="min-h-9 text-xs" onClick={() => setAdding(true)}>+ Contacto</Button>
        )}
      </div>
    </>
  );

  if (embedded) return body;
  return <section className="mt-4">{body}</section>;
}

export function ClientDataAccordion({
  client,
  ownerName,
  contacts,
  clientId,
  version,
  ownerUserId,
  prospects,
  updateAction,
  addContactAction,
  inactivateContactAction,
  reassignAction,
  inactivateAction,
  canReassign,
  canInactivate,
  candidates,
}: {
  client: ClientData;
  ownerName: string | null;
  contacts: ContactRow[];
  clientId: string;
  version: number;
  ownerUserId: string | null;
  prospects: ProspectRow[];
  updateAction: (formData: FormData) => void | Promise<void>;
  addContactAction: (formData: FormData) => void | Promise<void>;
  inactivateContactAction: (formData: FormData) => void | Promise<void>;
  reassignAction: (formData: FormData) => void | Promise<void>;
  inactivateAction: (formData: FormData) => void | Promise<void>;
  canReassign: boolean;
  canInactivate: boolean;
  candidates: Array<{ id: string; name: string }>;
}) {
  return (
    <CollapseBlock title="Datos del cliente y contactos" count={contacts.length}>
      <ClientProfileSection client={client} ownerName={ownerName} updateAction={updateAction} compact />
      <ClientContactsPanel clientId={clientId} contacts={contacts} addAction={addContactAction} inactivateAction={inactivateContactAction} embedded />
      {prospects.length > 0 ? (
        <ul className="border-t border-[var(--line)] px-3 py-2 text-xs">
          {prospects.map((p) => (
            <li key={p.id}><Link href={`/prospectos/${p.id}`} className="text-[var(--accent)]">Prospecto: {p.name}</Link></li>
          ))}
        </ul>
      ) : null}
      <ClientAdminAside
        clientId={clientId}
        version={version}
        ownerUserId={ownerUserId}
        canReassign={canReassign}
        canInactivate={canInactivate}
        candidates={candidates}
        reassignAction={reassignAction}
        inactivateAction={inactivateAction}
      />
    </CollapseBlock>
  );
}

export function ClientRelationsHub({
  clientId,
  quotes,
  attentions,
  equipments,
  canQuote,
  canService,
}: {
  clientId: string;
  quotes: QuoteRow[];
  attentions: AttentionRow[];
  equipments: EquipmentRow[];
  canQuote: boolean;
  canService: boolean;
}) {
  const sortedAttentions = [...attentions].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <section className="space-y-3">
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] bg-[#f7fafc] px-3 py-2">
          <h2 className="text-sm font-semibold text-[#0b1f3a]">Servicios ({sortedAttentions.length})</h2>
          {canService ? (
            <ActionLink href={`/servicios/diagnostico/nuevo?clientId=${clientId}`} className="min-h-9 px-3 py-1.5 text-xs">
              + Atención
            </ActionLink>
          ) : null}
        </div>
        {sortedAttentions.length === 0 ? (
          <div className="px-3 py-4 text-center text-xs text-[var(--muted)]">
            <p>Sin servicios registrados.</p>
            {canService ? (
              <ActionLink href={`/servicios/diagnostico/nuevo?clientId=${clientId}`} className="mt-3 inline-flex min-h-10">
                Abrir primera atención
              </ActionLink>
            ) : null}
          </div>
        ) : (
          <div className={denseTable}>
            <ResponsiveData
              table={
                <Table>
                  <thead>
                    <tr>
                      <Th>Tipo</Th>
                      <Th>Equipo</Th>
                      <Th>Estado</Th>
                      <Th>Operación</Th>
                      <Th>Fecha</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedAttentions.map((row) => {
                      const st = attentionStatusLabel(row.status);
                      const equipHref = row.equipment.kind === "MOT" ? `/motores/${row.equipment.id}` : `/equipos/${row.equipment.id}`;
                      const type = row.attentionType as AttentionType;
                      const caseRow = row.technicalCases[0];
                      return (
                        <tr key={row.id}>
                          <Td>
                            <Badge>{ATTENTION_LABEL[type] ?? row.attentionType}</Badge>
                            <span className="mt-0.5 block text-[var(--muted)]">{row.priorityName}</span>
                          </Td>
                          <Td>
                            <Link href={equipHref} className="font-medium text-[var(--accent)]">{row.equipment.folio}</Link>
                            <span className="block truncate text-[var(--muted)]" title={row.reportedFault}>{row.equipment.model}</span>
                          </Td>
                          <Td><Badge tone={st.tone}>{st.label}</Badge></Td>
                          <Td>
                            {caseRow ? (
                              <Link href={`/operacion/${caseRow.id}`} className="font-medium text-[var(--accent)]">{caseRow.folio}</Link>
                            ) : (
                              <span className="text-[var(--muted)]">—</span>
                            )}
                            {caseRow ? <span className="block text-[var(--muted)]">{CASE_STATUS_LABEL[caseRow.status] ?? caseRow.status}</span> : null}
                          </Td>
                          <Td><span className="text-[var(--muted)]">{formatWhen(row.createdAt)}</span></Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              }
              cards={sortedAttentions.map((row) => {
                const equipHref = row.equipment.kind === "MOT" ? `/motores/${row.equipment.id}` : `/equipos/${row.equipment.id}`;
                const st = attentionStatusLabel(row.status);
                const caseLink = row.technicalCases[0];
                const type = row.attentionType as AttentionType;
                return (
                  <MobileCard
                    key={row.id}
                    href={caseLink ? `/operacion/${caseLink.id}` : equipHref}
                    title={`${ATTENTION_LABEL[type] ?? row.attentionType} · ${row.equipment.folio}`}
                    meta={<Badge tone={st.tone}>{st.label}</Badge>}
                  >
                    <p>{row.reportedFault}</p>
                    {caseLink ? <p>{caseLink.folio}</p> : null}
                    <p>{formatWhen(row.createdAt)}</p>
                  </MobileCard>
                );
              })}
            />
          </div>
        )}
      </Card>

      <CollapseBlock title="Cotizaciones" count={quotes.length}>
        {quotes.length === 0 ? (
          <p className="px-3 py-3 text-xs text-[var(--muted)]">Sin cotizaciones.</p>
        ) : (
          <div className={denseTable}>
            <ResponsiveData
              table={
                <Table>
                  <thead><tr><Th>Folio</Th><Th>Tipo</Th><Th>Estado</Th><Th>Fecha</Th></tr></thead>
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
                  <p>{formatWhen(quote.updatedAt)}</p>
                </MobileCard>
              ))}
            />
          </div>
        )}
        {canQuote ? (
          <div className="border-t border-[var(--line)] px-3 py-2">
            <ActionLink href={`/cotizaciones/nuevo?clientId=${clientId}`} tone="ghost" className="min-h-9 w-full border-dashed text-xs sm:w-auto">
              + Nueva cotización
            </ActionLink>
          </div>
        ) : null}
      </CollapseBlock>

      <CollapseBlock title="Equipos y motores" count={equipments.length}>
        {equipments.length === 0 ? (
          <p className="px-3 py-3 text-xs text-[var(--muted)]">Sin equipos.</p>
        ) : (
          <div className={denseTable}>
            <ResponsiveData
              table={
                <Table>
                  <thead><tr><Th>Folio</Th><Th>Tipo</Th><Th>Modelo</Th><Th>Custodia</Th></tr></thead>
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
                </MobileCard>
              ))}
            />
          </div>
        )}
      </CollapseBlock>
    </section>
  );
}
