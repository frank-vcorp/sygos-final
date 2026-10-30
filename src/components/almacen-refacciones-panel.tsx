import {
  almacenIssuePartRequestAction,
  almacenPartNotFoundAction,
  almacenReceivePartRequestAction,
  almacenReceivePurchasePackageAction,
} from "@/app/(erp)/custodia/actions";
import { SlaCountdown } from "@/components/sla-countdown";
import { Badge, Button, Card, RecordLink, Table, Td, TextLink, Th } from "@/components/ui";
import { loadAlmacenRefaccionesPanelData } from "@/lib/almacen-refacciones";
import { formatWhen } from "@/lib/form";

function ContextCell({ label, href }: { label: string; href: string | null }) {
  if (!href || label === "—") return <span className="text-[var(--muted)]">{label}</span>;
  return <RecordLink href={href}>{label}</RecordLink>;
}

function countLabel(count: number, singular: string, plural: string) {
  if (count === 0) return "Sin pendientes";
  if (count === 1) return `1 ${singular}`;
  return `${count} ${plural}`;
}

export async function AlmacenRefaccionesPanel({ companyId }: { companyId: string }) {
  const { porSurtir, paquetesPorIngresar, pendientesSamuel } =
    await loadAlmacenRefaccionesPanelData(companyId);

  return (
    <section id="refacciones-almacen" className="mb-6 scroll-mt-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/90 bg-white px-5 py-3.5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
        <div>
          <h2 className="text-base font-bold tracking-tight text-slate-900">
            Panel de Refacciones de Almacén
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Surtido físico a técnicos, ingreso por paquete de compra y seguimiento con Gerencia Operativa.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <a
            href="#refacciones-por-surtir"
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50/80 px-3 py-1 font-semibold text-emerald-800 hover:bg-emerald-100/80"
          >
            <span>Por surtir: {porSurtir.length}</span>
          </a>
          <a
            href="#refacciones-paquetes"
            className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50/80 px-3 py-1 font-semibold text-[#0a477e] hover:bg-sky-100/80"
          >
            <span>Paquetes por ingresar: {paquetesPorIngresar.length}</span>
          </a>
          <a
            href="#refacciones-seguimiento"
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50/80 px-3 py-1 font-semibold text-amber-800 hover:bg-amber-100/80"
          >
            <span>Con Samuel: {pendientesSamuel.length}</span>
          </a>
          <TextLink href="/inventario">Abrir inventario</TextLink>
        </div>
      </div>

      {/* 1) Por surtir a técnicos */}
      <Card id="refacciones-por-surtir" className="scroll-mt-6 overflow-hidden p-0">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--line)] bg-[#fbfdff] px-5 py-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold tracking-tight text-[var(--ink)]">
                Refacciones por surtir a técnicos
              </h3>
              <Badge tone={porSurtir.length > 0 ? "ok" : "neutral"}>Prioridad 1</Badge>
            </div>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {countLabel(porSurtir.length, "partida lista en estante para entregar", "partidas listas en estante para entregar")}
            </p>
          </div>
        </div>
        {porSurtir.length === 0 ? (
          <p className="m-5 rounded-lg bg-[#f5f8fb] px-4 py-3 text-sm text-[var(--muted)]">
            No hay refacciones apartadas o recibidas pendientes de entregar a técnicos.
          </p>
        ) : (
          <div className="w-full px-4 pb-5 pt-2 sm:px-5">
            <Table>
              <thead>
                <tr>
                  <Th>Cant. a surtir</Th>
                  <Th>Partida / Refacción</Th>
                  <Th>Diag</Th>
                  <Th>OS</Th>
                  <Th>Equipo</Th>
                  <Th>Técnico / Solicitante</Th>
                  <Th>SLA</Th>
                  <Th>Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {porSurtir.map((row) => (
                  <tr key={row.id}>
                    <Td>
                      <div className="flex flex-col gap-1">
                        <span className="font-semibold text-slate-900 tabular-nums">
                          {row.issueable} <span className="text-xs font-normal text-slate-500">/ {row.qtyRequested}</span>
                        </span>
                        {row.partialWarningBadge ? (
                          <Badge tone="warn">{row.partialWarningBadge}</Badge>
                        ) : null}
                      </div>
                    </Td>
                    <Td>
                      <div className="font-medium text-slate-900">
                        {row.partNumber}
                        {row.description ? ` · ${row.description}` : ""}
                      </div>
                      <div className="mt-0.5 text-xs font-medium text-[#0a477e]">
                        Ubicación: {row.ubicacionLabel}
                      </div>
                    </Td>
                    <Td>
                      <ContextCell label={row.diagLabel} href={row.diagHref} />
                    </Td>
                    <Td>
                      <ContextCell label={row.osLabel} href={row.osHref} />
                    </Td>
                    <Td>
                      <ContextCell label={row.equipmentLabel} href={row.equipmentHref} />
                    </Td>
                    <Td>{row.technicianName}</Td>
                    <Td>
                      <SlaCountdown dueAt={row.slaDueAt} />
                    </Td>
                    <Td>
                      <div className="flex flex-wrap items-center gap-2">
                        <form action={almacenIssuePartRequestAction}>
                          <input type="hidden" name="requestId" value={row.id} />
                          <input type="hidden" name="version" value={row.version} />
                          <input type="hidden" name="quantity" value={row.issueable} />
                          <input type="hidden" name="caseId" value={row.caseId} />
                          <Button type="submit" className="min-h-9 px-3 py-1.5 text-xs">
                            {row.shortfall > 0 ? `Surtir disponibles (${row.issueable})` : "Surtido"}
                          </Button>
                        </form>
                        {row.qtyReserved > 0 ? (
                          <form action={almacenPartNotFoundAction}>
                            <input type="hidden" name="requestId" value={row.id} />
                            <input type="hidden" name="version" value={row.version} />
                            <Button
                              type="submit"
                              tone="ghost"
                              className="min-h-9 px-2.5 py-1.5 text-xs text-amber-800 hover:border-amber-300 hover:bg-amber-50"
                            >
                              No encontrada
                            </Button>
                          </form>
                        ) : null}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Card>

      {/* 2) Paquetes / Compras por ingresar a almacén */}
      <Card id="refacciones-paquetes" className="scroll-mt-6 overflow-hidden p-0">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--line)] bg-[#fbfdff] px-5 py-4">
          <div>
            <h3 className="text-base font-bold tracking-tight text-[var(--ink)]">
              Paquetes / Compras por ingresar a almacén
            </h3>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {countLabel(
                paquetesPorIngresar.length,
                "paquete de compra pendiente de ingreso físico",
                "paquetes de compra pendientes de ingreso físico",
              )}
            </p>
          </div>
        </div>
        {paquetesPorIngresar.length === 0 ? (
          <p className="m-5 rounded-lg bg-[#f5f8fb] px-4 py-3 text-sm text-[var(--muted)]">
            No hay paquetes ni carritos comprados pendientes de ingresar a almacén.
          </p>
        ) : (
          <div className="space-y-4 p-4 sm:p-5">
            {paquetesPorIngresar.map((pkg) => (
              <div
                key={pkg.purchaseId}
                className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-2xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 bg-slate-50/80 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span className="font-bold text-slate-900">{pkg.folio}</span>
                    <span className="text-slate-400">·</span>
                    <span className="font-medium text-slate-800">{pkg.supplierName}</span>
                    {pkg.shoppingListFolio ? (
                      <>
                        <span className="text-slate-400">·</span>
                        <Badge tone="neutral">Lista {pkg.shoppingListFolio}</Badge>
                      </>
                    ) : null}
                    <span className="text-slate-400">·</span>
                    <span className="text-xs text-slate-500">{formatWhen(pkg.purchaseDate)}</span>
                    <span className="text-slate-400">·</span>
                    <Badge tone="warn">
                      {pkg.lines.length} {pkg.lines.length === 1 ? "partida pendiente" : "partidas pendientes"} ({pkg.totalUnitsToReceive} pza{pkg.totalUnitsToReceive === 1 ? "" : "s"})
                    </Badge>
                  </div>
                  <form action={almacenReceivePurchasePackageAction}>
                    <input type="hidden" name="purchaseId" value={pkg.purchaseId} />
                    <Button type="submit" className="min-h-9 px-3.5 py-1.5 text-xs">
                      Ingresar paquete completo a almacén
                    </Button>
                  </form>
                </div>
                <div className="px-3 pb-3 pt-1 sm:px-4">
                  <Table>
                    <thead>
                      <tr>
                        <Th>Cantidad</Th>
                        <Th>Partida</Th>
                        <Th>Diag</Th>
                        <Th>OS</Th>
                        <Th>Equipo</Th>
                        <Th>Técnico</Th>
                        <Th>SLA</Th>
                        <Th>Acciones</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {pkg.lines.map((line) => (
                        <tr key={line.lineId}>
                          <Td className="font-semibold tabular-nums">{line.qtyToReceive}</Td>
                          <Td>
                            <span className="font-medium text-slate-900">{line.partNumber}</span>
                            {line.description ? ` · ${line.description}` : ""}
                          </Td>
                          <Td>
                            <ContextCell label={line.diagLabel} href={line.diagHref} />
                          </Td>
                          <Td>
                            <ContextCell label={line.osLabel} href={line.osHref} />
                          </Td>
                          <Td>
                            <ContextCell label={line.equipmentLabel} href={line.equipmentHref} />
                          </Td>
                          <Td>{line.technicianName}</Td>
                          <Td>
                            <SlaCountdown dueAt={line.slaDueAt} />
                          </Td>
                          <Td>
                            <form action={almacenReceivePartRequestAction}>
                              <input type="hidden" name="requestId" value={line.partRequestId} />
                              <input type="hidden" name="version" value={line.version} />
                              <input type="hidden" name="quantity" value={line.qtyToReceive} />
                              <Button type="submit" tone="ghost" className="min-h-8 px-2.5 py-1 text-xs">
                                Ingresar ({line.qtyToReceive})
                              </Button>
                            </form>
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 3) Solicitadas / Pendientes con Samuel (Seguimiento de compras) */}
      <Card id="refacciones-seguimiento" className="scroll-mt-6 overflow-hidden p-0">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--line)] bg-[#fbfdff] px-5 py-4">
          <div>
            <h3 className="text-base font-bold tracking-tight text-[var(--ink)]">
              Solicitadas / Pendientes con Samuel (Seguimiento de compras)
            </h3>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {countLabel(
                pendientesSamuel.length,
                "solicitud en seguimiento con compras",
                "solicitudes en seguimiento con compras",
              )}
            </p>
          </div>
          <TextLink href="/compras/requerimientos">Ver requerimientos</TextLink>
        </div>
        {pendientesSamuel.length === 0 ? (
          <p className="m-5 rounded-lg bg-[#f5f8fb] px-4 py-3 text-sm text-[var(--muted)]">
            No hay refacciones faltantes pendientes de compra con Gerencia Operativa.
          </p>
        ) : (
          <div className="w-full px-4 pb-5 pt-2 sm:px-5">
            <Table>
              <thead>
                <tr>
                  <Th>Faltante / Total</Th>
                  <Th>Partida</Th>
                  <Th>Diag</Th>
                  <Th>OS</Th>
                  <Th>Equipo</Th>
                  <Th>Solicitante</Th>
                  <Th>Estado con Samuel</Th>
                  <Th>SLA</Th>
                </tr>
              </thead>
              <tbody>
                {pendientesSamuel.map((row) => (
                  <tr key={row.id}>
                    <Td>
                      <span className="font-semibold text-slate-900 tabular-nums">
                        {row.shortfall} <span className="text-xs font-normal text-slate-500">de {row.qtyRequested}</span>
                      </span>
                      {row.qtyInWarehouse > 0 ? (
                        <span className="block text-xs text-emerald-700">
                          {row.qtyInWarehouse} ya en almacén
                        </span>
                      ) : null}
                    </Td>
                    <Td>
                      <span className="font-medium text-slate-900">{row.partNumber}</span>
                      {row.description ? ` · ${row.description}` : ""}
                    </Td>
                    <Td>
                      <ContextCell label={row.diagLabel} href={row.diagHref} />
                    </Td>
                    <Td>
                      <ContextCell label={row.osLabel} href={row.osHref} />
                    </Td>
                    <Td>
                      <ContextCell label={row.equipmentLabel} href={row.equipmentHref} />
                    </Td>
                    <Td>{row.requesterName}</Td>
                    <Td>
                      <Badge tone={row.samuelState.tone}>{row.samuelState.label}</Badge>
                    </Td>
                    <Td>
                      <SlaCountdown dueAt={row.slaDueAt} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Card>
    </section>
  );
}
