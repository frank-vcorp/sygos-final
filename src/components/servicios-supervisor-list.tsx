import { SlaCountdown } from "@/components/sla-countdown";
import { Badge, MobileCard, RecordLink, ResponsiveData, Table, Td, Th } from "@/components/ui";
import { CASE_STATUS_LABEL } from "@/lib/case-labels";
import { serviceSeries, servicioTipoLabel } from "@/lib/servicios-catalog";
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

function formatClosedAt(date: Date) {
  return date.toLocaleString("es-MX", {
    timeZone: "America/Mexico_City",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function ServiciosSupervisorList({
  rows,
  hideAssignee = false,
  showTipo = false,
  variant = "activos",
}: {
  rows: SupervisorServicioRow[];
  hideAssignee?: boolean;
  showTipo?: boolean;
  variant?: "activos" | "historial";
}) {
  const historial = variant === "historial";
  const trailHeader = historial ? "Cierre" : "SLA";

  return (
    <ResponsiveData
      table={
        <Table>
          <thead>
            <tr>
              {showTipo ? <Th>Tipo</Th> : null}
              <Th>Servicio</Th>
              <Th>Folio / equipo</Th>
              <Th>Cliente</Th>
              <Th>Prioridad</Th>
              <Th>Estado</Th>
              {hideAssignee ? null : <Th>Responsable</Th>}
              <Th>{trailHeader}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const { wrapClass, statusTone, markers } = servicioRowHighlight(row);
              if (row.kind === "atencion_cancelada" || row.kind === "espera_ingreso") {
                const statusLabel =
                  row.kind === "espera_ingreso" ? "Espera ingreso" : (CASE_STATUS_LABEL.CANCELADA ?? "Cancelada");
                const trail =
                  row.kind === "espera_ingreso"
                    ? row.createdAt.toLocaleDateString("es-MX", { timeZone: "America/Mexico_City" })
                    : formatClosedAt(row.closedAt);
                return (
                  <tr key={`att-${row.id}`} className={wrapClass}>
                    {showTipo ? (
                      <Td>
                        <Badge>{servicioTipoLabel(row.attentionType)}</Badge>
                      </Td>
                    ) : null}
                    <Td>
                      <RecordLink href={row.href}>{serviceSeries(row.attentionType)}</RecordLink>
                      <span className="block text-xs text-[var(--muted)]">
                        {row.kind === "espera_ingreso" ? `Pendiente de ingreso físico · el folio ${serviceSeries(row.attentionType)} se genera al recibir` : "Atención cancelada · sin operación"}
                      </span>
                    </Td>
                    <Td>{row.equipmentFolio}</Td>
                    <Td>{row.clientName}</Td>
                    <Td>{row.priorityName}</Td>
                    <Td>
                      <Badge tone="neutral">{statusLabel}</Badge>
                    </Td>
                    {hideAssignee ? null : <Td>—</Td>}
                    <Td>
                      <span className="text-[var(--muted)]">{trail}</span>
                    </Td>
                  </tr>
                );
              }
              return (
                <tr key={row.id} className={historial ? undefined : wrapClass}>
                  {showTipo ? (
                    <Td>
                      <Badge>{servicioTipoLabel(row.attentionType)}</Badge>
                    </Td>
                  ) : null}
                  <Td>
                    <RecordLink href={row.href}>{row.folio}</RecordLink>
                    {historial ? null : <Markers markers={markers} />}
                  </Td>
                  <Td>{row.equipmentFolio}</Td>
                  <Td>{row.clientName}</Td>
                  <Td>{row.priorityName}</Td>
                  <Td>
                    <Badge tone={historial ? "neutral" : statusTone}>{CASE_STATUS_LABEL[row.status] ?? row.status}</Badge>
                  </Td>
                  {hideAssignee ? null : (
                    <Td>{row.externalSupplier ? "Proveedor externo" : row.assigneeName ?? "Sin asignar"}</Td>
                  )}
                  <Td>
                    {historial ? (
                      <span className="text-[var(--muted)]">{row.closedAt ? formatClosedAt(row.closedAt) : "—"}</span>
                    ) : (
                      <SlaCountdown dueAt={row.slaDueAt} />
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      }
      cards={rows.map((row) => {
        const { wrapClass, statusTone, markers } = servicioRowHighlight(row);
        if (row.kind === "atencion_cancelada" || row.kind === "espera_ingreso") {
          const statusLabel =
            row.kind === "espera_ingreso" ? "Espera ingreso" : (CASE_STATUS_LABEL.CANCELADA ?? "Cancelada");
          return (
            <div key={`att-${row.id}`}>
              <MobileCard
                href={row.href}
                title={`${serviceSeries(row.attentionType)} · pendiente`}
                meta={
                  <>
                    {showTipo ? <Badge>{servicioTipoLabel(row.attentionType)}</Badge> : null}
                    <Badge tone="neutral">{statusLabel}</Badge>
                  </>
                }
              >
                <p>{row.equipmentFolio}</p>
                <p>{row.clientName}</p>
                <p>{row.priorityName}</p>
                <p className="line-clamp-2">{row.reportedFault}</p>
                {row.kind === "espera_ingreso" ? (
                  <p>Folio {serviceSeries(row.attentionType)}: se genera al confirmar la entrada física · Alta: {row.createdAt.toLocaleDateString("es-MX", { timeZone: "America/Mexico_City" })}</p>
                ) : (
                  <p>Cierre: {formatClosedAt(row.closedAt)}</p>
                )}
              </MobileCard>
            </div>
          );
        }
        return (
          <div key={row.id} className={historial ? undefined : wrapClass ? `rounded-lg ${wrapClass}` : undefined}>
            <MobileCard
              href={row.href}
              title={
                <>
                  {row.folio}
                  {historial ? null : <Markers markers={markers} />}
                </>
              }
              meta={
                <>
                  {showTipo ? <Badge>{servicioTipoLabel(row.attentionType)}</Badge> : null}
                  <Badge tone={historial ? "neutral" : statusTone}>{CASE_STATUS_LABEL[row.status] ?? row.status}</Badge>
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
                {historial ? (
                  <>Cierre: {row.closedAt ? formatClosedAt(row.closedAt) : "—"}</>
                ) : (
                  <>
                    SLA: <SlaCountdown dueAt={row.slaDueAt} />
                  </>
                )}
              </p>
            </MobileCard>
          </div>
        );
      })}
    />
  );
}
