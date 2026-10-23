"use client";

import { useState } from "react";
import { createAttentionAction } from "@/app/(erp)/equipos/actions";
import { FormOverlayDialog } from "@/components/overlay-dialog";
import { ClientNameLink } from "@/components/client-entity-links";
import { Button, controlClass, Field } from "@/components/ui";
import { ATTENTION_LABEL, ATTENTION_TYPES, type AttentionType } from "@/lib/priorities";

type PriorityRow = { id: string; attentionType: string; name: string };

const primaryButtonClass =
  "inline-flex min-h-11 items-center justify-center rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2";

export function EquipmentAttentionLauncher({
  equipmentId,
  equipmentFolio,
  clientId,
  clientName,
  clientIsSystem = false,
  kind,
  version,
  priorities,
}: {
  equipmentId: string;
  equipmentFolio: string;
  clientId: string;
  clientName: string;
  clientIsSystem?: boolean;
  kind: "EQUI" | "MOT";
  version: number;
  priorities: PriorityRow[];
}) {
  const [open, setOpen] = useState(false);
  const [attentionType, setAttentionType] = useState<AttentionType | "">("");
  const [reportedFault, setReportedFault] = useState("");
  const priorityOptions = attentionType ? priorities.filter((row) => row.attentionType === attentionType) : [];
  const canSubmit = Boolean(attentionType && reportedFault.trim());

  return (
    <>
      <button type="button" className={primaryButtonClass} onClick={() => setOpen(true)}>
        Crear atención
      </button>
      <FormOverlayDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Crear atención"
        titleId="equipment-attention-overlay"
        wide
      >
        <form action={createAttentionAction} className="grid gap-4">
          <input type="hidden" name="equipmentId" value={equipmentId} />
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="version" value={version} />
          <dl className="grid gap-2 rounded-md border border-[var(--line)] bg-[#f7f8f9] p-3 text-sm">
            <div><dt className="text-[var(--muted)]">Equipo</dt><dd className="font-medium">{equipmentFolio}</dd></div>
            <div>
              <dt className="text-[var(--muted)]">Cliente</dt>
              <dd><ClientNameLink clientId={clientId} name={clientName} isSystem={clientIsSystem} /></dd>
            </div>
          </dl>
          <Field label="Falla reportada" hint="Describe el síntoma que reporta el cliente.">
            <textarea name="reportedFault" required rows={3} className={controlClass} value={reportedFault} onChange={(event) => setReportedFault(event.target.value)} />
          </Field>
          <Field label="Tipo de atención">
            <select
              name="attentionType"
              required
              className={controlClass}
              value={attentionType}
              onChange={(event) => setAttentionType(event.target.value as AttentionType | "")}
            >
              <option value="">Selecciona</option>
              {ATTENTION_TYPES.map((type) => (
                <option key={type} value={type}>{ATTENTION_LABEL[type]}</option>
              ))}
            </select>
          </Field>
          <Field label="Prioridad">
            <select name="priorityId" required className={controlClass} disabled={!attentionType}>
              <option value="">{attentionType ? "Selecciona" : "Elige el tipo primero"}</option>
              {priorityOptions.map((row) => (
                <option key={row.id} value={row.id}>{row.name}</option>
              ))}
            </select>
          </Field>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" tone="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={!canSubmit}>Crear atención</Button>
          </div>
        </form>
      </FormOverlayDialog>
    </>
  );
}
