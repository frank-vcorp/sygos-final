import { ClientNameLink } from "@/components/client-entity-links";
import { ServiciosSupervisorList } from "@/components/servicios-supervisor-list";
import { Badge, Card, RecordLink, ResponsiveData, Table, Td, Th, TextLink } from "@/components/ui";
import { formatWhen } from "@/lib/form";
import { money } from "@/lib/money";
import type { Role } from "@/lib/roles";
import type { SupervisorServicioRow } from "@/lib/servicios-supervisor";

const LIST_CAP = 12;

function countLabel(count: number) {
  if (count === 0) return "Sin pendientes";
  if (count === 1) return "1 pendiente mostrado";
  return `${count} pendientes mostrados`;
}

export function SalesPanelServiciosSection({
  title,
  empty,
  bandejaHref,
  rows,
  role,
}: {
  title: string;
  empty: string;
  bandejaHref?: string;
  rows: SupervisorServicioRow[];
  role: Role;
}) {
  const shown = rows.slice(0, LIST_CAP);
  return (
    <Card className="flex h-full flex-col overflow-hidden p-0">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--line)] bg-[#fbfdff] px-5 py-4">
        <div>
          <h2 className="text-base font-bold tracking-tight text-[var(--ink)]">{title}</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">{countLabel(shown.length)}</p>
        </div>
        {bandejaHref ? <TextLink href={bandejaHref}>Ver bandeja</TextLink> : null}
      </div>
      {shown.length === 0 ? (
        <p className="m-5 rounded-lg bg-[#f5f8fb] px-4 py-3 text-sm text-[var(--muted)]">{empty}</p>
      ) : (
        <div className="min-w-0 overflow-x-auto px-1 pb-1 pt-2 sm:px-2">
          <ServiciosSupervisorList rows={shown} role={role} variant="activos" />
        </div>
      )}
    </Card>
  );
}

export function SalesPanelServiciosGrouped({
  title,
  role,
  sections,
}: {
  title: string;
  role: Role;
  sections: Array<{ subtitle: string; empty: string; bandejaHref?: string; rows: SupervisorServicioRow[] }>;
}) {
  const total = sections.reduce((sum, section) => sum + Math.min(section.rows.length, LIST_CAP), 0);
  return (
    <Card className="flex h-full flex-col overflow-hidden p-0">
      <div className="border-b border-[var(--line)] bg-[#fbfdff] px-5 py-4">
        <h2 className="text-base font-bold tracking-tight text-[var(--ink)]">{title}</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">{countLabel(total)}</p>
      </div>
      {sections.map((section, index) => {
        const shown = section.rows.slice(0, LIST_CAP);
        return (
          <section key={section.subtitle} className={index > 0 ? "border-t border-[var(--line)]" : ""}>
            <div className="flex flex-wrap items-start justify-between gap-3 bg-[#f8fbfd] px-5 py-3">
              <h3 className="text-sm font-semibold text-[var(--ink)]">{section.subtitle}</h3>
              {section.bandejaHref ? <TextLink href={section.bandejaHref}>Ver bandeja</TextLink> : null}
            </div>
            {shown.length === 0 ? (
              <p className="m-5 rounded-lg bg-[#f5f8fb] px-4 py-3 text-sm text-[var(--muted)]">{section.empty}</p>
            ) : (
              <div className="min-w-0 overflow-x-auto px-1 pb-3 pt-2 sm:px-2">
                <ServiciosSupervisorList rows={shown} role={role} variant="activos" />
              </div>
            )}
          </section>
        );
      })}
    </Card>
  );
}

type ReceivableRow = {
  id: string;
  balance: number;
  dueAt: Date;
  status: string;
  document: { folio: string };
  client: { id: string; name: string; isSystem: boolean };
};

export function SalesPanelCobranzaSection({
  title,
  empty,
  bandejaHref,
  rows,
  canEditClient,
  highlightVigente,
}: {
  title: string;
  empty: string;
  bandejaHref?: string;
  rows: ReceivableRow[];
  canEditClient: boolean;
  highlightVigente: (dueAt: Date, balance: number) => boolean;
}) {
  const shown = rows.slice(0, LIST_CAP);
  return (
    <Card className="flex h-full flex-col overflow-hidden p-0">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--line)] bg-[#fbfdff] px-5 py-4">
        <div>
          <h2 className="text-base font-bold tracking-tight text-[var(--ink)]">{title}</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">{countLabel(shown.length)}</p>
        </div>
        {bandejaHref ? <TextLink href={bandejaHref}>Ver bandeja</TextLink> : null}
      </div>
      {shown.length === 0 ? (
        <p className="m-5 rounded-lg bg-[#f5f8fb] px-4 py-3 text-sm text-[var(--muted)]">{empty}</p>
      ) : (
        <div className="min-w-0 overflow-x-auto px-1 pb-1 pt-2 sm:px-2">
          <ResponsiveData
            table={
              <Table stickyHeader>
                <thead>
                  <tr>
                    <Th>Documento</Th>
                    <Th>Cliente</Th>
                    <Th>Saldo</Th>
                    <Th>Vence</Th>
                    <Th>Estado</Th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((row) => {
                    const overdue = row.balance > 0 && row.dueAt.getTime() < Date.now();
                    const vigente = highlightVigente(row.dueAt, row.balance);
                    const statusLabel = overdue ? "Vencida" : row.status === "SALDADA" ? "Saldada" : row.status === "PARCIAL" ? "Parcial" : "Abierta";
                    return (
                      <tr
                        key={row.id}
                        className={vigente ? "bg-gradient-to-r from-[#f0fdf4] to-white ring-1 ring-inset ring-[#86efac]/70" : undefined}
                      >
                        <Td>
                          <RecordLink href={`/cobranza/${row.id}`}>{row.document.folio}</RecordLink>
                        </Td>
                        <Td>
                          <ClientNameLink
                            clientId={row.client.id}
                            name={row.client.name}
                            isSystem={row.client.isSystem}
                            canEdit={canEditClient}
                          />
                        </Td>
                        <Td>{money(row.balance)}</Td>
                        <Td>{formatWhen(row.dueAt)}</Td>
                        <Td>
                          <Badge tone={vigente ? "ok" : overdue ? "warn" : "neutral"}>{vigente ? "Vigente" : statusLabel}</Badge>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            }
            cards={shown.map((row) => {
              const overdue = row.balance > 0 && row.dueAt.getTime() < Date.now();
              const vigente = highlightVigente(row.dueAt, row.balance);
              const statusLabel = vigente ? "Vigente" : overdue ? "Vencida" : row.status === "PARCIAL" ? "Parcial" : "Abierta";
              return (
                <div
                  key={row.id}
                  className={vigente ? "rounded-xl bg-gradient-to-r from-[#f0fdf4] to-white p-0.5 ring-1 ring-inset ring-[#86efac]/70" : undefined}
                >
                  <a href={`/cobranza/${row.id}`} className="block rounded-lg border border-[var(--line)] bg-white p-4 text-sm">
                    <p className="font-semibold text-[var(--ink)]">{row.document.folio}</p>
                    <p className="mt-1 text-[var(--muted)]">{row.client.name}</p>
                    <p className="mt-2">{money(row.balance)} · vence {formatWhen(row.dueAt)}</p>
                    <p className="mt-1">
                      <Badge tone={vigente ? "ok" : overdue ? "warn" : "neutral"}>{statusLabel}</Badge>
                    </p>
                  </a>
                </div>
              );
            })}
          />
        </div>
      )}
    </Card>
  );
}
