"use client";

import { useMemo, useState } from "react";
import {
  collaboratorOvertimeDecisionAction,
  collaboratorOvertimeRequestAction,
  compensationDecisionAction,
  compensationRequestAction,
  leavePermissionDecisionAction,
  leavePermissionRequestAction,
  vacationDecisionAction,
  vacationRequestAction,
} from "../actions";
import { FormOverlayDialog } from "@/components/overlay-dialog";
import { Badge, Button, Card, controlClass, Empty, Field, MoneyInput, Table, Td, Th } from "@/components/ui";
import { money } from "@/lib/money";

export type VacationItem = {
  id: string;
  createdAtIso: string;
  startDate: string;
  endDate: string;
  days: number;
  comment: string | null;
  status: string;
  requestedByName: string;
  decidedByName: string | null;
  decidedAtIso: string | null;
  version: number;
};

export type OvertimeItem = {
  id: string;
  workDate: string;
  hours: number;
  authorizedHours: number | null;
  reason: string;
  status: string;
  requestedByName: string;
  authorizedByName: string | null;
  version: number;
};

export type CompensationItem = {
  id: string;
  createdAtIso: string;
  concept: string;
  requestedAmount: number;
  authorizedAmount: number | null;
  comment: string | null;
  status: string;
  requestedByName: string;
  decidedByName: string | null;
  version: number;
};

export type LeavePermissionItem = {
  id: string;
  createdAtIso: string;
  startDate: string;
  endDate: string;
  reason: string;
  comment: string | null;
  status: string;
  requestedByName: string;
  decidedByName: string | null;
  version: number;
};

function countWorkdaysMonFri(startDate: string, endDate: string): number {
  if (!startDate || !endDate || endDate < startDate) return 0;
  let count = 0;
  const cursor = new Date(`${startDate}T18:00:00.000Z`);
  const last = new Date(`${endDate}T18:00:00.000Z`);
  while (cursor <= last) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) count++;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

