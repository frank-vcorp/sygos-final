"use client";

import { useState } from "react";
import {
  attendanceIncidenceAction,
  attendanceJustificationDecisionAction,
  attendanceModeAction,
  manualEntryAction,
  manualExitAction,
} from "../actions";
import { FormOverlayDialog } from "@/components/overlay-dialog";
import { Badge, Button, Card, controlClass, Empty, Field, Table, Td, Th } from "@/components/ui";

type AttendanceRow = {
  id: string;
  workDate: string;
  entryTime: string | null;
  exitTime: string | null;
  status: string;
  justified: boolean;
  justificationStatus: string;
  note: string | null;
  version: number;
};

function incidenceTypeLabel(status: string): string {
  switch (status) {
    case "AUSENCIA":
      return "Falta";
    case "RETARDO":
      return "Retardo";
    case "PERMISO":
      return "Permiso";
    case "VACACIONES":
      return "Vacaciones";
    case "NORMAL":
    case "EN_JORNADA":
      return "Asistencia";
    default:
      return status;
  }
}

function incidenceStateBadge(row: AttendanceRow) {
  if (row.justificationStatus === "PENDIENTE_VALIDACION_CEO") {
    return <Badge tone="warn">Pendiente de validación del CEO</Badge>;
  }
  if (row.status === "AUSENCIA") {
    return row.justified ? <Badge tone="ok">Justificada</Badge> : <Badge tone="danger">No justificada</Badge>;
  }
  if (row.status === "RETARDO") {
    return row.justified ? <Badge tone="ok">Justificado</Badge> : <Badge tone="warn">No justificado</Badge>;
  }
  if (row.status === "PERMISO" || row.status === "VACACIONES") {
    return <Badge tone="ok">Justificada</Badge>;
  }
  return <Badge tone="ok">Normal</Badge>;
}

