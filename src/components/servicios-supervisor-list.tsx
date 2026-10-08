import Link from "next/link";
import { Badge, MobileCard, ResponsiveData, Table, Td, Th } from "@/components/ui";
import { CASE_STATUS_LABEL } from "@/lib/case-labels";
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

export function ServiciosSupervisorList({ rows }: { rows: SupervisorServicioRow[] }) {
  return (
    <ResponsiveData
      table={
        <Table>
          <thead>
            <tr>
              <Th>Folio / equipo</Th>
              <Th>Cliente</Th>
              <Th>Prioridad</Th>
              <Th>Estado</Th>
              <Th>Responsable</Th>
              <Th>SLA</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const { wrapClass, statusTone, markers } = servicioRowHighlight(row);
              if (row.kind === "ingreso") {
                return (
                  <tr key={`ing-${row.id}`} className={wrapClass}>
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
                    <Td>—</Td>
                    <Td className="text-[var(--muted)]">Pendiente entrada</Td>
                  </tr>
                );
              }
              return (
                <tr key={row.id} className={wrapClass}>
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
                  <Td>{row.externalSupplier ? "Proveedor externo" : row.assigneeName ?? "Sin asignar"}</Td>
                  <Td>
                    {row.slaDueAt
                      ? row.slaDueAt.toLocaleString("es-MX", {
                          timeZone: "America/Mexico_City",
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : "—"}
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
                meta={<Badge tone="neutral">Espera ingreso</Badge>}
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
              meta={<Badge tone={statusTone}>{CASE_STATUS_LABEL[row.status] ?? row.status}</Badge>}
            >
              <p>
                {row.equipmentFolio} · {row.equipmentModel}
              </p>
              <p>{row.clientName}</p>
              <p>{row.priorityName}</p>
              <p>
                {row.externalSupplier ? "Proveedor externo" : row.assigneeName ?? "Sin asignar"}
              </p>
              <p>
                SLA:{" "}
                {row.slaDueAt
                  ? row.slaDueAt.toLocaleString("es-MX", {
                      timeZone: "America/Mexico_City",
                      dateStyle: "medium",
                      timeStyle: "short",
                    })
                  : "—"}
              </p>
            </MobileCard>
          </div>
        );
      })}
    />
  );
}