export function CollaboratorSolicitudesTab({
  collaboratorId,
  isCeo,
  today,
  initialSubtab,
  vacations,
  overtime,
  compensations,
  leavePermissions,
}: {
  collaboratorId: string;
  isCeo: boolean;
  today: string;
  initialSubtab?: string;
  vacations: VacationItem[];
  overtime: OvertimeItem[];
  compensations: CompensationItem[];
  leavePermissions: LeavePermissionItem[];
}) {
  const [subtab, setSubtab] = useState<"vacaciones" | "horas" | "compensaciones" | "permisos">(
    initialSubtab === "horas" || initialSubtab === "compensaciones" || initialSubtab === "permisos"
      ? initialSubtab
      : "vacaciones",
  );
  const [statusFilter, setStatusFilter] = useState("TODOS");
  const [periodFilter, setPeriodFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const [vacStart, setVacStart] = useState(today);
  const [vacEnd, setVacEnd] = useState(today);
  const vacDays = useMemo(() => countWorkdaysMonFri(vacStart, vacEnd), [vacStart, vacEnd]);

  const filteredVacations = vacations.filter((v) => {
    if (statusFilter !== "TODOS" && v.status !== statusFilter) return false;
    if (periodFilter && !v.startDate.startsWith(periodFilter) && !v.createdAtIso.startsWith(periodFilter)) return false;
    return true;
  });

  const filteredOvertime = overtime.filter((o) => {
    const normalizedStatus = o.status === "PENDIENTE_CEO" || o.status === "PENDIENTE_JEFE" ? "PENDIENTE" : o.status === "PAGADA" ? "AUTORIZADA" : o.status;
    if (statusFilter !== "TODOS" && normalizedStatus !== statusFilter) return false;
    if (periodFilter && !o.workDate.startsWith(periodFilter)) return false;
    return true;
  });

  const filteredCompensations = compensations.filter((c) => {
    if (statusFilter !== "TODOS" && c.status !== statusFilter) return false;
    if (periodFilter && !c.createdAtIso.startsWith(periodFilter)) return false;
    return true;
  });

  const filteredPermissions = leavePermissions.filter((p) => {
    const normalizedStatus = p.status === "AUTORIZADO" ? "AUTORIZADA" : p.status === "RECHAZADO" ? "RECHAZADA" : p.status;
    if (statusFilter !== "TODOS" && normalizedStatus !== statusFilter && p.status !== statusFilter) return false;
    if (periodFilter && !p.startDate.startsWith(periodFilter) && !p.createdAtIso.startsWith(periodFilter)) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Subpestañas de solicitudes">
          {(
            [
              { id: "vacaciones", label: "Vacaciones" },
              { id: "horas", label: "Horas extra" },
              { id: "compensaciones", label: "Compensaciones" },
              { id: "permisos", label: "Permisos de falta" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={subtab === item.id}
              onClick={() => {
                setSubtab(item.id);
                setStatusFilter("TODOS");
              }}
              className={`inline-flex min-h-8 items-center rounded-full px-3.5 py-1 text-xs transition-all ${
                subtab === item.id
                  ? "bg-slate-900/[0.08] font-semibold text-slate-900 ring-1 ring-slate-300/80"
                  : "font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <Button type="button" onClick={() => setModalOpen(true)}>
          {subtab === "vacaciones"
            ? "Solicitar vacaciones"
            : subtab === "horas"
              ? "Solicitar horas extra"
              : subtab === "compensaciones"
                ? "Solicitar compensación"
                : "Solicitar permiso"}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 py-1">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filtrar por estado"
          className="min-h-8 rounded-full border border-slate-200/90 bg-slate-100/70 px-3 py-1 text-xs font-medium text-slate-800"
        >
          <option value="TODOS">Todos los estados</option>
          <option value="PENDIENTE">Pendientes</option>
          <option value="AUTORIZADA">{subtab === "permisos" ? "Autorizados" : "Autorizadas"}</option>
          <option value="RECHAZADA">{subtab === "permisos" ? "Rechazados" : "Rechazadas"}</option>
        </select>
        <input
          type="month"
          value={periodFilter}
          onChange={(e) => setPeriodFilter(e.target.value)}
          aria-label="Filtrar por periodo"
          className="min-h-8 rounded-full border border-slate-200/90 bg-slate-100/70 px-3 py-1 text-xs font-medium text-slate-800"
        />
        {periodFilter ? (
          <button
            type="button"
            onClick={() => setPeriodFilter("")}
            className="text-xs font-medium text-slate-500 hover:text-slate-800"
          >
            Limpiar periodo
          </button>
        ) : null}
      </div>

      {/* Subtab 1: Vacaciones */}
      {subtab === "vacaciones" ? (
        <Card className="p-5">
          <h2 className="mb-4 text-base font-bold tracking-tight text-slate-900">Historial de vacaciones</h2>
          {filteredVacations.length === 0 ? (
            <Empty title="Sin solicitudes de vacaciones" body="No hay solicitudes registradas con estos filtros." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Fecha de solicitud</Th>
                  <Th>Periodo solicitado</Th>
                  <Th>Días</Th>
                  <Th>Estado</Th>
                  <Th>Quién solicitó</Th>
                  <Th>Quién resolvió</Th>
                  <Th>Fecha de resolución</Th>
                  {isCeo ? <Th>Acciones</Th> : null}
                </tr>
              </thead>
              <tbody>
                {filteredVacations.map((row) => (
                  <tr key={row.id}>
                    <Td>{row.createdAtIso}</Td>
                    <Td>
                      {row.startDate} a {row.endDate}
                      {row.comment ? <p className="text-xs text-slate-500">{row.comment}</p> : null}
                    </Td>
                    <Td>{row.days}</Td>
                    <Td>
                      <Badge
                        tone={
                          row.status === "AUTORIZADA"
                            ? "ok"
                            : row.status === "RECHAZADA"
                              ? "danger"
                              : "warn"
                        }
                      >
                        {row.status === "AUTORIZADA"
                          ? "Autorizada"
                          : row.status === "RECHAZADA"
                            ? "Rechazada"
                            : "Pendiente de autorización"}
                      </Badge>
                    </Td>
                    <Td>{row.requestedByName}</Td>
                    <Td>{row.decidedByName ?? "—"}</Td>
                    <Td>{row.decidedAtIso ?? "—"}</Td>
                    {isCeo ? (
                      <Td>
                        {row.status === "PENDIENTE" ? (
                          <form action={vacationDecisionAction} className="flex flex-wrap gap-1.5">
                            <input type="hidden" name="vacationId" value={row.id} />
                            <input type="hidden" name="collaboratorId" value={collaboratorId} />
                            <input type="hidden" name="version" value={row.version} />
                            <input type="hidden" name="tab" value="solicitudes" />
                            <input type="hidden" name="subtab" value="vacaciones" />
                            <Button type="submit" name="decision" value="si" tone="ghost" className="min-h-8 px-2.5 py-1 text-xs">
                              Autorizar
                            </Button>
                            <Button type="submit" name="decision" value="no" tone="ghost" className="min-h-8 px-2.5 py-1 text-xs">
                              Rechazar
                            </Button>
                          </form>
                        ) : (
                          "—"
                        )}
                      </Td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      ) : null}

      {/* Subtab 2: Horas extra */}
      {subtab === "horas" ? (
        <Card className="p-5">
          <h2 className="mb-4 text-base font-bold tracking-tight text-slate-900">Historial de horas extra</h2>
          {filteredOvertime.length === 0 ? (
            <Empty title="Sin solicitudes de horas extra" body="No hay solicitudes registradas con estos filtros." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Fecha trabajada</Th>
                  <Th>Horas solicitadas</Th>
                  <Th>Horas autorizadas</Th>
                  <Th>Motivo</Th>
                  <Th>Estado</Th>
                  <Th>Quién solicitó</Th>
                  <Th>Quién autorizó</Th>
                  {isCeo ? <Th>Acciones</Th> : null}
                </tr>
              </thead>
              <tbody>
                {filteredOvertime.map((row) => {
                  const isPending = row.status === "PENDIENTE_CEO" || row.status === "PENDIENTE_JEFE";
                  const isAuthorized = row.status === "AUTORIZADA" || row.status === "PAGADA";
                  return (
                    <tr key={row.id}>
                      <Td>{row.workDate}</Td>
                      <Td>{row.hours} h</Td>
                      <Td>{row.authorizedHours != null ? `${row.authorizedHours} h` : isAuthorized ? `${row.hours} h` : "—"}</Td>
                      <Td>{row.reason}</Td>
                      <Td>
                        <Badge tone={isAuthorized ? "ok" : row.status === "RECHAZADA" ? "danger" : "warn"}>
                          {isAuthorized ? "Autorizada" : row.status === "RECHAZADA" ? "Rechazada" : "Pendiente"}
                        </Badge>
                      </Td>
                      <Td>{row.requestedByName}</Td>
                      <Td>{row.authorizedByName ?? "—"}</Td>
                      {isCeo ? (
                        <Td>
                          {isPending ? (
                            <form action={collaboratorOvertimeDecisionAction} className="flex flex-wrap items-center gap-1.5">
                              <input type="hidden" name="overtimeId" value={row.id} />
                              <input type="hidden" name="collaboratorId" value={collaboratorId} />
                              <input type="hidden" name="version" value={row.version} />
                              <input type="hidden" name="tab" value="solicitudes" />
                              <input type="hidden" name="subtab" value="horas" />
                              <input
                                name="authorizedHours"
                                type="number"
                                step="0.5"
                                min="0.5"
                                defaultValue={row.hours}
                                aria-label="Horas autorizadas"
                                className="min-h-8 w-20 rounded-lg border border-slate-300 px-2 py-1 text-xs"
                              />
                              <Button type="submit" name="decision" value="si" tone="ghost" className="min-h-8 px-2.5 py-1 text-xs">
                                Autorizar
                              </Button>
                              <Button type="submit" name="decision" value="no" tone="ghost" className="min-h-8 px-2.5 py-1 text-xs">
                                Rechazar
                              </Button>
                            </form>
                          ) : (
                            "—"
                          )}
                        </Td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>
      ) : null}

      {/* Subtab 3: Compensaciones */}
      {subtab === "compensaciones" ? (
        <Card className="p-5">
          <h2 className="mb-4 text-base font-bold tracking-tight text-slate-900">Historial de compensaciones</h2>
          {filteredCompensations.length === 0 ? (
            <Empty title="Sin solicitudes de compensación" body="No hay solicitudes registradas con estos filtros." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Fecha</Th>
                  <Th>Concepto</Th>
                  <Th>Monto solicitado</Th>
                  <Th>Monto autorizado</Th>
                  <Th>Estado</Th>
                  <Th>Quién solicitó</Th>
                  <Th>Quién resolvió</Th>
                  {isCeo ? <Th>Acciones</Th> : null}
                </tr>
              </thead>
              <tbody>
                {filteredCompensations.map((row) => (
                  <tr key={row.id}>
                    <Td>{row.createdAtIso}</Td>
                    <Td>
                      {row.concept}
                      {row.comment ? <p className="text-xs text-slate-500">{row.comment}</p> : null}
                    </Td>
                    <Td>{money(row.requestedAmount)}</Td>
                    <Td>{row.authorizedAmount != null ? money(row.authorizedAmount) : "—"}</Td>
                    <Td>
                      <Badge
                        tone={
                          row.status === "AUTORIZADA"
                            ? "ok"
                            : row.status === "RECHAZADA"
                              ? "danger"
                              : "warn"
                        }
                      >
                        {row.status === "AUTORIZADA"
                          ? "Autorizada"
                          : row.status === "RECHAZADA"
                            ? "Rechazada"
                            : "Pendiente"}
                      </Badge>
                    </Td>
                    <Td>{row.requestedByName}</Td>
                    <Td>{row.decidedByName ?? "—"}</Td>
                    {isCeo ? (
                      <Td>
                        {row.status === "PENDIENTE" ? (
                          <form action={compensationDecisionAction} className="flex flex-wrap items-center gap-1.5">
                            <input type="hidden" name="compensationId" value={row.id} />
                            <input type="hidden" name="collaboratorId" value={collaboratorId} />
                            <input type="hidden" name="version" value={row.version} />
                            <input type="hidden" name="tab" value="solicitudes" />
                            <input type="hidden" name="subtab" value="compensaciones" />
                            <input
                              name="authorizedAmount"
                              type="number"
                              step="0.01"
                              min="0"
                              defaultValue={row.requestedAmount}
                              aria-label="Monto autorizado"
                              className="min-h-8 w-24 rounded-lg border border-slate-300 px-2 py-1 text-xs"
                            />
                            <Button type="submit" name="decision" value="si" tone="ghost" className="min-h-8 px-2.5 py-1 text-xs">
                              Autorizar
                            </Button>
                            <Button type="submit" name="decision" value="no" tone="ghost" className="min-h-8 px-2.5 py-1 text-xs">
                              Rechazar
                            </Button>
                          </form>
                        ) : (
                          "—"
                        )}
                      </Td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      ) : null}

      {/* Subtab 4: Permisos de falta */}
      {subtab === "permisos" ? (
        <Card className="p-5">
          <h2 className="mb-4 text-base font-bold tracking-tight text-slate-900">Historial de permisos de falta</h2>
          {filteredPermissions.length === 0 ? (
            <Empty title="Sin solicitudes de permiso" body="No hay solicitudes registradas con estos filtros." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Fecha o periodo solicitado</Th>
                  <Th>Motivo</Th>
                  <Th>Estado</Th>
                  <Th>Quién solicitó</Th>
                  <Th>Quién resolvió</Th>
                  {isCeo ? <Th>Acciones</Th> : null}
                </tr>
              </thead>
              <tbody>
                {filteredPermissions.map((row) => (
                  <tr key={row.id}>
                    <Td>
                      {row.startDate === row.endDate
                        ? row.startDate
                        : `${row.startDate} a ${row.endDate}`}
                    </Td>
                    <Td>
                      {row.reason}
                      {row.comment ? <p className="text-xs text-slate-500">{row.comment}</p> : null}
                    </Td>
                    <Td>
                      <Badge
                        tone={
                          row.status === "AUTORIZADO"
                            ? "ok"
                            : row.status === "RECHAZADO"
                              ? "danger"
                              : "warn"
                        }
                      >
                        {row.status === "AUTORIZADO"
                          ? "Autorizado"
                          : row.status === "RECHAZADO"
                            ? "Rechazado"
                            : "Pendiente de autorización"}
                      </Badge>
                    </Td>
                    <Td>{row.requestedByName}</Td>
                    <Td>{row.decidedByName ?? "—"}</Td>
                    {isCeo ? (
                      <Td>
                        {row.status === "PENDIENTE" ? (
                          <form action={leavePermissionDecisionAction} className="flex flex-wrap gap-1.5">
                            <input type="hidden" name="permissionId" value={row.id} />
                            <input type="hidden" name="collaboratorId" value={collaboratorId} />
                            <input type="hidden" name="version" value={row.version} />
                            <input type="hidden" name="tab" value="solicitudes" />
                            <input type="hidden" name="subtab" value="permisos" />
                            <Button type="submit" name="decision" value="si" tone="ghost" className="min-h-8 px-2.5 py-1 text-xs">
                              Autorizar
                            </Button>
                            <Button type="submit" name="decision" value="no" tone="ghost" className="min-h-8 px-2.5 py-1 text-xs">
                              Rechazar
                            </Button>
                          </form>
                        ) : (
                          "—"
                        )}
                      </Td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      ) : null}

      {/* Modal: Solicitar vacaciones */}
      <FormOverlayDialog
        open={modalOpen && subtab === "vacaciones"}
        onClose={() => setModalOpen(false)}
        title="Solicitar vacaciones"
        titleId="modal-solicitar-vacaciones"
      >
        <form action={vacationRequestAction} className="space-y-4">
          <input type="hidden" name="collaboratorId" value={collaboratorId} />
          <input type="hidden" name="tab" value="solicitudes" />
          <input type="hidden" name="subtab" value="vacaciones" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Fecha inicial">
              <input
                name="startDate"
                type="date"
                required
                value={vacStart}
                onChange={(e) => setVacStart(e.target.value)}
                className={controlClass}
              />
            </Field>
            <Field label="Fecha final">
              <input
                name="endDate"
                type="date"
                required
                value={vacEnd}
                onChange={(e) => setVacEnd(e.target.value)}
                className={controlClass}
              />
            </Field>
          </div>
          <Field label="Días de vacaciones (lunes a viernes)">
            <input
              type="number"
              readOnly
              value={vacDays}
              className={`${controlClass} bg-slate-50`}
            />
          </Field>
          <Field label="Comentario o motivo (opcional)">
            <input name="comment" className={controlClass} />
          </Field>
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <Button type="button" tone="ghost" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Solicitar vacaciones</Button>
          </div>
        </form>
      </FormOverlayDialog>

      {/* Modal: Solicitar horas extra */}
      <FormOverlayDialog
        open={modalOpen && subtab === "horas"}
        onClose={() => setModalOpen(false)}
        title="Solicitar horas extra"
        titleId="modal-solicitar-horas"
      >
        <form action={collaboratorOvertimeRequestAction} className="space-y-4">
          <input type="hidden" name="collaboratorId" value={collaboratorId} />
          <input type="hidden" name="tab" value="solicitudes" />
          <input type="hidden" name="subtab" value="horas" />
          <Field label="Fecha">
            <input name="workDate" type="date" required defaultValue={today} className={controlClass} />
          </Field>
          <Field
            label="Cantidad de horas"
            hint="El sistema clasifica las horas extra automáticamente según las reglas vigentes."
          >
            <input
              name="hours"
              type="number"
              min="0.5"
              step="0.5"
              required
              defaultValue="1"
              className={controlClass}
            />
          </Field>
          <Field label="Motivo">
            <input name="reason" required className={controlClass} />
          </Field>
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <Button type="button" tone="ghost" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Solicitar horas extra</Button>
          </div>
        </form>
      </FormOverlayDialog>

      {/* Modal: Solicitar compensación */}
      <FormOverlayDialog
        open={modalOpen && subtab === "compensaciones"}
        onClose={() => setModalOpen(false)}
        title="Solicitar compensación"
        titleId="modal-solicitar-compensacion"
      >
        <form action={compensationRequestAction} className="space-y-4">
          <input type="hidden" name="collaboratorId" value={collaboratorId} />
          <input type="hidden" name="tab" value="solicitudes" />
          <input type="hidden" name="subtab" value="compensaciones" />
          <Field label="Concepto o motivo">
            <input name="concept" required className={controlClass} />
          </Field>
          <Field label="Monto solicitado en pesos">
            <MoneyInput name="requestedAmount" min="0" defaultValue="0" />
          </Field>
          <Field label="Comentario (opcional)">
            <input name="comment" className={controlClass} />
          </Field>
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <Button type="button" tone="ghost" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Solicitar compensación</Button>
          </div>
        </form>
      </FormOverlayDialog>

      {/* Modal: Solicitar permiso */}
      <FormOverlayDialog
        open={modalOpen && subtab === "permisos"}
        onClose={() => setModalOpen(false)}
        title="Solicitar permiso"
        titleId="modal-solicitar-permiso"
      >
        <form action={leavePermissionRequestAction} className="space-y-4">
          <input type="hidden" name="collaboratorId" value={collaboratorId} />
          <input type="hidden" name="tab" value="solicitudes" />
          <input type="hidden" name="subtab" value="permisos" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Fecha inicial">
              <input name="startDate" type="date" required defaultValue={today} className={controlClass} />
            </Field>
            <Field label="Fecha final (cuando aplique)">
              <input name="endDate" type="date" defaultValue={today} className={controlClass} />
            </Field>
          </div>
          <Field label="Motivo">
            <input name="reason" required className={controlClass} />
          </Field>
          <Field label="Comentario (opcional)">
            <input name="comment" className={controlClass} />
          </Field>
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <Button type="button" tone="ghost" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Solicitar permiso</Button>
          </div>
        </form>
      </FormOverlayDialog>
    </div>
  );
}
