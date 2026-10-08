import Link from "next/link";
import { SlaCountdown } from "@/components/sla-countdown";
import { Badge, MobileCard, ResponsiveData, Table, Td, Th } from "@/components/ui";
import { CASE_STATUS_LABEL } from "@/lib/case-labels";
import { servicioTipoLabel } from "@/lib/servicios-catalog";
import { servicioRowHighlight, type SupervisorServicioRow } from "@/lib/servicios-supervisor";

function Markers({ markers }: { markers: string[] }) {
  if (markers.length === 0) return null;
  return (
    <span className="ml-2 inline-flex flex-wrap gap-1">
      {markers.map((marker) => (
        <Badge key={marker} tone={marker === "Vencido" ? "warn" : "ok"}>
          {marker}
        </Badge>
      ))}
    </span>
  );
}

export function ServiciosSupervisorList({
  rows,
  hideAssignee = false,
  showTipo = false,
}: {
  rows: SupervisorServicioRow[];
  hideAssignee?: boolean;
  showTipo?: boolean;
}) {
  return (
    <ResponsiveData
      table={
        <Table>
          <thead>
            <tr>
              {showTipo ? <Th>Tipo</Th> : null}
              <Th>Folio / equipo</Th>
              <Th>Cliente</Th>
              <Th>Prioridad</Th>
              <Th>Estado</Th>
              {hideAssignee ? null : <Th>Responsable</Th>}
              <Th>SLA</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const { wrapClass, statusTone, markers } = servicioRowHighlight(row);
              if (row.kind === "ingreso") {
                return (
                  <tr key={`ing-${row.id}`} className={wrapClass}>
                    {showTipo ? (
                      <Td>
                        <Badge>{servicioTipoLabel(row.attentionType)}</Badge>
                      </Td>
                    ) : null}
                    <Td>
                      <Link href={row.href} className="font-medium text-[var(--accent)]">
                        {row.equipmentFolio}
                      </Link>
                      <span className="text-[var(--muted)]"> · espera ingreso</span>
                    </Td>
                    <Td>{row.clientName}</Td>
                    <Td>{row.priorityName}</Td>
                    <Td>
                      <Badge tone="neutral">Espera ingreso</Badge>
                    </Td>
                    {hideAssignee ? null : <Td>—</Td>}
                    <Td>
                      <span className="text-[var(--muted)]">Pendiente entrada</span>
                    </Td>
                  </tr>
                );
              }
              return (
                <tr key={row.id} className={wrapClass}>
                  {showTipo ? (
                    <Td>
                      <Badge>{servicioTipoLabel(row.attentionType)}</Badge>
                    </Td>
                  ) : null}
                  <Td>
                    <Link href={row.href} className="font-medium text-[var(--accent)]">
                      {row.folio}
                    </Link>
                    <span className="text-[var(--muted)]"> · {row.equipmentFolio}</span>
                    <Markers markers={markers} />
                  </Td>
                  <Td>{row.clientName}</Td>
                  <Td>{row.priorityName}</Td>
                  <Td>
                    <Badge tone={statusTone}>{CASE_STATUS_LABEL[row.status] ?? row.status}</Badge>
                  </Td>
                  {hideAssignee ? null : (
                    <Td>{row.externalSupplier ? "Proveedor externo" : row.assigneeName ?? "Sin asignar"}</Td>
                  )}
                  <Td>
                    <SlaCountdown dueAt={row.slaDueAt} />
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      }
      cards={rows.map((row) => {
        const { wrapClass, statusTone, markers } = servicioRowHighlight(row);
        if (row.kind === "ingreso") {
          return (
            <div key={`ing-${row.id}`} className={wrapClass ? `rounded-lg ${wrapClass}` : undefined}>
              <MobileCard
                href={row.href}
                title={row.equipmentFolio}
                meta={
                  <>
                    {showTipo ? <Badge>{servicioTipoLabel(row.attentionType)}</Badge> : null}
                    <Badge tone="neutral">Espera ingreso</Badge>
                  </>
                }
              >
                <p>{row.clientName}</p>
                <p>{row.priorityName}</p>
                <p className="line-clamp-2">{row.reportedFault}</p>
              </MobileCard>
            </div>
          );
        }
        return (
          <div key={row.id} className={wrapClass ? `rounded-lg ${wrapClass}` : undefined}>
            <MobileCard
              href={row.href}
              title={
                <>
                  {row.folio}
                  <Markers markers={markers} />
                </>
              }
              meta={
                <>
                  {showTipo ? <Badge>{servicioTipoLabel(row.attentionType)}</Badge> : null}
                  <Badge tone={statusTone}>{CASE_STATUS_LABEL[row.status] ?? row.status}</Badge>
                </>
              }
            >
              <p>
                {row.equipmentFolio} · {row.equipmentModel}
              </p>
              <p>{row.clientName}</p>
              <p>{row.priorityName}</p>
              {hideAssignee ? null : (
                <p>{row.externalSupplier ? "Proveedor externo" : row.assigneeName ?? "Sin asignar"}</p>
              )}
              <p>
                SLA: <SlaCountdown dueAt={row.slaDueAt} />
              </p>
            </MobileCard>
          </div>
        );
      })}
    />
  );
}