export function CollaboratorAsistenciaTab({
  collaboratorId,
  version,
  attendanceMode,
  isCeo,
  today,
  currentTime,
  rows,
}: {
  collaboratorId: string;
  version: number;
  attendanceMode: "AUTOMATICA" | "MANUAL";
  isCeo: boolean;
  today: string;
  currentTime: string;
  rows: AttendanceRow[];
}) {
  const [modal, setModal] = useState<null | "entrada" | "salida" | "falta" | "retardo">(null);
  const [exitDate, setExitDate] = useState(today);

  const visibleRows =
    attendanceMode === "AUTOMATICA"
      ? rows.filter((r) => r.status !== "NORMAL" && r.status !== "EN_JORNADA")
      : rows;

  const hasEntryForExitDate = rows.some((r) => r.workDate === exitDate && Boolean(r.entryTime));

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold tracking-tight text-slate-900">Modo de asistencia</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {attendanceMode === "AUTOMATICA"
                ? "Asistencia automática: se asume asistencia normal y solo se registran excepciones (faltas o retardos)."
                : "Asistencia manual: permite registrar entrada, salida, faltas y retardos de forma puntual."}
            </p>
          </div>
          <form action={attendanceModeAction} className="flex items-center gap-2">
            <input type="hidden" name="collaboratorId" value={collaboratorId} />
            <input type="hidden" name="version" value={version} />
            <input type="hidden" name="tab" value="asistencia" />
            <select
              name="attendanceMode"
              defaultValue={attendanceMode}
              className={controlClass}
              aria-label="Modo de asistencia"
            >
              <option value="AUTOMATICA">Asistencia automática</option>
              <option value="MANUAL">Asistencia manual</option>
            </select>
            <Button type="submit" tone="ghost">
              Guardar modo
            </Button>
          </form>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          {attendanceMode === "MANUAL" ? (
            <>
              <Button type="button" onClick={() => setModal("entrada")}>
                Registrar asistencia
              </Button>
              <Button
                type="button"
                tone="ghost"
                onClick={() => {
                  setExitDate(today);
                  setModal("salida");
                }}
              >
                Registrar salida
              </Button>
            </>
          ) : null}
          <Button type="button" tone="ghost" onClick={() => setModal("falta")}>
            Registrar falta
          </Button>
          <Button type="button" tone="ghost" onClick={() => setModal("retardo")}>
            Registrar retardo
          </Button>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-4 text-base font-bold tracking-tight text-slate-900">Historial de asistencia</h2>
        {visibleRows.length === 0 ? (
          <Empty
            title="Sin incidencias registradas"
            body={
              attendanceMode === "AUTOMATICA"
                ? "En modo automático no se generan filas repetitivas por día normal."
                : "Aún no hay registros de asistencia o incidencias para este colaborador."
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Fecha</Th>
                <Th>Entrada</Th>
                <Th>Salida</Th>
                <Th>Tipo de incidencia</Th>
                <Th>Estado</Th>
                {isCeo ? <Th>Acciones</Th> : null}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.id}>
                  <Td>{row.workDate}</Td>
                  <Td>{row.entryTime ?? "—"}</Td>
                  <Td>{row.exitTime ?? "—"}</Td>
                  <Td>
                    <div>
                      <span className="font-medium text-slate-900">{incidenceTypeLabel(row.status)}</span>
                      {row.note ? <p className="text-xs text-slate-500">{row.note}</p> : null}
                    </div>
                  </Td>
                  <Td>{incidenceStateBadge(row)}</Td>
                  {isCeo ? (
                    <Td>
                      {row.justificationStatus === "PENDIENTE_VALIDACION_CEO" ? (
                        <form action={attendanceJustificationDecisionAction} className="flex flex-wrap gap-1.5">
                          <input type="hidden" name="collaboratorId" value={collaboratorId} />
                          <input type="hidden" name="attendanceId" value={row.id} />
                          <input type="hidden" name="version" value={row.version} />
                          <input type="hidden" name="tab" value="asistencia" />
                          <Button type="submit" name="decision" value="si" tone="ghost" className="min-h-8 px-2.5 py-1 text-xs">
                            Validar ({row.status === "RETARDO" ? "Justificado" : "Justificada"})
                          </Button>
                          <Button type="submit" name="decision" value="no" tone="ghost" className="min-h-8 px-2.5 py-1 text-xs">
                            Rechazar ({row.status === "RETARDO" ? "No justificado" : "No justificada"})
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

      {/* Modal: Registrar asistencia (entrada) */}
      <FormOverlayDialog
        open={modal === "entrada"}
        onClose={() => setModal(null)}
        title="Registrar asistencia"
        titleId="modal-registrar-entrada"
      >
        <form action={manualEntryAction} className="space-y-4">
          <input type="hidden" name="collaboratorId" value={collaboratorId} />
          <input type="hidden" name="tab" value="asistencia" />
          <Field label="Fecha">
            <input name="workDate" type="date" required defaultValue={today} className={controlClass} />
          </Field>
          <Field label="Hora de entrada">
            <input name="entryTime" type="time" required defaultValue={currentTime} className={controlClass} />
          </Field>
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <Button type="button" tone="ghost" onClick={() => setModal(null)}>
              Cancelar
            </Button>
            <Button type="submit">Registrar entrada</Button>
          </div>
        </form>
      </FormOverlayDialog>

      {/* Modal: Registrar salida */}
      <FormOverlayDialog
        open={modal === "salida"}
        onClose={() => setModal(null)}
        title="Registrar salida"
        titleId="modal-registrar-salida"
      >
        <form action={manualExitAction} className="space-y-4">
          <input type="hidden" name="collaboratorId" value={collaboratorId} />
          <input type="hidden" name="tab" value="asistencia" />
          <Field label="Fecha">
            <input
              name="workDate"
              type="date"
              required
              value={exitDate}
              onChange={(e) => setExitDate(e.target.value)}
              className={controlClass}
            />
          </Field>
          <Field label="Hora de salida">
            <input name="exitTime" type="time" required defaultValue={currentTime} className={controlClass} />
          </Field>
          {!hasEntryForExitDate ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs font-medium text-amber-800">
              No existe una entrada previa registrada para el día {exitDate}. Primero debes registrar la entrada de la jornada antes de registrar la salida.
            </div>
          ) : null}
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <Button type="button" tone="ghost" onClick={() => setModal(null)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!hasEntryForExitDate}>
              Registrar salida
            </Button>
          </div>
        </form>
      </FormOverlayDialog>

      {/* Modal: Registrar falta */}
      <FormOverlayDialog
        open={modal === "falta"}
        onClose={() => setModal(null)}
        title="Registrar falta"
        titleId="modal-registrar-falta"
      >
        <form action={attendanceIncidenceAction} className="space-y-4">
          <input type="hidden" name="collaboratorId" value={collaboratorId} />
          <input type="hidden" name="kind" value="AUSENCIA" />
          <input type="hidden" name="tab" value="asistencia" />
          <Field label="Fecha">
            <input name="workDate" type="date" required defaultValue={today} className={controlClass} />
          </Field>
          <Field label="Motivo">
            <input name="reason" required placeholder="Describe el motivo de la falta" className={controlClass} />
          </Field>
          <Field label="Justificada">
            <select name="justified" defaultValue="no" className={controlClass}>
              <option value="no">No (queda registrada como no justificada)</option>
              <option value="si">Sí (pasa a validación del CEO)</option>
            </select>
          </Field>
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <Button type="button" tone="ghost" onClick={() => setModal(null)}>
              Cancelar
            </Button>
            <Button type="submit">Registrar falta</Button>
          </div>
        </form>
      </FormOverlayDialog>

      {/* Modal: Registrar retardo */}
      <FormOverlayDialog
        open={modal === "retardo"}
        onClose={() => setModal(null)}
        title="Registrar retardo"
        titleId="modal-registrar-retardo"
      >
        <form action={attendanceIncidenceAction} className="space-y-4">
          <input type="hidden" name="collaboratorId" value={collaboratorId} />
          <input type="hidden" name="kind" value="RETARDO" />
          <input type="hidden" name="tab" value="asistencia" />
          <Field label="Fecha">
            <input name="workDate" type="date" required defaultValue={today} className={controlClass} />
          </Field>
          <Field label="Motivo">
            <input name="reason" required placeholder="Describe el motivo del retardo" className={controlClass} />
          </Field>
          <Field label="Justificado">
            <select name="justified" defaultValue="no" className={controlClass}>
              <option value="no">No (queda registrado como no justificado)</option>
              <option value="si">Sí (pasa a validación del CEO)</option>
            </select>
          </Field>
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <Button type="button" tone="ghost" onClick={() => setModal(null)}>
              Cancelar
            </Button>
            <Button type="submit">Registrar retardo</Button>
          </div>
        </form>
      </FormOverlayDialog>
    </div>
  );
}
